"""Text extraction from various input formats."""
import io
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

# Prefer configured tesseract path, falling back to common Windows path if present.
if pytesseract is not None:
    settings = get_settings()
    if getattr(settings, "TESSERACT_CMD", None):
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
    elif os.path.exists(r"C:\Program Files\Tesseract-OCR\tesseract.exe"):
        pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# --- OCR / readable-text helpers -------------------------------------------

# Pages are OCR'd automatically when they are scanned images or use a non-Unicode
# (legacy-font) text layer. Set this to True to OCR EVERY page of every PDF instead.
ALWAYS_OCR_PDF = False

MIN_CHARS_PER_PAGE = 20          # below this a page has no real text layer
SCANNED_PAGE_MAX_TEXT_CHARS = 400  # a page picture + this little text = a scan with just a stamp/footer
SCANNED_PAGE_IMAGE_COVERAGE = 0.5  # share of the page covered by pictures to call it a scan

_COMMON_ENGLISH = {
    "the", "and", "of", "to", "in", "is", "that", "for", "it", "with", "as", "on",
    "was", "are", "be", "by", "this", "from", "or", "an", "at", "which", "not",
    "have", "has", "were", "will", "can", "their", "his", "her", "but", "all",
}


def _get_ocr_languages() -> str:
    """Return a Tesseract language string using only the languages actually installed."""
    wanted = ["eng", "tam", "sin"]
    available = []
    if pytesseract is not None:
        try:
            available = list(pytesseract.get_languages(config=""))
        except Exception:
            available = []
    chosen = [lang for lang in wanted if lang in available]
    if not chosen:
        chosen = ["eng"]
    return "+".join(chosen)


def _has_readable_pdf_text(text: str) -> bool:
    """Heuristic: is this extracted PDF text real, readable text?

    Non-Unicode (legacy-font) Tamil/Sinhala PDFs extract as Latin-looking
    garbage such as "jkpo; nkhop" or "(cid:123)". That garbage is long enough
    to pass a simple length check, so we also look at what the text looks like.
    """
    if not text:
        return False
    text = text.strip()
    if not text:
        return False

    # Broken font mapping markers
    if "(cid:" in text or text.count("\ufffd") > max(2, len(text) * 0.02):
        return False

    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False

    # Proper Unicode Tamil / Sinhala (or other non-Latin script) text
    tamil_sinhala = sum(1 for c in letters if "\u0b80" <= c <= "\u0bff" or "\u0d80" <= c <= "\u0dff")
    if tamil_sinhala / len(letters) >= 0.3:
        return True

    # Legacy-font garbage: Latin-1 accented letters/symbols and bracket/semicolon
    # characters used as letter stand-ins, mixed inside words.
    weird = sum(1 for c in text if "\u00a1" <= c <= "\u00ff" or c in ";[]{}~^|`\\")
    if weird / max(len(text), 1) > 0.05:
        return False

    # Plain Latin text should contain ordinary English words (or other normal prose).
    words = re.findall(r"[A-Za-z]+", text.lower())
    if len(words) >= 8:
        hits = sum(1 for w in words if w in _COMMON_ENGLISH)
        if hits / len(words) < 0.04:
            # Could be another Latin-script language; accept only if words look pronounceable
            vowels = sum(1 for w in words if re.search(r"[aeiou]", w))
            return vowels / len(words) > 0.85 and weird == 0
    return True


def _page_image_coverage(page) -> float:
    """Fraction (0-1) of the page area covered by embedded pictures."""
    try:
        page_area = abs(page.rect.width * page.rect.height) or 1.0
        covered = 0.0
        for info in page.get_image_info():
            visible = page.rect & type(page.rect)(info["bbox"])
            if not visible.is_empty:
                covered += visible.width * visible.height
        return min(covered / page_area, 1.0)
    except Exception:
        return 0.0


def _page_needs_ocr(page, page_text: str) -> bool:
    """True when the page's text layer cannot be trusted as the page's real content:
    no text, garbled (non-Unicode font) text, or a scanned page whose text layer is
    only a short stamp/footer (for example "Digitized by Noolaham Foundation")."""
    if ALWAYS_OCR_PDF:
        return True
    if len(page_text) < MIN_CHARS_PER_PAGE:
        return True
    if not _has_readable_pdf_text(page_text):
        return True
    return (
        len(page_text) < SCANNED_PAGE_MAX_TEXT_CHARS
        and _page_image_coverage(page) >= SCANNED_PAGE_IMAGE_COVERAGE
    )


def extract_from_text(content: bytes, encoding: str = "utf-8") -> str:
    return content.decode(encoding, errors="replace")


