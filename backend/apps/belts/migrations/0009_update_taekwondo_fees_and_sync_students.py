from django.db import migrations

def update_tenant_taekwondo_belts_and_sync_students(apps, schema_editor):
    schema_name = schema_editor.connection.schema_name
    if schema_name == 'public':
        return

    Belt = apps.get_model('belts', 'Belt')
    StudentBelt = apps.get_model('belts', 'StudentBelt')

    # Progression: (name, name_ar, color, order, sessions, months, fee)
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

    target_belts = {}

    for name, name_ar, color, order, sessions, months, fee in taekwondo_ranks:
        # Match by name_ar first, then by order_index
        belt = Belt.objects.filter(martial_art="Taekwondo", name_ar=name_ar).first()
        if not belt:
            belt = Belt.objects.filter(martial_art="Taekwondo", order_index=order).first()

        if belt:
            belt.name = name
            belt.name_ar = name_ar
            belt.color_hex = color
            belt.order_index = order
            belt.min_attendance_sessions = sessions
            belt.min_months_since_last = months
            belt.promotion_fee = fee
            belt.is_active = True
            belt.save()
        else:
            belt = Belt.objects.create(
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
        target_belts[order] = belt

    # Normalize historical records referencing legacy or duplicate Taekwondo belts
    legacy_belts = Belt.objects.filter(martial_art="Taekwondo").exclude(id__in=[b.id for b in target_belts.values()])
    for old_belt in legacy_belts:
        # Map to closest rank by order or name
        matched_belt = None
        for order, b in target_belts.items():
            if b.name_ar == old_belt.name_ar or b.name == old_belt.name or b.order_index == old_belt.order_index:
                matched_belt = b
                break
        if not matched_belt:
            matched_belt = target_belts[0]

        StudentBelt.objects.filter(belt_rank=old_belt).update(belt_rank=matched_belt)
        old_belt.is_active = False
        old_belt.save()

def reverse_update(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('belts', '0008_update_taekwondo_belts'),
    ]

    operations = [
        migrations.RunPython(update_tenant_taekwondo_belts_and_sync_students, reverse_update),
    ]
