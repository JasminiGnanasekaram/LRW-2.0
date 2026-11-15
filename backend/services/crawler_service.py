"""BFS web crawler service.

Discovers and extracts text from multiple pages of a website,
respecting robots.txt and staying within the same domain.
"""

import gzip
import html as html_lib
import logging
import re
import time
import urllib3
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse, unquote, parse_qsl, urlencode
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

try:
    import trafilatura
    _TRAFILATURA_AVAILABLE = True
except ImportError:
    _TRAFILATURA_AVAILABLE = False

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger("uvicorn.error")

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,ta;q=0.8,si;q=0.7",
}

def _get_session() -> requests.Session:
    session = requests.Session()
    retries = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retries, pool_connections=20, pool_maxsize=20)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session

_HTTP_SESSION = _get_session()

# ── Domain Normalization & Asset Filters ──────────────────────────────
_EXCLUDED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico", ".bmp", ".tiff",
    ".css", ".js", ".mjs", ".json", ".xml", ".rss", ".atom",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".zip", ".tar", ".gz", ".rar", ".7z",
    ".mp3", ".wav", ".ogg", ".mp4", ".webm", ".avi", ".mov", ".mkv",
    ".woff", ".woff2", ".ttf", ".eot",
}

def _clean_domain(netloc: str) -> str:
    """Normalize any domain or URL string by stripping scheme, path, port, and leading 'www.'."""
    if not netloc:
        return ""
    u = str(netloc).strip()
    if "://" not in u and not u.startswith("//"):
        u = "https://" + u
    try:
        parsed = urlparse(u)
        host = parsed.netloc or parsed.path.split("/")[0]
        d = host.lower().split(":")[0].strip()
        if d.startswith("www."):
            d = d[4:]
        return d
    except Exception:
        return ""

def _is_same_domain(base_url: str, target_url: str) -> bool:
    """Check if target_url belongs to the same core domain as base_url."""
    d1 = _clean_domain(base_url)
    d2 = _clean_domain(target_url)
    if not d1 or not d2:
        return False
    if d1 == d2:
        return True
    if d1.endswith("." + d2) or d2.endswith("." + d1):
        return True
    return False

def _normalize_page_url(raw_url: str, base_url: str = "") -> str:
    """Normalize URL by stripping hash, tracking query parameters, trailing slashes, and matching schemes."""
    if not raw_url:
        return ""
    u = str(raw_url).strip().split("#")[0].strip()
    if not u.startswith(("http://", "https://")):
        u = "https://" + u
    try:
        parsed = urlparse(u)
        base_parsed = urlparse(base_url if base_url.startswith(("http://", "https://")) else f"https://{base_url}") if base_url else parsed

        scheme = base_parsed.scheme or "https"
        netloc = parsed.netloc.lower()
        clean_base = _clean_domain(base_parsed.netloc)
        clean_target = _clean_domain(netloc)
        if clean_base and clean_base == clean_target:
            netloc = base_parsed.netloc.lower()

        path = parsed.path
        if len(path) > 1:
            path = path.rstrip("/")
        if not path:
            path = "/"

        # Strip tracking query params
        if parsed.query:
            q_pairs = parse_qsl(parsed.query, keep_blank_values=True)
            filtered_q = [(k, v) for k, v in q_pairs if not k.lower().startswith(("utm_", "fbclid", "gclid", "ref", "source"))]
            query = f"?{urlencode(filtered_q)}" if filtered_q else ""
        else:
            query = ""

        normalized = f"{scheme}://{netloc}{path}{query}"
        return normalized.rstrip("/") if len(path) > 1 or query else normalized
    except Exception:
        return u.split("#")[0].rstrip("/")

