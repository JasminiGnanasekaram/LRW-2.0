"""Crawl route — POST /crawl
Accepts a starting URL + max_pages limit.
Runs the BFS crawler, saves every discovered page as a document
(same DB pipeline as /documents/upload), and returns results.
"""
from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from database import (
    cleaned_documents_col,
    document_metadata_col,
    nlp_analysis_col,
    raw_documents_col,
    sources_col,
)
from urllib.parse import urlparse
from services import cleaning, nlp
from services.crawler_service import (
    crawl_site,
    discover_available_pages,
    extract_page_title,
    _fetch_html,
    _extract_text,
    _is_same_domain,
    _is_valid_page_url,
    _can_fetch,
    _clean_domain,
)
from utils.security import get_current_user

from typing import Optional

router = APIRouter(prefix="/crawl", tags=["crawl"])
# ── Request / Response schemas ────────────────────────────────────────
class CrawlRequest(BaseModel):
    url: str
    max_pages: int = 10
    document_id: Optional[str] = None


class PageResult(BaseModel):
    url:     str
    text:    str
    summary: str = ""
    doc_id:      str
    page_number: Optional[int] = None
    title:       Optional[str] = None


class CrawlResponse(BaseModel):
    total: int
    pages: list[PageResult]


class DiscoveredPageItem(BaseModel):
    page_number: int
    url: str
    title: str = ""


class DiscoverResponse(BaseModel):
    total_available: int
    domain: str
    has_sitemap: bool = False
    discovered_pages: list[str] = []
    discovered_items: list[DiscoveredPageItem] = []


class CrawlSpecificRequest(BaseModel):
    base_url: str
    mode: str = "selected"  # "selected", "page_number", or "url"
    page_number: Optional[int] = None
    page_url: Optional[str] = None
    document_id: Optional[str] = None


class CrawlSpecificResponse(BaseModel):
    page_title: str
    page_number: Optional[int] = None
    page_url: str
    summary: str
    doc_id: str
    text: str
    raw_text: str
    cleaned_text: str


# ── GET /crawl/discover ───────────────────────────────────────────────
@router.get("/discover", response_model=DiscoverResponse)
async def discover_pages_endpoint(
    url: str,
    document_id: Optional[str] = None,
    force_refresh: bool = False,
    user: dict = Depends(get_current_user),
):
    """
    Rapidly scans the website at *url* to discover the total number of
    pages available under this domain (via sitemaps and internal links).
    Returns consistent, deterministic count and page listings.
    """
    if not url or not url.strip():
        raise HTTPException(status_code=400, detail="URL is required.")

    clean_u = url.strip()
    target_domain = _clean_domain(clean_u)

    # Check MongoDB if document already has discovery results saved
    if document_id and not force_refresh:
        try:
            doc = await raw_documents_col.find_one({"_id": ObjectId(document_id)})
            if doc and doc.get("discovered_order_version") == 2 and (doc.get("discovered_pages") or doc.get("discovered_items")):
                doc_url = doc.get("filename") or ""
                doc_domain = _clean_domain(doc_url)
                if not doc_domain or doc_domain == target_domain:
                    pages = doc.get("discovered_pages") or []
                    items = doc.get("discovered_items") or []
                    if not items and pages:
                        from services.crawler_service import derive_title_from_url
                        items = [
                            {"page_number": idx + 1, "url": p, "title": derive_title_from_url(p)}
                            for idx, p in enumerate(pages)
                        ]
                    if not pages and items:
                        pages = [it.get("url") for it in items if isinstance(it, dict) and it.get("url")]

                    total_count = len(items) if items else (len(pages) or doc.get("total_available_pages", 0))
                    return DiscoverResponse(
                        total_available=total_count,
                        domain=target_domain,
                        has_sitemap=bool(doc.get("has_sitemap", True)),
                        discovered_pages=pages,
                        discovered_items=items,
                    )
        except Exception:
            pass

    from services.crawler_service import _DISCOVERY_CACHE
    if not force_refresh and target_domain and target_domain in _DISCOVERY_CACHE:
        cached = _DISCOVERY_CACHE[target_domain]
        cached_items = cached.get("discovered_items") or []
        cached_count = len(cached_items) if cached_items else cached.get("total_available", 0)
        cached["total_available"] = cached_count
        if document_id:
            try:
                await raw_documents_col.update_one(
                    {"_id": ObjectId(document_id)},
                    {"$set": {
                        "total_available_pages": cached_count,
                        "discovered_pages": cached.get("discovered_pages", []),
                        "discovered_items": cached_items,
                        "has_sitemap": cached.get("has_sitemap", False),
                        "discovered_order_version": 2,
                    }}
                )
            except Exception:
                pass

        return DiscoverResponse(**cached)

    result = await run_in_threadpool(discover_available_pages, clean_u, force_refresh)
    discovered_items_res = result.get("discovered_items", [])
    exact_count = len(discovered_items_res) if discovered_items_res else result.get("total_available", 0)
    result["total_available"] = exact_count

    if document_id:
        try:
            await raw_documents_col.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": {
                    "total_available_pages": exact_count,
                    "discovered_pages": result.get("discovered_pages", []),
                    "discovered_items": discovered_items_res,
                    "has_sitemap": result.get("has_sitemap", False),
                    "discovered_order_version": 2,
                }}
            )
        except Exception:
            pass

    return DiscoverResponse(**result)


