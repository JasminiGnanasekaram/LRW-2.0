"""Text extraction from various input formats."""
import io
import logging
import os
import re
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

logger = logging.getLogger(__name__)

# Prefer configured tesseract path, falling back to common Windows path if present.
if pytesseract is not None:
    settings = get_settings()
    if getattr(settings, "TESSERACT_CMD", None):
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
    elif os.path.exists(r"C:\Program Files\Tesseract-OCR\tesseract.exe"):
        pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def _get_ocr_languages() -> str:
    """Return the installed Tesseract language packs in preferred order."""
    preferred = ["eng", "tam", "sin"]
    if pytesseract is None:
        logger.warning("pytesseract is not installed; falling back to English OCR only.")
        return "eng"

    try:
        languages = pytesseract.get_languages()
        installed = set()
        if isinstance(languages, dict):
            for value in languages.values():
                if isinstance(value, (list, tuple, set)):
                    installed.update(str(item).lower() for item in value)
        elif isinstance(languages, (list, tuple, set)):
            installed.update(str(item).lower() for item in languages)
    except Exception as exc:  # pragma: no cover - depends on system Tesseract install
        logger.warning("Unable to detect installed Tesseract languages, falling back to English OCR: %s", exc)
        return "eng"

    available = [lang for lang in preferred if lang in installed]
    if not available:
        logger.warning(
            "No preferred OCR languages detected (%s). Falling back to English OCR.",
            ", ".join(preferred),
        )
        return "eng"
    return "+".join(available)


def _has_readable_pdf_text(page_text: str) -> bool:
    """Return True when the extracted PDF text still looks like real text rather than OCR noise."""
    if not page_text:
        return False
    cleaned = re.sub(r"\s+", " ", page_text).strip()
    if len(cleaned) < 3:
        return False
    letters = sum(
        1
        for ch in cleaned
        if ch.isalpha() or ch.isdigit() or bool(re.search(r"[\u0B80-\u0BFF\u0D80-\u0DFF]", ch))
    )
    return letters >= 3 and (letters / len(cleaned)) >= 0.35


def extract_from_text(content: bytes, encoding: str = "utf-8") -> str:
    return content.decode(encoding, errors="replace")


def extract_from_pdf(content: bytes) -> str:
    """Extract text from text, scanned, or mixed PDFs while preferring the original PDF wording."""
    import pdfplumber

    MIN_CHARS_PER_PAGE = 20
    text_parts = []

    try:
        with pdfplumber.open(io.BytesIO(content)) as doc:
            for page in doc.pages:
                page_text = (page.extract_text(layout=True) or "").strip()
                if not _has_readable_pdf_text(page_text) and len(page_text) < MIN_CHARS_PER_PAGE and pytesseract is not None:
                    try:
                        image = page.to_image(resolution=250).original
                        ocr_text = pytesseract.image_to_string(
                            image,
                            lang=_get_ocr_languages(),
                            config="--psm 6",
                        ).strip()
                        if ocr_text:
                            page_text = ocr_text
                    except Exception as exc:
                        logger.warning("OCR failed on a PDF page: %s", exc)
                        page_text = page_text or ""
                text_parts.append(page_text)
    except Exception as exc:
        raise ValueError(f"Unable to read PDF content: {exc}") from exc

    return "\n\n".join(text_parts)


def detect_pdf_type(content: bytes) -> str:
    """Analyze PDF to determine its type: text_only, text_image, or image_only."""
    import pdfplumber
    
    MIN_CHARS_PER_PAGE = 20  # Threshold for considering a page as having text
    
    text_page_count = 0
    image_page_count = 0
    
    with pdfplumber.open(io.BytesIO(content)) as doc:
        for page in doc.pages:
            page_text = (page.extract_text() or "").strip()
            if len(page_text) >= MIN_CHARS_PER_PAGE:
                text_page_count += 1
            else:
                image_page_count += 1
    
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
        return pytesseract.image_to_string(img, lang=_get_ocr_languages())
    except pytesseract.pytesseract.TesseractNotFoundError as exc:
        raise RuntimeError(
            "Tesseract OCR executable not found. Install Tesseract and add it to PATH, "
            "or set TESSERACT_CMD in backend/.env to the full tesseract executable path."
        ) from exc
    except Exception as exc:
        raise RuntimeError(f"OCR extraction failed: {exc}") from exc


def extract_from_url(url: str, timeout: int = 15) -> str:
    """Scrape visible text from a webpage."""
    headers = {"User-Agent": "Mozilla/5.0 (LRW Bot)"}
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text(separator="\n", strip=True)


_whisper_model = None


def _get_whisper():
    """Lazy-load faster-whisper model based on settings."""
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel

        size = get_settings().WHISPER_MODEL
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
    import pdfplumber

    with pdfplumber.open(io.BytesIO(content)) as doc:
        total_pages = len(doc.pages)
        if total_pages == 0:
            return False
        text_pages = sum(
            1 for page in doc.pages
            if len((page.extract_text() or "").strip()) >= min_chars_per_page
        )
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