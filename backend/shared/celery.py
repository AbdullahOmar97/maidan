"""
MAIDAN — Celery Utilities for Multi-Tenancy
"""
import logging
from typing import Callable, Iterable, List

from django_tenants.utils import get_public_schema_name, schema_context

from apps.tenants.models import Tenant

logger = logging.getLogger("maidan.celery")


def active_tenant_schema_names() -> List[str]:
    """List schema names for active tenants (excluding public). Always reads from public schema."""
    with schema_context(get_public_schema_name()):
        return list(
            Tenant.objects.exclude(schema_name=get_public_schema_name())
            .filter(is_active=True)
            .values_list("schema_name", flat=True)
        )


def run_task_for_all_tenants(task_func: Callable, *args, **kwargs):
    """
    Execute a synchronous callable inside each tenant schema (sequential).
    Prefer enqueueing per-tenant Celery tasks from beat handlers so one tenant cannot block others.
    """
    results = {}
    for schema_name in active_tenant_schema_names():
        try:
            with schema_context(schema_name):
                logger.info(f"Running task {task_func.__name__} for tenant: {schema_name}")
                results[schema_name] = task_func(*args, **kwargs)
        except Exception as e:
            logger.exception(f"Error running task {task_func.__name__} for tenant {schema_name}: {e}")
            results[schema_name] = {"error": str(e)}
    return results


def chunked(iterable: Iterable, size: int):
    """Yield lists of at most `size` items from iterable."""
    chunk: List = []
    for item in iterable:
        chunk.append(item)
        if len(chunk) >= size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk
