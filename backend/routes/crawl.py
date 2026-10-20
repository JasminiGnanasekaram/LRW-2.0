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
from services import cleaning, nlp
from services.crawler_service import crawl_site, discover_available_pages
from utils.security import get_current_user

from typing import Optional

router = APIRouter(prefix="/crawl", tags=["crawl"])
# ── Request / Response schemas ────────────────────────────────────────
class CrawlRequest(BaseModel):
    url: str
    max_pages: int = 10  # default 10, hard-capped at 50 in the handler
    document_id: Optional[str] = None


class PageResult(BaseModel):
    url:     str
    text:    str
    summary: str = ""
    doc_id:  str


class CrawlResponse(BaseModel):
    total: int
    pages: list[PageResult]


class DiscoverResponse(BaseModel):
    total_available: int
    domain: str
    has_sitemap: bool = False


# ── GET /crawl/discover ───────────────────────────────────────────────
@router.get("/discover", response_model=DiscoverResponse)
async def discover_pages_endpoint(
    url: str,
    document_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """
    Rapidly scans the website at *url* to discover the total number of
    pages available under this domain (via sitemaps and internal links).
    """
    if not url or not url.strip():
        raise HTTPException(status_code=400, detail="URL is required.")

    result = await run_in_threadpool(discover_available_pages, url.strip())

    if document_id:
        try:
            await raw_documents_col.update_one(
                {"_id": ObjectId(document_id)},
                {"$set": {"total_available_pages": result["total_available"]}}
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

    if not 1 <= req.max_pages <= 50:
        raise HTTPException(
            status_code=400, detail="max_pages must be between 1 and 50."
        )

    # Run blocking BFS crawler in a threadpool so we don't block the event loop
    pages = await run_in_threadpool(crawl_site, req.url, req.max_pages)
    if not pages:
        raise HTTPException(
            status_code=404,
            detail=(
                "No pages could be crawled. "
                "The URL may be unreachable, returning errors, or blocked by robots.txt."
            ),
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
    for page in pages:
        doc_id, page_summary = await _save_page_as_document(
            page["url"], page["text"], user["id"], parent_id=target_parent_id
        )
        results.append(
            PageResult(url=page["url"], text=page["text"], summary=page_summary, doc_id=doc_id)
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