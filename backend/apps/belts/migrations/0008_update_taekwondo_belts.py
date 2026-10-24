from django.db import migrations

def update_tenant_taekwondo_belts(apps, schema_editor):
    schema_name = schema_editor.connection.schema_name
    if schema_name == 'public':
        return

    Belt = apps.get_model('belts', 'Belt')

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

    # Check existing Taekwondo belts
    existing_belts = Belt.objects.filter(martial_art="Taekwondo")
    # If student promotions are linked to these belts, we avoid raw delete; update or create
    existing_by_name = {b.name_ar: b for b in existing_belts}

    for name, name_ar, color, order, sessions, months in taekwondo_ranks:
        if name_ar in existing_by_name:
            belt = existing_by_name[name_ar]
            belt.name = name
            belt.color_hex = color
            belt.order_index = order
            belt.min_attendance_sessions = sessions
            belt.min_months_since_last = months
            belt.is_active = True
            belt.save()
        else:
            Belt.objects.create(
                martial_art="Taekwondo",
                name=name,
                name_ar=name_ar,
                color_hex=color,
                order_index=order,
                min_attendance_sessions=sessions,
                min_months_since_last=months,
                is_active=True,
            )

def reverse_update_tenant_taekwondo_belts(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('belts', '0007_alter_examcandidate_options_belt_promotion_fee_and_more'),
    ]

    operations = [
        migrations.RunPython(update_tenant_taekwondo_belts, reverse_update_tenant_taekwondo_belts),
    ]