# ── DB helper: save one crawled page as a subpage document ────────────
async def _save_page_as_document(
    page_url: str,
    raw_text: str,
    user_id: str,
    parent_id: Optional[str] = None,
    title: Optional[str] = None,
    page_number: Optional[int] = None,
) -> tuple[str, str]:
    """
    Runs the pipeline for a crawled subpage and links it to parent_id.
    Returns (raw_document_id, summary).
    """
    # 1. Source
    src = await sources_col.insert_one({
        "user_id":    ObjectId(user_id),
        "type":       "url",
        "name":       page_url,
        "created_at": datetime.utcnow(),
    })

    # 2. Raw document (cap inline storage at 500 KB to stay well under 16 MB BSON limit)
    raw_res = await raw_documents_col.insert_one({
        "user_id":            ObjectId(user_id),
        "source_id":          src.inserted_id,
        "filename":           page_url,
        "title":              title or page_url,
        "page_number":        page_number,
        "file_type":          "url",
        "raw_text":           raw_text[:500_000],
        "is_crawled_subpage": True,
        "parent_document_id": ObjectId(parent_id) if parent_id else None,
        "created_at":         datetime.utcnow(),
    })

    # 3. Clean
    cleaned_text = cleaning.clean(raw_text) or raw_text
    cl_res = await cleaned_documents_col.insert_one({
        "user_id":         ObjectId(user_id),
        "raw_document_id": raw_res.inserted_id,
        "text":            cleaned_text,
        "created_at":      datetime.utcnow(),
    })

    # 4. Metadata — tag it as crawler-sourced so it's easy to filter later
    await document_metadata_col.insert_one({
        "raw_document_id": raw_res.inserted_id,
        "data": {
            "source":      "crawler",
            "crawled_url": page_url,
            "title":       title or page_url,
            "page_number": page_number,
        },
        "created_at": datetime.utcnow(),
    })

    # 5. NLP — run on first 10 000 chars to keep it fast
    try:
        analysis_data = nlp.analyze(cleaned_text[:10_000])
        await nlp_analysis_col.insert_one({
            "cleaned_document_id": cl_res.inserted_id,
            "data":                analysis_data,
            "created_at":          datetime.utcnow(),
        })
    except Exception as exc:
        import logging
        logging.getLogger("uvicorn.error").warning(
            f"[Crawl] NLP failed for {page_url}: {exc}"
        )

    # 6. Summary — generate concise summary using AI summarizer with local fallback
    summary = ""
    try:
        from routes.summarize import summarize
        summary = summarize(cleaned_text[:5000])
    except Exception:
        try:
            from services.summarizer import get_text_summary
            summary = get_text_summary(cleaned_text)
        except Exception:
            summary = cleaned_text[:300] if cleaned_text else ""

    if summary:
        await raw_documents_col.update_one(
            {"_id": raw_res.inserted_id},
            {"$set": {"summary": summary}}
        )

    return str(raw_res.inserted_id), summary


