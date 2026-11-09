from fastapi import APIRouter, Depends, UploadFile, File, Form, Body, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from starlette.concurrency import run_in_threadpool as run_blocking
from datetime import datetime
from collections import Counter
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
    get_gridfs_bucket,
    processing_jobs_col,
)
from services import extraction, cleaning, nlp
from services.csv_export import document_to_csv, documents_summary_csv
from services.summarizer import get_text_summary
from services.extraction import detect_pdf_type
from services.crawler_service import derive_title_from_url
from utils.security import get_current_user
from config import get_settings

router = APIRouter(prefix="/documents", tags=["documents"])


# ── Safe filename for HTTP headers (Latin-1 safe) ─────────────────────
def _safe_filename(name: str) -> str:
    """Strip non-ASCII and special chars so filename is safe for HTTP headers."""
    name = name.rsplit(".", 1)[0] if "." in name else name
    name = name.encode("ascii", errors="ignore").decode("ascii")
    name = re.sub(r'[^A-Za-z0-9_.-]', '_', name)
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

    nlp_data = dict(analysis.get("data") or {}) if analysis else None
    if nlp_data is not None:
        analysis_text = (cleaned or {}).get("text") or raw_text or ""
        computed_stats = nlp.compute_statistics(analysis_text, nlp_data)
        nlp_data["statistics"] = {**computed_stats, **(nlp_data.get("statistics") or {})}

    # Generate summary: prefer stored summary, fallback to extractive summary
    summary = raw.get("summary") or (get_text_summary(raw_text) if raw_text else None)

    return {
        "id":                 str(raw["_id"]),
        "user_id":            str(raw["user_id"]),
        "filename":           raw.get("filename"),
        "file_type":          raw.get("file_type"),
        "pdf_type":           raw.get("pdf_type"),
        "raw_text":           raw_text,
        "summary":            summary,
        "cleaned_text":       cleaned.get("text") if cleaned else None,
        "metadata":           meta.get("data") if meta else None,
        "nlp":                nlp_data,
        "is_crawled_subpage": bool(raw.get("is_crawled_subpage", False)),
        "parent_document_id": str(raw.get("parent_document_id")) if raw.get("parent_document_id") else None,
        "title":                 raw.get("title") or (meta.get("data", {}).get("title") if meta else None),
        "total_available_pages": (
            len(raw.get("discovered_items", []))
            if raw.get("discovered_items")
            else (len(raw.get("discovered_pages", [])) if raw.get("discovered_pages") else raw.get("total_available_pages"))
        ),
        "discovered_pages":      raw.get("discovered_pages") or [],
        "discovered_items":      (
            raw.get("discovered_items")
            if raw.get("discovered_items")
            else [
                {"page_number": idx + 1, "url": p, "title": derive_title_from_url(p)}
                for idx, p in enumerate(raw.get("discovered_pages") or [])
            ]
        ),
        "crawled_pages":         raw.get("crawled_pages") or [],
        "specific_page_crawl":   raw.get("specific_page_crawl"),
        "created_at":         raw.get("created_at"),
    }


def _document_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Document not found")


async def _owned_raw_document(document_id: str, user: dict) -> dict:
    raw = await raw_documents_col.find_one({"_id": _document_id(document_id)})
    if not raw or (user["role"] != "admin" and str(raw.get("user_id")) != user["id"]):
        raise HTTPException(status_code=404, detail="Document not found")
    return raw