def extract_from_pdf(content: bytes) -> str:
    """PDF extraction using PyMuPDF (fitz).
    Each page is checked for a real, readable text layer. Pages with one are
    extracted directly. Pages without one (scans/photos) AND pages whose text
    layer is garbage (non-Unicode / legacy-font Tamil or Sinhala) are rendered
    to an image and OCR'd instead."""
    import fitz  # PyMuPDF
    from PIL import Image

    doc = fitz.open(stream=content, filetype="pdf")
    text_parts = []
    ocr_langs = _get_ocr_languages()

    for page in doc:
        page_text = page.get_text().strip()

        if not _page_needs_ocr(page, page_text):
            text_parts.append(page_text)
            continue

        # Scanned page, or text layer is unreadable (non-Unicode font) -> OCR
        ocr_text = ""
        if pytesseract is not None:
            zoom = 3  # higher zoom helps Tamil/Sinhala glyphs
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            try:
                ocr_text = pytesseract.image_to_string(img, lang=ocr_langs).strip()
            except Exception as exc:
                print(f"[PDF OCR] failed on page {page.number + 1}: {exc}", flush=True)

        if ocr_text:
            text_parts.append(ocr_text)
        elif page_text:
            # OCR unavailable/empty: keep whatever the text layer gave us
            text_parts.append(page_text)

    doc.close()
    return "\n\n".join(text_parts)


def detect_pdf_type(content: bytes) -> str:
    """Analyze PDF to determine its type: text_only, text_image, or image_only."""
    import fitz  # PyMuPDF
    
    doc = fitz.open(stream=content, filetype="pdf")
    text_page_count = 0
    image_page_count = 0
    
    for page in doc:
        page_text = page.get_text().strip()
        if not _page_needs_ocr(page, page_text):
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
        return pytesseract.image_to_string(img, lang=_get_ocr_languages())
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


def extract_from_audio(content: bytes, filename: Optional[str] = None, language: Optional[str] = None) -> str:
    """Speech-to-Text via faster-whisper with tuned settings for Tamil and multilingual audio."""
    model = _get_whisper()
    
    # 1. Preserve original extension so ffmpeg accurately decodes the container
    ext = ".wav"
    if filename and "." in filename:
        candidate_ext = os.path.splitext(filename)[1].lower()
        if candidate_ext in {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".wma", ".webm"}:
            ext = candidate_ext

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Detect if Tamil is requested or hinted in filename
        lang_lower = (language or "").strip().lower()
        fn_lower = (filename or "").lower()
        is_tamil = lang_lower in {"ta", "tamil", "தமிழ்"} or any(k in fn_lower for k in ["tamil", "tam", "_ta", "தமிழ்"])
        is_sinhala = lang_lower in {"si", "sinhala", "සිංහල"} or any(k in fn_lower for k in ["sinhala", "sin", "_si", "සිංහල"])

        # High-accuracy parameters for faster-whisper:
        # - beam_size=5: avoids greedy decoding errors on agglutinative Tamil words
        # - vad_filter=True: silences background noise and stops hallucinations
        # - condition_on_previous_text=False: stops infinite phrase repeating loops
        # - initial_prompt: gives vocabulary and Unicode orthography context
        transcribe_kwargs = {
            "beam_size": 5,
            "best_of": 5,
            "vad_filter": True,
            "vad_parameters": dict(min_silence_duration_ms=400),
            "condition_on_previous_text": False,
            "temperature": [0.0, 0.2, 0.4],
        }

        if is_tamil:
            transcribe_kwargs["language"] = "ta"
            transcribe_kwargs["initial_prompt"] = "வணக்கம், இது தெளிவான தமிழ் பேச்சு மற்றும் உரை ஒலிப்பதிவு."
        elif is_sinhala:
            transcribe_kwargs["language"] = "si"
            transcribe_kwargs["initial_prompt"] = "ආයුබෝවන්, මෙය සිංහල භාෂාවෙන් කරන ලද හඬ පටිගත කිරීමකි."
        elif lang_lower in {"en", "english"}:
            transcribe_kwargs["language"] = "en"
        else:
            # Multilingual prompt guiding the model to support Tamil & Sinhala Unicode
            transcribe_kwargs["initial_prompt"] = "வணக்கம், இது தமிழ் மற்றும் பலமொழி உரை. Hello. ආයුබෝවන්."

        segments, info = model.transcribe(tmp_path, **transcribe_kwargs)
        text_segments = [seg.text.strip() for seg in segments if seg.text and seg.text.strip()]
        result_text = "\n".join(text_segments).strip()

        # Fallback: if auto-detect missed Tamil or produced empty output, re-run with explicit Tamil
        if not result_text or (not is_tamil and not is_sinhala and any(ord(c) >= 0x0B80 and ord(c) <= 0x0BFF for c in result_text)):
            segments, _ = model.transcribe(
                tmp_path,
                beam_size=5,
                language="ta",
                initial_prompt="வணக்கம், இது தமிழ் உரை ஒலிப்பதிவு.",
                vad_filter=True,
            )
            result_text = "\n".join(seg.text.strip() for seg in segments if seg.text and seg.text.strip()).strip()

        return result_text
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
        if not _page_needs_ocr(page, page.get_text().strip())
    )
    doc.close()
    return (text_pages / total_pages) >= text_ratio_threshold


def extract(
    file_type: str,
    content: Optional[bytes] = None,
    url: Optional[str] = None,
    filename: Optional[str] = None,
    language: Optional[str] = None,
) -> str:
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
        return extract_from_audio(content, filename=filename, language=language)
    if file_type == "url":
        return extract_from_url(url)
    raise ValueError(f"Unsupported file_type: {file_type}")