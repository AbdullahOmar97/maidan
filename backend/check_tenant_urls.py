import os
import django
from django.urls import reverse, get_resolver

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")
django.setup()

from django_tenants.utils import schema_context
from apps.tenants.models import Tenant

try:
    tenant = Tenant.objects.get(slug='awdah')
    print(f"Testing for tenant: {tenant.schema_name}")

    with schema_context(tenant.schema_name):
        try:
            # Try to reverse a known tenant URL
            url = reverse('location-list')
            print(f"SUCCESS: location-list URL is {url}")
        except Exception as e:
            print(f"FAILED: Could not reverse 'location-list'. Error: {e}")
            
except Exception as e:
    print(f"Could not find tenant 'awdah'. Error: {e}")