# ── List documents ────────────────────────────────────────────────────
@router.get("/")
async def list_documents(
    include_subpages: bool = False,
    user: dict = Depends(get_current_user),
    limit: int = 10_000,
):
    """List the current user's documents for the dashboard (excluding crawled subpages by default)."""
    query = {} if user["role"] == "admin" else {"user_id": ObjectId(user["id"])}
    if not include_subpages:
        query["is_crawled_subpage"] = {"$ne": True}

    result = []
    async for raw in raw_documents_col.find(query).sort("created_at", -1).limit(limit):
        cleaned = await cleaned_documents_col.find_one({"raw_document_id": raw["_id"]})
        meta = await document_metadata_col.find_one({"raw_document_id": raw["_id"]})
        analysis = await nlp_analysis_col.find_one(
            {"cleaned_document_id": cleaned["_id"]}
        ) if cleaned else None
        result.append(await _doc_out(raw, cleaned, meta, analysis))
    return result


# ── Get single document ───────────────────────────────────────────────
@router.get("/{document_id}")
async def get_document(document_id: str, user: dict = Depends(get_current_user)):
    raw = await _owned_raw_document(document_id, user)
    cleaned = await cleaned_documents_col.find_one({"raw_document_id": raw["_id"]})
    meta = await document_metadata_col.find_one({"raw_document_id": raw["_id"]})
    analysis = await nlp_analysis_col.find_one(
        {"cleaned_document_id": cleaned["_id"]}
    ) if cleaned else None

    if cleaned and (
        not analysis
        or not isinstance(analysis.get("data"), dict)
        or "token_details" not in (analysis.get("data") or {})
        or "sentences" not in (analysis.get("data") or {})
        or analysis.get("nlp_rules_version") != getattr(nlp, "NLP_RULES_VERSION", None)
    ):
        try:
            from fastapi.concurrency import run_in_threadpool
            analysis_data = await run_in_threadpool(nlp.analyze, cleaned.get("text") or "")
            nlp_version = getattr(nlp, "NLP_RULES_VERSION", None)
            if analysis:
                await nlp_analysis_col.update_one(
                    {"_id": analysis["_id"]},
                    {"$set": {"data": analysis_data, "nlp_rules_version": nlp_version}},
                )
                analysis["data"] = analysis_data
                analysis["nlp_rules_version"] = nlp_version
            else:
                analysis = {
                    "cleaned_document_id": cleaned["_id"],
                    "data": analysis_data,
                    "nlp_rules_version": nlp_version,
                    "created_at": datetime.utcnow(),
                }
                result = await nlp_analysis_col.insert_one(analysis)
                analysis["_id"] = result.inserted_id
        except Exception as exc:
            import logging
            logging.getLogger("uvicorn.error").warning(f"Failed to refresh NLP analysis: {exc}")

    if not raw.get("summary") and cleaned and cleaned.get("text"):
        try:
            from fastapi.concurrency import run_in_threadpool
            from .summarize import summarize
            summary = await run_in_threadpool(summarize, cleaned["text"][:5000])
        except Exception as exc:
            import logging
            logging.getLogger("uvicorn.error").warning(f"Failed to auto-generate missing summary: {exc}")
        else:
            if summary:
                await raw_documents_col.update_one(
                    {"_id": raw["_id"]},
                    {"$set": {"summary": summary}},
                )
                raw["summary"] = summary

    return await _doc_out(raw, cleaned, meta, analysis)


# ── Upload ────────────────────────────────────────────────────────────
@router.post("/upload")
async def upload(
    file: Optional[UploadFile] = File(None),
    file_type: str = Form(...),   # text | pdf | image | audio | url
    url: Optional[str] = Form(None),
    metadata: Optional[str] = Form(None),  # JSON string
    summary: Optional[str] = Form(None),
    language: Optional[str] = Form(None),  # language hint for audio (e.g. 'ta', 'si', 'en')
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
            args=[str(job_res.inserted_id), str(raw_res.inserted_id), file_type, content_b64, url,
                  filename, language],
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
            # Run the blocking OCR / Whisper work in a worker thread so it does not freeze the API.
                raw_text = await run_blocking(
                extraction.extract, file_type,
                content=content, filename=file.filename, language=language,
            )
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

    # 2. Save source
    src = await sources_col.insert_one({
        "user_id": ObjectId(user["id"]),
        "type": file_type,
        "name": filename,
        "created_at": datetime.utcnow(),
    })

    # 3. Store raw text — GridFS if > 8 MB, inline otherwise
    raw_text_bytes = raw_text.encode("utf-8")
    gridfs_id = None
    if len(raw_text_bytes) > 8 * 1024 * 1024:
        gridfs_id = await _store_text_gridfs(raw_text, filename, file_type, user["id"])
        stored_raw_text = ""
    else:
        stored_raw_text = raw_text

    raw_doc = {
        "user_id": ObjectId(user["id"]),
        "source_id": src.inserted_id,
        "filename": filename,
        "file_type": file_type,
        "pdf_type": pdf_type,
        "raw_text": stored_raw_text,
        "gridfs_id": gridfs_id,
        "created_at": datetime.utcnow(),
    }
    raw_res = await raw_documents_col.insert_one(raw_doc)
    raw_doc["_id"] = raw_res.inserted_id

    # 4. Clean
    cleaned_text = cleaning.clean(raw_text)
    if not cleaned_text.strip():
        cleaned_text = raw_text or ""

    cleaned_doc = {
        "user_id": ObjectId(user["id"]),
        "raw_document_id": raw_res.inserted_id,
        "text": cleaned_text,
        "created_at": datetime.utcnow(),
    }
    cl_res = await cleaned_documents_col.insert_one(cleaned_doc)
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
        "data": meta_data,
        "created_at": datetime.utcnow(),
    }
    await document_metadata_col.insert_one(meta_doc)

    # 6. NLP
    analysis_data = nlp.analyze(cleaned_text)
    analysis_doc = {
        "cleaned_document_id": cl_res.inserted_id,
        "data": analysis_data,
        "nlp_rules_version": getattr(nlp, "NLP_RULES_VERSION", None),
        "created_at": datetime.utcnow(),
    }
    await nlp_analysis_col.insert_one(analysis_doc)

    # 7. Summary — use preview summary if provided, otherwise generate
    final_summary = (summary or "").strip()
    if not final_summary:
        try:
            from fastapi.concurrency import run_in_threadpool
            from .summarize import summarize as generate_summary
            final_summary = await run_in_threadpool(generate_summary, cleaned_text[:5000])
        except Exception as e:
            import logging
            logging.getLogger("uvicorn.error").warning(f"Failed to generate summary during upload: {e}")
            final_summary = get_text_summary(cleaned_text)

    if final_summary:
        await raw_documents_col.update_one(
            {"_id": raw_res.inserted_id},
            {"$set": {"summary": final_summary}}
        )
    raw_doc["summary"] = final_summary

    return await _doc_out(raw_doc, cleaned_doc, meta_doc, analysis_doc)


# ── Update cleaned text ───────────────────────────────────────────────
@router.patch("/{document_id}/cleaned-text")
async def update_cleaned_text(
    document_id: str,
    payload: dict = Body(...),
    user: dict = Depends(get_current_user),
):
    """Save a manual correction to cleaned text; optionally rerun NLP."""
    text = payload.get("cleaned_text")
    reanalyze = payload.get("reanalyze", False)
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status_code=422, detail="Cleaned text must not be empty")
    if len(text) > 1_000_000:
        raise HTTPException(status_code=413, detail="Cleaned text exceeds 1 million characters")
    if not isinstance(reanalyze, bool):
        raise HTTPException(status_code=422, detail="reanalyze must be true or false")

    raw = await _owned_raw_document(document_id, user)
    cleaned = await cleaned_documents_col.find_one({"raw_document_id": raw["_id"]})
    if not cleaned:
        raise HTTPException(status_code=404, detail="Cleaned text record not found")

    # Compute BEFORE writing so NLP errors cannot leave a partially updated save.
    analysis_data = None
    if reanalyze:
        from fastapi.concurrency import run_in_threadpool
        analysis_data = await run_in_threadpool(nlp.analyze, text)

    timestamp = datetime.utcnow()
    await cleaned_documents_col.update_one(
        {"_id": cleaned["_id"]},
        {"$set": {"text": text, "updated_at": timestamp}},
    )

    if reanalyze:
        analysis_fields = {
            "data": analysis_data,
            "updated_at": timestamp,
        }
        if hasattr(nlp, "NLP_RULES_VERSION"):
            analysis_fields["nlp_rules_version"] = nlp.NLP_RULES_VERSION
        await nlp_analysis_col.update_one(
            {"cleaned_document_id": cleaned["_id"]},
            {
                "$set": analysis_fields,
                "$setOnInsert": {"created_at": timestamp},
            },
            upsert=True,
        )

    return {
        "detail": "Cleaned text saved",
        "cleaned_text": text,
        "reanalyzed": reanalyze,
        "nlp": analysis_data,
    }


