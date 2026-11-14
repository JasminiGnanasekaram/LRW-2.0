"""Extract text from documents, images, web pages, and audio."""

import io
import os
import re
import tempfile
from typing import Optional
from urllib.parse import urlsplit

import requests
from bs4 import BeautifulSoup

from config import get_settings

try:
    import pytesseract
except ImportError:
    pytesseract = None

try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        fitz = None


PDF_MIN_CHARS = 20
OCR_LANGUAGES = "eng+tam+sin"
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".wma", ".webm"}

_whisper_model = None


def _resolve_tesseract_cmd() -> Optional[str]:
    import shutil
    cmd = getattr(get_settings(), "TESSERACT_CMD", None)
    if cmd and os.path.isfile(cmd):
        return cmd

    candidates = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Tesseract-OCR\tesseract.exe"),
    ]
    for c in candidates:
        if c and os.path.isfile(c):
            return c

    which_cmd = shutil.which("tesseract") or shutil.which("tesseract.exe")
    if which_cmd:
        return which_cmd

    return cmd


def _ocr_image(image) -> str:
    if pytesseract is None:
        raise RuntimeError(
            "OCR requires pytesseract and the Tesseract executable. "
            "Install them before processing scanned documents or images."
        )

    cmd = _resolve_tesseract_cmd()
    if cmd and os.path.isfile(cmd):
        pytesseract.pytesseract.tesseract_cmd = cmd
        tessdata = os.path.join(os.path.dirname(cmd), "tessdata")
        if os.path.isdir(tessdata) and "TESSDATA_PREFIX" not in os.environ:
            os.environ["TESSDATA_PREFIX"] = tessdata




    try:
        return pytesseract.image_to_string(image, lang=OCR_LANGUAGES).strip()
    except pytesseract.pytesseract.TesseractNotFoundError as exc:
        raise RuntimeError(
            "Tesseract executable not found. Install it at the configured absolute path, "
            "or set TESSERACT_CMD in backend/.env to the full executable path."
        ) from exc
    except Exception as exc:
        err_str = str(exc).lower()
        if "data" in err_str or "language" in err_str or "tam" in err_str or "sin" in err_str:
            try:
                return pytesseract.image_to_string(image, lang="eng").strip()
            except Exception:
                pass
        raise RuntimeError(f"OCR extraction failed: {exc}") from exc



# --- Legacy (non-Unicode) Tamil font support -------------------------------
_TAMIL_RE = re.compile(r"[\u0B80-\u0BFF]")
_LEGACY_WORD_RE = re.compile(r"[A-Za-z][;>,<][A-Za-z]")


def _looks_legacy_encoded(text: str) -> bool:
    """True if text looks like Tamil typed in an old font (e.g. Bamini):
    lots of Latin words with ; > , < inside them and no real Tamil letters."""
    words = text.split()
    if len(words) < 5:
        return False
    if len(_TAMIL_RE.findall(text)) > len(text) * 0.1:
        return False  # already real Unicode Tamil
    weird = sum(1 for w in words if _LEGACY_WORD_RE.search(w))
    return weird / len(words) > 0.2


def _legacy_to_unicode(text: str) -> str:
    """Convert Bamini-style legacy Tamil to Unicode. Returns "" if it fails."""
    try:
        from tamil.txt2unicode import bamini2unicode
    except ImportError:
        return ""
    try:
        converted = bamini2unicode(text)
    except Exception:
        return ""
    # Accept only if the result really contains a good amount of Tamil
    if len(_TAMIL_RE.findall(converted)) >= max(10, len(text) * 0.3):
        return converted
    return ""


# --- Scanned pages that only carry a small text stamp ----------------------
# Digital-library PDFs (e.g. Noolaham) put a tiny "noolaham.org | aavanaham.org"
# text stamp on pages whose real content is a scanned picture. That stamp must
# not make the page count as "has text", otherwise OCR is skipped.
_STAMP_RE = re.compile(r"noolaham|aavanaham|noolagam|digitized by|www\.\S+|https?://\S+", re.I)
MIN_REAL_CHARS = 80        # fewer real characters than this -> page is a scan
SCAN_IMAGE_COVERAGE = 0.5  # a picture covering this much of the page ...
SCAN_MAX_TEXT = 400        # ... with little text on it -> page is a scan


def _real_text(page) -> str:
    """Page text with stamp / watermark / link lines removed."""
    lines = [ln for ln in page.get_text().splitlines() if ln.strip() and not _STAMP_RE.search(ln)]
    return "\n".join(lines).strip()


def _image_coverage(page) -> float:
    """Fraction of the page covered by pictures (0.0 - 1.0)."""
    import fitz  # PyMuPDF
    try:
        page_area = abs(page.rect.width * page.rect.height) or 1.0
        covered = 0.0
        for info in page.get_image_info():
            r = page.rect & fitz.Rect(info["bbox"])
            covered += abs(r.width * r.height)
        return min(covered / page_area, 1.0)
    except Exception:
        return 0.0


def _page_is_scan(page, real_text: str) -> bool:
    if len(real_text) < MIN_REAL_CHARS:
        return True
    return _image_coverage(page) >= SCAN_IMAGE_COVERAGE and len(real_text) < SCAN_MAX_TEXT


def extract_from_text(content: bytes, encoding: str = "utf-8") -> str:
    return content.decode(encoding, errors="replace")


