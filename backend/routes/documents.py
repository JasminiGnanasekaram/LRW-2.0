from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from datetime import datetime
from bson import ObjectId
import json
import re

from models import URLUpload, MetadataIn
from database import (
    raw_documents_col,
    cleaned_documents_col,
    document_metadata_col,
    nlp_analysis_col,
    sources_col,
    get_gridfs_bucket,
)
from services import extraction, cleaning, nlp
from services.csv_export import document_to_csv, documents_summary_csv
from services.summarizer import get_text_summary
from services.extraction import detect_pdf_type
from utils.security import get_current_user
from config import get_settings
from database import processing_jobs_col

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

    # Generate summary from raw text
    summary = get_text_summary(raw_text) if raw_text else None

    return {
        "id":           str(raw["_id"]),
        "user_id":      str(raw["user_id"]),
        "filename":     raw.get("filename"),
        "file_type":    raw.get("file_type"),
        "pdf_type":     raw.get("pdf_type"),
        "raw_text":     raw_text,
        "cleaned_text": cleaned.get("text") if cleaned else None,
        "metadata":     meta.get("data") if meta else None,
        "nlp":          analysis.get("data") if analysis else None,
        "summary":      summary,
        "created_at":   raw.get("created_at"),
    }


# ── Upload ────────────────────────────────────────────────────────────
@router.post("/upload")
async def upload(
    file: UploadFile | None = File(None),
    file_type: str = Form(...),   # text | pdf | image | audio | url
    url: str | None = Form(None),
    metadata: str | None = Form(None),  # JSON string
    user: dict = Depends(get_current_user),
):
    """Upload a document or URL. Runs extraction + cleaning + NLP synchronously."""

    settings = get_settings()
    if settings.USE_CELERY:
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
        return {
            "async": True,
            "job_id": str(job_res.inserted_id),
            "raw_document_id": str(raw_res.inserted_id),
        }

    # 1. Extract raw text (sync path)
    pdf_type = None
    content = None
    
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
        
        # Detect PDF type if applicable
        if file_type == "pdf":
            try:
                pdf_type = detect_pdf_type(content)
            except Exception:
                pdf_type = None  # If detection fails, leave it as None

    # 2. Save source
    src = await sources_col.insert_one({
        "user_id":    ObjectId(user["id"]),
        "type":       file_type,
        "name":       filename,
        "created_at": datetime.utcnow(),
    })

    # 3. Store raw text — GridFS if > 8 MB, inline otherwise
    raw_text_bytes = raw_text.encode("utf-8")
    gridfs_id      = None

    if len(raw_text_bytes) > 8 * 1024 * 1024:
        gridfs_id       = await _store_text_gridfs(raw_text, filename, file_type, user["id"])
        stored_raw_text = ""
    else:
        stored_raw_text = raw_text

    raw_doc = {
        "user_id":    ObjectId(user["id"]),
        "source_id":  src.inserted_id,
        "filename":   filename,
        "file_type":  file_type,
        "raw_text":   stored_raw_text,
        "gridfs_id":  gridfs_id,
        "created_at": datetime.utcnow(),
    }
    if pdf_type:
        raw_doc["pdf_type"] = pdf_type
    
    raw_res        = await raw_documents_col.insert_one(raw_doc)
    raw_doc["_id"] = raw_res.inserted_id

    # 4. Clean
    cleaned_text = cleaning.clean(raw_text)
    if not cleaned_text.strip():
        cleaned_text = raw_text or ""

    cleaned_doc = {
        "user_id":          ObjectId(user["id"]),
        "raw_document_id":  raw_res.inserted_id,
        "text":             cleaned_text,
        "created_at":       datetime.utcnow(),
    }
    cl_res             = await cleaned_documents_col.insert_one(cleaned_doc)
    cleaned_doc["_id"] = cl_res.inserted_id

    # 5. Metadata
    meta_data = {}
    if metadata:
        try:
            meta_data = MetadataIn(**json.loads(metadata)).model_dump()
        except Exception:
            meta_data = {}
    meta_doc = {
        "raw_document_id": raw_res.inserted_id,
        "data":            meta_data,
        "created_at":      datetime.utcnow(),
    }
    await document_metadata_col.insert_one(meta_doc)

    # 6. NLP
    print(f"[DOC] Running NLP on {len(cleaned_text)} chars", flush=True)
    analysis_data = nlp.analyze(cleaned_text)
    print(f"[DOC] sentiment={analysis_data.get('sentiment')}", flush=True)
    print(f"[DOC] classification keys={list((analysis_data.get('classification') or {}).keys())}", flush=True)

    analysis_doc = {
        "cleaned_document_id": cl_res.inserted_id,
        "data":                analysis_data,
        "created_at":          datetime.utcnow(),
    }
    await nlp_analysis_col.insert_one(analysis_doc)

    return await _doc_out(raw_doc, cleaned_doc, meta_doc, analysis_doc)


