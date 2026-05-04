"""
MAIDAN — seed_belts Management Command
Seeds default belt ranks for all existing tenants.
"""

from django.core.management.base import BaseCommand
from apps.tenants.models import Tenant
from django_tenants.utils import schema_context
from apps.tenants.utils import seed_default_data

class Command(BaseCommand):
    help = "Seed default belt ranks and class types for all existing tenants"

    def handle(self, *args, **options):
        tenants = Tenant.objects.exclude(schema_name="public")
        self.stdout.write(f"Found {tenants.count()} tenants to seed.")

        for tenant in tenants:
            self.stdout.write(f"Seeding tenant: {tenant.schema_name}...")
            with schema_context(tenant.schema_name):
                seed_default_data(tenant)
            self.stdout.write(self.style.SUCCESS(f"Successfully seeded {tenant.schema_name}"))

        self.stdout.write(self.style.SUCCESS("All tenants processed."))
