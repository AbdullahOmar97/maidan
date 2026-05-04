"""
MAIDAN — Tenants App Utilities
Seeding default data for new tenants.
"""

from apps.belts.models import BeltRank
from apps.attendance.models import ClassType
from .models import GlobalDefaultBelt
import logging

logger = logging.getLogger("maidan")

def seed_default_data(tenant):
    """
    Seeds default data (belts, class types) for a new tenant.
    This should be called within the context of the tenant's schema.
    """
    logger.info(f"Seeding default data for tenant: {tenant.schema_name}")

    # --- 1. Default Belt Ranks ---
    # Fetch from GlobalDefaultBelt (public schema)
    # Since we are in schema context, we need to access public schema for GlobalDefaultBelt
    from django_tenants.utils import schema_context
    with schema_context("public"):
        defaults = GlobalDefaultBelt.objects.filter(is_active=True).order_by("martial_art", "order_index")
        belt_list = list(defaults)

    if not belt_list:
        logger.warning("No global default belts found in public schema. Using fallback hardcoded BJJ belts.")
        # Fallback hardcoded BJJ belts if nothing in GlobalDefaultBelt
        belt_list = [
            # Note: converting to objects/dicts that match the loop below
            type('obj', (object,), {
                'martial_art': "BJJ", 'name': "White", 'name_ar': "أبيض", 'color_hex': "#FFFFFF",
                'order_index': 0, 'min_attendance_sessions': 0, 'min_months_since_last': 0
            }),
            type('obj', (object,), {
                'martial_art': "BJJ", 'name': "Blue", 'name_ar': "أزرق", 'color_hex': "#1E3A8A",
                'order_index': 1, 'min_attendance_sessions': 50, 'min_months_since_last': 12
            }),
            type('obj', (object,), {
                'martial_art': "BJJ", 'name': "Purple", 'name_ar': "بنفسجي", 'color_hex': "#7C3AED",
                'order_index': 2, 'min_attendance_sessions': 100, 'min_months_since_last': 18
            }),
            type('obj', (object,), {
                'martial_art': "BJJ", 'name': "Brown", 'name_ar': "بني", 'color_hex': "#92400E",
                'order_index': 3, 'min_attendance_sessions': 150, 'min_months_since_last': 24
            }),
            type('obj', (object,), {
                'martial_art': "BJJ", 'name': "Black", 'name_ar': "أسود", 'color_hex': "#111827",
                'order_index': 4, 'min_attendance_sessions': 250, 'min_months_since_last': 36
            }),
        ]

    for b in belt_list:
        BeltRank.objects.get_or_create(
            martial_art=b.martial_art,
            order_index=b.order_index,
            defaults={
                "name": b.name,
                "name_ar": b.name_ar,
                "color_hex": b.color_hex,
                "min_attendance_sessions": b.min_attendance_sessions,
                "min_months_since_last": b.min_months_since_last,
                "is_active": True,
            },
        )

    # --- 2. Default Class Types ---
    # (Keeping these hardcoded for now or you can also move them to global defaults if needed)
    class_types = [
        ("BJJ Fundamentals", "أساسيات البراجيتسو", "BJJ", "#6366f1", 60),
        ("Kids BJJ", "براجيتسو الأطفال", "BJJ", "#f59e0b", 45),
        ("No-Gi Grappling", "جراپلينج بدون كيموناه", "BJJ", "#ef4444", 60),
    ]

    for name, name_ar, martial_art, color, duration in class_types:
        ClassType.objects.get_or_create(
            name=name,
            defaults={
                "name_ar": name_ar,
                "martial_art": martial_art,
                "color": color,
                "default_duration_minutes": duration,
                "is_active": True,
            },
        )

    logger.info(f"Successfully seeded default data for {tenant.schema_name}")
