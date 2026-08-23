from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from config import get_settings

settings = get_settings()

client = AsyncIOMotorClient(settings.MONGO_URI)
db = client[settings.DB_NAME]

# Collections (matches SRS entities)
users_col = db["users"]
sessions_col = db["sessions"]
sources_col = db["sources"]
raw_documents_col = db["raw_documents"]
cleaned_documents_col = db["cleaned_documents"]
annotated_documents_col = db["annotated_documents"]
document_metadata_col = db["document_metadata"]
licenses_col = db["licenses"]
nlp_analysis_col = db["nlp_analysis"]
search_index_col = db["search_index_entries"]
processing_jobs_col = db["processing_jobs"]
outputs_col = db["outputs"]
email_verifications_col = db["email_verifications"]
password_resets_col = db["password_resets"]

# ---- GridFS (stores the actual uploaded files: PDF, audio, images) ----
# ✅ இதை போடுங்க
# ---- GridFS: stores large document text / file binaries ----
# Created lazily: AsyncIOMotorGridFSBucket grabs the running event loop at
# construction time, and at import time there is no loop yet.
_fs_bucket: AsyncIOMotorGridFSBucket | None = None


def get_gridfs_bucket() -> AsyncIOMotorGridFSBucket:
    """GridFS bucket used by routes/documents.py. Call only from async code."""
    global _fs_bucket
    if _fs_bucket is None:
        _fs_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="documents")
    return _fs_bucket



async def init_indexes():
    """Create indexes on first run."""
    await users_col.create_index("email", unique=True)
    await sessions_col.create_index("token", unique=True)
    await raw_documents_col.create_index("user_id")
    await cleaned_documents_col.create_index("user_id")
    await cleaned_documents_col.create_index([("text", "text")])  # full-text search
    await search_index_col.create_index("term")
    await email_verifications_col.create_index("token", unique=True)
    await email_verifications_col.create_index("expires_at", expireAfterSeconds=0)
    await password_resets_col.create_index("token", unique=True)
    await password_resets_col.create_index("expires_at", expireAfterSeconds=0)
