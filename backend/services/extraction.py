"""Text extraction from various input formats."""
import io
import re
import unicodedata
import requests
from typing import Optional
from bs4 import BeautifulSoup

try:
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    TESSERACT_AVAILABLE = True
except Exception:
    TESSERACT_AVAILABLE = False


# ── Tamil Unicode normalization ───────────────────────────────────────
def _normalize_tamil_unicode(text: str) -> str:
    if not text:
        return text
    text = unicodedata.normalize("NFC", text)
    ra = "\u0BB0"
    vowel_signs = [
        "\u0BBE", "\u0BBF", "\u0BC0", "\u0BC1", "\u0BC2",
        "\u0BC6", "\u0BC7", "\u0BC8", "\u0BCA", "\u0BCB", "\u0BCC",
    ]
    for vs in vowel_signs:
        text = text.replace(ra + vs, vs)
    while ra + ra in text:
        text = text.replace(ra + ra, ra)
    return text


# ── Tamil PDF font correction ─────────────────────────────────────────
def _fix_tamil_pdf_encoding(text: str) -> str:
    """Fix Tamil font encoding errors common in PDFs."""
    if not text:
        return text

    text = _normalize_tamil_unicode(text)

    # Apply all string corrections
    corrections = [
        # ே vowel misread as ப prefix
        ("පපர",  "பேர"),
        ("පපரரசு","பேரரசு"),
        ("පපரசு", "பேரரசு"),
        ("பபரசு", "பேரரசு"),
        # செ misread as சச
        ("சசஞ்", "செஞ்"),
        ("சசய்", "செய்"),
        ("சசல்", "செல்"),
        ("சசன்", "சென்"),
        ("சசய",  "செய"),
        ("சசாற்படி","சொற்படி"),
        ("சசான்னாரு","சொன்னாரு"),
        ("சசான்னாு","சொன்னாரு"),
        # போ misread as பப
        ("පපானான்","போனான்"),
        ("පපாயி", "போயி"),
        ("පපாகிற","போகிற"),
        ("පපா",   "போ"),
        # Common word corrections
        ("அவபராை","அவரோட"),
        ("சகாண்டு","கொண்டு"),
        ("சகாடுத்தது","கொடுத்தது"),
        ("சகாடுத்தா","கொடுத்தா"),
        ("பவறல",  "வேலை"),
        ("சதன்னந்","தென்னந்"),
        ("சதன்னங்","தென்னங்"),
        ("சதன்னகன்","தென்னகன்"),
        ("சறமயல்","சமையல்"),
        ("பதறவக்கு","தேவைக்கு"),
        ("பதங்காய்","தேங்காய்"),
        ("கிறைக்கும்","கிடைக்கும்"),
        ("அரண்மறன","அரண்மனை"),
        ("சவளித்","வெளித்"),
        ("நிறனச்ச","நினைச்ச"),
        ("நிறனத்து","நினைத்து"),
        ("குைள்", "குறள்"),
        ("அவறர",  "அவரை"),
        ("தன்றன", "தன்னை"),
        ("பாதுகாக்கிைது","பாதுகாக்கிறது"),
        ("உைபன",  "உடனே"),
        ("தன்பனாை","தன்னோட"),
        ("என்பனாை","என்னோட"),
        ("சராம்ப","ரொம்ப"),
        ("சபரிய", "பெரிய"),
        ("சதாைங்கின","தொடங்கின"),
        ("பசார்ந்து","சோர்ந்து"),
        ("பகாபப்படு","கோபப்படு"),
        ("முட்ைாள்","முட்டாள்"),
        ("தறல",   "தலை"),
        ("பார்றவயிை","பார்வையிட"),
        ("நாட்றை","நாட்டை"),
        ("மரத்றத","மரத்தை"),
        ("காரியத்றத","காரியத்தை"),
        ("கன்றுகறள","கன்றுகளை"),
        ("படுக்றக","படுக்கை"),
        ("சபாறுப்றப","பொறுப்பை"),
        ("திைறம", "திறமை"),
        ("நிறலறம","நிலைமை"),
        ("பதாட்ைம்","தோட்டம்"),
        ("பதாட்ைத்தில்","தோட்டத்தில்"),
        ("பதாணுச்சு","தோணுச்சு"),
        ("வளக்கைதுக்கும்","வளர்க்கறதுக்கும்"),
        ("இருக்குைதுக்கு","இருக்குறதுக்கு"),
        ("காத்துகிட்டு","காத்துக்கிட்டு"),
        ("பதடி",  "தேடி"),
        ("குரல்படி","குறள்படி"),
        ("பரேரசு","பேரரசு"),
        ("பரேர",  "பேர"),
        ("சிிப்பு","சிரிப்பு"),
        ("காியத்","காரியத்"),
        ("காியம்","காரியம்"),
        ("விசாிக்க","விசாரிக்க"),
        ("சாம்ப சபிய","சற்றே பெரிய"),
        ("வச்சிுந்தாு","வச்சிருந்தாரு"),
        ("நட்டு வச்சாு","நட்டு வச்சாரு"),
        ("நியமிச்சாு","நியமிச்சாரு"),
        ("வளர்த்தாு","வளர்த்தாரு"),
        ("தன்னுறைய","தன்னுடைய"),
        ("பாத்துக்குை","பாத்துக்குற"),
        ("சாப்பிைாமல்","சாப்பிடாமல்"),
        ("இுக்குைதுக்கு","இருக்குறதுக்கு"),
        ("புடிங்கி","புடுங்கி"),
        ("அவுக்கு","அவருக்கு"),
        ("அவுறைய","அவருறைய"),
        ("நட்டு வச்சாரு","நட்டு வச்சாரு"),
        ("ஒு","ஒரு"),
    ]

    for wrong, correct in corrections:
        text = text.replace(wrong, correct)

    # Bulk character fixes — apply AFTER specific corrections
    text = text.replace("இு", "இரு")    # இு → இரு
    text = text.replace("திு", "திரு")   # திு → திரு
    text = text.replace("அவு ", "அவரு ") # அவு → அவரு

    return text


