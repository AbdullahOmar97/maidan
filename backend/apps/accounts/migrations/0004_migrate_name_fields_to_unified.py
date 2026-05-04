from django.db import migrations

def migrate_names(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    for user in User.objects.all():
        if not user.first_name and user.first_name_ar:
            user.first_name = user.first_name_ar
        if not user.last_name and user.last_name_ar:
            user.last_name = user.last_name_ar
        user.save()

class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_alter_user_first_name_alter_user_first_name_ar_and_more"),
    ]

    operations = [
        migrations.RunPython(migrate_names, reverse_code=migrations.RunPython.noop),
    ]
