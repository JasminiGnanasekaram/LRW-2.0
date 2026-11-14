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
    """Find Tesseract: TESSERACT_CMD env/.env -> system PATH (Linux/Render) ->
    bundled copy in the repo -> common Windows install paths.
    Returns None when nothing is found (no stale hardcoded path)."""
    import shutil

    cmd = (os.getenv("TESSERACT_CMD") or getattr(get_settings(), "TESSERACT_CMD", None) or "").strip().strip("\"'")
    if cmd and os.path.isfile(cmd):
        return cmd

    which_cmd = shutil.which("tesseract") or shutil.which("tesseract.exe")
    if which_cmd:
        return which_cmd

    here = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.abspath(os.path.join(here, "..", ".."))
    candidates = [
        os.path.abspath(os.path.join(here, "..", "Tesseract-OCR", "tesseract.exe")),
        os.path.join(repo_root, "Tesseract-OCR", "tesseract.exe"),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Tesseract-OCR\tesseract.exe"),
        "/usr/bin/tesseract",
        "/usr/local/bin/tesseract",
    ]
    for c in candidates:
        if c and os.path.isfile(c):
            return c

    return None


def _ocr_image(image, required_languages=()) -> str:
    if pytesseract is None:
        raise RuntimeError(
            "OCR requires pytesseract and the Tesseract executable. "
            "Install them before processing scanned documents or images."
        )

    cmd = _resolve_tesseract_cmd()
    if cmd and os.path.isfile(cmd):
        pytesseract.pytesseract.tesseract_cmd = cmd
        tessdata = os.path.join(os.path.dirname(cmd), "tessdata")
        if os.path.isdir(tessdata):
            os.environ["TESSDATA_PREFIX"] = tessdata




    try:
        return _clean_ocr(
            pytesseract.image_to_string(image, lang=_get_ocr_languages(required_languages))
        )
    except pytesseract.pytesseract.TesseractNotFoundError as exc:
        raise RuntimeError(
            "Tesseract executable not found. Install it at the configured absolute path, "
            "or set TESSERACT_CMD in backend/.env to the full executable path."
        ) from exc
    except Exception as exc:
        raise RuntimeError(f"OCR extraction failed: {exc}") from exc


     
# Legacy (non-Unicode) Tamil fonts store glyphs under Latin codes, so the PDF text
# layer is gibberish (e.g. "ngNyhg;gplhR" instead of Tamil). Such pages must be OCR'd.
LEGACY_TAMIL_FONT_MARKERS = (
    "bamini", "baamini", "tscii", "tab-", "tam-", "vaigai", "shree", "shrilipi",
    "amudham", "kavipriya", "lt-tm", "ltamil", "mylai", "nakkeeran", "indoweb", "tace",
    "senthamil", "thendral",
)
LEGACY_SINHALA_FONT_MARKERS = (
    "fmabhaya", "fmbindumathi", "dl-man", "dlmanel", "dl-araliya", "kaputa",
    "malithi", "dinamina", "sarasavi", "thibus",
)
STANDARD_UNICODE_FONT_MARKERS = (
    "arial", "calibri", "aptos", "cambria", "helvetica", "times", "courier",
    "verdana", "georgia", "tahoma", "segoe", "liberation", "dejavu", "noto",
    "carlito", "consolas", "roboto",
)


def _has_readable_pdf_text(text: str) -> bool:
    """Reject empty or symbol-heavy PDF text layers that should be OCRed instead."""
    stripped = text.strip()
    if len(stripped) < PDF_MIN_CHARS:
        return False
    content_chars = sum(char.isalnum() for char in stripped)
    return content_chars / len(stripped) >= 0.5


def _get_ocr_languages(required_languages=()) -> str:
    """Use installed supported Tesseract languages instead of failing on missing data."""
    if pytesseract is None:
        if required_languages:
            raise RuntimeError("OCR requires pytesseract and the Tesseract executable.")
        return OCR_LANGUAGES
    try:
        available = set(pytesseract.get_languages(config=""))
    except Exception:
        return OCR_LANGUAGES
    missing = set(required_languages) - available
    if missing:
        missing_list = ", ".join(sorted(missing))
        raise RuntimeError(
            f"This legacy-font PDF requires Tesseract language data for {missing_list}. "
            "Install the corresponding traineddata file and try again."
        )
    languages = [lang for lang in OCR_LANGUAGES.split("+") if lang in available]
    languages.extend(lang for lang in required_languages if lang not in languages)
    return "+".join(languages) if languages else OCR_LANGUAGES


def _page_legacy_language(page):
    for font in page.get_fonts():
        name = str(font[3]).lower().split("+")[-1]
        if any(marker in name for marker in LEGACY_TAMIL_FONT_MARKERS):
            return "tam"
        if any(marker in name for marker in LEGACY_SINHALA_FONT_MARKERS):
            return "sin"
    return None


def _page_may_have_legacy_encoding(page, text: str) -> bool:
    """Detect likely legacy script text when its PDF font lacks a known legacy name."""
    if _page_legacy_language(page):
        return True

    letters = [char for char in text if char.isalpha()]
    if len(letters) < PDF_MIN_CHARS:
        return False
    latin_letters = sum(char.isascii() for char in letters)
    has_tamil_or_sinhala = _script_character_count(text) > 0

    font_names = [
        str(font[3]).lower().split("+")[-1]
        for font in page.get_fonts()
        if len(font) > 3
    ]
    nonstandard_font = not font_names or not any(
        marker in name
        for name in font_names
        for marker in STANDARD_UNICODE_FONT_MARKERS
    )
    if not nonstandard_font:
        return False
    if not font_names:
        return latin_letters / len(letters) >= 0.75
    return latin_letters / len(letters) >= 0.30 or has_tamil_or_sinhala