# ── Update document metadata ──────────────────────────────────────────
@router.patch("/{document_id}/metadata")
async def update_document_metadata(
    document_id: str,
    metadata_update: dict = Body(...),
    user: dict = Depends(get_current_user),
):
    """Update metadata for a document."""
    raw = await _owned_raw_document(document_id, user)

    meta = await document_metadata_col.find_one({"raw_document_id": raw["_id"]})
    if meta:
        await document_metadata_col.update_one(
            {"_id": meta["_id"]},
            {"$set": {"data": metadata_update, "updated_at": datetime.utcnow()}},
        )
    else:
        meta_doc = {
            "raw_document_id": raw["_id"],
            "data": metadata_update,
            "created_at": datetime.utcnow(),
        }
        await document_metadata_col.insert_one(meta_doc)

    return {"detail": "Metadata updated successfully", "metadata": metadata_update}


# ── Update document NLP data ──────────────────────────────────────────
@router.patch("/{document_id}/nlp")
async def update_document_nlp(
    document_id: str,
    nlp_update: dict = Body(...),
    user: dict = Depends(get_current_user),
):
    """Update NLP analysis data for a document, supporting per-token or batch word edits."""
    raw = await _owned_raw_document(document_id, user)

    cleaned = await cleaned_documents_col.find_one({"raw_document_id": raw["_id"]})
    if not cleaned:
        raise HTTPException(status_code=404, detail="Cleaned document not found")

    analysis = await nlp_analysis_col.find_one({"cleaned_document_id": cleaned["_id"]})
    current_data = analysis.get("data") if analysis else {}
    if not isinstance(current_data, dict):
        current_data = {}

    # Targeted token / word update
    if "token_index" in nlp_update or "word" in nlp_update:
        token_details = list(current_data.get("token_details") or [])
        token_index = nlp_update.get("token_index")
        word = nlp_update.get("word")
        new_pos = nlp_update.get("pos")
        new_lemma = nlp_update.get("lemma")
        new_morph = nlp_update.get("morph")
        apply_all = bool(nlp_update.get("apply_all", False))

        target_word = word.strip().lower() if word else ""
        updated_count = 0

        for idx, tk in enumerate(token_details):
            if not isinstance(tk, dict):
                continue
            tk_text = (tk.get("text") or tk.get("token") or "").strip().lower()
            match = False

            if token_index is not None and idx == token_index:
                match = True
            elif apply_all and target_word:
                if tk_text == target_word:
                    match = True
            elif not apply_all and target_word and tk_text == target_word and updated_count == 0:
                match = True

            if match:
                if new_pos is not None:
                    tk["pos"] = new_pos
                    tk["tag"] = new_pos
                if new_lemma is not None:
                    tk["lemma"] = new_lemma
                if new_morph is not None:
                    tk["morph"] = new_morph
                updated_count += 1
                if not apply_all:
                    break

        current_data["token_details"] = token_details

        # Recompute pos_distribution
        pos_counter = Counter()
        for tk in token_details:
            if isinstance(tk, dict):
                p = tk.get("pos")
                if p:
                    pos_counter[p] += 1
        current_data["pos_distribution"] = dict(pos_counter)

        # Recompute lemmas
        current_data["lemmas"] = [
            tk.get("lemma") for tk in token_details if isinstance(tk, dict) and tk.get("lemma")
        ]

    elif "nlp" in nlp_update and isinstance(nlp_update["nlp"], dict):
        current_data.update(nlp_update["nlp"])
    else:
        current_data.update(nlp_update)

    if analysis:
        await nlp_analysis_col.update_one(
            {"_id": analysis["_id"]},
            {"$set": {"data": current_data, "updated_at": datetime.utcnow()}},
        )
    else:
        await nlp_analysis_col.insert_one({
            "cleaned_document_id": cleaned["_id"],
            "data": current_data,
            "created_at": datetime.utcnow(),
        })

    return {
        "detail": "NLP analysis updated successfully",
        "nlp": current_data,
    }


