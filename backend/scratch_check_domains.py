
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")
django.setup()

from apps.tenants.models import Tenant, Domain
from django_tenants.utils import get_public_schema_name

print(f"Public schema name: {get_public_schema_name()}")
print("\nTenants:")
for t in Tenant.objects.all():
    print(f"- {t.name} (slug: {t.slug}, schema: {t.schema_name})")
    for d in Domain.objects.filter(tenant=t):
        print(f"  * Domain: {d.domain} (Primary: {d.is_primary})")
