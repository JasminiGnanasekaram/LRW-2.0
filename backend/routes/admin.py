"""Admin-only endpoints: user management, system stats, license catalog."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId

from database import (
    users_col, sessions_col, raw_documents_col,
    cleaned_documents_col, processing_jobs_col, licenses_col,
)
from utils.security import require_roles

router = APIRouter(prefix="/admin", tags=["admin"])
admin_only = require_roles("admin")


def _user_summary(u: dict) -> dict:
    return {
        "id": str(u["_id"]),
        "name": u.get("name"),
        "email": u.get("email"),
        "role": u.get("role"),
        "verified": u.get("verified", False),
        "blocked": u.get("blocked", False),
        "created_at": u.get("created_at"),
    }


@router.get("/stats")
async def stats(_: dict = Depends(admin_only)):
    return {
        "users": await users_col.count_documents({}),
        "verified_users": await users_col.count_documents({"verified": True}),
        "blocked_users": await users_col.count_documents({"blocked": True}),
        "raw_documents": await raw_documents_col.count_documents({}),
        "cleaned_documents": await cleaned_documents_col.count_documents({}),
        "active_sessions": await sessions_col.count_documents({}),
        "processing_jobs": await processing_jobs_col.count_documents({}),
    }


@router.get("/users")
async def list_users(limit: int = 100, _: dict = Depends(admin_only)):
    cursor = users_col.find({}).sort("created_at", -1).limit(limit)
    return [_user_summary(u) async for u in cursor]


class UpdateUserRequest(BaseModel):
    role: str | None = None
    blocked: bool | None = None
    verified: bool | None = None


@router.patch("/users/{user_id}")
async def update_user(user_id: str, payload: UpdateUserRequest, _: dict = Depends(admin_only)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "role" in update and update["role"] not in {"admin", "researcher", "student", "guest"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await users_col.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    return _user_summary(user)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, _: dict = Depends(admin_only)):
    res = await users_col.delete_one({"_id": ObjectId(user_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await sessions_col.delete_many({"user_id": ObjectId(user_id)})
    return {"message": "Deleted"}


# ----- License catalog -----
class LicenseRequest(BaseModel):
    code: str
    name: str
    description: str | None = None


@router.get("/licenses")
async def list_licenses(_: dict = Depends(admin_only)):
    return [
        {"id": str(d["_id"]), "code": d["code"], "name": d["name"], "description": d.get("description")}
        async for d in licenses_col.find({})
    ]


@router.post("/licenses")
async def create_license(payload: LicenseRequest, _: dict = Depends(admin_only)):
    doc = {**payload.model_dump(), "created_at": datetime.utcnow()}
    res = await licenses_col.insert_one(doc)
    return {"id": str(res.inserted_id), **payload.model_dump()}


@router.delete("/licenses/{license_id}")
async def delete_license(license_id: str, _: dict = Depends(admin_only)):
    res = await licenses_col.delete_one({"_id": ObjectId(license_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="License not found")
    return {"message": "Deleted"}
