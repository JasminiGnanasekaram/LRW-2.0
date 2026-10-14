import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from bson import ObjectId

from config import get_settings
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

settings = get_settings()


def _public_user(user_doc: dict, base_url: str | None = None) -> dict:
    profile_image = user_doc.get("profile_image")
    avatar_url = None
    if profile_image:
        avatar_url = f"/uploads/avatars/{profile_image}"

    return {
        "id": str(user_doc["_id"]),
        "name": user_doc.get("name"),
        "email": user_doc.get("email"),
        "role": user_doc.get("role", "guest"),
        "verified": user_doc.get("verified", False),
        "phone": user_doc.get("phone"),
        "address": user_doc.get("address"),
        "date_of_birth": user_doc.get("date_of_birth"),
        "gender": user_doc.get("gender"),
        "bio": user_doc.get("bio"),
        "profile_image": profile_image,
        "avatar_url": avatar_url,
        "created_at": user_doc.get("created_at"),
        "last_login": user_doc.get("last_login"),
    }


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[str] = None
    bio: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


@router.post("/register")
async def register(request: Request, payload: RegisterRequest):
    existing = await users_col.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    valid_roles = {"admin", "researcher", "guest"}
    role = payload.role if payload.role in valid_roles else "student"

    doc = {
        "name": payload.name,
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "role": role,
        "verified": settings.DEV_SKIP_EMAIL_VERIFICATION,
        "blocked": False,
        "created_at": datetime.utcnow(),
    }
    res = await users_col.insert_one(doc)

    # If dev auto-verify is enabled, skip token creation and email send
    if settings.DEV_SKIP_EMAIL_VERIFICATION:
        return {
            "message": "Registered and auto-verified (dev). You can sign in.",
            "email": payload.email,
        }

    # Create verification token
    token = generate_token()
    await email_verifications_col.insert_one({
        "user_id": res.inserted_id,
        "token": token,
        "expires_at": expiry(24),
        "created_at": datetime.utcnow(),
    })
    try:
        origin = request.headers.get("origin") or settings.APP_BASE_URL
        send_verification_email(payload.email, token, base_url=origin)
    except Exception as e:
        print(f"[register] Email send error: {e}", flush=True)

    return {
        "message": "Registered. Check your email for the verification link.",
        "email": payload.email,
    }


@router.get("/verify-email", response_class=HTMLResponse, name="verify_email_get")
async def verify_email_get(request: Request, token: str):
    rec = await email_verifications_col.find_one({"token": token})
    frontend_origin = request.headers.get("origin") or settings.APP_BASE_URL
    login_url = f"{frontend_origin.rstrip('/')}/login"

    if not rec:
        return HTMLResponse(
            "<html><body style='font-family: Arial, sans-serif; text-align: center; padding: 40px;'>"
            "<h1>Verification failed</h1>"
            "<p>Invalid or expired token.</p>"
            f"<p><a href=\"{login_url}\">Back to sign in</a></p>"
            "</body></html>",
            status_code=400,
        )

    await users_col.update_one({"_id": rec["user_id"]}, {"$set": {"verified": True}})
    await email_verifications_col.delete_one({"_id": rec["_id"]})
    return HTMLResponse(
        "<html><body style='font-family: Arial, sans-serif; text-align: center; padding: 40px;'>"
        "<h1>Email verified!</h1>"
        "<p>Your account is now active.</p>"
        f"<p><a href=\"{login_url}\">Sign in</a></p>"
        "</body></html>"
    )


@router.post("/verify-email")
async def verify_email(token: str):
    rec = await email_verifications_col.find_one({"token": token})
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    await users_col.update_one({"_id": rec["user_id"]}, {"$set": {"verified": True}})
    await email_verifications_col.delete_one({"_id": rec["_id"]})
    return {"message": "Email verified. You can now sign in."}


@router.post("/resend-verification")
async def resend_verification(request: Request, email: EmailStr):
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
    try:
        origin = request.headers.get("origin") or settings.APP_BASE_URL
        send_verification_email(email, token, base_url=origin)
    except Exception as e:
        print(f"[resend] Email send error: {e}", flush=True)
    return {"message": "Verification email sent."}


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, form: OAuth2PasswordRequestForm = Depends()):
    user = await users_col.find_one({"email": form.username})
    if not user or not verify_password(form.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.get("blocked"):
        raise HTTPException(status_code=403, detail="Account blocked")
    if not user.get("verified"):
        raise HTTPException(status_code=403, detail="Email not verified. Check your inbox.")

    now = datetime.utcnow()
    await users_col.update_one({"_id": user["_id"]}, {"$set": {"last_login": now}})
    token = create_access_token(str(user["_id"]), user.get("role", "student"))
    await sessions_col.insert_one({
        "user_id": user["_id"], "token": token, "created_at": now,
    })
    user["last_login"] = now
    base_url = str(request.base_url).rstrip("/")
    return {"access_token": token, "token_type": "bearer", "user": _public_user(user, base_url=base_url)}


@router.post("/logout")
async def logout(user: dict = Depends(get_current_user)):
    await sessions_col.delete_many({"user_id": ObjectId(user["id"])})
    return {"message": "Logged out"}


@router.get("/me")
async def me(request: Request, user: dict = Depends(get_current_user)):
    base_url = str(request.base_url).rstrip("/")
    return _public_user({**user, "_id": ObjectId(user["id"])}, base_url=base_url)


@router.patch("/me")
async def update_profile(request: Request, payload: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    update_fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update_fields:
        await users_col.update_one({"_id": ObjectId(user["id"])}, {"$set": update_fields})
    updated = await users_col.find_one({"_id": ObjectId(user["id"])})
    base_url = str(request.base_url).rstrip("/")
    return _public_user(updated, base_url=base_url)


@router.post("/me/avatar")
async def upload_avatar(request: Request, avatar: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if avatar.content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
        raise HTTPException(status_code=400, detail="Invalid image file type")

    avatar_dir = os.path.join(settings.UPLOAD_DIR, "avatars")
    os.makedirs(avatar_dir, exist_ok=True)
    ext = os.path.splitext(avatar.filename)[1].lower() or ".png"
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        ext = ".png"
    filename = f"{user['id']}{ext}"
    avatar_path = os.path.join(avatar_dir, filename)
    with open(avatar_path, "wb") as f:
        f.write(await avatar.read())

    await users_col.update_one({"_id": ObjectId(user["id"])}, {"$set": {"profile_image": filename}})
    updated = await users_col.find_one({"_id": ObjectId(user["id"])})
    base_url = str(request.base_url).rstrip("/")
    return {"user": _public_user(updated, base_url=base_url)}


@router.post("/change-password")
async def change_password(payload: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    user_doc = await users_col.find_one({"_id": ObjectId(user["id"])})
    if not verify_password(payload.current_password, user_doc["password_hash"]):
        raise HTTPException(status_code=403, detail="Current password is incorrect")

    await users_col.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"password_hash": hash_password(payload.new_password)}},
    )
    return {"message": "Password updated successfully."}


# ----- Password reset -----
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    user = await users_col.find_one({"email": payload.email})
    if user:
        await password_resets_col.delete_many({"user_id": user["_id"]})
        token = generate_token()
        await password_resets_col.insert_one({
            "user_id": user["_id"], "token": token,
            "expires_at": expiry(1), "created_at": datetime.utcnow(),
        })
        try:
            send_reset_email(payload.email, token)
        except Exception as e:
            print(f"[forgot-password] Email send error: {e}", flush=True)
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