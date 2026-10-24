from django.db import migrations

def update_taekwondo_belts(apps, schema_editor):
    GlobalDefaultBelt = apps.get_model('tenants', 'GlobalDefaultBelt')

    taekwondo_ranks = [
        ("White", "أبيض", "#FFFFFF", 0, 0, 0),
        ("Yellow", "أصفر", "#FBBF24", 1, 20, 3),
        ("Green 1", "أخضر واحد", "#10B981", 2, 30, 3),
        ("Green 2", "أخضر اثنين", "#059669", 3, 30, 3),
        ("Blue 1", "أزرق واحد", "#3B82F6", 4, 40, 4),
        ("Blue 2", "أزرق اثنين", "#1D4ED8", 5, 40, 4),
        ("Brown 1", "بني واحد", "#92400E", 6, 50, 4),
        ("Brown 2", "بني اثنين", "#78350F", 7, 50, 4),
        ("Red 1", "أحمر واحد", "#EF4444", 8, 60, 5),
        ("Red 2", "أحمر اثنين", "#B91C1C", 9, 60, 5),
        ("Black 1st Dan", "أسود واحد دان", "#111827", 10, 120, 12),
        ("Black 2nd Dan", "أسود اثنين دان", "#0F172A", 11, 150, 24),
        ("Black 3rd Dan", "أسود ثلاث دان", "#000000", 12, 180, 36),
        ("Black 4th Dan", "أسود أربعه دان", "#000000", 13, 240, 48),
    ]

    # Delete existing Taekwondo default ranks in GlobalDefaultBelt to avoid conflicting order_index
    GlobalDefaultBelt.objects.filter(martial_art="Taekwondo").delete()

    for name, name_ar, color, order, sessions, months in taekwondo_ranks:
        GlobalDefaultBelt.objects.create(
            martial_art="Taekwondo",
            name=name,
            name_ar=name_ar,
            color_hex=color,
            order_index=order,
            min_attendance_sessions=sessions,
            min_months_since_last=months,
            is_active=True,
        )

def reverse_update_taekwondo_belts(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0010_sync_tenant_subscription_dates'),
    ]

    operations = [
        migrations.RunPython(update_taekwondo_belts, reverse_update_taekwondo_belts),
    ]
