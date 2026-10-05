"""Routes for document summarization using Groq AI and extraction services."""
import base64
import io
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from groq import Groq
from PIL import Image

from typing import Optional
from config import get_settings
from services import extraction
from services.summarizer import get_text_summary

router = APIRouter(prefix="/summarize", tags=["summarize"])
settings = get_settings()

MODEL = "llama-3.3-70b-versatile"


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


def compress_image(image_bytes: bytes, mime_type: Optional[str] = None) -> str:
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = img.convert("RGB")
        img.thumbnail((800, 800))
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=70)
        buffer.seek(0)
        return base64.b64encode(buffer.read()).decode("utf-8")
    except Exception:
        return base64.b64encode(image_bytes).decode("utf-8")


def summarize(text: str) -> str:
    if not text or not text.strip():
        return "No text content found to summarize."

    # Detect language of the text
    lang = "English"
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
                "en": "English", "ta": "Tamil", "si": "Sinhala",
                "es": "Spanish", "fr": "French", "de": "German",
                "it": "Italian", "pt": "Portuguese", "nl": "Dutch",
                "zh-cn": "Chinese", "zh-tw": "Chinese",
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
                {"role": "system", "content": system_content},
                {"role": "user", "content": prompt_prefix + text[:5000]}
            ],
            max_tokens=250 if lang != "English" else 80,
            temperature=0.3,
        )
        return response.choices[0].message.content
    except Exception as e:
        # Fallback to local extractive summary if Groq fails or API key is not configured
        print(f"[Summarize] Groq AI failed ({e}), using extractive summarizer fallback.", flush=True)
        return get_text_summary(text)


def summarize_image_b64(b64: str) -> str:
    try:
        client = get_groq_client()
        response = client.chat.completions.create(
            model="llama-3.2-11b-vision-preview",
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
    except Exception as e:
        print(f"[Summarize Image] Groq vision failed: {e}", flush=True)
        return "Could not process image for vision summarization."


@router.post("/text")
async def summarize_text(file: UploadFile = File(...)):
    try:
        content = await file.read()
        raw_text = extraction.extract("text", content=content)
        return {"summary": summarize(raw_text)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/pdf")
async def summarize_pdf(file: UploadFile = File(...)):
    try:
        content = await file.read()
        raw_text = extraction.extract("pdf", content=content, filename=file.filename)
        return {"summary": summarize(raw_text)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/image")
async def summarize_image(file: UploadFile = File(...)):
    try:
        content = await file.read()
        raw_text = extraction.extract("image", content=content, filename=file.filename)
        return {"summary": summarize(raw_text)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/audio")
async def summarize_audio(file: UploadFile = File(...)):
    try:
        content = await file.read()
        raw_text = extraction.extract("audio", content=content)
        return {"summary": summarize(raw_text)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/url")
async def summarize_url(url: str = Form(...)):
    try:
        raw_text = extraction.extract("url", url=url)
        return {"summary": summarize(raw_text)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))