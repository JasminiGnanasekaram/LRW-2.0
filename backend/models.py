from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# ----- Auth -----
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    role: str = "student"  # admin | researcher | student | guest


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ----- Documents -----
class MetadataIn(BaseModel):
    source: Optional[str] = None
    author: Optional[str] = None
    publication_date: Optional[str] = None
    domain: Optional[str] = None
    category: Optional[str] = None
    license: str = "open"  # open | research | restricted


class DocumentOut(BaseModel):
    id: str
    user_id: str
    filename: str
    file_type: str  # text | pdf | image | audio | url
    raw_text: Optional[str] = None
    cleaned_text: Optional[str] = None
    metadata: Optional[dict] = None
    nlp: Optional[dict] = None
    created_at: datetime


class URLUpload(BaseModel):
    url: str
    metadata: Optional[MetadataIn] = None


# ----- Search -----
class SearchRequest(BaseModel):
    query: str
    pos_filter: Optional[str] = None
    domain: Optional[str] = None
    limit: int = 20
