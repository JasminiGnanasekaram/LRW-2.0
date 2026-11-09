"""Extract text from documents, images, web pages, and audio."""

import hashlib
import io
import os
import tempfile
import threading
from collections import OrderedDict
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
_whisper_init_lock = threading.Lock()

# Only one transcription runs at a time, and finished transcripts are cached.
# This means the "summary on file select" call and the real upload call do NOT
# transcribe the same file twice, and both always see the identical transcript.
_transcribe_lock = threading.Lock()
_TRANSCRIPT_CACHE: "OrderedDict[str, str]" = OrderedDict()
_TRANSCRIPT_CACHE_MAX = 16

# Whisper may echo an invented prompt back over silence, so prompts are OFF by default.
# Set to True only if you tested it and it helps your recordings.
USE_INITIAL_PROMPT = False
_INITIAL_PROMPTS = {
    "ta": "வணக்கம், இது தெளிவான தமிழ் பேச்சு மற்றும் உரை ஒலிப்பதிவு.",
    "si": "ආයුබෝවන්, මෙය සිංහල භාෂාවෙන් කරන ලද හඬ පටිගත කිරීමකි.",
}


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
            if len(page.get_text().strip()) >= PDF_MIN_CHARS:
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


def _pick_device():
    """Use the GPU in float16 if one is available, otherwise CPU in int8."""
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() > 0:
            return "cuda", "float16"
    except Exception:
        pass
    return "cpu", "int8"


def _get_whisper():
    global _whisper_model
    if _whisper_model is None:
        with _whisper_init_lock:
            if _whisper_model is None:
                from faster_whisper import WhisperModel

                device, compute_type = _pick_device()
                _whisper_model = WhisperModel(
                    get_settings().WHISPER_MODEL,
                    device=device,
                    compute_type=compute_type,
                )
    return _whisper_model


_LANG_ALIASES = {
    "ta": "ta", "tamil": "ta", "தமிழ்": "ta",
    "si": "si", "sinhala": "si", "sinhalese": "si", "සිංහල": "si",
    "en": "en", "english": "en",
}


def _audio_language(language: Optional[str], filename: Optional[str]) -> Optional[str]:
    """Return a Whisper language code, or None to let Whisper auto-detect.

    An explicit but unrecognised language now raises instead of silently
    falling back to auto-detect (which is unreliable for Tamil/Sinhala).
    """
    lang = (language or "").strip().lower().replace("_", "-")
    if lang and lang != "auto":
        if lang in _LANG_ALIASES:
            return _LANG_ALIASES[lang]
        base = lang.split("-")[0]          # "ta-lk" -> "ta"
        if base in _LANG_ALIASES:
            return _LANG_ALIASES[base]
        raise ValueError(
            f"Unsupported audio language '{language}'. Use 'ta', 'si', 'en' or 'auto'."
        )

    name = (filename or "").lower()
    if "tamil" in name or "தமிழ்" in name or "_ta." in name or "_tam." in name:
        return "ta"
    if "sinhala" in name or "සිංහල" in name or "_si." in name or "_sin." in name:
        return "si"
    return None


def _transcribe(content: bytes, extension: str, selected_language: Optional[str]) -> str:
    with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as temp:
        temp.write(content)
        temp_path = temp.name

    try:
        options = {
            "beam_size": 5,
            "best_of": 5,
            "vad_filter": True,
            "vad_parameters": {"min_silence_duration_ms": 500, "speech_pad_ms": 400},
            "condition_on_previous_text": False,
            "temperature": [0.0, 0.2, 0.4],
        }
        if selected_language:
            options["language"] = selected_language
            if USE_INITIAL_PROMPT and selected_language in _INITIAL_PROMPTS:
                options["initial_prompt"] = _INITIAL_PROMPTS[selected_language]

        segments, _info = _get_whisper().transcribe(temp_path, **options)
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


def extract_from_audio(
    content: bytes,
    filename: Optional[str] = None,
    language: Optional[str] = None,
) -> str:
    """Transcribe multilingual audio with faster-whisper (cached, one job at a time)."""
    extension = os.path.splitext(filename or "")[1].lower()
    if extension not in AUDIO_EXTENSIONS:
        extension = ".wav"

    selected_language = _audio_language(language, filename)
    key = "|".join([
        hashlib.sha256(content).hexdigest(),
        selected_language or "auto",
        get_settings().WHISPER_MODEL,
    ])

    with _transcribe_lock:
        cached = _TRANSCRIPT_CACHE.get(key)
        if cached is not None:
            _TRANSCRIPT_CACHE.move_to_end(key)
            return cached

        text = _transcribe(content, extension, selected_language)
        if not text.strip():
            raise ValueError(
                "No speech could be transcribed from this audio. "
                "Check the file and the selected language."
            )

        _TRANSCRIPT_CACHE[key] = text
        while len(_TRANSCRIPT_CACHE) > _TRANSCRIPT_CACHE_MAX:
            _TRANSCRIPT_CACHE.popitem(last=False)
        return text


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
            len(page.get_text().strip()) >= min_chars_per_page
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