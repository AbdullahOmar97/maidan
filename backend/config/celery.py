"""
MAIDAN — Celery Configuration
"""
import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("maidan")

app.config_from_object("django.conf:settings", namespace="CELERY")

app.autodiscover_tasks()

# ---------------------------------------------------------------------------
# Periodic Tasks (Celery Beat)
# ---------------------------------------------------------------------------
app.conf.beat_schedule = {
    # Billing: Check overdue invoices daily at 8am
    "check-overdue-invoices": {
        "task": "apps.billing.tasks.check_all_overdue_invoices",
        "schedule": crontab(hour=8, minute=0),
    },
    # Billing: Send renewal reminders 7 days before expiry
    "send-renewal-reminders": {
        "task": "apps.billing.tasks.send_all_renewal_reminders",
        "schedule": crontab(hour=9, minute=0),
    },
    # Messaging: Process queued messages every 5 minutes
    "process-message-queue": {
        "task": "apps.messaging.tasks.process_all_message_queues",
        "schedule": crontab(minute="*/5"),
    },
    # Belt promotions: Check promotion eligibility weekly
    "check-promotion-eligibility": {
        "task": "apps.belts.tasks.check_all_promotion_eligibility",
        "schedule": crontab(day_of_week=1, hour=10, minute=0),
    },
    # Tenants: Check expired trials daily at 1am
    "check-expired-trials": {
        "task": "apps.tenants.tasks.check_expired_trials",
        "schedule": crontab(hour=1, minute=0),
    },
}

app.conf.task_routes = {
    "apps.billing.*": {"queue": "billing"},
    "apps.messaging.*": {"queue": "messaging"},
    "apps.*": {"queue": "default"},
}

app.conf.task_serializer = "json"
app.conf.result_serializer = "json"
app.conf.accept_content = ["json"]
app.conf.timezone = "UTC"
app.conf.enable_utc = True
