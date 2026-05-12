import os
import django
from django.urls import set_urlconf, reverse
from django.conf import settings
import traceback

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")
django.setup()

tenant_urlconf = settings.ROOT_URLCONF
print(f"Attempting to load URLCONF: {tenant_urlconf}")

try:
    set_urlconf(tenant_urlconf)
    # Try to reverse a known tenant URL
    url = reverse('location-list')
    print(f"SUCCESS: location-list URL is {url}")
except Exception as e:
    print(f"CRITICAL ERROR while loading {tenant_urlconf}:")
    traceback.print_exc()