def _is_valid_page_url(url: str, base_url: str) -> bool:
    """Verify that url is http/https, on same domain, and not an image/asset/feed."""
    try:
        if not url:
            return False
        u = str(url).strip()
        if "://" not in u and not u.startswith("//"):
            u = "https://" + u
        parsed = urlparse(u)
        if parsed.scheme not in ("http", "https"):
            return False
        if not _is_same_domain(base_url, u):
            return False
        path_lower = parsed.path.lower()
        for ext in _EXCLUDED_EXTENSIONS:
            if path_lower.endswith(ext):
                return False
        return True
    except Exception:
        return False

# ── robots.txt Parser Cache ───────────────────────────────────────────
_ROBOT_PARSERS: dict[str, RobotFileParser | None] = {}

def _get_robot_parser(origin: str) -> RobotFileParser | None:
    if origin in _ROBOT_PARSERS:
        return _ROBOT_PARSERS[origin]
    try:
        rp = RobotFileParser()
        rp.set_url(f"{origin}/robots.txt")
        rp.read()
        _ROBOT_PARSERS[origin] = rp
        return rp
    except Exception:
        _ROBOT_PARSERS[origin] = None
        return None

def _can_fetch(url: str) -> bool:
    """Return True if robots.txt permits crawling this URL."""
    try:
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        rp = _get_robot_parser(origin)
        if rp is not None:
            return rp.can_fetch("*", url)
        return True
    except Exception:
        return True

# ── Fetch raw HTML ────────────────────────────────────────────────────
def _fetch_html(url: str, timeout: int = 15) -> str | None:
    for attempt in range(2):
        try:
            resp = _HTTP_SESSION.get(url, headers=_HEADERS, timeout=timeout, verify=False)
            if resp.status_code == 200:
                return resp.text
            elif resp.status_code in (404, 410):
                return None
        except Exception as exc:
            if attempt == 0:
                time.sleep(0.5)
            else:
                logger.warning(f"[Crawler] Failed to fetch {url}: {exc}")
    return None

# ── Extract readable text ─────────────────────────────────────────────
def _extract_text(html: str) -> str:
    """
    Extract clean readable text from HTML.
    Uses trafilatura when available, falls back to BeautifulSoup tag-stripping.
    """
    if _TRAFILATURA_AVAILABLE:
        try:
            text = trafilatura.extract(html, include_links=False, include_images=False)
            if text and text.strip():
                return text.strip()
        except Exception:
            pass

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()
    return soup.get_text(separator="\n", strip=True)

# ── Extract page title ────────────────────────────────────────────────
def extract_page_title(html: str, fallback_url: str = "") -> str:
    """Extract page title from HTML <title> tag, or first <h1>, or fallback."""
    if not html:
        return fallback_url
    try:
        soup = BeautifulSoup(html, "html.parser")
        if soup.title and soup.title.string:
            t = soup.title.string.strip()
            if t:
                return t
        h1 = soup.find("h1")
        if h1:
            t = h1.get_text(separator=" ", strip=True)
            if t:
                return t
    except Exception:
        pass
    try:
        parsed = urlparse(fallback_url)
        path = parsed.path.strip("/").split("/")[-1]
        if path:
            return path.replace("-", " ").replace("_", " ").capitalize()
    except Exception:
        pass
    return fallback_url


def derive_title_from_url(url: str) -> str:
    """Generate a clean, readable title from URL slug or path, decoding unicode characters."""
    try:
        parsed = urlparse(url)
        decoded_path = unquote(parsed.path).strip("/")
        if not decoded_path:
            return f"{_clean_domain(parsed.netloc)} (Home)"
        
        segments = [s for s in decoded_path.split("/") if s]
        last_seg = segments[-1]
        
        for ext in [".html", ".htm", ".php", ".asp", ".aspx"]:
            if last_seg.lower().endswith(ext):
                last_seg = last_seg[:-len(ext)]
                
        last_seg = re.sub(r"-\d{5,}$", "", last_seg)
        cleaned = re.sub(r"[-_]+", " ", last_seg).strip()
        if cleaned and not cleaned.isdigit():
            if any(ord(c) > 127 for c in cleaned):
                return cleaned[:100]
            return cleaned[:90].title()
        
        if len(segments) > 1:
            prev = re.sub(r"[-_]+", " ", segments[-2]).strip()
            if prev:
                prev_text = prev if any(ord(c) > 127 for c in prev) else prev.title()
                return f"{prev_text} #{last_seg}"
                
        return decoded_path[:80]
    except Exception:
        return url


