from motor.motor_asyncio import AsyncIOMotorClient
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
