"""Text extraction from various input formats."""
import io
import os
import tempfile
from typing import Optional

import requests
import urllib3
from bs4 import BeautifulSoup

# Suppress certificate verification warning when calling requests.get with verify=False
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from config import get_settings

try:
    import pytesseract
except ImportError:  # pragma: no cover - optional dependency
    pytesseract = None

# Prefer configured tesseract path, falling back to common Windows path if present.
if pytesseract is not None:
    settings = get_settings()
    if getattr(settings, "TESSERACT_CMD", None):
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
    elif os.path.exists(r"C:\Program Files\Tesseract-OCR\tesseract.exe"):
        pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def extract_from_text(content: bytes, encoding: str = "utf-8") -> str:
    return content.decode(encoding, errors="replace")


def extract_from_pdf(content: bytes) -> str:
    """PDF extraction using PyMuPDF (fitz).
    Each page is checked for a real text layer; pages with one are
    extracted directly, pages without one (scans/photos) are rendered
    to an image and OCR'd. Handles text-only, scanned-only, and mixed PDFs."""
    import fitz  # PyMuPDF
    from PIL import Image

    MIN_CHARS_PER_PAGE = 20  # below this, treat the page as "no real text"

    doc = fitz.open(stream=content, filetype="pdf")
    text_parts = []

    for page in doc:
        page_text = page.get_text().strip()

        if len(page_text) >= MIN_CHARS_PER_PAGE:
            text_parts.append(page_text)
        else:
            # 1. Use Matrix Zoom (compatible with all PyMuPDF versions) to scale up page image for high-quality OCR
            zoom = 2  # 2x zoom factor
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            
            # 2. Convert to bytes and open with Pillow
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            ocr_text = pytesseract.image_to_string(img, lang="eng+tam+sin") if pytesseract else ""
            text_parts.append(ocr_text.strip())

    doc.close()
    return "\n\n".join(text_parts)


def detect_pdf_type(content: bytes) -> str:
    """Analyze PDF to determine its type: text_only, text_image, or image_only."""
    import fitz  # PyMuPDF
    
    MIN_CHARS_PER_PAGE = 20  # Threshold for considering a page as having text
    
    doc = fitz.open(stream=content, filetype="pdf")
    text_page_count = 0
    image_page_count = 0
    
    for page in doc:
        page_text = page.get_text().strip()
        if len(page_text) >= MIN_CHARS_PER_PAGE:
            text_page_count += 1
        else:
            image_page_count += 1
    
    doc.close()
    
    total_pages = text_page_count + image_page_count
    if total_pages == 0:
        return "text_only"  # Default to text_only if no pages
    
    # Determine type based on page composition
    if image_page_count == 0:
        return "text_only"  # All pages have text
    elif text_page_count == 0:
        return "image_only"  # All pages are images (scanned)
    else:
        return "text_image"  # Mixed: both text and image pages


def extract_from_image(content: bytes) -> str:
    """OCR using Tesseract (supports English, Tamil, and Sinhala)."""
    from PIL import Image

    if pytesseract is None:
        raise RuntimeError(
            "pytesseract is required for OCR. Install it with `pip install pytesseract`, "
            "and install the Tesseract runtime per README instructions."
        )

    settings = get_settings()
    if getattr(settings, "TESSERACT_CMD", None):
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
    elif os.path.exists(r"C:\Program Files\Tesseract-OCR\tesseract.exe"):
        pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

    img = Image.open(io.BytesIO(content))
    try:
        return pytesseract.image_to_string(img, lang="eng+tam+sin")
    except pytesseract.pytesseract.TesseractNotFoundError as exc:
        raise RuntimeError(
            "Tesseract OCR executable not found. Install Tesseract and add it to PATH, "
            "or set TESSERACT_CMD in backend/.env to the full tesseract executable path."
        ) from exc
    except Exception as exc:
        raise RuntimeError(f"OCR extraction failed: {exc}") from exc


def extract_from_url(url: str, timeout: int = 20) -> str:
    """Scrape visible text from a webpage."""
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    try:
        resp = requests.get(url, headers=headers, timeout=timeout, verify=False)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()

        text = soup.get_text(separator="\n", strip=True)
        if not text.strip():
            raise ValueError("No readable text found on that page.")
        return text
    except requests.exceptions.Timeout:
        raise ValueError(f"Request to {url} timed out. The site may be slow or blocking requests.")
    except requests.exceptions.RequestException as e:
        raise ValueError(f"Could not fetch the page: {e}")


_whisper_model = None

def _get_whisper():
    """Lazy-load faster-whisper model based on settings."""
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel

        size = get_settings().WHISPER_MODEL
        # CPU-only by default; users with GPU can switch device="cuda"
        _whisper_model = WhisperModel(size, device="cpu", compute_type="int8")
    return _whisper_model


def extract_from_audio(content: bytes) -> str:
    """Speech-to-Text via faster-whisper. Requires ffmpeg on PATH."""
    model = _get_whisper()
    with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        segments, _info = model.transcribe(tmp_path, beam_size=1)
        return "\n".join(seg.text.strip() for seg in segments).strip()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _pdf_is_mostly_text(content: bytes, min_chars_per_page: int = 20, text_ratio_threshold: float = 0.5) -> bool:
    """Check whether a PDF has a usable text layer on most pages."""
    import fitz  # PyMuPDF

    doc = fitz.open(stream=content, filetype="pdf")
    total_pages = len(doc)
    if total_pages == 0:
        doc.close()
        return False

    text_pages = sum(
        1 for page in doc
        if len(page.get_text().strip()) >= min_chars_per_page
    )
    doc.close()
    return (text_pages / total_pages) >= text_ratio_threshold


def extract(file_type: str, content: Optional[bytes] = None, url: Optional[str] = None, filename: Optional[str] = None) -> str:
    file_type = file_type.lower()

    # Image tab + actual .pdf file → only allow scanned/image PDFs here.
    # Text-based PDFs are rejected and pointed to the PDF tab instead.
    if file_type == "image" and filename and filename.lower().endswith(".pdf"):
        if _pdf_is_mostly_text(content):
            raise ValueError(
                "This PDF contains extractable text, not just images. "
                "Please upload it using the PDF tab instead."
            )
        file_type = "pdf"

    if file_type == "text":
        return extract_from_text(content)
    if file_type == "pdf":
        return extract_from_pdf(content)
    if file_type == "image":
        return extract_from_image(content)
    if file_type == "audio":
        return extract_from_audio(content)
    if file_type == "url":
        return extract_from_url(url)
    raise ValueError(f"Unsupported file_type: {file_type}")