# ── Discover links ────────────────────────────────────────────────────
def _extract_links(html: str, base_url: str) -> list[str]:
    """Return all clean, same-domain page URLs found in <a href> tags, strictly preserving document order."""
    if not html:
        return []
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    ordered_links: list[str] = []
    clean_base = _normalize_page_url(base_url, base_url)
    if clean_base:
        seen.add(clean_base)

    for tag in soup.find_all("a", href=True):
        raw_href = tag.get("href", "").strip()
        if not raw_href or raw_href.startswith(("javascript:", "mailto:", "tel:", "#")):
            continue
        absolute = urljoin(base_url, raw_href)
        clean = _normalize_page_url(absolute, base_url)
        if not clean or clean in seen:
            continue
        if _is_same_domain(base_url, clean) and _is_valid_page_url(clean, base_url):
            seen.add(clean)
            ordered_links.append(clean)
    return ordered_links


# ── Public BFS crawler ────────────────────────────────────────────────
def crawl_site(start_url: str, max_pages: int = 10, seed_urls: list[str] | None = None) -> list[dict]:
    """
    BFS crawl starting from *start_url* strictly maintaining original link order.
    - Page 1 is always start_url.
    - Follows the exact document order of links on the main URL and discovered pages.
    - If seed_urls is provided, crawls pages strictly following their sequential page numbers.
    - Crawls exactly up to *max_pages* pages.
    """
    start_url = start_url.strip()
    if not start_url.startswith(("http://", "https://")):
        start_url = "https://" + start_url

    clean_start = _normalize_page_url(start_url, start_url)
    domain = _clean_domain(start_url)
    visited: set[str] = set()

    # Build queue strictly preserving exact sequential order
    queue: list[str] = []
    seen_in_queue: set[str] = set()

    candidate_list = seed_urls or (_DISCOVERY_CACHE.get(domain, {}).get("discovered_pages") if domain in _DISCOVERY_CACHE else None)
    if candidate_list:
        for s in candidate_list:
            clean_s = _normalize_page_url(s, start_url)
            if clean_s and clean_s not in seen_in_queue and _is_same_domain(start_url, clean_s) and _is_valid_page_url(clean_s, start_url):
                seen_in_queue.add(clean_s)
                queue.append(clean_s)

    if clean_start not in seen_in_queue:
        queue.insert(0, clean_start)
        seen_in_queue.add(clean_start)
    elif queue and queue[0] != clean_start:
        queue.remove(clean_start)
        queue.insert(0, clean_start)

    results: list[dict] = []

    while queue and len(results) < max_pages:
        url = queue.pop(0)

        if url in visited:
            continue
        visited.add(url)

        if not _can_fetch(url):
            logger.info(f"[Crawler] Blocked by robots.txt — skipping: {url}")
            continue

        html = _fetch_html(url)
        if html is None:
            continue

        text = _extract_text(html)
        if not text or not text.strip():
            continue

        title = extract_page_title(html, fallback_url=url)

        page_num = len(results) + 1
        if candidate_list:
            clean_target = _normalize_page_url(url, start_url)
            for s_idx, s_url in enumerate(candidate_list):
                if _normalize_page_url(s_url, start_url) == clean_target:
                    page_num = s_idx + 1
                    break

        results.append({
            "url": url,
            "text": text,
            "title": title,
            "page_number": page_num,
        })
        logger.info(f"[Crawler] (Page #{page_num} -> {len(results)}/{max_pages}) Crawled: {url}")

        links = _extract_links(html, url)
        for link in links:
            if link not in visited and link not in seen_in_queue and _is_same_domain(start_url, link) and _is_valid_page_url(link, start_url):
                seen_in_queue.add(link)
                queue.append(link)

    logger.info(f"[Crawler] Finished. Total pages crawled: {len(results)}")
    return results


