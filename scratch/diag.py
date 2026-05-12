import os
import django
from django.conf import settings
from django.urls import get_resolver

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")
django.setup()

from apps.tenants.models import Tenant, Domain

print("--- Settings ---")
print(f"ROOT_URLCONF: {settings.ROOT_URLCONF}")
print(f"PUBLIC_SCHEMA_URLCONF: {getattr(settings, 'PUBLIC_SCHEMA_URLCONF', 'N/A')}")
print(
    "django-tenants: tenant hosts fall back to ROOT_URLCONF when middleware "
    "does not set PUBLIC_SCHEMA_URLCONF;"
    f" ROOT_URLCONF={settings.ROOT_URLCONF}"
)
print(f"ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}")

print("\n--- Tenants & Domains ---")
tenants = Tenant.objects.all()
if not tenants.exists():
    print("No tenants found in DB.")
for tenant in tenants:
    print(f"Tenant: {tenant.name} (Schema: {tenant.schema_name})")
    domains = Domain.objects.filter(tenant=tenant)
    for domain in domains:
        print(f"  - Domain: {domain.domain} (Primary: {domain.is_primary})")

print("\n--- URL Resolution Test ---")
resolver = get_resolver()
print(f"Resolver URLConf: {resolver.urlconf_module.__name__}")
found_admin = any('admin' in str(p.pattern) for p in resolver.url_patterns)
print(f"Admin in current resolver: {found_admin}")
