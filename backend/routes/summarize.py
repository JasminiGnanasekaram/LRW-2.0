"""Routes for document summarization using Groq AI and extraction services."""
import base64
import io
import re
import time
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.concurrency import run_in_threadpool
from groq import Groq
from PIL import Image

from typing import Optional
from config import get_settings
from services import extraction
from services.summarizer import get_text_summary

router = APIRouter(prefix="/summarize", tags=["summarize"])
settings = get_settings()

MODEL = "openai/gpt-oss-120b"

# Long documents are summarized piece by piece (each piece up to this many characters),
# then the piece summaries are summarized again. The input length is NOT limited.
CHUNK_CHARS = 6000


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


def _ask_groq(system: str, user: str, max_tokens: int = 1000) -> str:
    """One Groq chat call with a couple of retries (rate limits, short network errors)."""
    client = get_groq_client()
    last_error = None
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                max_tokens=max_tokens,
                temperature=0.3,
                extra_body={"reasoning_effort": "low"},  # faster answers from gpt-oss
            )
            return (response.choices[0].message.content or "").strip()
        except Exception as e:  # noqa: BLE001
            last_error = e
            time.sleep(2 * (attempt + 1))
    raise last_error


def _split_chunks(text: str, size: int = CHUNK_CHARS) -> list:
    """Split text into pieces of at most `size` characters, preferring sentence boundaries."""
    chunks, current, length = [], [], 0
    for piece in re.split(r"(?<=[.!?।॥])\s+|\n+", text):
        piece = piece.strip()
        if not piece:
            continue
        while len(piece) > size:  # a long run with no punctuation (common in OCR text)
            if current:
                chunks.append(" ".join(current))
                current, length = [], 0
            chunks.append(piece[:size])
            piece = piece[size:]
        if current and length + len(piece) + 1 > size:
            chunks.append(" ".join(current))
            current, length = [], 0
        current.append(piece)
        length += len(piece) + 1
    if current:
        chunks.append(" ".join(current))
    return chunks


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

    # Only the summary itself is short: 2 sentences. The document length is not limited.
    system_content = f"You are a summarizer. Respond in {lang}. Respond with exactly 2 informative sentences. Each sentence must be under 20 words. Never exceed 2 sentences."
    prompt_prefix = f"Summarize the following content in {lang} in 2 informative sentences. Each sentence must be under 20 words. Stop after 2 sentences:\n\n"
    part_system = f"You are a summarizer. Respond in {lang}. Summarize the passage in 3 to 5 factual sentences that keep its main points."
    part_prefix = f"Summarize this part of a longer document in {lang}:\n\n"

    try:
        working = text.strip()
        # Long document: summarize every piece, then summarize those summaries (repeat if needed)
        while len(working) > CHUNK_CHARS:
            chunks = _split_chunks(working)
            with ThreadPoolExecutor(max_workers=3) as pool:
                partials = list(pool.map(lambda c: _ask_groq(part_system, part_prefix + c, 600), chunks))
            condensed = "\n".join(p for p in partials if p)
            if not condensed or len(condensed) >= len(working):
                break
            working = condensed

        summary = _ask_groq(system_content, prompt_prefix + working)
        if summary:
            return summary
        raise ValueError("Groq returned an empty summary")
    except Exception as e:
        # Fallback to local extractive summary (reads the whole text) if Groq fails
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
        raw_text = await run_in_threadpool(extraction.extract, "text", content=content)
        return {"summary": await run_in_threadpool(summarize, raw_text)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/pdf")
async def summarize_pdf(file: UploadFile = File(...)):
    try:
        content = await file.read()
        raw_text = await run_in_threadpool(extraction.extract, "pdf", content=content, filename=file.filename)
        return {"summary": await run_in_threadpool(summarize, raw_text)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/image")
async def summarize_image(file: UploadFile = File(...)):
    try:
        content = await file.read()
        raw_text = await run_in_threadpool(extraction.extract, "image", content=content, filename=file.filename)
        return {"summary": await run_in_threadpool(summarize, raw_text)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/audio")
async def summarize_audio(file: UploadFile = File(...), language: Optional[str] = Form(None)):
    try:
        content = await file.read()
        raw_text = await run_in_threadpool(extraction.extract, "audio", content=content)
        return {"summary": await run_in_threadpool(summarize, raw_text)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/url")
async def summarize_url(url: str = Form(...)):
    try:
        raw_text = await run_in_threadpool(extraction.extract, "url", url=url)
        return {"summary": await run_in_threadpool(summarize, raw_text)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))