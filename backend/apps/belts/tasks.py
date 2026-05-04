"""MAIDAN — Belts Celery Tasks"""
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger("maidan.belts")


@shared_task(queue="default")
def check_promotion_eligibility():
    """Compute belt promotion eligibility for all active students for the current tenant."""
    from apps.students.models import Student
    from apps.belts.models import BeltRank, StudentBelt, PromotionEligibility
    from apps.attendance.models import AttendanceRecord
    # ... logic stays same, it will be called per-tenant
    active_students = Student.objects.filter(status="active").prefetch_related(
        "belt_history__belt_rank"
    )

    updated = 0
    for student in active_students:
        current_belt = student.belt_history.filter(is_current=True).first()
        if not current_belt:
            continue

        # Find the next belt in sequence
        next_belt = BeltRank.objects.filter(
            martial_art=current_belt.belt_rank.martial_art,
            order_index__gt=current_belt.belt_rank.order_index,
            is_active=True,
        ).order_by("order_index").first()

        if not next_belt:
            continue

        # Count sessions since last promotion
        sessions_since = AttendanceRecord.objects.filter(
            student=student,
            checked_in_at__gte=current_belt.promoted_at,
        ).count()

        # Months since last promotion
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

        # Send alert if newly eligible and not yet alerted
        if is_eligible and not eligibility.alert_sent:
            send_promotion_alert.delay(student.id)
            PromotionEligibility.objects.filter(student=student).update(alert_sent=True)

        updated += 1

    logger.info(f"Checked promotion eligibility for {updated} students")
    return {"updated": updated}


@shared_task(queue="default")
def check_all_promotion_eligibility():
    """Periodic task to check promotion eligibility for all tenants."""
    from shared.celery import run_task_for_all_tenants
    return run_task_for_all_tenants(check_promotion_eligibility)


@shared_task(queue="messaging")
def send_promotion_alert(student_id: int):
    """Notify staff that a student is eligible for promotion."""
    from apps.students.models import Student
    from apps.messaging.models import get_whatsapp_provider
    try:
        student = Student.objects.get(id=student_id)
        logger.info(f"Promotion alert: {student.full_name} is eligible for belt promotion")
        # TODO: Send to instructor/manager via WhatsApp/notification
    except Student.DoesNotExist:
        pass
