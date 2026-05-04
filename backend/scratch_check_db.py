import os
import django
from django.conf import settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from apps.students.models import Location
from django_tenants.utils import schema_context, get_tenant_model

Tenant = get_tenant_model()

print(f"Total tenants: {Tenant.objects.count()}")

for tenant in Tenant.objects.all():
    print(f"\nChecking tenant: {tenant.schema_name} ({tenant.domain_url if hasattr(tenant, 'domain_url') else 'no domain'})")
    with schema_context(tenant.schema_name):
        try:
            count = Location.objects.count()
            print(f"  Location count: {count}")
            if count > 0:
                for loc in Location.objects.all():
                    print(f"    - {loc.name} ({loc.name_ar})")
        except Exception as e:
            print(f"  Error accessing Location: {e}")
