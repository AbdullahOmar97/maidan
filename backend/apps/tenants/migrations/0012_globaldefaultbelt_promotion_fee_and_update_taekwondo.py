from django.db import migrations, models

def update_taekwondo_defaults_and_fees(apps, schema_editor):
    GlobalDefaultBelt = apps.get_model('tenants', 'GlobalDefaultBelt')

    # Taekwondo progression:
    # (name, name_ar, color, order_index, sessions, months, fee)
    taekwondo_ranks = [
        ("White", "أبيض", "#FFFFFF", 0, 0, 0, 0.00),
        ("Yellow", "أصفر", "#FBBF24", 1, 24, 3, 20.00),
        ("Green 1", "أخضر واحد", "#10B981", 2, 28, 3, 20.00),
        ("Green 2", "أخضر اثنين", "#059669", 3, 28, 3, 25.00),
        ("Blue 1", "أزرق واحد", "#3B82F6", 4, 36, 4, 25.00),
        ("Blue 2", "أزرق اثنين", "#1D4ED8", 5, 36, 4, 30.00),
        ("Brown 1", "بني واحد", "#92400E", 6, 40, 4, 30.00),
        ("Brown 2", "بني اثنين", "#78350F", 7, 40, 4, 35.00),
        ("Red 1", "أحمر واحد", "#EF4444", 8, 48, 5, 35.00),
        ("Red 2", "أحمر اثنين", "#B91C1C", 9, 48, 5, 40.00),
        ("Black 1st Dan", "أسود واحد دان", "#111827", 10, 100, 12, 100.00),
        ("Black 2nd Dan", "أسود اثنين دان", "#0F172A", 11, 150, 24, 150.00),
        ("Black 3rd Dan", "أسود ثلاث دان", "#000000", 12, 200, 36, 200.00),
        ("Black 4th Dan", "أسود أربعه دان", "#000000", 13, 250, 48, 250.00),
    ]

    # Clean existing Taekwondo global defaults and recreate
    GlobalDefaultBelt.objects.filter(martial_art="Taekwondo").delete()

    for name, name_ar, color, order, sessions, months, fee in taekwondo_ranks:
        GlobalDefaultBelt.objects.create(
            martial_art="Taekwondo",
            name=name,
            name_ar=name_ar,
            color_hex=color,
            order_index=order,
            min_attendance_sessions=sessions,
            min_months_since_last=months,
            promotion_fee=fee,
            is_active=True,
        )

def reverse_update(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0011_update_taekwondo_default_belts'),
    ]

    operations = [
        migrations.AddField(
            model_name='globaldefaultbelt',
            name='promotion_fee',
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=10),
        ),
        migrations.RunPython(update_taekwondo_defaults_and_fees, reverse_update),
    ]
