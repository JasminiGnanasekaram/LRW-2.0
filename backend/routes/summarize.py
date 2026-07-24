from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from groq import Groq, AuthenticationError, APIStatusError, APIConnectionError
import pdfplumber
import httpx
import base64
import io
from bs4 import BeautifulSoup
import fitz  # pymupdf
from PIL import Image

from config import get_settings

router = APIRouter(prefix="/summarize", tags=["summarize"])

settings = get_settings()

# ── Groq setup ────────────────────────────────────────
def get_groq_client():
    api_key = settings.GROQ_API_KEY
    if api_key:
        api_key = api_key.strip().strip("'\"")

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Groq API key is not configured. Please set GROQ_API_KEY in your backend/.env file."
        )

    if "..." in api_key:
        raise HTTPException(
            status_code=401,
            detail=(
                f"Groq API key authentication failed. The loaded key '{api_key}' appears to be a placeholder with dots. "
                "Please replace it with your actual Groq API key (e.g. gsk_...) in your backend/.env file."
            )
        )
    return Groq(api_key=api_key)

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
    # Detect language of the text to instruct the model to respond in the same language
    lang = "English"
    
    # Check Unicode blocks first for Sinhala and Tamil as standard langdetect lacks Sinhala support
    sinhala_chars = sum(1 for char in text[:2000] if '\u0d80' <= char <= '\u0dff')
    tamil_chars = sum(1 for char in text[:2000] if '\u0b80' <= char <= '\u0bff')
    
    if sinhala_chars > 0 and sinhala_chars > tamil_chars:
        lang = "Sinhala"
    elif tamil_chars > 0 and tamil_chars > sinhala_chars:
        lang = "Tamil"
    else:
        try:
            from langdetect import detect
            code = detect(text[:2000])
            lang_map = {
                "en": "English",
                "ta": "Tamil",
                "si": "Sinhala",
                "es": "Spanish",
                "fr": "French",
                "de": "German",
                "it": "Italian",
                "pt": "Portuguese",
                "nl": "Dutch",
                "zh-cn": "Chinese",
                "zh-tw": "Chinese",
            }
            lang = lang_map.get(code, "English")
        except Exception:
            pass

    system_content = f"You are a summarizer. Respond in {lang}. Respond with exactly 2 informative sentences. Each sentence must be under 20 words. Never exceed 2 sentences."
    prompt_prefix = f"Summarize the following content in {lang} in 2 informative sentences. Each sentence must be under 20 words. Stop after 2 sentences:\n\n"

    try:
        client = get_groq_client()
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": system_content
                },
                {
                    "role": "user",
                    "content": prompt_prefix + text
                }
            ],
            max_tokens=250 if lang != "English" else 80,
            temperature=0.3,
        )
        return response.choices[0].message.content
    except AuthenticationError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Groq API authentication failed. The provided API key is invalid: {e.message}"
        )
    except APIStatusError as e:
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=f"Groq API error (status {e.status_code}): {e.message}"
        )
    except APIConnectionError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to Groq API: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during summarization: {str(e)}"
        )


# ── Helper: summarize image (base64) ─────────────────
def summarize_image_b64(b64: str) -> str:
    try:
        client = get_groq_client()
        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a summarizer. Respond in the same language as the text in the image "
                        "(e.g., if the text in the image is in Tamil, the summary must be in Tamil). "
                        "Respond with exactly 2 informative sentences. Each sentence must be under 20 words."
                    )
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Summarize the full content of this image in exactly 2 short sentences. "
                                "The summary must be in the same language as the text in the image (e.g. Tamil or English)."
                            )
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
            max_tokens=250,
            temperature=0.3,
        )
        return response.choices[0].message.content
    except AuthenticationError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Groq API authentication failed. The provided API key is invalid: {e.message}"
        )
    except APIStatusError as e:
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=f"Groq API error (status {e.status_code}): {e.message}"
        )
    except APIConnectionError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to Groq API: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during image summarization: {str(e)}"
        )


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
    try:
        client = get_groq_client()
        # Transcribe audio using Whisper
        transcription = client.audio.transcriptions.create(
            file=(file.filename, content, file.content_type),
            model="whisper-large-v3",
        )
        text = transcription.text
    except AuthenticationError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Groq API authentication failed. The provided API key is invalid: {e.message}"
        )
    except APIStatusError as e:
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=f"Groq API error (status {e.status_code}): {e.message}"
        )
    except APIConnectionError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to Groq API: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during audio transcription: {str(e)}"
        )

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