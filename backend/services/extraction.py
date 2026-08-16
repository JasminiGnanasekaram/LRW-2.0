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
    import fitz
    try:
        doc = fitz.open(stream=content, filetype="pdf")
    except Exception:
        return "", "unknown"

    pdf_type = detect_pdf_type(content)
    text_parts = []

    for page_num, page in enumerate(doc):
        try:
            text = page.get_text().strip()
            if text:
                text_parts.append(text)
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
                    continue
        except Exception as page_err:
            print(f"[PDF] Page {page_num} extraction failed: {page_err}", flush=True)
            continue

    doc.close()
    return "\n".join(text_parts), pdf_type


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


def _preprocess_image_for_ocr(img):
    """Upscale and enhance image for better OCR accuracy."""
    try:
        from PIL import ImageEnhance, ImageFilter
        # Convert to RGB
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        # Upscale — Tamil OCR needs at least 1500px wide
        w, h = img.size
        if w < 1500:
            scale = 1500 / w
            img = img.resize((int(w * scale), int(h * scale)), resample=3)
        # Sharpen then boost contrast
        img = img.filter(ImageFilter.SHARPEN)
        img = ImageEnhance.Contrast(img).enhance(1.8)
        img = ImageEnhance.Sharpness(img).enhance(2.5)
        return img
    except Exception:
        return img


def _count_script_chars(text: str) -> dict:
    """Count Tamil, Sinhala and Latin characters in text."""
    tamil   = sum(1 for c in text if "\u0B80" <= c <= "\u0BFF")
    sinhala = sum(1 for c in text if "\u0D80" <= c <= "\u0DFF")
    latin   = sum(1 for c in text if c.isascii() and c.isalpha())
    total   = tamil + sinhala + latin or 1
    return {
        "tamil":   tamil / total,
        "sinhala": sinhala / total,
        "latin":   latin / total,
        "total":   total,
    }


def _detect_image_script(img) -> str:
    """
    Detect script by sampling MULTIPLE regions of the image
    — not just top-left corner which may have English UI elements
    (browser toolbar, Windows taskbar, app title bar, etc).
    Returns correct Tesseract lang string.
    """
    try:
        w, h = img.size

        # Sample 4 regions: upper-middle, center, lower-middle, center-column
        regions = [
            img.crop((0,      h // 4,      w,          h // 2      )),
            img.crop((0,      h // 3,      w,          2 * h // 3  )),
            img.crop((0,      h // 2,      w,          3 * h // 4  )),
            img.crop((w // 4, 0,           3 * w // 4, h           )),
        ]

        tamil_score   = 0.0
        sinhala_score = 0.0
        total_samples = 0

        for region in regions:
            try:
                sample = pytesseract.image_to_string(
                    region, lang="eng+tam+sin",
                    config="--psm 6 --oem 1"
                )
                counts = _count_script_chars(sample)
                if counts["total"] > 3:
                    tamil_score   += counts["tamil"]
                    sinhala_score += counts["sinhala"]
                    total_samples += 1
            except Exception:
                continue

        if total_samples == 0:
            print("[Image OCR] Script detection failed — defaulting to tam+eng", flush=True)
            return "tam+eng"

        avg_tamil   = tamil_score   / total_samples
        avg_sinhala = sinhala_score / total_samples

        print(f"[Image OCR] Script scores → Tamil:{avg_tamil:.2f} Sinhala:{avg_sinhala:.2f}", flush=True)

        if avg_tamil > 0.10:
            print("[Image OCR] → Tamil detected", flush=True)
            return "tam+eng"
        if avg_sinhala > 0.10:
            print("[Image OCR] → Sinhala detected", flush=True)
            return "sin+eng"

        print("[Image OCR] → English detected", flush=True)
        return "eng"

    except Exception as ex:
        print(f"[Image OCR] Script detection error: {ex}", flush=True)
        return "eng+tam+sin"


def extract_from_image(content: bytes) -> str:
    """OCR using Tesseract — auto-detects Tamil/Sinhala/English script."""
    if not TESSERACT_AVAILABLE:
        return "Tesseract OCR not available."
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(content))

        # Step 1: Preprocess
        img = _preprocess_image_for_ocr(img)
        print(f"[Image OCR] Image size after preprocessing: {img.size}", flush=True)

        # Step 2: Detect script from multiple regions
        script_lang = _detect_image_script(img)
        print(f"[Image OCR] Using lang={script_lang}", flush=True)

        # Step 3: OCR with best config for detected script
        if "tam" in script_lang or "sin" in script_lang:
            config = "--psm 6 --oem 1"
        else:
            config = "--psm 3 --oem 3"

        text = pytesseract.image_to_string(img, lang=script_lang, config=config)

        # Step 4: Retry with tam+eng if empty
        if not text.strip():
            print("[Image OCR] Empty — retrying with tam+eng", flush=True)
            text = pytesseract.image_to_string(
                img, lang="tam+eng", config="--psm 6 --oem 1"
            )

        word_count = len(text.split())
        print(f"[Image OCR] Done — {word_count} words extracted", flush=True)

        if word_count < 3:
            print("[Image OCR] Very few words detected.", flush=True)
            print("[Image OCR] Check: is tam.traineddata in C:\\Program Files\\Tesseract-OCR\\tessdata\\?", flush=True)

        return text

    except Exception as e:
        print(f"[Image OCR] Failed: {e}", flush=True)
        return ""


def extract_from_url(url: str, timeout: int = 15) -> str:
    """
    Extract ALL content from a webpage:
    - All visible text
    - OCR text from all images on the page
    """
    headers = {"User-Agent": "Mozilla/5.0 (LRW Bot)"}
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    page_text = soup.get_text(separator="\n", strip=True)
    all_parts = [page_text]

    if TESSERACT_AVAILABLE:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        img_tags = soup.find_all("img", src=True)

        for img_tag in img_tags[:20]:
            img_src = img_tag["src"]
            if img_src.startswith("http"):
                img_url = img_src
            elif img_src.startswith("//"):
                img_url = "https:" + img_src
            elif img_src.startswith("/"):
                img_url = f"{parsed.scheme}://{parsed.netloc}{img_src}"
            else:
                img_url = f"{parsed.scheme}://{parsed.netloc}/{img_src}"

            try:
                img_resp = requests.get(img_url, timeout=8, headers=headers)
                if img_resp.status_code == 200:
                    from PIL import Image
                    img = Image.open(io.BytesIO(img_resp.content))
                    if img.width > 100 and img.height > 100:
                        ocr_text = pytesseract.image_to_string(
                            img, lang="eng+tam+sin"
                        )
                        if ocr_text.strip():
                            all_parts.append(f"\n[Image text]: {ocr_text.strip()}")
            except Exception as img_err:
                print(f"[URL img OCR] {img_url}: {img_err}", flush=True)
                continue

    return "\n".join(all_parts)


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
        raise e