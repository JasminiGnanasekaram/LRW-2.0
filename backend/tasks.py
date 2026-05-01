"""Celery tasks for async document processing.

These mirror the synchronous pipeline in routes/documents.py but run in a worker.
The job document is updated as it progresses so the API can poll status.
"""
from datetime import datetime
from bson import ObjectId
from pymongo import MongoClient

from celery_app import celery
from config import get_settings
from services import extraction, cleaning, nlp

# Synchronous Mongo client for the worker (motor is async — Celery is sync).
_settings = get_settings()
_sync_db = MongoClient(_settings.MONGO_URI)[_settings.DB_NAME]


def _set_status(job_id: str, **fields):
    fields["updated_at"] = datetime.utcnow()
    _sync_db.processing_jobs.update_one({"_id": ObjectId(job_id)}, {"$set": fields})


@celery.task(name="lrw.process_document", bind=True)
def process_document(self, job_id: str, raw_doc_id: str, file_type: str,
                     content_b64: str | None = None, url: str | None = None):
    import base64
    try:
        _set_status(job_id, status="extracting")
        if file_type == "url":
            raw_text = extraction.extract("url", url=url)
        else:
            content = base64.b64decode(content_b64) if content_b64 else b""
            raw_text = extraction.extract(file_type, content=content)

        _sync_db.raw_documents.update_one(
            {"_id": ObjectId(raw_doc_id)},
            {"$set": {"raw_text": raw_text}},
        )

        _set_status(job_id, status="cleaning")
        cleaned_text = cleaning.clean(raw_text)
        cleaned_res = _sync_db.cleaned_documents.insert_one({
            "user_id": _sync_db.raw_documents.find_one({"_id": ObjectId(raw_doc_id)})["user_id"],
            "raw_document_id": ObjectId(raw_doc_id),
            "text": cleaned_text,
            "created_at": datetime.utcnow(),
        })

        _set_status(job_id, status="annotating")
        analysis_data = nlp.analyze(cleaned_text)
        _sync_db.nlp_analysis.insert_one({
            "cleaned_document_id": cleaned_res.inserted_id,
            "data": analysis_data,
            "created_at": datetime.utcnow(),
        })

        _set_status(job_id, status="completed", cleaned_document_id=cleaned_res.inserted_id)
        return {"status": "completed", "raw_document_id": raw_doc_id}
    except Exception as e:
        _set_status(job_id, status="failed", error=str(e))
        raise
