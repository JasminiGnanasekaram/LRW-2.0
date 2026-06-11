"""Celery app for background processing.

Run a worker with:
    celery -A celery_app.celery worker --loglevel=info
"""
from celery import Celery
from config import get_settings

settings = get_settings()

celery = Celery(
    "lrw",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)
celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)

# Auto-discover tasks
celery.autodiscover_tasks(["tasks"])
