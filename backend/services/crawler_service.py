"""BFS web crawler service.

Discovers and extracts text from multiple pages of a website,
respecting robots.txt and staying within the same domain.
"""

import logging
import urllib3
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import re
import requests
from bs4 import BeautifulSoup

try:
    import trafilatura
    _TRAFILATURA_AVAILABLE = True
except ImportError:
    _TRAFILATURA_AVAILABLE = False

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger("uvicorn.error")

from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

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
    adapter = HTTPAdapter(max_retries=retries)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session

_HTTP_SESSION = _get_session()


# ── robots.txt ────────────────────────────────────────────────────────
def _can_fetch(url: str) -> bool:
    """Return True if robots.txt permits crawling this URL."""
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = RobotFileParser()
    rp.set_url(robots_url)
    try:
        rp.read()
        return rp.can_fetch("*", url)
    except Exception:
        return True  # allow if robots.txt is unreachable


# ── Same-domain guard ─────────────────────────────────────────────────
def _is_same_domain(base_url: str, target_url: str) -> bool:
    return urlparse(base_url).netloc == urlparse(target_url).netloc


# ── Fetch raw HTML ────────────────────────────────────────────────────
def _fetch_html(url: str, timeout: int = 15) -> str | None:
    try:
        resp = _HTTP_SESSION.get(url, headers=_HEADERS, timeout=timeout, verify=False)
        resp.raise_for_status()
        return resp.text
    except Exception as exc:
        logger.warning(f"[Crawler] Failed to fetch {url}: {exc}")
        return None


# ── Extract readable text ─────────────────────────────────────────────
def _extract_text(html: str) -> str:
    """
    Extract clean readable text from HTML.
    Uses trafilatura when available (better article extraction),
    falls back to BeautifulSoup tag-stripping (mirrors existing extraction.py logic).
    """
    if _TRAFILATURA_AVAILABLE:
        try:
            text = trafilatura.extract(html, include_links=False, include_images=False)
            if text and text.strip():
                return text.strip()
        except Exception:
            pass

    # BeautifulSoup fallback — same approach as services/extraction.py
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()
    return soup.get_text(separator="\n", strip=True)


# ── Discover links ────────────────────────────────────────────────────
def _extract_links(html: str, base_url: str) -> list[str]:
    """Return all absolute, same-scheme URLs found in <a href> tags."""
    soup = BeautifulSoup(html, "html.parser")
    links: set[str] = set()
    for tag in soup.find_all("a", href=True):
        absolute = urljoin(base_url, tag["href"])
        clean = absolute.split("#")[0].split("?")[0]  # strip fragment & query
        if clean.startswith("http"):
            links.add(clean)
    return list(links)


# ── Public BFS crawler ────────────────────────────────────────────────
def crawl_site(start_url: str, max_pages: int = 10) -> list[dict]:
    """
    BFS crawl starting from *start_url*.

    Rules:
    - Stays within the same domain as *start_url*.
    - Respects robots.txt on every page.
    - Stops after visiting *max_pages* pages.

    Returns:
        List of dicts: [{"url": str, "text": str}, ...]
    """
    start_url = start_url.strip()
    if not start_url.startswith(("http://", "https://")):
        start_url = "https://" + start_url

    visited: set[str] = set()
    queue: list[str] = [start_url]
    results: list[dict] = []

    while queue and len(visited) < max_pages:
        url = queue.pop(0)

        if url in visited:
            continue

        if not _can_fetch(url):
            logger.info(f"[Crawler] Blocked by robots.txt — skipping: {url}")
            continue

        html = _fetch_html(url)
        if html is None:
            continue

        visited.add(url)
        logger.info(f"[Crawler] ({len(visited)}/{max_pages}) Crawled: {url}")

        text = _extract_text(html)
        links = _extract_links(html, url)

        results.append({"url": url, "text": text})

        for link in links:
            if link not in visited and _is_same_domain(start_url, link):
                queue.append(link)

    logger.info(f"[Crawler] Finished. Total pages crawled: {len(results)}")
    return results


# ── Rapid Discovery of Total Available Pages ─────────────────────────
def discover_available_pages(start_url: str, max_discovery: int = 1000) -> dict:
    """
    Rapidly scans the website to estimate the total number of pages available.
    Combines:
    1. Sitemap discovery (sitemap.xml, robots.txt)
    2. Internal link discovery on the target page and its immediate child links
    Returns a dict with total_available count, domain, and metadata.
    """
    start_url = start_url.strip()
    if not start_url.startswith(("http://", "https://")):
        start_url = "https://" + start_url

    parsed = urlparse(start_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    domain = parsed.netloc

    discovered: set[str] = set()
    clean_start = start_url.split("#")[0].rstrip("/")
    discovered.add(clean_start)
    has_sitemap = False

    # 1. Check sitemaps
    for s_url in [f"{origin}/sitemap.xml", f"{origin}/sitemap_index.xml", f"{origin}/robots.txt"]:
        try:
            r = _HTTP_SESSION.get(s_url, headers=_HEADERS, timeout=6, verify=False)
            if r.status_code == 200:
                if "sitemap" in s_url and "<loc>" in r.text:
                    has_sitemap = True
                    for loc in re.findall(r"<loc>(.*?)</loc>", r.text):
                        loc_clean = loc.strip().split("#")[0].rstrip("/")
                        if urlparse(loc_clean).netloc == domain:
                            discovered.add(loc_clean)
                            if len(discovered) >= max_discovery:
                                break
                elif "robots.txt" in s_url:
                    for line in r.text.splitlines():
                        if line.lower().startswith("sitemap:"):
                            sm_url = line.split(":", 1)[1].strip()
                            try:
                                sm_r = _HTTP_SESSION.get(sm_url, headers=_HEADERS, timeout=6, verify=False)
                                if sm_r.status_code == 200 and "<loc>" in sm_r.text:
                                    has_sitemap = True
                                    for loc in re.findall(r"<loc>(.*?)</loc>", sm_r.text):
                                        loc_clean = loc.strip().split("#")[0].rstrip("/")
                                        if urlparse(loc_clean).netloc == domain:
                                            discovered.add(loc_clean)
                                            if len(discovered) >= max_discovery:
                                                break
                            except Exception:
                                pass
        except Exception:
            pass
        if len(discovered) >= max_discovery:
            break

    # 2. Extract internal links from target HTML
    try:
        r = _HTTP_SESSION.get(start_url, headers=_HEADERS, timeout=8, verify=False)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            for tag in soup.find_all("a", href=True):
                abs_url = urljoin(start_url, tag["href"])
                clean_url = abs_url.split("#")[0].split("?")[0].rstrip("/")
                if clean_url.startswith("http") and urlparse(clean_url).netloc == domain:
                    discovered.add(clean_url)
                    if len(discovered) >= max_discovery:
                        break
    except Exception:
        pass

    return {
        "total_available": max(1, len(discovered)),
        "domain": domain,
        "has_sitemap": has_sitemap,
    }