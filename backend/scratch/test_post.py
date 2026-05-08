import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.billing.serializers import InvoiceSerializer
data = {"student_id": 6, "subtotal": 10.0, "due_date": "2026-05-06"}
s = InvoiceSerializer(data=data)
if s.is_valid():
    print("VALID:", s.validated_data)
else:
    print("ERRORS:", s.errors)
