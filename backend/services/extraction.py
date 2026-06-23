"""Text extraction from various input formats."""
import io
import requests
from typing import Optional
from bs4 import BeautifulSoup
import pytesseract  # Import pytesseract for OCR

# Tell Python where Tesseract is installed on Windows
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'


def extract_from_text(content: bytes, encoding: str = "utf-8") -> str:
    return content.decode(encoding, errors="replace")


def extract_from_pdf(content: bytes) -> str:
    """PDF extraction using PyMuPDF (fitz) - Fast, lightweight single tool."""
    import fitz  # PyMuPDF
    # Open the PDF directly from bytes in memory
    doc = fitz.open(stream=content, filetype="pdf")
    text_parts = [page.get_text() for page in doc]
    return "\n".join(text_parts)


def extract_from_image(content: bytes) -> str:
    """OCR using Tesseract (supports English, Tamil, and Sinhala)."""
    from PIL import Image
    # Load the image from memory bytes
    img = Image.open(io.BytesIO(content))
    # "eng+tam+sin" tells Tesseract to recognize English, Tamil, and Sinhala text
    return pytesseract.image_to_string(img, lang="eng+tam+sin")


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
        from config import get_settings
        size = get_settings().WHISPER_MODEL
        # CPU-only by default; users with GPU can switch device="cuda"
        _whisper_model = WhisperModel(size, device="cpu", compute_type="int8")
    return _whisper_model


def extract_from_audio(content: bytes) -> str:
    """Speech-to-Text via faster-whisper. Requires ffmpeg on PATH."""
    import tempfile, os
    model = _get_whisper()
    # Write to a temp file because faster-whisper expects a path / numpy array
    with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        segments, _info = model.transcribe(tmp_path, beam_size=1)
        return "\n".join(seg.text.strip() for seg in segments).strip()
    finally:
        try: os.unlink(tmp_path)
        except OSError: pass


def extract(file_type: str, content: Optional[bytes] = None, url: Optional[str] = None) -> str:
    file_type = file_type.lower()
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