# ── Sitemap helper ────────────────────────────────────────────────────
def _extract_sitemap_locs(text: str) -> list[str]:
    """Extract and sanitize all <loc> values from sitemap XML, handling CDATA, whitespace, and HTML entities."""
    if not text:
        return []
    raw_locs = re.findall(r"<loc\b[^>]*>(.*?)</loc>", text, re.IGNORECASE | re.DOTALL)
    cleaned_locs = []
    for raw in raw_locs:
        clean = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", raw, flags=re.DOTALL)
        clean = html_lib.unescape(clean.strip())
        clean = "".join(clean.split())
        if clean.startswith(("http://", "https://")):
            cleaned_locs.append(clean)
    return cleaned_locs


def _fetch_sitemap_text(url: str, timeout: int = 15) -> str | None:
    """Fetch sitemap XML, auto-decompressing gzip if needed, with retry."""
    for attempt in range(2):
        try:
            resp = _HTTP_SESSION.get(url, headers=_HEADERS, timeout=timeout, verify=False)
            if resp.status_code == 200:
                content = resp.content
                if content[:2] == b'\x1f\x8b':
                    return gzip.decompress(content).decode("utf-8", errors="ignore")
                return resp.text
            elif resp.status_code in (404, 410):
                return None
        except Exception as exc:
            if attempt == 0:
                time.sleep(0.5)
            else:
                logger.debug(f"[Crawler] Sitemap fetch failed for {url}: {exc}")
    return None


# ── Accurate Discovery of Total Available Pages ───────────────────────
_DISCOVERY_CACHE: dict[str, dict] = {}

