from fastapi import APIRouter, Depends, UploadFile, File, Form, Body, HTTPException
<<<<<<< HEAD
from fastapi.responses import JSONResponse, PlainTextResponse, Response
=======

from fastapi.responses import JSONResponse, PlainTextResponse

>>>>>>> origin/main
from datetime import datetime

from collections import Counter

from bson import ObjectId
<<<<<<< HEAD
from bson.errors import InvalidId
=======

>>>>>>> origin/main
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
<<<<<<< HEAD
    processing_jobs_col,
=======

>>>>>>> origin/main
)

from services import extraction, cleaning, nlp

from services.csv_export import document_to_csv, documents_summary_csv

from services.summarizer import get_text_summary

from services.extraction import detect_pdf_type

from utils.security import get_current_user

from config import get_settings
<<<<<<< HEAD
=======

from database import processing_jobs_col
>>>>>>> origin/main



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

<<<<<<< HEAD
    nlp_data = dict(analysis.get("data") or {}) if analysis else None
    if nlp_data is not None:
        analysis_text = (cleaned or {}).get("text") or raw_text or ""
        computed_stats = nlp.compute_statistics(analysis_text, nlp_data)
        nlp_data["statistics"] = {**computed_stats, **(nlp_data.get("statistics") or {})}
=======

>>>>>>> origin/main

    # Generate summary: prefer stored summary, fallback to extractive summary

    summary = raw.get("summary") or (get_text_summary(raw_text) if raw_text else None)



    return {
<<<<<<< HEAD
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
        or analysis.get("nlp_rules_version") != nlp.NLP_RULES_VERSION
    ):
        try:
            from fastapi.concurrency import run_in_threadpool
            analysis_data = await run_in_threadpool(nlp.analyze, cleaned.get("text") or "")
            if analysis:
                await nlp_analysis_col.update_one(
                    {"_id": analysis["_id"]},
                    {"$set": {"data": analysis_data, "nlp_rules_version": nlp.NLP_RULES_VERSION}},
                )
                analysis["data"] = analysis_data
                analysis["nlp_rules_version"] = nlp.NLP_RULES_VERSION
            else:
                analysis = {
                    "cleaned_document_id": cleaned["_id"],
                    "data": analysis_data,
                    "nlp_rules_version": nlp.NLP_RULES_VERSION,
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
=======

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

>>>>>>> origin/main
@router.post("/upload")

async def upload(

    file: Optional[UploadFile] = File(None),

    file_type: str = Form(...),   # text | pdf | image | audio | url

    url: Optional[str] = Form(None),

    metadata: Optional[str] = Form(None),  # JSON string
<<<<<<< HEAD
    summary: Optional[str] = Form(None),
=======

>>>>>>> origin/main
    language: Optional[str] = Form(None),  # language hint for audio (e.g. 'ta', 'si', 'en')

    user: dict = Depends(get_current_user),

):

    """Upload a document or URL. Runs extraction + cleaning + NLP synchronously."""
<<<<<<< HEAD
=======



>>>>>>> origin/main
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
<<<<<<< HEAD
=======



>>>>>>> origin/main
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

            raw_text = extraction.extract(file_type, content=content, filename=file.filename, language=language)

        except NotImplementedError as e:

            raise HTTPException(status_code=501, detail=str(e))

        except Exception as e:

            raise HTTPException(status_code=400, detail=f"Extraction failed: {e}")

        filename = file.filename

<<<<<<< HEAD
=======


>>>>>>> origin/main
        # Detect PDF type if applicable

        if file_type == "pdf":

            try:

                pdf_type = detect_pdf_type(content)

            except Exception:

                pdf_type = None



    # 2. Save source

    src = await sources_col.insert_one({
<<<<<<< HEAD
        "user_id": ObjectId(user["id"]),
        "type": file_type,
        "name": filename,
=======

        "user_id":    ObjectId(user["id"]),

        "type":       file_type,

        "name":       filename,

>>>>>>> origin/main
        "created_at": datetime.utcnow(),

    })



    # 3. Store raw text — GridFS if > 8 MB, inline otherwise

    raw_text_bytes = raw_text.encode("utf-8")
<<<<<<< HEAD
    gridfs_id = None
    if len(raw_text_bytes) > 8 * 1024 * 1024:
        gridfs_id = await _store_text_gridfs(raw_text, filename, file_type, user["id"])
=======

    gridfs_id      = None



    if len(raw_text_bytes) > 8 * 1024 * 1024:

        gridfs_id       = await _store_text_gridfs(raw_text, filename, file_type, user["id"])

>>>>>>> origin/main
        stored_raw_text = ""

    else:

        stored_raw_text = raw_text



    raw_doc = {
<<<<<<< HEAD
        "user_id": ObjectId(user["id"]),
        "source_id": src.inserted_id,
        "filename": filename,
        "file_type": file_type,
        "pdf_type": pdf_type,
        "raw_text": stored_raw_text,
        "gridfs_id": gridfs_id,
=======

        "user_id":    ObjectId(user["id"]),

        "source_id":  src.inserted_id,

        "filename":   filename,

        "file_type":  file_type,

        "raw_text":   stored_raw_text,

        "gridfs_id":  gridfs_id,

        "summary":    get_text_summary(raw_text),

>>>>>>> origin/main
        "created_at": datetime.utcnow(),

    }
<<<<<<< HEAD
    raw_res = await raw_documents_col.insert_one(raw_doc)
=======

    if pdf_type:

        raw_doc["pdf_type"] = pdf_type



    raw_res        = await raw_documents_col.insert_one(raw_doc)

>>>>>>> origin/main
    raw_doc["_id"] = raw_res.inserted_id



    # 4. Clean

    cleaned_text = cleaning.clean(raw_text)

    if not cleaned_text.strip():

        cleaned_text = raw_text or ""



    cleaned_doc = {
<<<<<<< HEAD
        "user_id": ObjectId(user["id"]),
        "raw_document_id": raw_res.inserted_id,
        "text": cleaned_text,
        "created_at": datetime.utcnow(),
    }
    cl_res = await cleaned_documents_col.insert_one(cleaned_doc)
=======

        "user_id":          ObjectId(user["id"]),

        "raw_document_id":  raw_res.inserted_id,

        "text":             cleaned_text,

        "created_at":       datetime.utcnow(),

    }

    cl_res             = await cleaned_documents_col.insert_one(cleaned_doc)