# ── POST /crawl ───────────────────────────────────────────────────────
@router.post("", response_model=CrawlResponse)
async def start_crawl(
    req:  CrawlRequest,
    user: dict = Depends(get_current_user),
):
    """
    Crawl a website starting at *req.url*.
    - Discovers links within the same domain via BFS.
    - Respects robots.txt on every page.
    - Saves each crawled page as a document (visible in /documents).
    - Returns extracted text + summary + doc_id for every page.
    """

    if req.max_pages < 1:
        raise HTTPException(
            status_code=400, detail="Number of pages to crawl must be at least 1."
        )

    # Resolve parent document ID to attach crawled pages to
    target_parent_id = req.document_id
    if not target_parent_id:
        try:
            root_doc = await raw_documents_col.find_one({
                "user_id": ObjectId(user["id"]),
                "filename": req.url,
                "is_crawled_subpage": {"$ne": True},
            })
            if root_doc:
                target_parent_id = str(root_doc["_id"])
        except Exception:
            target_parent_id = None

    # Validate that requested pages do not exceed total available pages
    if target_parent_id:
        try:
            parent_doc = await raw_documents_col.find_one({"_id": ObjectId(target_parent_id)})
            if parent_doc and parent_doc.get("total_available_pages"):
                total_avail = int(parent_doc["total_available_pages"])
                if req.max_pages > total_avail:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Requested pages ({req.max_pages}) exceeds total available pages ({total_avail}) on this website."
                    )
        except HTTPException:
            raise
        except Exception:
            pass

    seed_urls = None
    if target_parent_id:
        try:
            p_doc = await raw_documents_col.find_one({"_id": ObjectId(target_parent_id)})
            if p_doc and p_doc.get("discovered_order_version") == 2 and p_doc.get("discovered_pages"):
                seed_urls = p_doc["discovered_pages"]
            else:
                disc = await run_in_threadpool(discover_available_pages, req.url)
                seed_urls = disc.get("discovered_pages")
                await raw_documents_col.update_one(
                    {"_id": ObjectId(target_parent_id)},
                    {"$set": {
                        "total_available_pages": len(disc.get("discovered_pages", [])),
                        "discovered_pages": disc.get("discovered_pages", []),
                        "discovered_items": disc.get("discovered_items", []),
                        "discovered_order_version": 2,
                    }}
                )
        except Exception:
            seed_urls = None

    # Run blocking BFS crawler in a threadpool so we don't block the event loop
    pages = await run_in_threadpool(crawl_site, req.url, req.max_pages, seed_urls)
    if not pages:
        raise HTTPException(
            status_code=404,
            detail=(
                "No pages could be crawled. "
                "The URL may be unreachable, returning errors, or blocked by robots.txt."
            ),
        )

    # If re-crawling for a parent document, delete any previous crawled subpages
    # so that old results never linger or duplicate in the database.
    if target_parent_id:
        try:
            old_subpages = await raw_documents_col.find({
                "parent_document_id": ObjectId(target_parent_id),
                "is_crawled_subpage": True,
            }).to_list(None)
            for old_sub in old_subpages:
                old_raw_id = old_sub["_id"]
                cleaned_docs = await cleaned_documents_col.find({"raw_document_id": old_raw_id}).to_list(None)
                for cl in cleaned_docs:
                    await nlp_analysis_col.delete_many({"cleaned_document_id": cl["_id"]})
                await cleaned_documents_col.delete_many({"raw_document_id": old_raw_id})
                await document_metadata_col.delete_many({"raw_document_id": old_raw_id})
                if old_sub.get("source_id"):
                    await sources_col.delete_one({"_id": old_sub["source_id"]})
            await raw_documents_col.delete_many({
                "parent_document_id": ObjectId(target_parent_id),
                "is_crawled_subpage": True,
            })
        except Exception as exc:
            import logging
            logging.getLogger("uvicorn.error").warning(
                f"[Crawl] Failed to clean up previous crawled subpages for parent {target_parent_id}: {exc}"
            )

    # Save each page and build the response
    results: list[PageResult] = []
    for idx, page in enumerate(pages):
        page_num = page.get("page_number") or (idx + 1)
        doc_id, page_summary = await _save_page_as_document(
            page["url"], page["text"], user["id"], parent_id=target_parent_id,
            title=page.get("title"), page_number=page_num
        )
        results.append(
            PageResult(url=page["url"], text=page["text"], summary=page_summary, doc_id=doc_id, page_number=page_num, title=page.get("title") or page["url"])
        )

    # Persist the newly crawled pages array on the parent document (overwriting previous crawl results)
    if target_parent_id:
        try:
            fresh_list = [r.model_dump() for r in results]
            await raw_documents_col.update_one(
                {"_id": ObjectId(target_parent_id)},
                {"$set": {"crawled_pages": fresh_list}}
            )
        except Exception as exc:
            import logging
            logging.getLogger("uvicorn.error").warning(
                f"[Crawl] Failed to update crawled_pages on document {target_parent_id}: {exc}"
            )

    return CrawlResponse(total=len(results), pages=results)


