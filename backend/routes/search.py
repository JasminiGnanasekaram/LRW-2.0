from fastapi import APIRouter, Depends, Query
from bson import ObjectId
from typing import Optional

from database import (
    cleaned_documents_col,
    raw_documents_col,
    document_metadata_col,
    nlp_analysis_col,
)
from utils.security import get_current_user

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
async def search(
    q: Optional[str] = Query(None),
    pos: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    license: Optional[str] = Query(None),
    file_type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = 20,
    user: dict = Depends(get_current_user),
):
    base_filter = {}
    if user["role"] != "admin":
        base_filter["user_id"] = ObjectId(user["id"])

    candidates = []
    if q:
        try:
            text_filter = {**base_filter, "$text": {"$search": q}}
            cursor = (
                cleaned_documents_col.find(text_filter, {"score": {"$meta": "textScore"}})
                .sort([("score", {"$meta": "textScore"})])
                .limit(limit * 4)
            )
            candidates = [doc async for doc in cursor]
        except Exception:
            regex_filter = {**base_filter, "text": {"$regex": q, "$options": "i"}}
            candidates = [doc async for doc in cleaned_documents_col.find(regex_filter).limit(limit * 4)]
    else:
        cursor = cleaned_documents_col.find(base_filter).sort([("_id", -1)]).limit(limit * 4)
        candidates = [doc async for doc in cursor]

    results = []
    for cleaned in candidates:
        raw = await raw_documents_col.find_one({"_id": cleaned["raw_document_id"]})
        if not raw:
            continue
        if file_type and raw.get("file_type") != file_type:
            continue
        if date_from and raw.get("created_at") and raw["created_at"].isoformat() < date_from:
            continue
        if date_to and raw.get("created_at") and raw["created_at"].isoformat() > date_to + "T23:59:59":
            continue

        meta = await document_metadata_col.find_one({"raw_document_id": cleaned["raw_document_id"]})
        meta_data = (meta or {}).get("data") or {}
        if domain and meta_data.get("domain") != domain:
            continue
        if license and meta_data.get("license") != license:
            continue

        # FIX: POS filter works with both string and dict tokens
        if pos:
            analysis = await nlp_analysis_col.find_one({"cleaned_document_id": cleaned["_id"]})
            nlp_data = ((analysis or {}).get("data") or {})
            tokens = nlp_data.get("token_details") or nlp_data.get("tokens") or []
            ql = q.lower() if q else None
            match = False
            for t in tokens:
                if isinstance(t, dict):
                    token_pos = (t.get("pos") or "").upper()
                    token_text = (t.get("text") or "").lower()
                    token_lemma = (t.get("lemma") or "").lower()
                else:
                    token_pos = ""
                    token_text = str(t).lower()
                    token_lemma = token_text
                
                if token_pos == pos.upper():
                    if ql is None or (ql in token_text or ql in token_lemma):
                        match = True
                        break
            if not match:
                continue

        snippet = (cleaned.get("text") or "")[:300]
        results.append({
            "id": str(cleaned["_id"]),
            "raw_document_id": str(cleaned["raw_document_id"]),
            "filename": raw.get("filename"),
            "file_type": raw.get("file_type"),
            "snippet": snippet,
            "score": cleaned.get("score"),
            "metadata": meta_data,
            "created_at": raw.get("created_at"),
        })
        if len(results) >= limit:
            break

    return {
        "query": q,
        "filters": {
            "pos": pos, "domain": domain, "license": license,
            "file_type": file_type, "date_from": date_from, "date_to": date_to,
        },
        "count": len(results),
        "results": results,
    }