def extract_from_pdf(content: bytes) -> str:
    """Read PDF text layers and OCR pages without enough extractable text."""
    import fitz
    from PIL import Image

    MIN_CHARS_PER_PAGE = 20  # below this, treat the page as "no real text"

    doc = fitz.open(stream=content, filetype="pdf")
    text_parts = []

    for page in doc:
        page_text = _real_text(page)

        # Scanned page (possibly with a small stamp): read it with OCR
        if _page_is_scan(page, page_text):
            page_text = ""
        elif _looks_legacy_encoded(page_text):
            # Non-Unicode Tamil font: convert, or OCR the page if conversion fails
            converted = _legacy_to_unicode(page_text)
            if converted:
                text_parts.append(converted.strip())
                continue
            page_text = ""

        if page_text:
            text_parts.append(page_text)
        else:
            zoom = 2  # 2x zoom for better OCR quality
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
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
        page_text = _real_text(page)
        if not _page_is_scan(page, page_text):
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
    """Recognize English, Tamil, and Sinhala text in an image."""
    from PIL import Image

    with Image.open(io.BytesIO(content)) as image:
        return _ocr_image(image)


def extract_from_url(url: str, timeout: int = 20) -> str:
    """Fetch a web page and return its visible text."""
    if not url or not url.strip():
        raise ValueError("A website URL is required.")

    url = url.strip()
    if "://" not in url:
        url = f"https://{url}"

    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Enter a valid HTTP or HTTPS URL.")

    headers = {"User-Agent": "Mozilla/5.0 (compatible; LRW-Extractor/1.0)"}

    try:
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
    except requests.exceptions.Timeout as exc:
        raise ValueError(f"Request to {url} timed out.") from exc
    except requests.exceptions.RequestException as exc:
        raise ValueError(f"Could not fetch the page: {exc}") from exc

    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)
    if not text:
        raise ValueError("No readable text found on that page.")
    return text


def _get_whisper():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel

        _whisper_model = WhisperModel(
            get_settings().WHISPER_MODEL,
            device="cpu",
            compute_type="int8",
        )
    return _whisper_model


def _audio_language(language: Optional[str], filename: Optional[str]) -> Optional[str]:
    lang = (language or "").strip().lower()
    aliases = {
        "ta": "ta", "tamil": "ta", "தமிழ்": "ta",
        "si": "si", "sinhala": "si", "සිංහල": "si",
        "en": "en", "english": "en",
    }
    if lang:
        return aliases.get(lang)

    name = (filename or "").lower()
    if "tamil" in name or "தமிழ்" in name or "_ta." in name or "_tam." in name:
        return "ta"
    if "sinhala" in name or "සිංහල" in name or "_si." in name or "_sin." in name:
        return "si"
    return None


def extract_from_audio(
    content: bytes,
    filename: Optional[str] = None,
    language: Optional[str] = None,
) -> str:
    """Transcribe multilingual audio with faster-whisper."""
    extension = os.path.splitext(filename or "")[1].lower()
    if extension not in AUDIO_EXTENSIONS:
        extension = ".wav"

    with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as temp:
        temp.write(content)
        temp_path = temp.name

    try:
        selected_language = _audio_language(language, filename)
        options = {
            "beam_size": 5,
            "best_of": 5,
            "vad_filter": True,
            "vad_parameters": {"min_silence_duration_ms": 400},
            "condition_on_previous_text": False,
            "temperature": [0.0, 0.2, 0.4],
        }

        if selected_language:
            options["language"] = selected_language
        if selected_language == "ta":
            options["initial_prompt"] = "வணக்கம், இது தெளிவான தமிழ் பேச்சு மற்றும் உரை ஒலிப்பதிவு."
        elif selected_language == "si":
            options["initial_prompt"] = "ආයුබෝවන්, මෙය සිංහල භාෂාවෙන් කරන ලද හඬ පටිගත කිරීමකි."

        segments, _ = _get_whisper().transcribe(temp_path, **options)
        return "\n".join(
            segment.text.strip()
            for segment in segments
            if segment.text and segment.text.strip()
        )
    finally:
        try:
            os.unlink(temp_path)
        except OSError:
            pass


def _pdf_is_mostly_text(
    content: bytes,
    text_ratio_threshold: float = 0.5,
) -> bool:
    import fitz

    document = fitz.open(stream=content, filetype="pdf")
    try:
        total_pages = len(document)
        if not total_pages:
            return False

        text_pages = sum(
            1
            for page in document
            if not _page_is_scan(page, _real_text(page))
        )
        return (text_pages / total_pages) >= text_ratio_threshold
    finally:
        document.close()


def extract(
    file_type: str,
    content: Optional[bytes] = None,
    url: Optional[str] = None,
    filename: Optional[str] = None,
    language: Optional[str] = None,
) -> str:
    """Dispatch extraction based on the selected input type."""
    kind = (file_type or "").strip().lower()
    supported_types = {"text", "pdf", "image", "audio", "url"}
    if kind not in supported_types:
        raise ValueError(f"Unsupported file_type: {file_type}")

    if kind == "url":
        return extract_from_url(url)

    if content is None:
        raise ValueError("File content is required.")

    if kind == "image" and filename and filename.lower().endswith(".pdf"):
        kind = "pdf"
        if False and _pdf_is_mostly_text(content):
            raise ValueError(
                "This PDF contains extractable text. "
                "Please upload it using the PDF tab instead."
            )
        kind = "pdf"

    if kind == "text":
        return extract_from_text(content)
    if kind == "pdf":
        return extract_from_pdf(content)
    if kind == "image":
        return extract_from_image(content)
    if file_type == "audio":
        return extract_from_audio(content, filename=filename, language=language)
    if file_type == "url":
        return extract_from_url(url)
    raise ValueError(f"Unsupported file_type: {file_type}")