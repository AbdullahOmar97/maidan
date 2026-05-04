"""MAIDAN — Billings Celery Tasks"""
import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger("maidan.billing")


@shared_task(queue="billing", bind=True, max_retries=3)
def check_overdue_invoices(self):
    """Mark past-due pending invoices as overdue and send notifications for the current tenant."""
    from apps.billing.models import Invoice
    today = timezone.now().date()

    overdue = Invoice.objects.filter(
        status="pending",
        due_date__lt=today,
    )
    count = overdue.update(status="overdue")
    logger.info(f"Marked {count} invoices as overdue")

    for invoice in Invoice.objects.filter(status="overdue").select_related("student"):
        send_overdue_notification.delay(invoice.id)

    return {"overdue_count": count}


@shared_task(queue="billing")
def check_all_overdue_invoices():
    """Periodic task to check overdue invoices for all tenants."""
    from shared.celery import run_task_for_all_tenants
    return run_task_for_all_tenants(check_overdue_invoices)


@shared_task(queue="billing")
def send_overdue_notification(invoice_id: int):
    """Send overdue payment WhatsApp/email notification."""
    from apps.billing.models import Invoice
    from apps.messaging.models import get_whatsapp_provider, NotificationLog
    try:
        invoice = Invoice.objects.select_related("student").get(id=invoice_id)
        student = invoice.student

        if not student.whatsapp and not student.phone:
            return {"skipped": "no phone"}

        provider = get_whatsapp_provider()
        message = (
            f"عزيزي {student.full_name}،\n"
            f"فاتورتك رقم {invoice.invoice_number} بمبلغ {invoice.total_amount} {invoice.currency} "
            f"متأخرة. الرجاء السداد في أقرب وقت.\n"
            f"شكراً — فريق MAIDAN"
        )

        phone = student.whatsapp or student.phone
        result = provider.send_message(phone, message)

        NotificationLog.objects.create(
            student=student,
            recipient_phone=phone,
            channel="whatsapp",
            content=message,
            status="sent" if result.get("status") == "sent" else "failed",
            provider_response=result,
        )

        return {"sent": True, "phone": phone}
    except Exception as e:
        logger.exception(f"Failed to send overdue notification for invoice {invoice_id}: {e}")
        return {"error": str(e)}


@shared_task(queue="billing")
def send_renewal_reminders():
    """Send renewal reminders to members expiring in 7 days for the current tenant."""
    from apps.billing.models import Membership
    from apps.messaging.models import get_whatsapp_provider, NotificationLog

    today = timezone.now().date()
    expiry_date = today + timedelta(days=7)

    expiring = Membership.objects.filter(
        status="active",
        end_date=expiry_date,
    ).select_related("student", "plan")

    provider = get_whatsapp_provider()
    sent = 0

    for membership in expiring:
        student = membership.student
        phone = student.whatsapp or student.phone
        if not phone:
            continue

        message = (
            f"مرحباً {student.full_name}،\n"
            f"اشتراكك في {membership.plan.name} سينتهي بتاريخ {membership.end_date}.\n"
            f"لتجديد الاشتراك، تواصل معنا أو قم بالدفع عبر التطبيق.\n"
            f"شكراً — فريق MAIDAN"
        )

        result = provider.send_message(phone, message)
        NotificationLog.objects.create(
            student=student,
            recipient_phone=phone,
            channel="whatsapp",
            content=message,
            status="sent" if result.get("status") == "sent" else "failed",
            provider_response=result,
        )
        sent += 1

    return {"reminders_sent": sent}


@shared_task(queue="billing")
def send_all_renewal_reminders():
    """Periodic task to send renewal reminders for all tenants."""
    from shared.celery import run_task_for_all_tenants
    return run_task_for_all_tenants(send_renewal_reminders)
