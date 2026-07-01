from fastapi import APIRouter, UploadFile, File, Form
from groq import Groq
import pdfplumber
import httpx
import base64
import io
from bs4 import BeautifulSoup
import fitz  # pymupdf
from PIL import Image
from config import get_settings

router = APIRouter(prefix="/summarize", tags=["summarize"])

# ── Groq setup ────────────────────────────────────────
_settings = get_settings()
client = Groq(api_key=_settings.GROQ_API_KEY)
MODEL = "llama-3.3-70b-versatile"

PROMPT = "Summarize the following content in 2 informative sentences. Each sentence must be under 20 words. Stop after 2 sentences:\n\n"


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


# ── PDF ───────────────────────────────────────────────
@router.post("/pdf")
async def summarize_pdf(file: UploadFile = File(...)):
    content = await file.read()

    # STEP A: Try to extract text first
    text = ""
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            text += page.extract_text() or ""

    # STEP B: If text found → summarize text directly
    if text.strip():
        return {"summary": summarize(text[:5000])}

    # STEP C: If no text (image-based PDF) → convert first page to image
    pdf_doc = fitz.open(stream=content, filetype="pdf")
    page = pdf_doc[0]
    mat = fitz.Matrix(2, 2)
    pix = page.get_pixmap(matrix=mat)

    # Compress the image
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    img = img.convert("RGB")
    img.thumbnail((800, 800))
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=70)
    buffer.seek(0)
    b64 = base64.b64encode(buffer.read()).decode("utf-8")

    # STEP D: Send image to vision model
    return {"summary": summarize_image_b64(b64)}


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