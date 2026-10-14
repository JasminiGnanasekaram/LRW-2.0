"""Auth helpers — uses PyJWT + bcrypt directly (no passlib, no python-jose).

This avoids the passlib/bcrypt-version-detection bug and python-jose's stale
deps that don't yet have wheels for Python 3.14.
"""
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from bson import ObjectId

from config import get_settings
from database import users_col

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(sub: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRES_MINUTES)
    payload = {"sub": sub, "role": role, "exp": expire}
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    if isinstance(token, bytes):  # PyJWT < 2 returned bytes; defensive
        token = token.decode("utf-8")
    return token


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    creds_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise creds_exc
    except jwt.PyJWTError:
        raise creds_exc

    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise creds_exc
    user["id"] = str(user["_id"])
    return user


def require_roles(*allowed_roles: str):
    async def checker(user: dict = Depends(get_current_user)):
        if user.get("role") not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker
