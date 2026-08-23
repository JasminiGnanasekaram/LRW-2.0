from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import Response
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
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
    get_gridfs_bucket,
)
from services import extraction, cleaning, nlp
from services.csv_export import document_to_csv, documents_summary_csv
from services.summarizer import get_text_summary
from services.extraction import detect_pdf_type
from utils.security import get_current_user
from config import get_settings

router = APIRouter(prefix="/documents", tags=["documents"])


def _now() -> datetime:
    """datetime.utcnow() is deprecated in Python 3.12+ — use aware UTC."""
    return datetime.now(timezone.utc)


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
        try:
            raw_text = await _fetch_text_gridfs(raw["gridfs_id"])
        except Exception:
            # A missing GridFS file must not blow up the whole document list
            raw_text = None

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
        "metadata":     meta.get("data") if meta else None,
        "nlp":          analysis.get("data") if analysis else None,
        "created_at":   raw.get("created_at"),
    }


def _document_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Document not found")


async def _owned_raw_document(document_id: str, user: dict) -> dict:
    raw = await raw_documents_col.find_one({"_id": _document_id(document_id)})
    if not raw or (user["role"] != "admin" and raw.get("user_id") != ObjectId(user["id"])):
        raise HTTPException(status_code=404, detail="Document not found")
    return raw


async def _assemble(raw: dict) -> dict:
    """Load cleaned + metadata + nlp for one raw document."""
    cleaned = await cleaned_documents_col.find_one({"raw_document_id": raw["_id"]})
    meta = await document_metadata_col.find_one({"raw_document_id": raw["_id"]})
    analysis = await nlp_analysis_col.find_one(
        {"cleaned_document_id": cleaned["_id"]}
    ) if cleaned else None
    return await _doc_out(raw, cleaned, meta, analysis)


@router.get("/")
async def list_documents(user: dict = Depends(get_current_user)):
    """List the current user's documents for the dashboard."""
    query = {} if user["role"] == "admin" else {"user_id": ObjectId(user["id"])}
    result = []
    async for raw in raw_documents_col.find(query).sort("created_at", -1):
        result.append(await _assemble(raw))
    return result


# NOTE: this MUST stay above "/{document_id}" so the literal path wins.
@router.get("/export/all")
async def export_all(format: str = "csv", user: dict = Depends(get_current_user)):
    """Export the whole corpus as CSV or JSON. Frontend calls this from exportAll()."""
    query = {} if user["role"] == "admin" else {"user_id": ObjectId(user["id"])}
    documents = []
    async for raw in raw_documents_col.find(query).sort("created_at", -1):
        documents.append(await _assemble(raw))

    fmt = format.lower()
    if fmt == "csv":
        return Response(
            content=documents_summary_csv(documents),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="lrw_documents.csv"'},
        )
    if fmt == "json":
        return Response(
            content=json.dumps(
                jsonable_encoder(documents), ensure_ascii=False, indent=2, default=str
            ),
            media_type="application/json; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="lrw_documents.json"'},
        )
    raise HTTPException(status_code=400, detail="format must be json or csv")


@router.get("/{document_id}")
async def get_document(document_id: str, user: dict = Depends(get_current_user)):
    raw = await _owned_raw_document(document_id, user)
    return await _assemble(raw)


@router.get("/{document_id}/export")
async def export_document(
    document_id: str,
    format: str = "json",
    user: dict = Depends(get_current_user),
):
    """Download a document with its raw, cleaned, metadata, and NLP data."""
    raw = await _owned_raw_document(document_id, user)
    document = await _assemble(raw)
    filename = _safe_filename(raw.get("filename") or "document")

    fmt = format.lower()
    if fmt == "json":
        return Response(
            content=json.dumps(
                jsonable_encoder(document), ensure_ascii=False, indent=2, default=str
            ),
            media_type="application/json; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}.json"'},
        )
    if fmt == "csv":
        return Response(
            content=document_to_csv(document),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
        )
    raise HTTPException(status_code=400, detail="format must be json or csv")


@router.delete("/{document_id}")
async def delete_document(document_id: str, user: dict = Depends(get_current_user)):
    raw = await _owned_raw_document(document_id, user)

    # nlp_analysis links to cleaned docs, so collect those ids before deleting them
    cleaned_ids = [
        c["_id"] async for c in cleaned_documents_col.find({"raw_document_id": raw["_id"]})
    ]
    if cleaned_ids:
        await nlp_analysis_col.delete_many({"cleaned_document_id": {"$in": cleaned_ids}})

    await cleaned_documents_col.delete_many({"raw_document_id": raw["_id"]})
    await document_metadata_col.delete_many({"raw_document_id": raw["_id"]})

    if raw.get("source_id"):
        await sources_col.delete_one({"_id": raw["source_id"]})

    if raw.get("gridfs_id"):
        try:
            await get_gridfs_bucket().delete(raw["gridfs_id"])
        except Exception:
            pass  # file already gone — not worth failing the delete

    await raw_documents_col.delete_one({"_id": raw["_id"]})
    return {"message": "Document deleted"}

