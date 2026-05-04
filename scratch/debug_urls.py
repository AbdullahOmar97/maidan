
import os
import django
from django.conf import settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.base")
django.setup()

from apps.attendance.urls import router

for url in router.urls:
    print(url.pattern)
