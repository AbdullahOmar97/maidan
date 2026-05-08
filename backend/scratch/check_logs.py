import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from django_tenants.utils import schema_context
from apps.audit.models import AuditLog

with schema_context('awdah'):
    logs = AuditLog.objects.filter(resource_id='bd1d1ac4-847d-4684-93eb-ca4226eb8f77').order_by('-created_at')[:10]
    print("Timestamp | Action | Changes")
    for l in logs:
        print(f"{l.created_at} | {l.action} | {l.changes}")
