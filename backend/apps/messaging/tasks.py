"""MAIDAN — Messaging Celery Tasks"""
import logging
from celery import shared_task

logger = logging.getLogger("maidan.messaging")


@shared_task(queue="messaging")
def process_message_queue():
    """Process any queued notifications for the current tenant."""
    from .models import NotificationLog, get_whatsapp_provider
    from django.utils import timezone

    queued = NotificationLog.objects.filter(status="queued")[:50]
    provider = get_whatsapp_provider()
    sent = 0

    for log in queued:
        try:
            if log.channel == "whatsapp" and log.recipient_phone:
                result = provider.send_message(log.recipient_phone, log.content)
                log.status = "sent" if result.get("status") == "sent" else "failed"
                log.provider_response = result
                log.sent_at = timezone.now()
                log.save(update_fields=["status", "provider_response", "sent_at"])
                sent += 1
        except Exception as e:
            log.status = "failed"
            log.error_message = str(e)
            log.save(update_fields=["status", "error_message"])

    return {"sent": sent}


@shared_task(queue="messaging")
def process_all_message_queues():
    """Periodic task to process queues for all tenants."""
    from shared.celery import run_task_for_all_tenants
    return run_task_for_all_tenants(process_message_queue)


@shared_task(queue="messaging")
def send_broadcast_campaign(campaign_id: int, schema_name: str = None):
    """Send a broadcast campaign to all matching students."""
    from .models import BroadcastCampaign, NotificationLog, get_whatsapp_provider
    from apps.students.models import Student
    from django.utils import timezone
    from django_tenants.utils import schema_context

    # If schema_name is provided, wrap in schema_context
    if schema_name:
        with schema_context(schema_name):
            return _send_broadcast_campaign_logic(campaign_id)
    else:
        return _send_broadcast_campaign_logic(campaign_id)


def _send_broadcast_campaign_logic(campaign_id: int):
    from .models import BroadcastCampaign, NotificationLog, get_whatsapp_provider
    from apps.students.models import Student
    from django.utils import timezone

    try:
        campaign = BroadcastCampaign.objects.get(id=campaign_id)
        campaign.status = "running"
        campaign.started_at = timezone.now()
        campaign.save(update_fields=["status", "started_at"])

        # Apply audience filters
        students = Student.objects.filter(deleted_at__isnull=True, **campaign.audience_filter)
        provider = get_whatsapp_provider()
        sent = 0
        failed = 0

        for student in students:
            phone = student.whatsapp or student.phone
            if not phone:
                continue

            context = {
                "student_name": student.full_name,
                "location_name": student.location.name if student.location else "",
            }
            message = campaign.template.render(context)

            try:
                result = provider.send_message(phone, message)
                NotificationLog.objects.create(
                    student=student,
                    recipient_phone=phone,
                    channel=campaign.channel,
                    template=campaign.template,
                    content=message,
                    status="sent" if result.get("status") == "sent" else "failed",
                    provider_response=result,
                    sent_at=timezone.now(),
                )
                sent += 1
            except Exception:
                failed += 1

        campaign.status = "completed"
        campaign.completed_at = timezone.now()
        campaign.sent_count = sent
        campaign.failed_count = failed
        campaign.actual_recipients = sent + failed
        campaign.save()

        return {"sent": sent, "failed": failed}

    except Exception as e:
        logger.exception(f"Broadcast campaign {campaign_id} failed: {e}")
        return {"error": str(e)}
