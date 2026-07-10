"""MAIDAN — Billings Celery Tasks"""
import logging
from datetime import timedelta

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone
from django_tenants.utils import schema_context

from shared.celery import active_tenant_schema_names, chunked

logger = logging.getLogger("maidan.billing")

OVERDUE_NOTIFY_COOLDOWN_SEC = 7 * 24 * 3600
RENEWAL_REMINDER_BATCH_SIZE = 25


@shared_task(queue="billing", max_retries=3)
def check_overdue_invoices(schema_name: str):
    """Mark past-due pending invoices overdue for one tenant; notify only those newly transitioned."""
    from apps.billing.models import Invoice

    with schema_context(schema_name):
        today = timezone.now().date()
        qs = Invoice.objects.filter(status="pending", due_date__lt=today)
        invoice_ids = list(qs.values_list("pk", flat=True))
        count = qs.update(status="overdue")
        logger.info(f"[{schema_name}] Marked {count} invoices as overdue")

        for invoice_id in invoice_ids:
            send_overdue_notification.delay(schema_name, invoice_id)

    return {"schema": schema_name, "overdue_count": count}


@shared_task(queue="billing")
def check_all_overdue_invoices():
    """Periodic task: enqueue overdue scan per tenant (parallel workers)."""
    dispatched = 0
    for schema_name in active_tenant_schema_names():
        check_overdue_invoices.delay(schema_name)
        dispatched += 1
    return {"dispatched": dispatched}


@shared_task(queue="billing")
def send_overdue_notification(schema_name: str, invoice_id: int):
    """Send overdue WhatsApp once per invoice per cooldown window (deduped)."""
    from apps.billing.models import Invoice
    from apps.messaging.models import get_whatsapp_provider, NotificationLog

    dedupe_key = f"overdue_ntf:{schema_name}:{invoice_id}"

    try:
        with schema_context(schema_name):
            if cache.get(dedupe_key):
                return {"skipped": "recently_notified"}

            try:
                invoice = Invoice.objects.select_related("student").get(id=invoice_id)
            except Invoice.DoesNotExist:
                return {"skipped": "missing"}

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

            cache.set(dedupe_key, 1, OVERDUE_NOTIFY_COOLDOWN_SEC)
            return {"sent": True, "phone": phone}
    except Exception as e:
        logger.exception(f"Failed overdue notification invoice {invoice_id} @{schema_name}: {e}")
        return {"error": str(e)}


@shared_task(queue="billing")
def send_renewal_reminder_batch(schema_name: str, membership_ids: list):
    """Send renewal reminders for a batch of membership IDs within one tenant."""
    from apps.billing.models import Membership
    from apps.messaging.models import get_whatsapp_provider, NotificationLog

    sent = 0
    with schema_context(schema_name):
        provider = get_whatsapp_provider()
        memberships = Membership.objects.filter(id__in=membership_ids).select_related("student", "plan")

        for membership in memberships:
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

    return {"schema": schema_name, "reminders_sent": sent}


@shared_task(queue="billing")
def send_renewal_reminders(schema_name: str):
    """Enqueue batched renewal reminders for memberships expiring in 7 days."""
    from apps.billing.models import Membership

    today = timezone.now().date()
    expiry_date = today + timedelta(days=7)
    batches = 0
    mids = []

    with schema_context(schema_name):
        for mid in (
            Membership.objects.filter(status="active", end_date=expiry_date)
            .select_related("student")
            .values_list("id", "student__whatsapp", "student__phone")
        ):
            _pk, wa, ph = mid
            if wa or ph:
                mids.append(_pk)

        for batch in chunked(mids, RENEWAL_REMINDER_BATCH_SIZE):
            send_renewal_reminder_batch.delay(schema_name, batch)
            batches += 1

    logger.info(f"[{schema_name}] Queued {batches} renewal reminder batches ({len(mids)} memberships)")
    return {"schema": schema_name, "batches": batches, "memberships": len(mids)}


@shared_task(queue="billing")
def send_all_renewal_reminders():
    """Periodic task: enqueue renewal reminders per tenant."""
    dispatched = 0
    for schema_name in active_tenant_schema_names():
        send_renewal_reminders.delay(schema_name)
        dispatched += 1
    return {"dispatched": dispatched}


@shared_task(queue="billing")
def process_dunning_suspensions(schema_name: str):
    """Suspend students with invoices overdue by > 7 days, and notify them."""
    from apps.billing.models import Invoice
    from apps.students.models import Student
    from apps.messaging.models import get_whatsapp_provider, NotificationLog
    from django.utils import timezone
    from datetime import timedelta

    with schema_context(schema_name):
        seven_days_ago = timezone.now().date() - timedelta(days=7)
        # Find unpaid overdue invoices older than 7 days, whose student is active
        overdue_invoices = Invoice.objects.filter(
            status="overdue",
            due_date__lte=seven_days_ago,
            student__status="active"
        ).select_related("student")

        suspended_count = 0
        provider = get_whatsapp_provider()

        for invoice in overdue_invoices:
            student = invoice.student
            student.status = Student.Status.SUSPENDED
            student.notes = ((student.notes or "") + f"\n[SYSTEM] تم تعليق الحساب تلقائياً لتأخر السداد للفاتورة #{invoice.invoice_number}.").strip()
            student.save(update_fields=["status", "notes"])
            suspended_count += 1

            # Dispatch internal in-app notification
            from apps.messaging.utils import create_in_app_notification
            create_in_app_notification(
                subject="تعليق حساب تلقائي",
                content=f"تم تعليق حساب الطالب {student.full_name} تلقائياً لتأخر سداد الفاتورة #{invoice.invoice_number} المستحقة منذ {invoice.due_date}.",
                student=student
            )

            # Send WhatsApp notification
            message = (
                f"عزيزي {student.full_name}،\n"
                f"نود إعلامك بأنه تم تعليق اشتراكك مؤقتاً لتأخر سداد الفاتورة رقم {invoice.invoice_number} المستحقة منذ {invoice.due_date}.\n"
                f"الرجاء سداد المبلغ المتبقي ({invoice.total_amount} {invoice.currency}) لتنشيط حسابك.\n"
                f"شكراً — فريق MAIDAN"
            )
            phone = student.whatsapp or student.phone
            if phone:
                try:
                    result = provider.send_message(phone, message)
                    NotificationLog.objects.create(
                        student=student,
                        recipient_phone=phone,
                        channel="whatsapp",
                        content=message,
                        status="sent" if result.get("status") == "sent" else "failed",
                        provider_response=result,
                    )
                except Exception as e:
                    logger.error(f"Failed to send dunning suspension alert to student {student.id} @{schema_name}: {e}")

        logger.info(f"[{schema_name}] Suspended {suspended_count} students due to unpaid overdue invoices (>7 days)")
        return {"schema": schema_name, "suspended_count": suspended_count}


@shared_task(queue="billing")
def process_all_dunning_suspensions():
    """Periodic task: enqueue dunning suspension checks per tenant."""
    dispatched = 0
    for schema_name in active_tenant_schema_names():
        process_dunning_suspensions.delay(schema_name)
        dispatched += 1
    return {"dispatched": dispatched}
