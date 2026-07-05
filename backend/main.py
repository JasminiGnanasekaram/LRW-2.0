from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from config import get_settings
from database import init_indexes
from routes import auth, documents, search, admin, jobs
from routes import summarize  

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Safe startup check for Groq API Key
    import logging
    logger = logging.getLogger("uvicorn.error")

    api_key = settings.GROQ_API_KEY
    if api_key:
        api_key = api_key.strip().strip("'\"")

    if not api_key:
        logger.warning("[Groq Check] WARNING: GROQ_API_KEY is not configured in backend/.env or system environment variables. Summarization endpoints will fail.")
    elif "..." in api_key:
        # Mask the key
        masked_key = f"gsk_***{api_key[-4:]}" if api_key.startswith("gsk_") else f"{api_key[:4]}***{api_key[-4:]}"
        logger.warning(
            f"[Groq Check] WARNING: GROQ_API_KEY is loaded but contains placeholder dots: '{masked_key}' (raw: '{api_key}'). "
            "Please configure your actual Groq API key without placeholder dots."
        )
    else:
        # Mask the key
        masked_key = f"gsk_***{api_key[-4:]}" if api_key.startswith("gsk_") else f"{api_key[:4]}***{api_key[-4:]}"
        logger.info(f"[Groq Check] SUCCESS: GROQ_API_KEY is successfully loaded (masked: '{masked_key}').")

    await init_indexes()
    yield


app = FastAPI(
    title="Language Resource Workbench API",
    version="0.1.0",
    description="Centralized platform for language resource collection, processing, and analysis.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

uploads_dir = os.path.abspath(settings.UPLOAD_DIR)
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(search.router)
app.include_router(admin.router)
app.include_router(jobs.router)
app.include_router(summarize.router)  


@app.get("/")
async def root():
    return {"name": "LRW API", "status": "ok", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)