import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

# Absolute path to the backend/.env file
current_dir = os.path.dirname(os.path.abspath(__file__))
env_file_path = os.path.join(current_dir, ".env")

# Clean up any bad placeholder system environment variables to avoid overriding the .env file
if os.environ.get("GROQ_API_KEY") and ("..." in os.environ["GROQ_API_KEY"] or not os.environ["GROQ_API_KEY"].strip()):
    del os.environ["GROQ_API_KEY"]

class Settings(BaseSettings):
    MONGO_URI: str = "mongodb://localhost:27017"
    DB_NAME: str = "lrw"
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_MINUTES: int = 1440
    UPLOAD_DIR: str = "./uploads"
    CORS_ORIGINS: str = "http://localhost:5173"

    WHISPER_MODEL: str = "base"
    REDIS_URL: str = "redis://localhost:6379/0"
    USE_CELERY: bool = False
    DEV_SKIP_EMAIL_VERIFICATION: bool = False

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "no-reply@lrw.local"
    APP_BASE_URL: str = "http://localhost:5173"
    GROQ_API_KEY: str | None = None
    TESSERACT_CMD: str | None = None

    model_config = SettingsConfigDict(env_file=env_file_path, extra="ignore")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
