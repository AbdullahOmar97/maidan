"""Celery app initialization — ensures celery is loaded with Django."""
from .celery import app as celery_app

__all__ = ("celery_app",)
