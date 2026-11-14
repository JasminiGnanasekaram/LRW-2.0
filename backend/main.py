from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from config import get_settings
from database import init_indexes
from routes import auth, documents, search, admin, jobs, summarize, crawl

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
        masked_key = f"gsk_***{api_key[-4:]}" if api_key.startswith("gsk_") else f"{api_key[:4]}***{api_key[-4:]}"
        logger.warning(
            f"[Groq Check] WARNING: GROQ_API_KEY is loaded but contains placeholder dots: '{masked_key}' (raw: '{api_key}'). "
            "Please configure your actual Groq API key without placeholder dots."
        )
    else:
        masked_key = f"gsk_***{api_key[-4:]}" if api_key.startswith("gsk_") else f"{api_key[:4]}***{api_key[-4:]}"
        logger.info(f"[Groq Check] SUCCESS: GROQ_API_KEY is successfully loaded (masked: '{masked_key}').")

    try:
        from services.extraction import _resolve_tesseract_cmd
        tess_path = _resolve_tesseract_cmd()
        if tess_path and os.path.isfile(tess_path):
            logger.info(f"[Tesseract Check] SUCCESS: Tesseract executable found at '{tess_path}'.")
        else:
            logger.warning(
                "[Tesseract Check] WARNING: Tesseract not found (checked TESSERACT_CMD, PATH, bundled "
                "Tesseract-OCR/, and standard install folders). Scanned PDFs and image OCR will fail. "
                "Install Tesseract, or set TESSERACT_CMD to the full path of tesseract.exe."
            )
    except Exception as exc:
        logger.warning(f"[Tesseract Check] Check error: {exc}")

    await init_indexes()
    yield


app = FastAPI(
    title="Language Resource Workbench API",
    version="0.1.0",
    description="Centralized platform for language resource collection, processing, and analysis.",
    lifespan=lifespan,
)

# Comma-separated list, e.g. CORS_ORIGINS=https://my-app.vercel.app,http://localhost:5173
# (settings reads the real environment variable first, then backend/.env)
origins = [
    o.strip().rstrip("/")
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
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
app.include_router(crawl.router)


@app.get("/")
async def root():
    return {"name": "LRW API", "status": "ok", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
