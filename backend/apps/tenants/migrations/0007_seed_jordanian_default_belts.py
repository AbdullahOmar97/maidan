from django.db import migrations

def seed_jordanian_default_belts(apps, schema_editor):
    GlobalDefaultBelt = apps.get_model('tenants', 'GlobalDefaultBelt')
    
    belts_data = []

    # BJJ
    for name, name_ar, color, order, sessions, months in [
        ("White", "أبيض", "#FFFFFF", 0, 0, 0),
        ("Blue", "أزرق", "#1E3A8A", 1, 50, 12),
        ("Purple", "بنفسجي", "#7C3AED", 2, 100, 18),
        ("Brown", "بني", "#92400E", 3, 150, 24),
        ("Black", "أسود", "#111827", 4, 250, 36),
    ]:
        belts_data.append({
            'martial_art': "BJJ", 'name': name, 'name_ar': name_ar, 'color_hex': color,
            'order_index': order, 'min_attendance_sessions': sessions, 'min_months_since_last': months
        })

    # Karate
    for name, name_ar, color, order, sessions, months in [
        ("White", "أبيض", "#FFFFFF", 0, 0, 0),
        ("Yellow", "أصفر", "#FBBF24", 1, 20, 3),
        ("Orange", "برتقالي", "#F97316", 2, 30, 3),
        ("Green", "أخضر", "#10B981", 3, 40, 4),
        ("Blue", "أزرق", "#3B82F6", 4, 50, 4),
        ("Purple", "بنفسجي", "#8B5CF6", 5, 60, 5),
        ("Brown", "بني", "#78350F", 6, 90, 6),
        ("Black", "أسود", "#111827", 7, 180, 12),
    ]:
        belts_data.append({
            'martial_art': "Karate", 'name': name, 'name_ar': name_ar, 'color_hex': color,
            'order_index': order, 'min_attendance_sessions': sessions, 'min_months_since_last': months
        })

    # Taekwondo
    for name, name_ar, color, order, sessions, months in [
        ("White", "أبيض", "#FFFFFF", 0, 0, 0),
        ("Yellow", "أصفر", "#FBBF24", 1, 20, 3),
        ("Green", "أخضر", "#10B981", 2, 40, 4),
        ("Blue", "أزرق", "#3B82F6", 3, 60, 5),
        ("Red", "أحمر", "#EF4444", 4, 80, 6),
        ("Black", "أسود", "#111827", 5, 150, 12),
    ]:
        belts_data.append({
            'martial_art': "Taekwondo", 'name': name, 'name_ar': name_ar, 'color_hex': color,
            'order_index': order, 'min_attendance_sessions': sessions, 'min_months_since_last': months
        })

    # Judo
    for name, name_ar, color, order, sessions, months in [
        ("White", "أبيض", "#FFFFFF", 0, 0, 0),
        ("Yellow", "أصفر", "#FBBF24", 1, 25, 3),
        ("Orange", "برتقالي", "#F97316", 2, 40, 4),
        ("Green", "أخضر", "#10B981", 3, 60, 5),
        ("Blue", "أزرق", "#3B82F6", 4, 80, 6),
        ("Brown", "بني", "#78350F", 5, 100, 8),
        ("Black", "أسود", "#111827", 6, 200, 12),
    ]:
        belts_data.append({
            'martial_art': "Judo", 'name': name, 'name_ar': name_ar, 'color_hex': color,
            'order_index': order, 'min_attendance_sessions': sessions, 'min_months_since_last': months
        })

    # Create or update them
    for b in belts_data:
        GlobalDefaultBelt.objects.update_or_create(
            martial_art=b['martial_art'],
            order_index=b['order_index'],
            defaults={
                'name': b['name'],
                'name_ar': b['name_ar'],
                'color_hex': b['color_hex'],
                'min_attendance_sessions': b['min_attendance_sessions'],
                'min_months_since_last': b['min_months_since_last'],
                'is_active': True,
            }
        )

def remove_jordanian_default_belts(apps, schema_editor):
    GlobalDefaultBelt = apps.get_model('tenants', 'GlobalDefaultBelt')
    GlobalDefaultBelt.objects.filter(martial_art__in=["BJJ", "Karate", "Taekwondo", "Judo"]).delete()

class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0006_subscriptionchangerequest_billing_cycle"),
    ]

    operations = [
        migrations.RunPython(seed_jordanian_default_belts, remove_jordanian_default_belts),
    ]
