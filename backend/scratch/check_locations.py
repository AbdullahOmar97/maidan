import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "maidan.settings")
django.setup()

from apps.students.models import Location
from django.db import connection

# For multi-tenancy, we might need to iterate through schemas, 
# but let's check public first or just see the structure.
print(f"Current schema: {connection.schema_name}")

try:
    locations = Location.objects.all()
    print(f"Found {locations.count()} locations in current schema.")
    for loc in locations:
        print(f"ID: {loc.id}, Name: '{loc.name}', Name_AR: '{loc.name_ar}'")
except Exception as e:
    print(f"Error: {e}")
