import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from apps.accounts.models import User
from apps.accounts.serializers import UserSerializer

try:
    target_user = User.objects.get(email='a.salman@livaatverse.com')
    # Reset some to False and one to True
    data = {'permissions': {'can_view_reports': True, 'can_view_billing': False}}
    serializer = UserSerializer(target_user, data=data, partial=True)
    if serializer.is_valid():
        serializer.save()
        # Re-fetch from DB
        target_user.refresh_from_db()
        print(f"Updated user {target_user.email}")
        print(f"New perms in DB: {target_user.permissions}")
    else:
        print(f"Serializer errors: {serializer.errors}")
except User.DoesNotExist:
    print("User Salman not found")
except Exception as e:
    print(f"Error: {e}")
