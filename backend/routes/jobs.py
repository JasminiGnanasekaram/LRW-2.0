"""Background job status endpoint."""
from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from database import processing_jobs_col
from utils.security import get_current_user

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}")
async def get_job(job_id: str, user: dict = Depends(get_current_user)):
    job = await processing_jobs_col.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if str(job.get("user_id")) != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return {
        "id": str(job["_id"]),
        "status": job.get("status"),
        "raw_document_id": str(job.get("raw_document_id")) if job.get("raw_document_id") else None,
        "cleaned_document_id": str(job.get("cleaned_document_id")) if job.get("cleaned_document_id") else None,
        "error": job.get("error"),
        "created_at": job.get("created_at"),
        "updated_at": job.get("updated_at"),
    }


@router.get("/")
async def list_jobs(user: dict = Depends(get_current_user), limit: int = 50):
    base = {} if user["role"] == "admin" else {"user_id": ObjectId(user["id"])}
    cursor = processing_jobs_col.find(base).sort("created_at", -1).limit(limit)
    return [
        {
            "id": str(j["_id"]),
            "status": j.get("status"),
            "raw_document_id": str(j.get("raw_document_id")) if j.get("raw_document_id") else None,
            "created_at": j.get("created_at"),
            "updated_at": j.get("updated_at"),
            "error": j.get("error"),
        }
        async for j in cursor
    ]
