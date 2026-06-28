"""Text extraction from various input formats."""
import io
import requests
from typing import Optional
from bs4 import BeautifulSoup

try:
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    TESSERACT_AVAILABLE = True
except Exception:
    TESSERACT_AVAILABLE = False


def extract_from_text(content: bytes, encoding: str = "utf-8") -> str:
    return content.decode(encoding, errors="replace")


def detect_pdf_type(content: bytes) -> str:
    import fitz
    doc = fitz.open(stream=content, filetype="pdf")
    has_text = False
    has_images = False
    for page in doc:
        if page.get_text().strip():
            has_text = True
        if page.get_images(full=True):
            has_images = True
    doc.close()
    if has_text and has_images:
        return "text_image"
    elif has_text:
        return "text_only"
    else:
        return "image_only"


def extract_from_pdf(content: bytes) -> tuple:
    """
    Extract text from PDF (text + OCR for image pages).
    Returns (text, pdf_type)
    """
    import fitz
    try:
        doc = fitz.open(stream=content, filetype="pdf")
    except Exception as e:
        return "", "unknown"

    pdf_type = detect_pdf_type(content)
    text_parts = []

    for page_num, page in enumerate(doc):
        try:
            # Always try to get text first
            text = page.get_text().strip()
            if text:
                text_parts.append(text)

            # If page has images and little/no text — try OCR
            images = page.get_images(full=True)
            if images and not text and TESSERACT_AVAILABLE:
                try:
                    pix = page.get_pixmap(dpi=150)
                    img_bytes = pix.tobytes("png")
                    from PIL import Image
                    img = Image.open(io.BytesIO(img_bytes))
                    ocr_text = pytesseract.image_to_string(img, lang="eng+tam+sin")
                    if ocr_text.strip():
                        text_parts.append(ocr_text.strip())
                except Exception as ocr_err:
                    print(f"[PDF OCR] Page {page_num} OCR failed: {ocr_err}", flush=True)
                    # Don't crash — just skip this page's OCR
                    continue

        except Exception as page_err:
            print(f"[PDF] Page {page_num} extraction failed: {page_err}", flush=True)
            continue

    doc.close()
    full_text = "\n".join(text_parts)
    return full_text, pdf_type


def generate_summary(text: str, max_sentences: int = 2) -> str:
    import re
    if not text or not text.strip():
        return "No content available for summary."
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    meaningful = [s.strip() for s in sentences if len(s.strip()) > 20]
    if not meaningful:
        return text.strip()[:150] + "..."
    summary = " ".join(meaningful[:max_sentences])
    if len(summary) > 300:
        summary = summary[:300] + "..."
    return summary


def extract_from_image(content: bytes) -> str:
    if not TESSERACT_AVAILABLE:
        return "Tesseract OCR not available."
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(content))
        return pytesseract.image_to_string(img, lang="eng+tam+sin")
    except Exception as e:
        print(f"[Image OCR] Failed: {e}", flush=True)
        return ""


def extract_from_url(url: str, timeout: int = 15) -> str:
    headers = {"User-Agent": "Mozilla/5.0 (LRW Bot)"}
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text(separator="\n", strip=True)


_whisper_model = None


def _get_whisper():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        from config import get_settings
        size = get_settings().WHISPER_MODEL
        _whisper_model = WhisperModel(size, device="cpu", compute_type="int8")
    return _whisper_model


def extract_from_audio(content: bytes) -> str:
    import tempfile, os
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


def extract(file_type: str, content: Optional[bytes] = None, url: Optional[str] = None) -> tuple:
    """
    Always returns (text, extra_info_dict) — never raises on partial failure.
    """
    file_type = file_type.lower()

    try:
        if file_type == "text":
            text = extract_from_text(content)
            return text, {"summary": generate_summary(text)}

        if file_type == "pdf":
            text, pdf_type = extract_from_pdf(content)
            return text, {"pdf_type": pdf_type, "summary": generate_summary(text)}

        if file_type == "image":
            text = extract_from_image(content)
            return text, {"summary": generate_summary(text)}

        if file_type == "audio":
            text = extract_from_audio(content)
            return text, {"summary": generate_summary(text)}

        if file_type == "url":
            text = extract_from_url(url)
            return text, {"summary": generate_summary(text)}

        raise ValueError(f"Unsupported file_type: {file_type}")

    except Exception as e:
        # Re-raise so documents.py shows the real error — but now it's always a proper exception
        # not a tuple unpacking error
        raise e