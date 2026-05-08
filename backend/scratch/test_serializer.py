import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.billing.serializers import InvoiceSerializer
from apps.billing.models import Invoice

print(repr(InvoiceSerializer()))
