# routes/summarize.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from services import extraction
from services.summarizer import get_text_summary

router = APIRouter(prefix="/summarize", tags=["summarize"])

@router.post("/text")
async def summarize_text(file: UploadFile = File(...)):
    try:
        content = await file.read()
        raw_text = extraction.extract("text", content=content)
        return {"summary": get_text_summary(raw_text)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/pdf")
async def summarize_pdf(file: UploadFile = File(...)):
    try:
        content = await file.read()
        raw_text = extraction.extract("pdf", content=content, filename=file.filename)
        return {"summary": get_text_summary(raw_text)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/image")
async def summarize_image(file: UploadFile = File(...)):
    try:
        content = await file.read()
        raw_text = extraction.extract("image", content=content, filename=file.filename)
        return {"summary": get_text_summary(raw_text)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/audio")
async def summarize_audio(file: UploadFile = File(...)):
    try:
        content = await file.read()
        raw_text = extraction.extract("audio", content=content)
        return {"summary": get_text_summary(raw_text)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/url")
async def summarize_url(url: str = Form(...)):
    try:
        raw_text = extraction.extract("url", url=url)
        return {"summary": get_text_summary(raw_text)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))