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
        logger.warning("No global default belts found in public schema. Using fallback hardcoded BJJ, Karate, Taekwondo, and Judo belts.")
        # Fallback hardcoded belts if nothing in GlobalDefaultBelt
        fallback_belts = []
        
        # BJJ
        for name, name_ar, color, order, sessions, months in [
            ("White", "أبيض", "#FFFFFF", 0, 0, 0),
            ("Blue", "أزرق", "#1E3A8A", 1, 50, 12),
            ("Purple", "بنفسجي", "#7C3AED", 2, 100, 18),
            ("Brown", "بني", "#92400E", 3, 150, 24),
            ("Black", "أسود", "#111827", 4, 250, 36),
        ]:
            fallback_belts.append({
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
            fallback_belts.append({
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
            fallback_belts.append({
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
            fallback_belts.append({
                'martial_art': "Judo", 'name': name, 'name_ar': name_ar, 'color_hex': color,
                'order_index': order, 'min_attendance_sessions': sessions, 'min_months_since_last': months
            })

        belt_list = [type('obj', (object,), b) for b in fallback_belts]

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
    class_types = [
        # BJJ
        ("BJJ Fundamentals", "أساسيات البراجيتسو", "BJJ", "#6366f1", 60),
        ("Kids BJJ", "براجيتسو الأطفال", "BJJ", "#f59e0b", 45),
        ("No-Gi Grappling", "جراپلينج بدون كيموناه", "BJJ", "#ef4444", 60),
        # Karate
        ("Karate Fundamentals", "أساسيات الكاراتيه", "Karate", "#10b981", 60),
        ("Kids Karate", "كاراتيه الأطفال", "Karate", "#3b82f6", 45),
        ("Kumite", "القتال - كوميته", "Karate", "#f59e0b", 60),
        # Taekwondo
        ("Taekwondo Poomsae", "تايكوندو بومزا", "Taekwondo", "#ef4444", 60),
        ("Taekwondo Sparring", "تايكوندو قتال الكيروجي", "Taekwondo", "#6366f1", 60),
        ("Kids Taekwondo", "تايكوندو الأطفال", "Taekwondo", "#f59e0b", 45),
        # Judo
        ("Judo Fundamentals", "أساسيات الجودو", "Judo", "#3b82f6", 60),
        ("Randori", "الاشتباك الحر - راندوري", "Judo", "#10b981", 60),
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


def enforce_plan_downgrade_limits(tenant, new_plan):
    """
    Enforces new plan limits on active locations, staff, and students
    by deactivating the newest records if they exceed the plan limits.
    This should be called under schema context of the tenant.
    """
    from apps.students.models import Location, Student
    from apps.staff.models import StaffMember

    # 1. Deactivate newest active Locations if limits are exceeded
    active_locations = Location.objects.filter(is_active=True).order_by("created_at")
    active_locations_count = active_locations.count()
    if active_locations_count > new_plan.max_locations:
        excess = active_locations_count - new_plan.max_locations
        to_deactivate = Location.objects.filter(is_active=True).order_by("-created_at")[:excess]
        for loc in to_deactivate:
            loc.is_active = False
            loc.save(update_fields=["is_active"])
            logger.info(f"Deactivated location due to downgrade: {loc.name} (Tenant: {tenant.schema_name})")

    # 2. Deactivate newest active Staff if limits are exceeded
    active_staff = StaffMember.objects.filter(user__is_active=True).order_by("created_at")
    active_staff_count = active_staff.count()
    if active_staff_count > new_plan.max_staff:
        excess = active_staff_count - new_plan.max_staff
        to_deactivate_staff = StaffMember.objects.filter(user__is_active=True).order_by("-created_at")[:excess]
        for sm in to_deactivate_staff:
            user = sm.user
            user.is_active = False
            user.save(update_fields=["is_active"])
            logger.info(f"Deactivated staff user due to downgrade: {user.email} (Tenant: {tenant.schema_name})")

    # 3. Deactivate newest active Students if limits are exceeded
    active_students = Student.objects.filter(status="active", deleted_at__isnull=True).order_by("created_at")
    active_students_count = active_students.count()
    if active_students_count > new_plan.max_students:
        excess = active_students_count - new_plan.max_students
        to_deactivate_students = Student.objects.filter(status="active", deleted_at__isnull=True).order_by("-created_at")[:excess]
        for stu in to_deactivate_students:
            stu.status = "inactive"
            stu.save(update_fields=["status"])
            logger.info(f"Deactivated student due to downgrade: {stu.full_name} (Tenant: {tenant.schema_name})")