@router.patch("/{document_id}/metadata")
async def update_metadata(
    document_id: str,
    payload: MetadataIn,
    user: dict = Depends(get_current_user)
):
    """Update metadata for an existing document."""
    try:
        oid = ObjectId(document_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid document ID")

    raw = await raw_documents_col.find_one({"_id": oid})
    if not raw:
        raise HTTPException(status_code=404, detail="Document not found")
    if str(raw["user_id"]) != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    meta_data = payload.model_dump(exclude_none=True)

    existing = await document_metadata_col.find_one({"raw_document_id": oid})
    if existing:
        await document_metadata_col.update_one(
            {"raw_document_id": oid},
            {"$set": {"data": meta_data, "updated_at": datetime.now(timezone.utc)}}
        )
    else:
        await document_metadata_col.insert_one({
            "raw_document_id": oid,
            "data": meta_data,
            "created_at": datetime.now(timezone.utc),
        })

    return {"message": "Metadata updated successfully"}


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

    allowed_types = {"text", "pdf", "image", "audio", "url"}
    if file_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"file_type must be one of: {', '.join(sorted(allowed_types))}",
        )

    # Parse metadata FIRST, so a bad payload fails before anything is written.
    meta_data = {}
    if metadata:
        try:
            meta_data = MetadataIn(**json.loads(metadata)).model_dump(exclude_none=True)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="metadata must be valid JSON")
        except Exception as e:
            # Previously this was swallowed with `except Exception: meta_data = {}`,
            # so bad metadata silently saved as empty and was impossible to debug.
            raise HTTPException(status_code=422, detail=f"Invalid metadata: {e}")

    if settings.USE_CELERY:
        # Async path: enqueue a Celery task and return a job id immediately.
        import base64
        from celery_app import celery

        content_b64 = None
        filename = url if file_type == "url" else (file.filename if file else None)
        if file_type == "url":
            if not url:
                raise HTTPException(status_code=400, detail="url field required for url uploads")
        else:
            if not file:
                raise HTTPException(status_code=400, detail="file required")
            content_b64 = base64.b64encode(await file.read()).decode()

        src = await sources_col.insert_one({
            "user_id": ObjectId(user["id"]), "type": file_type,
            "name": filename, "created_at": _now(),
        })
        raw_res = await raw_documents_col.insert_one({
            "user_id": ObjectId(user["id"]), "source_id": src.inserted_id,
            "filename": filename, "file_type": file_type,
            "raw_text": "", "created_at": _now(),
        })
        # Metadata was being dropped entirely on the Celery path — save it here too.
        await document_metadata_col.insert_one({
            "raw_document_id": raw_res.inserted_id,
            "data": meta_data,
            "created_at": _now(),
        })
        job_res = await processing_jobs_col.insert_one({
            "user_id": ObjectId(user["id"]),
            "raw_document_id": raw_res.inserted_id,
            "status": "queued",
            "created_at": _now(),
            "updated_at": _now(),
        })
        celery.send_task(
            "lrw.process_document",
            args=[str(job_res.inserted_id), str(raw_res.inserted_id), file_type, content_b64, url],
        )
        return {
            "async": True,
            "id": str(raw_res.inserted_id),
            "job_id": str(job_res.inserted_id),
            "raw_document_id": str(raw_res.inserted_id),
        }

    # 1. Extract raw text (sync path)
    pdf_type = None
    if file_type == "url":
        if not url:
            raise HTTPException(status_code=400, detail="url field required for url uploads")
        try:
           raw_text, extra_info = extraction.extract(file_type, url=url)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"URL extraction failed: {e}")
        filename = url
    else:
        if not file:
            raise HTTPException(status_code=400, detail="file required")
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        try:
           raw_text, extra_info = extraction.extract(file_type, content=content)
        except NotImplementedError as e:
            raise HTTPException(status_code=501, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Extraction failed: {e}")
        filename = file.filename

        if file_type == "pdf":
            try:
                pdf_type = detect_pdf_type(content)
            except Exception:
                pdf_type = None

    if not raw_text or not raw_text.strip():
        raise HTTPException(
            status_code=422,
            detail="No text could be extracted from this source. "
                   "For scanned PDFs or images, check that OCR is installed.",
        )

    # 2. Save source + raw doc
    src = await sources_col.insert_one({
        "user_id": ObjectId(user["id"]),
        "type": file_type,
        "name": filename,
        "created_at": _now(),
    })
    raw_res = await raw_documents_col.insert_one({
        "user_id": ObjectId(user["id"]),
        "source_id": src.inserted_id,
        "filename": filename,
        "file_type": file_type,
        "pdf_type": pdf_type,
        "raw_text": raw_text,
        "created_at": _now(),
    })

    # 3. Clean
    cleaned_text = cleaning.clean(raw_text)
    cl_res = await cleaned_documents_col.insert_one({
        "user_id": ObjectId(user["id"]),
        "raw_document_id": raw_res.inserted_id,
        "text": cleaned_text,
        "created_at": _now(),
    })

    # 4. Metadata (already parsed and validated above)
    await document_metadata_col.insert_one({
        "raw_document_id": raw_res.inserted_id,
        "data": meta_data,
        "created_at": _now(),
    })

    # 5. NLP
    analysis_data = nlp.analyze(cleaned_text)
    await nlp_analysis_col.insert_one({
        "cleaned_document_id": cl_res.inserted_id,
        "data": analysis_data,
        "created_at": _now(),
    })

    return {"async": False, "id": str(raw_res.inserted_id)}