"""Admin-only endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId

from database import (
    users_col, sessions_col, raw_documents_col,
    cleaned_documents_col, processing_jobs_col,
)
from utils.security import require_roles
from services.tool_config import get_all_tools, update_tool

router = APIRouter(prefix="/admin", tags=["admin"])
admin_only = require_roles("admin")


def _user_out(u: dict, doc_count: int = 0) -> dict:
    return {
        "id":         str(u["_id"]),
        "name":       u.get("name"),
        "email":      u.get("email"),
        "role":       u.get("role"),
        "verified":   u.get("verified", False),
        "blocked":    u.get("blocked", False),
        "created_at": u.get("created_at"),
        "doc_count":  doc_count,
    }


@router.get("/stats")
async def stats(_: dict = Depends(admin_only)):
    return {
        "total_users":     await users_col.count_documents({}),
        "verified_users":  await users_col.count_documents({"verified": True}),
        "blocked_users":   await users_col.count_documents({"blocked": True}),
        "total_documents": await raw_documents_col.count_documents({}),
        "active_sessions": await sessions_col.count_documents({}),
        "processing_jobs": await processing_jobs_col.count_documents({}),
    }


@router.get("/users")
async def list_users(_: dict = Depends(admin_only)):
    result = []
    async for u in users_col.find({}).sort("created_at", -1):
        doc_count = await raw_documents_col.count_documents({"user_id": u["_id"]})
        result.append(_user_out(u, doc_count))
    return result


@router.get("/activity")
async def user_activity(limit: int = 100, _: dict = Depends(admin_only)):
    result = []
    async for doc in raw_documents_col.find({}).sort("created_at", -1).limit(limit):
        user = await users_col.find_one({"_id": doc["user_id"]})
        result.append({
            "doc_id":     str(doc["_id"]),
            "filename":   doc.get("filename"),
            "file_type":  doc.get("file_type"),
            "summary":    doc.get("summary"),
            "created_at": doc.get("created_at"),
            "user_id":    str(doc["user_id"]),
            "user_name":  user.get("name")  if user else "Unknown",
            "user_email": user.get("email") if user else "Unknown",
            "user_role":  user.get("role")  if user else "unknown",
        })
    return result


class UpdateUserRequest(BaseModel):
    role:     str | None = None
    blocked:  bool | None = None
    verified: bool | None = None


@router.patch("/users/{user_id}")
async def update_user(user_id: str, payload: UpdateUserRequest, _: dict = Depends(admin_only)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "role" in update and update["role"] not in {"admin", "researcher", "guest"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await users_col.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    u = await users_col.find_one({"_id": ObjectId(user_id)})
    return _user_out(u)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, _: dict = Depends(admin_only)):
    res = await users_col.delete_one({"_id": ObjectId(user_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await sessions_col.delete_many({"user_id": ObjectId(user_id)})
    return {"message": "Deleted"}


# ── Tool Configuration ────────────────────────────────────────────────

@router.get("/tools")
async def get_tools(_: dict = Depends(admin_only)):
    """Get all NLP tool configurations."""
    return get_all_tools()


@router.patch("/tools/{tool_name}")
async def update_tool_config(
    tool_name: str, enabled: bool, _: dict = Depends(admin_only)
):
    """Enable or disable a specific NLP tool."""
    updated = update_tool(tool_name, enabled)
    if tool_name not in updated:
        raise HTTPException(status_code=404, detail="Tool not found")
    return updated