# ── List documents ────────────────────────────────────────────────────
@router.get("/")
async def list_documents(user: dict = Depends(get_current_user), limit: int = 50):
    cursor = raw_documents_col.find(
        {"user_id": ObjectId(user["id"])}
    ).sort("created_at", -1).limit(limit)

    out = []
    async for raw in cursor:
        cleaned  = await cleaned_documents_col.find_one({"raw_document_id": raw["_id"]})
        meta     = await document_metadata_col.find_one({"raw_document_id": raw["_id"]})
        analysis = None
        if cleaned:
            analysis = await nlp_analysis_col.find_one({"cleaned_document_id": cleaned["_id"]})
        out.append(await _doc_out(raw, cleaned, meta, analysis))
    return out


# ── Get single document ───────────────────────────────────────────────
@router.get("/{doc_id}")
async def get_document(doc_id: str, user: dict = Depends(get_current_user)):
    raw = await raw_documents_col.find_one({"_id": ObjectId(doc_id)})
    if not raw:
        raise HTTPException(status_code=404, detail="Not found")
    if str(raw["user_id"]) != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    cleaned  = await cleaned_documents_col.find_one({"raw_document_id": raw["_id"]})
    meta     = await document_metadata_col.find_one({"raw_document_id": raw["_id"]})
    analysis = None
    if cleaned:
        analysis = await nlp_analysis_col.find_one({"cleaned_document_id": cleaned["_id"]})

    return await _doc_out(raw, cleaned, meta, analysis)


# ── Delete document ───────────────────────────────────────────────────
@router.delete("/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    raw = await raw_documents_col.find_one({"_id": ObjectId(doc_id)})
    if not raw:
        raise HTTPException(status_code=404, detail="Not found")
    if str(raw["user_id"]) != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    # Delete GridFS file if exists
    if raw.get("gridfs_id"):
        bucket = get_gridfs_bucket()
        await bucket.delete(raw["gridfs_id"])

    cleaned = await cleaned_documents_col.find_one({"raw_document_id": raw["_id"]})

    await raw_documents_col.delete_one({"_id": raw["_id"]})
    await cleaned_documents_col.delete_one({"raw_document_id": raw["_id"]})
    await document_metadata_col.delete_one({"raw_document_id": raw["_id"]})
    await sources_col.delete_one({"_id": raw.get("source_id")})

    if cleaned:
        await nlp_analysis_col.delete_one({"cleaned_document_id": cleaned["_id"]})

    return {"detail": "Deleted successfully"}


# ── Export single document ────────────────────────────────────────────
@router.get("/{doc_id}/export")
async def export_document(
    doc_id: str,
    format: str = "json",
    user: dict = Depends(get_current_user),
):
    """Export a processed document. format = json | csv."""
    doc      = await get_document(doc_id, user)
    safe_doc = json.loads(json.dumps(doc, default=str))
    name     = _safe_filename(doc.get("filename") or "document")

    if format == "json":
        json_text = json.dumps(safe_doc, indent=2, ensure_ascii=True)
        return PlainTextResponse(
            json_text,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{name}.json"'},
        )

    if format == "csv":
        csv_text = document_to_csv(safe_doc)
        return PlainTextResponse(
            csv_text,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{name}.csv"'},
        )

    raise HTTPException(status_code=400, detail="Unsupported format. Use json or csv.")


# ── Bulk export ───────────────────────────────────────────────────────
@router.get("/export/all")
async def export_all(format: str = "csv", user: dict = Depends(get_current_user)):
    """Bulk export the user's documents as a summary table (csv) or list (json)."""
    docs      = await list_documents(user=user, limit=10_000)
    safe_docs = json.loads(json.dumps(docs, default=str))

    if format == "csv":
        return PlainTextResponse(
            documents_summary_csv(safe_docs),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="lrw_documents.csv"'},
        )

    return JSONResponse(content=safe_docs)