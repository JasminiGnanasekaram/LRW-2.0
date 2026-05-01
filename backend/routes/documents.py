from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from datetime import datetime
from bson import ObjectId
import json

from models import URLUpload, MetadataIn
from database import (
    raw_documents_col,
    cleaned_documents_col,
    document_metadata_col,
    nlp_analysis_col,
    sources_col,
)
from services import extraction, cleaning, nlp
from services.csv_export import document_to_csv, documents_summary_csv
from utils.security import get_current_user
from config import get_settings
from database import processing_jobs_col

router = APIRouter(prefix="/documents", tags=["documents"])


def _doc_out(raw, cleaned=None, meta=None, analysis=None):
    return {
        "id": str(raw["_id"]),
        "user_id": str(raw["user_id"]),
        "filename": raw.get("filename"),
        "file_type": raw.get("file_type"),
        "raw_text": raw.get("raw_text"),
        "cleaned_text": cleaned.get("text") if cleaned else None,
        "metadata": meta.get("data") if meta else None,
        "nlp": analysis.get("data") if analysis else None,
        "created_at": raw.get("created_at"),
    }


@router.post("/upload")
async def upload(
    file: UploadFile | None = File(None),
    file_type: str = Form(...),  # text | pdf | image | audio | url
    url: str | None = Form(None),
    metadata: str | None = Form(None),  # JSON string
    user: dict = Depends(get_current_user),
):
    """Upload a document or URL. Runs extraction + cleaning + NLP synchronously (MVP)."""
    if user["role"] == "guest":
        raise HTTPException(status_code=403, detail="Guests cannot upload")

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
            raw_text = extraction.extract(file_type, content=content)
        except NotImplementedError as e:
            raise HTTPException(status_code=501, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Extraction failed: {e}")
        filename = file.filename

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
    await nlp_analysis_col.insert_one(analysis_doc)

    return _doc_out(raw_doc, cleaned_doc, meta_doc, analysis_doc)


@router.get("/")
async def list_documents(user: dict = Depends(get_current_user), limit: int = 50):
    cursor = raw_documents_col.find({"user_id": ObjectId(user["id"])}).sort("created_at", -1).limit(limit)
    out = []
    async for raw in cursor:
        cleaned = await cleaned_documents_col.find_one({"raw_document_id": raw["_id"]})
        meta = await document_metadata_col.find_one({"raw_document_id": raw["_id"]})
        analysis = None
        if cleaned:
            analysis = await nlp_analysis_col.find_one({"cleaned_document_id": cleaned["_id"]})
        out.append(_doc_out(raw, cleaned, meta, analysis))
    return out


@router.get("/{doc_id}")
async def get_document(doc_id: str, user: dict = Depends(get_current_user)):
    raw = await raw_documents_col.find_one({"_id": ObjectId(doc_id)})
    if not raw:
        raise HTTPException(status_code=404, detail="Not found")
    if str(raw["user_id"]) != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    cleaned = await cleaned_documents_col.find_one({"raw_document_id": raw["_id"]})
    meta = await document_metadata_col.find_one({"raw_document_id": raw["_id"]})
    analysis = None
    if cleaned:
        analysis = await nlp_analysis_col.find_one({"cleaned_document_id": cleaned["_id"]})
    return _doc_out(raw, cleaned, meta, analysis)


@router.get("/{doc_id}/export")
async def export_document(doc_id: str, format: str = "json", user: dict = Depends(get_current_user)):
    """Export a processed document. format = json | csv."""
    doc = await get_document(doc_id, user)
    safe_doc = json.loads(json.dumps(doc, default=str))

    if format == "json":
        return JSONResponse(content=safe_doc)
    if format == "csv":
        csv_text = document_to_csv(safe_doc)
        filename = (doc.get("filename") or "document").rsplit(".", 1)[0] + ".csv"
        return PlainTextResponse(
            csv_text,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    raise HTTPException(status_code=400, detail="Unsupported format. Use json or csv.")


@router.get("/export/all")
async def export_all(format: str = "csv", user: dict = Depends(get_current_user)):
    """Bulk export the user's documents as a summary table (csv) or list (json)."""
    docs = await list_documents(user=user, limit=10_000)
    safe_docs = json.loads(json.dumps(docs, default=str))
    if format == "csv":
        return PlainTextResponse(
            documents_summary_csv(safe_docs),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="lrw_documents.csv"'},
        )
    return JSONResponse(content=safe_docs)
