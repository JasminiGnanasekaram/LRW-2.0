from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from starlette.concurrency import run_in_threadpool
from groq import Groq
import pdfplumber
import pytesseract
import httpx
import base64
import io
from bs4 import BeautifulSoup
import fitz  # pymupdf
from PIL import Image

router = APIRouter(prefix="/summarize", tags=["summarize"])

# ── Groq setup ────────────────────────────────────────
import os
client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
# Groq client configured elsewhere
MODEL = "llama-3.3-70b-versatile"

PROMPT = "Summarize the following content in 2 informative sentences. Each sentence must be under 20 words. Stop after 2 sentences:\n\n"

# ── PDF settings ──────────────────────────────────────
# Languages Tesseract should use for OCR. Change in .env if needed.
OCR_LANGS = os.getenv("OCR_LANGS", "eng+sin+tam")
# Words per chunk when a PDF is too long to summarize in one go.
CHUNK_WORDS = 1200


# ── Helper: compress image ─────────────────────────────
def compress_image(image_bytes: bytes, mime_type: str = None) -> str:
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = img.convert("RGB")
        img.thumbnail((800, 800))
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=70)
        buffer.seek(0)
        return base64.b64encode(buffer.read()).decode("utf-8")
    except Exception:
        # If PIL fails, just return raw base64
        return base64.b64encode(image_bytes).decode("utf-8")

# ── Helper: summarize text ────────────────────────────
def summarize(text: str) -> str:
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": "You are a summarizer. Respond with exactly 2 informative sentences. Each sentence must be under 20 words. Never exceed 2 sentences."
            },
            {
                "role": "user",
                "content": PROMPT + text
            }
        ],
        max_tokens=80,
        temperature=0.3,
    )
    return response.choices[0].message.content


# ── Helper: summarize image (base64) ─────────────────
def summarize_image_b64(b64: str) -> str:
    response = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {
                "role": "system",
                "content": "You are a summarizer. Respond with exactly 2 informative sentences. Each sentence must be under 20 words."
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Summarize the full content of this image in exactly 2 short sentences."
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{b64}"
                        }
                    }
                ]
            }
        ],
        max_tokens=80,
        temperature=0.3,
    )
    return response.choices[0].message.content


# ── TEXT ──────────────────────────────────────────────
@router.post("/text")
async def summarize_text(file: UploadFile = File(...)):
    text = (await file.read()).decode("utf-8")
    return {"summary": summarize(text[:5000])}


# ── PDF helpers ───────────────────────────────────────
def extract_text_layer(content: bytes) -> str:
    """Read the normal text layer of the PDF (works for Unicode text PDFs)."""
    parts = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            parts.append(page.extract_text() or "")
    return "\n".join(parts)


def looks_garbled(text: str) -> bool:
    """
    Non-Unicode (legacy font) PDFs usually extract as odd Latin symbols,
    replacement characters or (cid:123) codes instead of real letters.
    """
    sample = text[:3000]
    if "(cid:" in sample or "\ufffd" in sample:
        return True
    letters = [c for c in sample if c.isalpha()]
    if not letters:
        return True
    odd = sum(1 for c in letters if 0x80 <= ord(c) <= 0x24F)
    return odd / len(letters) > 0.3


def ocr_pdf(content: bytes) -> str:
    """OCR every page, so scanned and non-Unicode PDFs work too."""
    doc = fitz.open(stream=content, filetype="pdf")
    parts = []
    for page in doc:
        pix = page.get_pixmap(dpi=300)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        parts.append(pytesseract.image_to_string(img, lang=OCR_LANGS))
    return "\n".join(parts)


def chunk_text(text: str, max_words: int = CHUNK_WORDS):
    words = text.split()
    return [" ".join(words[i:i + max_words]) for i in range(0, len(words), max_words)]


def summarize_long(text: str) -> str:
    """
    No word limit: split into chunks, summarize each chunk,
    then summarize the summaries until one summary is left.
    """
    for _ in range(3):
        chunks = chunk_text(text)
        if len(chunks) <= 1:
            return summarize(chunks[0] if chunks else text)
        text = "\n".join(summarize(c) for c in chunks)
    return summarize(text)


def _summarize_pdf_bytes(content: bytes) -> str:
    # 1. Try the normal text layer first
    text = extract_text_layer(content)

    # 2. No text, or garbled text (non-Unicode font) -> OCR
    if not text.strip() or looks_garbled(text):
        try:
            text = ocr_pdf(content)
        except pytesseract.TesseractNotFoundError:
            raise HTTPException(
                status_code=500,
                detail="OCR engine (Tesseract) is not installed on the server.",
            )

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="No text could be extracted from this PDF.",
        )

    # 3. Summarize with Groq (any length)
    return summarize_long(text)


# ── PDF ───────────────────────────────────────────────
@router.post("/pdf")
async def summarize_pdf(file: UploadFile = File(...)):
    content = await file.read()
    # OCR and Groq calls are slow/blocking, so run them off the event loop
    summary = await run_in_threadpool(_summarize_pdf_bytes, content)
    return {"summary": summary}


# ── IMAGE ─────────────────────────────────────────────
@router.post("/image")
async def summarize_image(file: UploadFile = File(...)):
    content = await file.read()
    mime_type = file.content_type or "image/jpeg"

    # If it's a PDF uploaded as image → handle as PDF
    if mime_type == "application/pdf" or file.filename.endswith(".pdf"):
        pdf_doc = fitz.open(stream=content, filetype="pdf")
        page = pdf_doc[0]
        mat = fitz.Matrix(2, 2)
        pix = page.get_pixmap(matrix=mat)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        img = img.convert("RGB")
        img.thumbnail((800, 800))
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=70)
        buffer.seek(0)
        b64 = base64.b64encode(buffer.read()).decode("utf-8")
    else:
        # Normal image → compress and encode
        try:
            img = Image.open(io.BytesIO(content))
            img = img.convert("RGB")
            img.thumbnail((800, 800))
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=70)
            buffer.seek(0)
            b64 = base64.b64encode(buffer.read()).decode("utf-8")
        except Exception:
            b64 = base64.b64encode(content).decode("utf-8")

    return {"summary": summarize_image_b64(b64)}

# ── AUDIO ─────────────────────────────────────────────
@router.post("/audio")
async def summarize_audio(file: UploadFile = File(...)):
    content = await file.read()

    # Transcribe audio using Whisper
    transcription = client.audio.transcriptions.create(
        file=(file.filename, content, file.content_type),
        model="whisper-large-v3",
    )
    text = transcription.text

    if not text.strip():
        return {"summary": "Could not transcribe audio content."}

    return {"summary": summarize(text[:5000])}


# ── URL ───────────────────────────────────────────────
@router.post("/url")
async def summarize_url(url: str = Form(...)):
    async with httpx.AsyncClient() as c:
        r = await c.get(url, follow_redirects=True)
    text = BeautifulSoup(r.text, "html.parser").get_text(" ", strip=True)

    if not text.strip():
        return {"summary": "Could not extract content from this URL."}

    return {"summary": summarize(text[:5000])}