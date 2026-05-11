import os
import django
from django.conf import settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")
django.setup()

from apps.tenants.models import Tenant, Domain

print("--- Tenants ---")
for tenant in Tenant.objects.all():
    print(f"Tenant: {tenant.name}, Schema: {tenant.schema_name}")
    for domain in tenant.domains.all():
        print(f"  Domain: {domain.domain}, Primary: {domain.is_primary}")

print("\n--- Current Host Check ---")
# This won't work perfectly without a request context, but we can see what's in DB.