# ── Tamil OCR error fix ───────────────────────────────────────────────
def _fix_tamil_ocr_errors(text: str) -> str:
    """Fix common Tesseract OCR mistakes in Tamil text."""
    if not text:
        return text
    text = _normalize_tamil_unicode(text)
    corrections = [
        ("පපர",  "பேர"),   ("சசஞ்","செஞ்"),
        ("சசய்", "செய்"),  ("சசல்","செல்"),
        ("சசன்", "சென்"),  ("சசய", "செய"),
        ("அவபராை","அவரோட"), ("පපானான்","போனான்"),
        ("පපாயி","போயி"),  ("පපாகிற","போகிற"),
        ("பதாட்","தோட்"),  ("பதாணு","தோணு"),
        ("පපரரசு","பேரரசு"),("கிைக்கும்","கிடைக்கும்"),
        ("கிைந்த","கிடைந்த"),("வளக்க","வளர்க்க"),
    ]
    for wrong, correct in corrections:
        text = text.replace(wrong, correct)
    return text


# ── PDF ───────────────────────────────────────────────────────────────
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
    Extract text from PDF.
    Strategy:
    - For each page, convert to IMAGE first, then run OCR.
    - This bypasses Tamil font encoding issues completely.
    - If OCR gives nothing, fall back to direct text extraction.
    Returns (text, pdf_type)
    """
    import fitz
    try:
        doc = fitz.open(stream=content, filetype="pdf")
    except Exception:
        return "", "unknown"

    pdf_type = detect_pdf_type(content)
    text_parts = []

    for page_num, page in enumerate(doc):
        try:
            page_extracted = ""

            # STEP 1: Convert page to image and run OCR
            if TESSERACT_AVAILABLE:
                try:
                    # Render page as high-resolution image
                    pix = page.get_pixmap(dpi=300)
                    img_bytes = pix.tobytes("png")

                    from PIL import Image, ImageEnhance, ImageFilter
                    img = Image.open(io.BytesIO(img_bytes))

                    # Preprocess for better Tamil OCR
                    img = img.convert("RGB")
                    w, h = img.size
                    # Upscale if small
                    if w < 1500:
                        scale = 1500 / w
                        img = img.resize(
                            (int(w * scale), int(h * scale)),
                            resample=Image.LANCZOS
                        )
                    # Enhance contrast and sharpness
                    img = ImageEnhance.Contrast(img).enhance(2.0)
                    img = ImageEnhance.Sharpness(img).enhance(2.0)

                    # Run OCR with Tamil + English
                    ocr_text = pytesseract.image_to_string(
                        img,
                        lang="tam+eng",
                        config="--psm 6 --oem 1"
                    )

                    if ocr_text.strip():
                        page_extracted = ocr_text.strip()
                        print(f"[PDF] Page {page_num}: OCR got {len(page_extracted)} chars", flush=True)

                except Exception as ocr_err:
                    print(f"[PDF OCR] Page {page_num} failed: {ocr_err}", flush=True)

            # STEP 2: If OCR gave nothing, fall back to direct text extraction
            if not page_extracted:
                direct_text = page.get_text().strip()
                if direct_text:
                    direct_text = _fix_tamil_pdf_encoding(direct_text)
                    page_extracted = direct_text
                    print(f"[PDF] Page {page_num}: direct text got {len(page_extracted)} chars", flush=True)

            if page_extracted:
                text_parts.append(page_extracted)

        except Exception as page_err:
            print(f"[PDF] Page {page_num} failed: {page_err}", flush=True)

    doc.close()
    full_text = "\n".join(text_parts)
    print(f"[PDF] Total extracted: {len(full_text)} chars from {len(text_parts)} pages", flush=True)
    return full_text, pdf_type

# ── Summary ───────────────────────────────────────────────────────────
def generate_summary(text: str, max_sentences: int = 2) -> str:
    if not text or not text.strip():
        return "No content available for summary."
    if any("\u0B80" <= c <= "\u0BFF" for c in text):
        sentences = re.split(r'[।\.\n]+', text.strip())
    else:
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    meaningful = []
    for s in sentences:
        s = s.strip()
        if len(s) < 20:
            continue
        letter_ratio = sum(c.isalpha() for c in s) / max(len(s), 1)
        if letter_ratio < 0.35:
            continue
        meaningful.append(s)
    if not meaningful:
        return text.strip()[:200] + ("..." if len(text) > 200 else "")
    summary = " ".join(meaningful[:max_sentences])
    return summary[:300] + "..." if len(summary) > 300 else summary


# ── Image preprocessing ───────────────────────────────────────────────
def _preprocess_image_for_ocr(img):
    try:
        from PIL import ImageEnhance, ImageFilter
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        w, h = img.size
        if w < 1500:
            scale = 1500 / w
            img = img.resize((int(w * scale), int(h * scale)), resample=3)
        img = img.filter(ImageFilter.SHARPEN)
        img = ImageEnhance.Contrast(img).enhance(1.8)
        img = ImageEnhance.Sharpness(img).enhance(2.5)
        return img
    except Exception:
        return img


def _count_script_chars(text: str) -> dict:
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
    try:
        w, h = img.size
        regions = [
            img.crop((0,      h // 4, w,          h // 2    )),
            img.crop((0,      h // 3, w,          2 * h // 3)),
            img.crop((0,      h // 2, w,          3 * h // 4)),
            img.crop((w // 4, 0,      3 * w // 4, h         )),
        ]
        tamil_score   = 0.0
        total_samples = 0
        for region in regions:
            try:
                sample = pytesseract.image_to_string(
                    region, lang="tam+eng", config="--psm 6 --oem 1"
                )
                counts = _count_script_chars(sample)
                if counts["total"] > 3:
                    tamil_score   += counts["tamil"]
                    total_samples += 1
            except Exception:
                continue
        if total_samples == 0:
            return "tam+eng"
        avg_tamil = tamil_score / total_samples
        print(f"[Image OCR] Tamil score: {avg_tamil:.2f}", flush=True)
        return "tam+eng" if avg_tamil > 0.05 else "eng"
    except Exception as ex:
        print(f"[Image OCR] Script detection error: {ex}", flush=True)
        return "tam+eng"


# ── Image ─────────────────────────────────────────────────────────────
def extract_from_image(content: bytes) -> str:
    if not TESSERACT_AVAILABLE:
        return "Tesseract OCR not available."
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(content))
        img = _preprocess_image_for_ocr(img)
        script_lang = _detect_image_script(img)
        print(f"[Image OCR] Using lang={script_lang}", flush=True)
        config = "--psm 6 --oem 1" if "tam" in script_lang else "--psm 3 --oem 3"
        text = pytesseract.image_to_string(img, lang=script_lang, config=config)
        if not text.strip():
            print("[Image OCR] Empty — retrying with tam", flush=True)
            text = pytesseract.image_to_string(
                img, lang="tam", config="--psm 6 --oem 1"
            )
        if text.strip():
            text = _fix_tamil_ocr_errors(text)
        print(f"[Image OCR] Done — {len(text.split())} words", flush=True)
        return text
    except Exception as e:
        print(f"[Image OCR] Failed: {e}", flush=True)
        return ""


# ── Text ──────────────────────────────────────────────────────────────
def extract_from_text(content: bytes, encoding: str = "utf-8") -> str:
    try:
        import chardet
        detected = chardet.detect(content)
        enc = detected.get("encoding") or "utf-8"
        if (detected.get("confidence") or 0) < 0.7:
            enc = "utf-8"
    except ImportError:
        enc = encoding
    try:
        return content.decode(enc, errors="replace")
    except (UnicodeDecodeError, LookupError):
        return content.decode("utf-8", errors="replace")


# ── URL ───────────────────────────────────────────────────────────────
def extract_from_url(url: str, timeout: int = 15) -> str:
    headers = {"User-Agent": "Mozilla/5.0 (LRW Bot)"}
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text(separator="\n", strip=True)


# ── Audio ─────────────────────────────────────────────────────────────
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


# ── Main entry point ──────────────────────────────────────────────────
def extract(
    file_type: str,
    content: Optional[bytes] = None,
    url: Optional[str] = None,
) -> tuple:
    """Always returns (text, extra_info_dict)."""
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