# ── Delete document ───────────────────────────────────────────────────
@router.delete("/{document_id}")
async def delete_document(document_id: str, user: dict = Depends(get_current_user)):
    """Delete a document and all associated data."""
    raw = await _owned_raw_document(document_id, user)

    if raw.get("gridfs_id"):
        bucket = get_gridfs_bucket()
        try:
            await bucket.delete(raw["gridfs_id"])
        except Exception:
            pass

    cleaned_docs = await cleaned_documents_col.find(
        {"raw_document_id": raw["_id"]}
    ).to_list(None)
    for cleaned in cleaned_docs:
        await nlp_analysis_col.delete_many(
            {"cleaned_document_id": cleaned["_id"]}
        )

    await cleaned_documents_col.delete_many({"raw_document_id": raw["_id"]})
    await document_metadata_col.delete_many({"raw_document_id": raw["_id"]})
    await raw_documents_col.delete_one({"_id": raw["_id"]})
    if raw.get("source_id"):
        await sources_col.delete_one({"_id": raw["source_id"]})

    return {"detail": "Deleted successfully"}


# ── Export single document ────────────────────────────────────────────
@router.get("/{document_id}/export")
async def export_document(
    document_id: str,
    format: str = "json",
    user: dict = Depends(get_current_user),
):
    """Download a document with its raw, cleaned, metadata, and NLP data."""
    raw = await _owned_raw_document(document_id, user)
    cleaned = await cleaned_documents_col.find_one({"raw_document_id": raw["_id"]})
    meta = await document_metadata_col.find_one({"raw_document_id": raw["_id"]})
    analysis = await nlp_analysis_col.find_one(
        {"cleaned_document_id": cleaned["_id"]}
    ) if cleaned else None
    document = await _doc_out(raw, cleaned, meta, analysis)
    filename = _safe_filename(raw.get("filename") or "document")

    if format.lower() == "json":
        json_text = json.dumps(
            document,
            ensure_ascii=False,
            indent=2,
            default=str,
        )
        return PlainTextResponse(
            json_text,
            media_type="application/json; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}.json"'},
        )
    if format.lower() == "csv":
        csv_data = document_to_csv(document)
        return PlainTextResponse(
            csv_data,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
        )
    raise HTTPException(status_code=400, detail="format must be json or csv")


# ── Bulk export ───────────────────────────────────────────────────────
@router.get("/export/all")
async def export_all(format: str = "csv", user: dict = Depends(get_current_user)):
    """Bulk export the user's documents as a summary table (csv) or list (json)."""
    docs = await list_documents(user=user, limit=10_000)
    safe_docs = json.loads(json.dumps(docs, default=str))

    if format.lower() == "csv":
        return PlainTextResponse(
            documents_summary_csv(safe_docs),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="lrw_documents.csv"'},
        )

    return JSONResponse(
        content=safe_docs,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="lrw_documents.json"'},
    )