def _ocr_has_better_script_text(ocr_text: str, extracted_text: str) -> bool:
    """Prefer OCR only when it recovers substantially more Tamil/Sinhala characters."""
    extracted_count = _script_character_count(extracted_text)
    ocr_count = _script_character_count(ocr_text)
    return ocr_count > extracted_count + max(5, int(extracted_count * 0.1))


def _script_character_count(text: str) -> int:
    return sum(
        "\u0b80" <= char <= "\u0bff" or "\u0d80" <= char <= "\u0dff"
        for char in text
    )


def _page_image_coverage(page) -> float:
    """Return the fraction of a page covered by embedded raster images."""
    page_rect = page.rect
    page_area = page_rect.width * page_rect.height
    if page_area <= 0:
        return 0.0

    image_rects = []
    for image in page.get_image_info(xrefs=True):
        x0, y0, x1, y1 = image["bbox"]
        x0, x1 = max(page_rect.x0, x0), min(page_rect.x1, x1)
        y0, y1 = max(page_rect.y0, y0), min(page_rect.y1, y1)
        if x1 > x0 and y1 > y0:
            image_rects.append((x0, y0, x1, y1))
    if not image_rects:
        return 0.0

    x_edges = sorted({edge for rect in image_rects for edge in (rect[0], rect[2])})
    covered_area = 0.0
    for left, right in zip(x_edges, x_edges[1:]):
        midpoint = (left + right) / 2
        intervals = sorted(
            (rect[1], rect[3])
            for rect in image_rects
            if rect[0] < midpoint < rect[2]
        )
        covered_height = 0.0
        if intervals:
            start, end = intervals[0]
            for next_start, next_end in intervals[1:]:
                if next_start > end:
                    covered_height += end - start
                    start, end = next_start, next_end
                else:
                    end = max(end, next_end)
            covered_height += end - start
        covered_area += (right - left) * covered_height
    return min(covered_area / page_area, 1.0)


def _page_requires_ocr(page, text: str) -> bool:
    """Recognize scans whose only searchable text is a small stamp or watermark."""
    if _page_may_have_legacy_encoding(page, text):
        return True
    if _script_character_count(text) or len(text.strip()) > 300:
        return False
    return _page_image_coverage(page) >= 0.6


def _page_has_legacy_font(page) -> bool:
    return _page_legacy_language(page) is not None


def _page_has_usable_text(page) -> bool:
    """True when the page has a real, correctly encoded Unicode text layer."""
    text = page.get_text()
    if not _has_readable_pdf_text(text):
        return False
    return not _page_requires_ocr(page, text)


def _clean_ocr(text: str) -> str:
    # Tesseract emits invisible zero-width (non-)joiners after Tamil words; they break tokenization.
    return text.replace("\u200c", "").replace("\u200d", "").strip()

def extract_from_text(content: bytes, encoding: str = "utf-8") -> str:
    return content.decode(encoding, errors="replace")


def extract_from_pdf(content: bytes) -> str:
    """Read PDF text layers and OCR pages without enough extractable text."""
    if fitz is None:
        raise RuntimeError("PDF extraction requires PyMuPDF. Install the backend dependencies.")
    from PIL import Image

    document = fitz.open(stream=content, filetype="pdf")
    try:
        parts = []
        for page_number, page in enumerate(document, start=1):
            page_text = page.get_text().strip()
            legacy_language = _page_legacy_language(page)
            requires_ocr = _page_requires_ocr(page, page_text)
            if not requires_ocr and _has_readable_pdf_text(page_text):
                parts.append(page_text)
                continue

            try:
                pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                with Image.open(io.BytesIO(pixmap.tobytes("png"))) as image:
                    ocr_res = _ocr_image(
                        image,
                        required_languages=(legacy_language,) if legacy_language else (),
                    )
                    if ocr_res and (
                        requires_ocr
                        or not _has_readable_pdf_text(page_text)
                        or _ocr_has_better_script_text(ocr_res, page_text)
                    ):
                        parts.append(ocr_res)
                    elif _has_readable_pdf_text(page_text):
                        parts.append(page_text)
                    else:
                        raise ValueError("OCR did not recognize readable text on this page.")
            except Exception as ocr_err:
                if _has_readable_pdf_text(page_text):
                    parts.append(page_text)
                else:
                    raise RuntimeError(f"Could not read PDF page {page_number}: {ocr_err}") from ocr_err

        full_text = "\n\n".join(p for p in parts if p and p.strip())
        if not full_text.strip():
            raise ValueError(
                "No readable text could be extracted from this PDF. "
                "For legacy-font or scanned documents, verify Tesseract and the required "
                "English, Tamil, or Sinhala language data are installed."
            )
        return full_text
    finally:
        document.close()


def detect_pdf_type(content: bytes) -> str:
    """Return text_only, text_image, or image_only."""
    if fitz is None:
        raise RuntimeError("PDF extraction requires PyMuPDF. Install the backend dependencies.")

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


def is_pdf_content(content: bytes) -> bool:
    """Detect PDF uploads by their header, including files with a non-PDF extension."""
    return b"%PDF-" in content[:1024]


def _pdf_is_mostly_text(
    content: bytes,
    min_chars_per_page: int = PDF_MIN_CHARS,
    text_ratio_threshold: float = 0.5,
) -> bool:
    import pymupdf as fitz

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

    if kind == "image" and (
        (filename and filename.lower().endswith(".pdf")) or is_pdf_content(content)
    ):
        kind = "pdf"

    if kind == "text":
        return extract_from_text(content)
    if kind == "pdf":
        return extract_from_pdf(content)
    if kind == "image":
        return extract_from_image(content)
    return extract_from_audio(content, filename=filename, language=language)