>>>>>>> origin/main
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
<<<<<<< HEAD
        "data": meta_data,
        "created_at": datetime.utcnow(),
=======

        "data":            meta_data,

        "created_at":      datetime.utcnow(),

>>>>>>> origin/main
    }

    await document_metadata_col.insert_one(meta_doc)



    # 6. NLP
<<<<<<< HEAD
    analysis_data = nlp.analyze(cleaned_text)
=======

    print(f"[DOC] Running NLP on {len(cleaned_text)} chars", flush=True)

    analysis_data = nlp.analyze(cleaned_text)

    print(f"[DOC] sentiment={analysis_data.get('sentiment')}", flush=True)

    print(f"[DOC] classification keys={list((analysis_data.get('classification') or {}).keys())}", flush=True)



>>>>>>> origin/main
    analysis_doc = {

        "cleaned_document_id": cl_res.inserted_id,
<<<<<<< HEAD
        "data": analysis_data,
        "nlp_rules_version": nlp.NLP_RULES_VERSION,
        "created_at": datetime.utcnow(),
=======

        "data":                analysis_data,

        "created_at":          datetime.utcnow(),

>>>>>>> origin/main
    }

    await nlp_analysis_col.insert_one(analysis_doc)

<<<<<<< HEAD
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
=======


    # 7. Generate Summary

    summary = ""

    try:

        from fastapi.concurrency import run_in_threadpool

        from .summarize import summarize

        summary = await run_in_threadpool(summarize, cleaned_text[:5000])

    except Exception as e:

        import logging

        logging.getLogger("uvicorn.error").warning(f"Failed to generate summary during upload: {e}")

        summary = ""



    await raw_documents_col.update_one(

        {"_id": raw_res.inserted_id},

        {"$set": {"summary": summary}}

    )

    raw_doc["summary"] = summary
>>>>>>> origin/main



    return await _doc_out(raw_doc, cleaned_doc, meta_doc, analysis_doc)


