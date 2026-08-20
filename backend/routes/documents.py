from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from datetime import datetime
from bson import ObjectId
import json
import re

from typing import Optional
from models import MetadataIn
from database import (
    raw_documents_col,
    cleaned_documents_col,
    document_metadata_col,
    nlp_analysis_col,
    sources_col,
    processing_jobs_col,
)
from services import extraction, cleaning, nlp
from services.csv_export import document_to_csv, documents_summary_csv
from utils.security import get_current_user
from config import get_settings

# TODO: verify these import paths match where these functions actually live in your project
from utils.gridfs import get_gridfs_bucket        # adjust path if needed
from services.pdf_utils import detect_pdf_type    # adjust path if needed
from services.summarize_utils import get_text_summary  # adjust path if needed

router = APIRouter(prefix="/documents", tags=["documents"])


# ── Safe filename for HTTP headers (Latin-1 safe) ─────────────────────
def _safe_filename(name: str) -> str:
    """Strip non-ASCII and special chars so filename is safe for HTTP headers."""
    name = name.rsplit(".", 1)[0] if "." in name else name
    name = name.encode("ascii", errors="ignore").decode("ascii")
    name = re.sub(r'[^\w\-.]', '_', name)
    name = re.sub(r'_+', '_', name).strip('_')
    return name or "document"


# ── GridFS helpers ────────────────────────────────────────────────────
async def _store_text_gridfs(text: str, filename: str, file_type: str, user_id: str) -> object:
    bucket = get_gridfs_bucket()
    file_id = await bucket.upload_from_stream(
        filename,
        text.encode("utf-8"),
        metadata={"file_type": file_type, "user_id": user_id},
    )
    return file_id


async def _fetch_text_gridfs(gridfs_id) -> str:
    bucket = get_gridfs_bucket()
    stream = await bucket.open_download_stream(gridfs_id)
    return (await stream.read()).decode("utf-8")


# ── Document output builder ───────────────────────────────────────────
async def _doc_out(raw, cleaned=None, meta=None, analysis=None):
    raw_text = raw.get("raw_text")
    if not raw_text and raw.get("gridfs_id"):
        raw_text = await _fetch_text_gridfs(raw["gridfs_id"])

    # Generate summary: prefer stored summary, fallback to extractive summary
    summary = raw.get("summary") or (get_text_summary(raw_text) if raw_text else None)

    return {
        "id":           str(raw["_id"]),
        "user_id":      str(raw["user_id"]),
        "filename":     raw.get("filename"),
        "file_type":    raw.get("file_type"),
        "pdf_type":     raw.get("pdf_type"),
        "raw_text":     raw_text,
        "summary":      summary,
        "cleaned_text": cleaned.get("text") if cleaned else None,
        "metadata": meta.get("data") if meta else None,
        "nlp": analysis.get("data") if analysis else None,
        "created_at": raw.get("created_at"),
    }


@router.post("/upload")
async def upload(
    file: Optional[UploadFile] = File(None),
    file_type: str = Form(...),   # text | pdf | image | audio | url
    url: Optional[str] = Form(None),
    metadata: Optional[str] = Form(None),  # JSON string
    user: dict = Depends(get_current_user),
):
    """Upload a document or URL. Runs extraction + cleaning + NLP synchronously (MVP)."""
    settings = get_settings()
    if settings.USE_CELERY:
        # Async path: enqueue a Celery task and return a job id immediately.
        import base64
        from celery_app import celery

        content_b64 = None
        filename = url if file_type == "url" else (file.filename if file else None)
        if file_type != "url":
            if not file:
                raise HTTPException(status_code=400, detail="file required")
            content_b64 = base64.b64encode(await file.read()).decode()

        src = await sources_col.insert_one({
            "user_id": ObjectId(user["id"]), "type": file_type,
            "name": filename, "created_at": datetime.utcnow(),
        })
        raw_res = await raw_documents_col.insert_one({
            "user_id": ObjectId(user["id"]), "source_id": src.inserted_id,
            "filename": filename, "file_type": file_type,
            "raw_text": "", "created_at": datetime.utcnow(),
        })
        job_res = await processing_jobs_col.insert_one({
            "user_id": ObjectId(user["id"]),
            "raw_document_id": raw_res.inserted_id,
            "status": "queued",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })
        celery.send_task(
            "lrw.process_document",
            args=[str(job_res.inserted_id), str(raw_res.inserted_id), file_type, content_b64, url],
        )
        return {"async": True, "job_id": str(job_res.inserted_id), "raw_document_id": str(raw_res.inserted_id)}

    # 1. Extract raw text (sync path)
    pdf_type = None
    if file_type == "url":
        if not url:
            raise HTTPException(status_code=400, detail="url field required for url uploads")
        try:
            raw_text = extraction.extract(file_type, url=url)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"URL extraction failed: {e}")
        filename = url
    else:
        if not file:
            raise HTTPException(status_code=400, detail="file required")
        content = await file.read()
        try:
            raw_text = extraction.extract(file_type, content=content, filename=file.filename)
        except NotImplementedError as e:
            raise HTTPException(status_code=501, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Extraction failed: {e}")
        filename = file.filename

        # Detect PDF type if applicable
        if file_type == "pdf":
            try:
                pdf_type = detect_pdf_type(content)
            except Exception:
                pdf_type = None

    # 2. Save source + raw doc
    src = await sources_col.insert_one({
        "user_id": ObjectId(user["id"]),
        "type": file_type,
        "name": filename,
        "created_at": datetime.utcnow(),
    })
    raw_doc = {
        "user_id": ObjectId(user["id"]),
        "source_id": src.inserted_id,
        "filename": filename,
        "file_type": file_type,
        "pdf_type": pdf_type,
        "raw_text": raw_text,
        "created_at": datetime.utcnow(),
    }
    raw_res = await raw_documents_col.insert_one(raw_doc)
    raw_doc["_id"] = raw_res.inserted_id

    # 3. Clean
    cleaned_text = cleaning.clean(raw_text)
    cleaned_doc = {
        "user_id": ObjectId(user["id"]),
        "raw_document_id": raw_res.inserted_id,
        "text": cleaned_text,
        "created_at": datetime.utcnow(),
    }
    cl_res = await cleaned_documents_col.insert_one(cleaned_doc)
    cleaned_doc["_id"] = cl_res.inserted_id

    # 4. Metadata
    meta_data = {}
    if metadata:
        try:
            meta_data = MetadataIn(**json.loads(metadata)).model_dump()
        except Exception:
            meta_data = {}
    meta_doc = {
        "raw_document_id": raw_res.inserted_id,
        "data": meta_data,
        "created_at": datetime.utcnow(),
    }
    await document_metadata_col.insert_one(meta_doc)

    # 5. NLP
    analysis_data = nlp.analyze(cleaned_text)
    analysis_doc = {
        "cleaned_document_id": cl_res.inserted_id,
        "data": analysis_data,
        "created_at": datetime.utcnow(),
    }
    await nlp_analysis_col.insert_one(analysis_doc