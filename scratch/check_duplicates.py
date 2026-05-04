import os
import django
from django.db.models import Count

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.config.settings")
django.setup()

from apps.students.models import Student
from django_tenants.utils import tenant_context, get_tenant_model

Tenant = get_tenant_model()

for tenant in Tenant.objects.exclude(schema_name='public'):
    with tenant_context(tenant):
        print(f"Checking tenant: {tenant.schema_name}")
        duplicates = Student.objects.values('first_name', 'last_name', 'phone', 'location').annotate(count=Count('id')).filter(count__gt=1)
        if duplicates.exists():
            print(f"Found duplicates in {tenant.schema_name}:")
            for dup in duplicates:
                print(dup)
        else:
            print("No duplicates found.")
