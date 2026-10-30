# Generated for MAIDAN Accounts Security & Preferences Upgrade

import apps.accounts.models
import shared.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_add_force_password_reset"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="notification_preferences",
            field=models.JSONField(
                blank=True,
                default=apps.accounts.models.default_notification_preferences,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="password_changed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="token_version",
            field=models.PositiveIntegerField(
                default=1,
                help_text="Incremented on password change, reset, or global session revocation.",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="ui_preferences",
            field=models.JSONField(
                blank=True,
                default=apps.accounts.models.default_ui_preferences,
            ),
        ),
        migrations.AlterField(
            model_name="user",
            name="avatar",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to=shared.validators.avatar_upload_path,
            ),
        ),
    ]
