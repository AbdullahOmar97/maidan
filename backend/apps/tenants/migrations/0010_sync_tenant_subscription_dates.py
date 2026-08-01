from django.db import migrations
from django.db.models import F

def sync_subscription_dates(apps, schema_editor):
    Tenant = apps.get_model('tenants', 'Tenant')
    Tenant.objects.filter(
        subscription_end_date__isnull=True,
        trial_ends_at__isnull=False
    ).update(subscription_end_date=F('trial_ends_at'))

    Tenant.objects.filter(
        trial_ends_at__isnull=True,
        subscription_end_date__isnull=False
    ).update(trial_ends_at=F('subscription_end_date'))

def reverse_sync(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0009_rename_belt_globaldefaultbelt_and_more'),
    ]

    operations = [
        migrations.RunPython(sync_subscription_dates, reverse_sync),
    ]
