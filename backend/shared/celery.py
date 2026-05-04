"""
MAIDAN — Celery Utilities for Multi-Tenancy
"""
import logging
from typing import Callable

from django.db import connection
from django_tenants.utils import schema_context
from apps.tenants.models import Tenant

logger = logging.getLogger("maidan.celery")

def run_task_for_all_tenants(task_func: Callable, *args, **kwargs):
    """
    Utility to execute a function/task for all active tenants.
    """
    tenants = Tenant.objects.exclude(schema_name="public").filter(is_active=True)
    results = {}
    
    for tenant in tenants:
        try:
            with schema_context(tenant.schema_name):
                logger.info(f"Running task {task_func.__name__} for tenant: {tenant.schema_name}")
                results[tenant.schema_name] = task_func(*args, **kwargs)
        except Exception as e:
            logger.exception(f"Error running task {task_func.__name__} for tenant {tenant.schema_name}: {e}")
            results[tenant.schema_name] = {"error": str(e)}
            
    return results
