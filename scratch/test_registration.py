import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.tenants.serializers import TenantRegistrationSerializer
from apps.tenants.models import Plan

# Create a dummy plan if none exists
plan, created = Plan.objects.get_or_create(
    slug="basic",
    defaults={"name": "Basic Plan", "price_monthly": 100}
)

data = {
    "first_name": "Test",
    "last_name": "User",
    "email": "test@example.com",
    "password": "password123",
    "academy_name": "Test Academy",
    "slug": "test-academy",
    "plan_id": plan.id
}

serializer = TenantRegistrationSerializer(data=data)
if serializer.is_valid():
    try:
        tenant = serializer.save()
        print(f"Success! Tenant created: {tenant}")
    except Exception as e:
        print(f"Error during save: {e}")
else:
    print(f"Validation errors: {serializer.errors}")
