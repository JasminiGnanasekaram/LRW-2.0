"""Extract text from documents, images, web pages, and audio."""

import io
import os
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
        return _clean_ocr(pytesseract.image_to_string(image, lang=OCR_LANGUAGES))
    except pytesseract.pytesseract.TesseractNotFoundError as exc:
        raise RuntimeError(
            "Tesseract executable not found. Install it at the configured absolute path, "
            "or set TESSERACT_CMD in backend/.env to the full executable path."
        ) from exc
    except Exception as exc:
        err_str = str(exc).lower()
        if "data" in err_str or "language" in err_str or "tam" in err_str or "sin" in err_str:
            try:
                return _clean_ocr(pytesseract.image_to_string(image, lang="eng"))
            except Exception:
                pass
        raise RuntimeError(f"OCR extraction failed: {exc}") from exc


     
# Legacy (non-Unicode) Tamil fonts store glyphs under Latin codes, so the PDF text
# layer is gibberish (e.g. "ngNyhg;gplhR" instead of Tamil). Such pages must be OCR'd.
LEGACY_TAMIL_FONT_MARKERS = (
    "bamini", "baamini", "tscii", "tab-", "tam-", "vaigai", "shree", "shrilipi",
    "amudham", "kavipriya", "lt-tm", "ltamil", "mylai", "nakkeeran", "indoweb", "tace",
    "senthamil", "thendral",
)


def _page_has_legacy_tamil_font(page) -> bool:
    for font in page.get_fonts():
        name = str(font[3]).lower().split("+")[-1]
        if any(marker in name for marker in LEGACY_TAMIL_FONT_MARKERS):
            return True
    return False


def _page_has_usable_text(page) -> bool:
    """True when the page has a real, correctly encoded Unicode text layer."""
    if len(page.get_text().strip()) < PDF_MIN_CHARS:
        return False
    return not _page_has_legacy_tamil_font(page)


def _clean_ocr(text: str) -> str:
    # Tesseract emits invisible zero-width (non-)joiners after Tamil words; they break tokenization.
    return text.replace("\u200c", "").replace("\u200d", "").strip()

def extract_from_text(content: bytes, encoding: str = "utf-8") -> str:
    return content.decode(encoding, errors="replace")


def extract_from_pdf(content: bytes) -> str:
    """Read PDF text layers and OCR pages without enough extractable text."""
    import fitz
    from PIL import Image

    document = fitz.open(stream=content, filetype="pdf")
    try:
        parts = []
        for page in document:
            page_text = page.get_text().strip()
            if _page_has_legacy_tamil_font(page):
                page_text = ""  # legacy-font text layer is gibberish; OCR the page instead
            if len(page_text) >= PDF_MIN_CHARS:
                parts.append(page_text)
                continue

            try:
                pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                with Image.open(io.BytesIO(pixmap.tobytes("png"))) as image:
    
                    ocr_res = _ocr_image(image)
                    if ocr_res:
                        parts.append(ocr_res)
                    elif page_text:
                        parts.append(page_text)
            except Exception as ocr_err:
                if page_text:
                    parts.append(page_text)
                elif len(document) == 1:
                    raise ocr_err





        full_text = "\n\n".join(p for p in parts if p and p.strip())
        if not full_text.strip():
            fallback_text = "\n\n".join(page.get_text().strip() for page in document)
            if fallback_text.strip():
                return fallback_text.strip()
        return full_text
    finally:
        document.close()


def detect_pdf_type(content: bytes) -> str:
    """Return text_only, text_image, or image_only."""
    import fitz

    document = fitz.open(stream=content, filetype="pdf")
    try:
        text_pages = 0
        scanned_pages = 0
        embedded_images = False

        for page in document:
            if _page_has_usable_text(page):
                text_pages += 1
                if page.get_images(full=True):
                    embedded_images = True
            else:
                scanned_pages += 1

        if text_pages and (scanned_pages or embedded_images):
            return "text_image"
        if text_pages:
            return "text_only"
        return "image_only" if scanned_pages else "text_only"
    finally:
        document.close()


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
    min_chars_per_page: int = PDF_MIN_CHARS,
    text_ratio_threshold: float = 0.5,
) -> bool:
    import fitz

    document = fitz.open(stream=content, filetype="pdf")
    try:
        total_pages = len(document)
        if not total_pages:
            return False

        text_pages = sum(
            _page_has_usable_text(page)
            for page in document
        )
        return text_pages / total_pages >= text_ratio_threshold
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
    return extract_from_audio(content, filename=filename, language=language)