"""MAIDAN — Belts Celery Tasks"""
import logging

from celery import shared_task
from django.utils import timezone
from django_tenants.utils import schema_context

from shared.celery import active_tenant_schema_names

logger = logging.getLogger("maidan.belts")


@shared_task(queue="default")
def check_promotion_eligibility(schema_name: str):
    """Compute belt promotion eligibility for all active students in one tenant schema."""
    from apps.students.models import Student
    from apps.belts.models import StudentBelt, PromotionEligibility, Belt
    from apps.attendance.models import AttendanceRecord

    updated = 0
    with schema_context(schema_name):
        active_students = Student.objects.filter(status="active").prefetch_related(
            "belt_history__belt_rank"
        )

        for student in active_students:
            current_belt = student.belt_history.filter(is_current=True).first()
            if not current_belt:
                continue

            next_belt = Belt.objects.filter(
                martial_art=current_belt.belt_rank.martial_art,
                order_index__gt=current_belt.belt_rank.order_index,
                is_active=True,
            ).order_by("order_index").first()

            if not next_belt:
                continue

            sessions_since = AttendanceRecord.objects.filter(
                student=student,
                checked_in_at__gte=current_belt.promoted_at,
            ).count()

            months_since = (timezone.now().date() - current_belt.promoted_at).days // 30

            is_eligible = (
                sessions_since >= next_belt.min_attendance_sessions
                and months_since >= next_belt.min_months_since_last
            )

            eligibility, _ = PromotionEligibility.objects.update_or_create(
                student=student,
                defaults={
                    "next_belt": next_belt,
                    "sessions_completed": sessions_since,
                    "sessions_required": next_belt.min_attendance_sessions,
                    "months_since_last": months_since,
                    "is_eligible": is_eligible,
                },
            )

            if is_eligible and not eligibility.alert_sent:
                send_promotion_alert.delay(schema_name, student.id)
                PromotionEligibility.objects.filter(student=student).update(alert_sent=True)

            updated += 1

    logger.info(f"[{schema_name}] Checked promotion eligibility for {updated} students")
    return {"schema": schema_name, "updated": updated}


@shared_task(queue="default")
def check_all_promotion_eligibility():
    """Periodic task: enqueue promotion eligibility check per tenant."""
    dispatched = 0
    for schema_name in active_tenant_schema_names():
        check_promotion_eligibility.delay(schema_name)
        dispatched += 1
    return {"dispatched": dispatched}


@shared_task(queue="messaging")
def send_promotion_alert(schema_name: str, student_id: int):
    """Notify staff that a student is eligible for promotion."""
    from apps.students.models import Student
    from apps.messaging.models import get_whatsapp_provider

    with schema_context(schema_name):
        try:
            student = Student.objects.get(id=student_id)
            logger.info(f"Promotion alert: {student.full_name} is eligible for belt promotion")
        except Student.DoesNotExist:
            pass