# ── POST /crawl/specific ──────────────────────────────────────────────
@router.post("/specific", response_model=CrawlSpecificResponse)
async def crawl_specific_page_endpoint(
    req: CrawlSpecificRequest,
    user: dict = Depends(get_current_user),
):
    """
    Crawls a single specific page by either:
    1. page_number (1-based index from discovered pages)
    2. direct page_url (within the website's domain)
    Extracts text, generates multilingual AI summary, performs cleaning & NLP,
    stores the subpage document, and returns page title, URL, summary, and doc_id.
    """
    base_url = req.base_url.strip()
    if not base_url.startswith(("http://", "https://")):
        base_url = "https://" + base_url

    # Resolve parent document
    target_parent_id = req.document_id
    parent_doc = None
    if target_parent_id:
        try:
            parent_doc = await raw_documents_col.find_one({"_id": ObjectId(target_parent_id)})
        except Exception:
            parent_doc = None

    if not parent_doc:
        parent_doc = await raw_documents_col.find_one({
            "user_id": ObjectId(user["id"]),
            "filename": base_url,
            "is_crawled_subpage": {"$ne": True},
        })
        if parent_doc:
            target_parent_id = str(parent_doc["_id"])

    # Determine target URL and target page number
    target_url = ""
    target_page_number: Optional[int] = None

    if req.page_url and req.page_url.strip():
        raw_url = req.page_url.strip()
        if not raw_url.startswith(("http://", "https://")):
            raw_url = "https://" + raw_url
        target_url = raw_url.split("#")[0]
        target_page_number = req.page_number

        if not _is_same_domain(base_url, target_url):
            core_domain = _clean_domain(base_url)
            raise HTTPException(
                status_code=400,
                detail=f"The selected URL must belong to this website domain ({core_domain})."
            )

        if not _is_valid_page_url(target_url, base_url):
            raise HTTPException(
                status_code=400,
                detail="The selected URL points to an excluded media file, asset, or invalid page."
            )

        if target_page_number is None:
            discovered_pages = (parent_doc.get("discovered_pages") if (parent_doc and parent_doc.get("discovered_order_version") == 2) else None) or []
            clean_target = target_url.rstrip("/")
            for idx, p in enumerate(discovered_pages):
                if p.rstrip("/") == clean_target:
                    target_page_number = idx + 1
                    break

    elif req.mode in ("page_number", "selected") and req.page_number is not None:
        if req.page_number < 1:
            raise HTTPException(status_code=400, detail="Page number must be at least 1.")

        discovered_pages = (parent_doc.get("discovered_pages") if (parent_doc and parent_doc.get("discovered_order_version") == 2) else None) or []
        if not discovered_pages:
            discovery_res = await run_in_threadpool(discover_available_pages, base_url)
            discovered_pages = discovery_res.get("discovered_pages") or []
            if target_parent_id and discovered_pages:
                try:
                    await raw_documents_col.update_one(
                        {"_id": ObjectId(target_parent_id)},
                        {"$set": {
                            "total_available_pages": len(discovered_pages),
                            "discovered_pages": discovered_pages,
                            "discovered_order_version": 2,
                        }}
                    )
                except Exception:
                    pass

        total_pages = len(discovered_pages)
        if total_pages == 0:
            raise HTTPException(
                status_code=400,
                detail="No discoverable pages found for this website."
            )

        if req.page_number > total_pages:
            raise HTTPException(
                status_code=400,
                detail=f"Selected page number ({req.page_number}) exceeds total available pages ({total_pages})."
            )

        target_url = discovered_pages[req.page_number - 1]
        target_page_number = req.page_number

    else:
        raise HTTPException(status_code=400, detail="Please select a valid page to crawl.")

    # Robots.txt check: log warning if disallowed, but proceed with user's specific request
    if not _can_fetch(target_url):
        import logging
        logging.getLogger("uvicorn.error").warning(
            f"[Crawler Specific] robots.txt disallows {target_url}, proceeding with user request."
        )

    # Fetch page HTML with 20s timeout
    html = await run_in_threadpool(_fetch_html, target_url, 20)
    if not html:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch content from {target_url}. The site may be slow, unreachable, or blocking requests."
        )

    # Extract title and readable text
    title = extract_page_title(html, fallback_url=target_url)
    raw_text = _extract_text(html)
    if not raw_text or not raw_text.strip():
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "svg"]):
                tag.decompose()
            fallback_text = soup.get_text(separator="\n", strip=True)
            if fallback_text and len(fallback_text) > 10:
                raw_text = fallback_text
        except Exception:
            pass

    if not raw_text or not raw_text.strip():
        raise HTTPException(
            status_code=400,
            detail="No readable text content could be extracted from this page."
        )

    # Save as subpage document (runs cleaning, NLP, and multilingual AI summary)
    doc_id, summary = await _save_page_as_document(
        target_url,
        raw_text,
        user["id"],
        parent_id=target_parent_id,
        title=title,
        page_number=target_page_number,
    )

    cleaned_doc = await cleaned_documents_col.find_one({"raw_document_id": ObjectId(doc_id)})
    cleaned_text = cleaned_doc.get("text", "") if cleaned_doc else raw_text

    specific_result = {
        "page_title": title,
        "page_number": target_page_number,
        "page_url": target_url,
        "summary": summary,
        "doc_id": doc_id,
        "text": raw_text[:2000],
        "raw_text": raw_text,
        "cleaned_text": cleaned_text,
    }

    # Persist specific page crawl on parent document so results survive tab changes and refreshes
    if target_parent_id:
        try:
            await raw_documents_col.update_one(
                {"_id": ObjectId(target_parent_id)},
                {"$set": {"specific_page_crawl": specific_result}}
            )
        except Exception:
            pass

    return CrawlSpecificResponse(**specific_result)
