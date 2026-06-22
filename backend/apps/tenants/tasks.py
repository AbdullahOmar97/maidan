"""MAIDAN — Tenants Celery Tasks"""
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger("maidan.tenants")

@shared_task(queue="default")
def check_expired_trials():
    """
    Find trial accounts that have exceeded their trial period and mark them as expired.
    """
    from apps.tenants.models import Tenant
    
    now = timezone.now()
    expired_tenants = Tenant.objects.filter(
        is_active=True,
        status=Tenant.SubscriptionStatus.TRIAL,
        trial_ends_at__lt=now
    )
    count = 0
    for tenant in expired_tenants:
        tenant.status = Tenant.SubscriptionStatus.EXPIRED
        tenant.is_active = False
        tenant.save(update_fields=["status", "is_active"])
        count += 1
        logger.info(f"Tenant {tenant.schema_name} trial has expired. Status updated to EXPIRED.")
    
    return {"expired_count": count}
