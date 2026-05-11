import os
import django
from django.urls import get_resolver

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")
django.setup()

def check_admin(resolver, name):
    found = False
    for pattern in resolver.url_patterns:
        p = str(pattern.pattern)
        if 'admin' in p:
            print(f"Found admin in {name}: {p}")
            found = True
    if not found:
        print(f"No admin found in {name}")

check_admin(get_resolver("config.urls"), "Public")
check_admin(get_resolver("config.urls_tenant"), "Tenant")
