"""
MAIDAN — Tenants App Utilities
Seeding default data for new tenants.
"""

from apps.attendance.models import ClassType
import logging

logger = logging.getLogger("maidan")

def seed_default_data(tenant):
    """
    Seeds default data (class types) for a new tenant.
    This should be called within the context of the tenant's schema.
    """
    logger.info(f"Seeding default data for tenant: {tenant.schema_name}")

    # --- 1. Default Class Types ---
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

