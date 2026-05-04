"""
MAIDAN — Tenants App Signals
Handles automatic seeding after schema creation.
"""

from django.dispatch import receiver
from django_tenants.signals import post_schema_sync
from django_tenants.utils import schema_context
from .utils import seed_default_data

@receiver(post_schema_sync)
def post_schema_sync_handler(sender, tenant, **kwargs):
    """
    Triggers after a tenant's schema has been synced (migrations finished).
    We use this to seed default data like belt ranks.
    """
    # Only seed for actual tenants, not the public schema
    if tenant.schema_name != "public":
        # Ensure we are in the correct schema context
        with schema_context(tenant.schema_name):
            seed_default_data(tenant)
