import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from apps.accounts.models import User
from shared.permissions import CanViewReports
from rest_framework.test import APIRequestFactory

factory = APIRequestFactory()
request = factory.get('/')

try:
    user = User.objects.get(email='a.salman@livaatverse.com')
    request.user = user

    perm = CanViewReports()
    print(f"User: {user.email}")
    print(f"Role: {user.role}")
    print(f"Perms: {user.permissions}")
    print(f"Has permission: {perm.has_permission(request, None)}")
except User.DoesNotExist:
    print("User Salman not found")
