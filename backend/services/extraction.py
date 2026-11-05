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


PDF_MIN_CHARS = 20
OCR_LANGUAGES = "eng+tam+sin"
WINDOWS_TESSERACT_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".wma", ".webm"}

_whisper_model = None


def _ocr_image(image) -> str:
    if pytesseract is None:
        raise RuntimeError(
            "OCR requires pytesseract and the Tesseract executable. "
            "Install them before processing scanned documents or images."
        )

    command = getattr(get_settings(), "TESSERACT_CMD", None)
    if command:
        pytesseract.pytesseract.tesseract_cmd = command
    elif os.path.isfile(WINDOWS_TESSERACT_PATH):
        pytesseract.pytesseract.tesseract_cmd = WINDOWS_TESSERACT_PATH

    try:
        return pytesseract.image_to_string(image, lang=OCR_LANGUAGES).strip()
    except pytesseract.pytesseract.TesseractNotFoundError as exc:
        raise RuntimeError(
            "Tesseract executable not found. Install Tesseract, add it to PATH, "
            "or set TESSERACT_CMD in backend/.env."
        ) from exc
    except Exception as exc:
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

            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            with Image.open(io.BytesIO(pixmap.tobytes("png"))) as image:
                parts.append(_ocr_image(image))

        return "\n\n".join(parts)
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
        if _pdf_is_mostly_text(content):
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