<<<<<<< HEAD
# ── Update document metadata ──────────────────────────────────────────
@router.patch("/{document_id}/metadata")
async def update_document_metadata(
    document_id: str,
    metadata_update: dict = Body(...),
=======



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

        if (

            not analysis

            or not isinstance(analysis.get("data"), dict)

            or "token_details" not in analysis["data"]

            or "sentences" not in analysis["data"]

        ):

            try:

                from fastapi.concurrency import run_in_threadpool

                analysis_data = await run_in_threadpool(nlp.analyze, cleaned.get("text") or "")

                if analysis:

                    await nlp_analysis_col.update_one(

                        {"_id": analysis["_id"]},

                        {"$set": {"data": analysis_data}}

                    )

                    analysis["data"] = analysis_data

                else:

                    analysis_doc = {

                        "cleaned_document_id": cleaned["_id"],

                        "data": analysis_data,

                        "created_at": datetime.utcnow(),

                    }

                    res = await nlp_analysis_col.insert_one(analysis_doc)

                    analysis_doc["_id"] = res.inserted_id

                    analysis = analysis_doc

            except Exception as e:

                import logging

                logging.getLogger("uvicorn.error").warning(f"Failed to lazily compute NLP data: {e}")



    # Auto-generate summary if missing and cleaned text is available

    if not raw.get("summary") and cleaned and cleaned.get("text"):

        summary = ""

        try:

            from fastapi.concurrency import run_in_threadpool

            from .summarize import summarize

            summary = await run_in_threadpool(summarize, cleaned.get("text")[:5000])

        except Exception as e:

            import logging

            logging.getLogger("uvicorn.error").warning(f"Failed to auto-generate missing summary: {e}")

            summary = ""



        if summary:

            await raw_documents_col.update_one(

                {"_id": raw["_id"]},

                {"$set": {"summary": summary}}

            )

            raw["summary"] = summary



    return await _doc_out(raw, cleaned, meta, analysis)





# ── Update cleaned text ───────────────────────────────────────────────
@router.patch("/{doc_id}/cleaned-text")
async def update_cleaned_text(
    doc_id: str,
    payload: dict = Body(...),
>>>>>>> origin/main
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

    try:
<<<<<<< HEAD
        raw = await raw_documents_col.find_one({"_id": ObjectId(document_id)})
=======
        raw_id = ObjectId(doc_id)
>>>>>>> origin/main
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid document ID")

    raw = await raw_documents_col.find_one({"_id": raw_id})
    if not raw:
        raise HTTPException(status_code=404, detail="Document not found")
    if str(raw.get("user_id")) != str(user.get("id")) and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    cleaned = await cleaned_documents_col.find_one({"raw_document_id": raw_id})
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

@router.patch("/{doc_id}/metadata")

async def update_document_metadata(

    doc_id: str,

    metadata_update: dict = Body(...),

    user: dict = Depends(get_current_user),

):

    """Update metadata for a document."""

    try:

        raw = await raw_documents_col.find_one({"_id": ObjectId(doc_id)})

    except Exception:

        raise HTTPException(status_code=400, detail="Invalid document ID")



    if not raw:

        raise HTTPException(status_code=404, detail="Not found")

    if str(raw["user_id"]) != user["id"] and user["role"] != "admin":

        raise HTTPException(status_code=403, detail="Forbidden")



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
<<<<<<< HEAD
@router.patch("/{document_id}/nlp")
async def update_document_nlp(
    document_id: str,
=======

@router.patch("/{doc_id}/nlp")

async def update_document_nlp(

    doc_id: str,

>>>>>>> origin/main
    nlp_update: dict = Body(...),

    user: dict = Depends(get_current_user),

):

    """Update NLP analysis data for a document, supporting per-token or batch word edits."""

    try:
<<<<<<< HEAD
        raw = await raw_documents_col.find_one({"_id": ObjectId(document_id)})
=======

        raw = await raw_documents_col.find_one({"_id": ObjectId(doc_id)})

>>>>>>> origin/main
    except Exception:

        raise HTTPException(status_code=400, detail="Invalid document ID")



    if not raw:

        raise HTTPException(status_code=404, detail="Not found")

    if str(raw["user_id"]) != user["id"] and user["role"] != "admin":

        raise HTTPException(status_code=403, detail="Forbidden")



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

        res = await nlp_analysis_col.insert_one({

            "cleaned_document_id": cleaned["_id"],

            "data": current_data,

            "created_at": datetime.utcnow(),

        })



    return {

        "detail": "NLP analysis updated successfully",

        "nlp": current_data,

    }


<<<<<<< HEAD
# ── Delete document ───────────────────────────────────────────────────
@router.delete("/{document_id}")
async def delete_document(document_id: str, user: dict = Depends(get_current_user)):
    """Delete a document and all associated data."""
    raw = await _owned_raw_document(document_id, user)
=======



# ── Delete document ───────────────────────────────────────────────────

@router.delete("/{doc_id}")

async def delete_document(doc_id: str, user: dict = Depends(get_current_user)):

    """Delete a document and all associated data."""

    raw = await raw_documents_col.find_one({"_id": ObjectId(doc_id)})

    if not raw:

        raise HTTPException(status_code=404, detail="Not found")

    if str(raw["user_id"]) != user["id"] and user["role"] != "admin":

        raise HTTPException(status_code=403, detail="Forbidden")



>>>>>>> origin/main
    if raw.get("gridfs_id"):

        bucket = get_gridfs_bucket()

        try:

            await bucket.delete(raw["gridfs_id"])

        except Exception:

            pass

<<<<<<< HEAD
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
=======


    cleaned_docs = await cleaned_documents_col.find({"raw_document_id": raw["_id"]}).to_list(None)

    for cleaned in cleaned_docs:

        await nlp_analysis_col.delete_many({"cleaned_document_id": cleaned["_id"]})



    await raw_documents_col.delete_one({"_id": raw["_id"]})

    await cleaned_documents_col.delete_many({"raw_document_id": raw["_id"]})

    await document_metadata_col.delete_one({"raw_document_id": raw["_id"]})

    await sources_col.delete_one({"_id": raw.get("source_id")})
>>>>>>> origin/main



    return {"detail": "Deleted successfully"}


<<<<<<< HEAD
# ── Export single document ────────────────────────────────────────────
@router.get("/{document_id}/export")
async def export_document(
    document_id: str,
=======





# ── Export single document ────────────────────────────────────────────

@router.get("/{doc_id}/export")

async def export_document(

    doc_id: str,

>>>>>>> origin/main
    format: str = "json",

    user: dict = Depends(get_current_user),

):
<<<<<<< HEAD
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
=======

    """Export a processed document. format = json | csv."""

    doc      = await get_document(doc_id, user)

    safe_doc = json.loads(json.dumps(doc, default=str))

    name     = _safe_filename(doc.get("filename") or "document")



    if format == "json":

        json_text = json.dumps(safe_doc, indent=2, ensure_ascii=False)

>>>>>>> origin/main
        return PlainTextResponse(

            json_text,

            media_type="application/json; charset=utf-8",
<<<<<<< HEAD
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


=======

            headers={"Content-Disposition": f'attachment; filename="{name}.json"'},

        )



    if format == "csv":

        csv_text = document_to_csv(safe_doc)

        return PlainTextResponse(

            csv_text,

            media_type="text/csv; charset=utf-8",

            headers={"Content-Disposition": f'attachment; filename="{name}.csv"'},

        )



    raise HTTPException(status_code=400, detail="Unsupported format. Use json or csv.")





>>>>>>> origin/main
# ── Bulk export ───────────────────────────────────────────────────────

@router.get("/export/all")

async def export_all(format: str = "csv", user: dict = Depends(get_current_user)):

    """Bulk export the user's documents as a summary table (csv) or list (json)."""
<<<<<<< HEAD
    docs = await list_documents(user=user, limit=10_000)
    safe_docs = json.loads(json.dumps(docs, default=str))

    if format.lower() == "csv":
=======

    docs      = await list_documents(user=user, limit=10_000)

    safe_docs = json.loads(json.dumps(docs, default=str))



    if format == "csv":

>>>>>>> origin/main
        return PlainTextResponse(

            documents_summary_csv(safe_docs),

            media_type="text/csv; charset=utf-8",

            headers={"Content-Disposition": 'attachment; filename="lrw_documents.csv"'},

        )

    return JSONResponse(

        content=safe_docs,
<<<<<<< HEAD
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="lrw_documents.json"'},
=======

        media_type="application/json; charset=utf-8"

>>>>>>> origin/main
    )
