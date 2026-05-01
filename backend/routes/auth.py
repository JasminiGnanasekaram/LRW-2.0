from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from bson import ObjectId

from models import RegisterRequest, TokenResponse
from database import (
    users_col, sessions_col,
    email_verifications_col, password_resets_col,
)
from utils.security import (
    hash_password, verify_password, create_access_token, get_current_user,
)
from services.email_service import (
    generate_token, expiry,
    send_verification_email, send_reset_email,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _public_user(user_doc: dict) -> dict:
    return {
        "id": str(user_doc["_id"]),
        "name": user_doc.get("name"),
        "email": user_doc.get("email"),
        "role": user_doc.get("role", "student"),
        "verified": user_doc.get("verified", False),
    }


@router.post("/register")
async def register(payload: RegisterRequest):
    existing = await users_col.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    valid_roles = {"admin", "researcher", "student", "guest"}
    role = payload.role if payload.role in valid_roles else "student"

    doc = {
        "name": payload.name,
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "role": role,
        "verified": False,
        "blocked": False,
        "created_at": datetime.utcnow(),
    }
    res = await users_col.insert_one(doc)

    # Create verification token
    token = generate_token()
    await email_verifications_col.insert_one({
        "user_id": res.inserted_id,
        "token": token,
        "expires_at": expiry(24),
        "created_at": datetime.utcnow(),
    })
    send_verification_email(payload.email, token)

    return {
        "message": "Registered. Check your email for the verification link.",
        "email": payload.email,
    }


@router.post("/verify-email")
async def verify_email(token: str):
    rec = await email_verifications_col.find_one({"token": token})
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    await users_col.update_one({"_id": rec["user_id"]}, {"$set": {"verified": True}})
    await email_verifications_col.delete_one({"_id": rec["_id"]})
    return {"message": "Email verified. You can now sign in."}


@router.post("/resend-verification")
async def resend_verification(email: EmailStr):
    user = await users_col.find_one({"email": email})
    if not user:
        return {"message": "If that email exists, a verification link was sent."}
    if user.get("verified"):
        return {"message": "Already verified."}
    await email_verifications_col.delete_many({"user_id": user["_id"]})
    token = generate_token()
    await email_verifications_col.insert_one({
        "user_id": user["_id"], "token": token,
        "expires_at": expiry(24), "created_at": datetime.utcnow(),
    })
    send_verification_email(email, token)
    return {"message": "Verification email sent."}


@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = await users_col.find_one({"email": form.username})
    if not user or not verify_password(form.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.get("blocked"):
        raise HTTPException(status_code=403, detail="Account blocked")
    if not user.get("verified"):
        raise HTTPException(status_code=403, detail="Email not verified. Check your inbox.")

    token = create_access_token(str(user["_id"]), user.get("role", "student"))
    await sessions_col.insert_one({
        "user_id": user["_id"], "token": token, "created_at": datetime.utcnow(),
    })
    return {"access_token": token, "token_type": "bearer", "user": _public_user(user)}


@router.post("/logout")
async def logout(user: dict = Depends(get_current_user)):
    await sessions_col.delete_many({"user_id": ObjectId(user["id"])})
    return {"message": "Logged out"}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return _public_user({**user, "_id": ObjectId(user["id"])})


# ----- Password reset -----
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    user = await users_col.find_one({"email": payload.email})
    # Always succeed silently to avoid email enumeration
    if user:
        await password_resets_col.delete_many({"user_id": user["_id"]})
        token = generate_token()
        await password_resets_col.insert_one({
            "user_id": user["_id"], "token": token,
            "expires_at": expiry(1), "created_at": datetime.utcnow(),
        })
        send_reset_email(payload.email, token)
    return {"message": "If that email exists, a reset link was sent."}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    rec = await password_resets_col.find_one({"token": payload.token})
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    await users_col.update_one(
        {"_id": rec["user_id"]},
        {"$set": {"password_hash": hash_password(payload.new_password)}},
    )
    await password_resets_col.delete_one({"_id": rec["_id"]})
    return {"message": "Password reset successful. You can sign in now."}