def discover_available_pages(start_url: str, force_refresh: bool = False) -> dict:
    """
    Scans the website to discover all available pages under the domain, strictly
    preserving the original order of links from the main website URL:
    - Page 1 is ALWAYS the main URL itself.
    - Page 2, Page 3, ... are the links on the main page in exact HTML document order.
    - Subpages are expanded via deterministic BFS in link order.
    - Sitemaps (if present) contribute any unlinked pages appended at the end.
    - Assigns sequential 1-based page numbers matching the link order.
    """
    start_url = start_url.strip()
    if not start_url.startswith(("http://", "https://")):
        start_url = "https://" + start_url

    clean_start = _normalize_page_url(start_url, start_url)
    parsed = urlparse(clean_start)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    domain = _clean_domain(parsed.netloc) or parsed.netloc.lower()

    if not force_refresh and domain in _DISCOVERY_CACHE:
        logger.info(f"[Crawler Discovery] Cache hit for domain '{domain}' ({_DISCOVERY_CACHE[domain]['total_available']} pages)")
        return _DISCOVERY_CACHE[domain]

    ordered_pages: list[str] = [clean_start]
    seen: set[str] = {clean_start}

    # 1. Fetch the main URL and extract links in exact HTML document order
    logger.info(f"[Crawler Discovery] Fetching main URL for ordered discovery: {clean_start}")
    main_html = _fetch_html(clean_start, timeout=12)
    main_links: list[str] = []
    if main_html:
        main_links = _extract_links(main_html, clean_start)
        for link in main_links:
            if link not in seen:
                seen.add(link)
                ordered_pages.append(link)

    # 2. BFS crawl internal links starting from the main page's links
    crawl_queue: list[str] = list(main_links)
    crawled_in_discovery: set[str] = {clean_start}

    while crawl_queue and len(crawled_in_discovery) < 50:
        batch = [u for u in crawl_queue if u not in crawled_in_discovery][:6]
        if not batch:
            break
        for b in batch:
            crawled_in_discovery.add(b)
            if b in crawl_queue:
                crawl_queue.remove(b)

        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_url = {executor.submit(_fetch_html, b_url, 10): b_url for b_url in batch}
            # Process in strict batch order to keep discovery deterministic and ordered
            for b_url in batch:
                fut = [f for f, u in future_to_url.items() if u == b_url][0]
                try:
                    html = fut.result()
                    if html:
                        found_links = _extract_links(html, b_url)
                        for fl in found_links:
                            if fl not in seen:
                                seen.add(fl)
                                ordered_pages.append(fl)
                                crawl_queue.append(fl)
                except Exception:
                    pass

    # 3. Augment with sitemaps (if any), appending unlinked pages to the end
    sitemap_candidates: list[str] = [
        f"{origin}/sitemap.xml",
        f"{origin}/sitemap_index.xml",
        f"{origin}/wp-sitemap.xml",
        f"{origin}/sitemap-index.xml",
    ]
    has_sitemap = False

    try:
        r_txt = _fetch_html(f"{origin}/robots.txt", timeout=6)
        if r_txt:
            for line in r_txt.splitlines():
                if line.lower().startswith("sitemap:"):
                    sm_url = line.split(":", 1)[1].strip()
                    if sm_url.startswith("http") and sm_url not in sitemap_candidates:
                        sitemap_candidates.append(sm_url)
    except Exception:
        pass

    sitemaps_to_crawl: list[str] = list(dict.fromkeys(sitemap_candidates))
    processed_sitemaps: set[str] = set()

    while sitemaps_to_crawl and len(processed_sitemaps) < 100:
        current_batch = [sm for sm in sitemaps_to_crawl if sm not in processed_sitemaps][:5]
        if not current_batch:
            break
        for sm in current_batch:
            processed_sitemaps.add(sm)
            sitemaps_to_crawl.remove(sm)

        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_url = {executor.submit(_fetch_sitemap_text, sm_url, 12): sm_url for sm_url in current_batch}
            for sm_url in current_batch:
                fut = [f for f, u in future_to_url.items() if u == sm_url][0]
                try:
                    text = fut.result()
                    if not text or "<loc" not in text.lower():
                        continue
                    has_sitemap = True
                    locs = _extract_sitemap_locs(text)
                    for loc in locs:
                        clean_loc = _normalize_page_url(loc, start_url)
                        if not clean_loc or not _is_same_domain(start_url, clean_loc):
                            continue
                        loc_lower = clean_loc.lower()
                        if (
                            loc_lower.endswith(".xml")
                            or loc_lower.endswith(".xml.gz")
                            or "sitemap" in loc_lower
                        ):
                            if clean_loc not in processed_sitemaps and clean_loc not in sitemaps_to_crawl:
                                sitemaps_to_crawl.append(clean_loc)
                        elif _is_valid_page_url(clean_loc, start_url):
                            if clean_loc not in seen:
                                seen.add(clean_loc)
                                ordered_pages.append(clean_loc)
                except Exception as exc:
                    logger.debug(f"[Crawler Discovery] Error processing sitemap batch: {exc}")

    total = len(ordered_pages)
    logger.info(f"[Crawler Discovery] Total discoverable pages for {start_url}: {total} (main_page_links={len(main_links)}, has_sitemap={has_sitemap})")

    discovered_items = [
        {
            "page_number": idx + 1,
            "url": p_url,
            "title": derive_title_from_url(p_url),
        }
        for idx, p_url in enumerate(ordered_pages)
    ]

    result = {
        "total_available": total,
        "domain": domain or parsed.netloc,
        "has_sitemap": has_sitemap,
        "discovered_pages": ordered_pages,
        "discovered_items": discovered_items,
    }

    _DISCOVERY_CACHE[domain] = result
    return result
