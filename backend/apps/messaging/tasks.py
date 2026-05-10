"""MAIDAN — Messaging Celery Tasks"""
import logging

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone
from django_tenants.utils import schema_context

from shared.celery import active_tenant_schema_names, chunked

logger = logging.getLogger("maidan.messaging")

BROADCAST_CHUNK_SIZE = 50
BROADCAST_CACHE_TTL = 86400 * 2


def _broadcast_cache_keys(campaign_id: int):
    p = f"maidan:broadcast:{campaign_id}"
    return {
        "total": f"{p}:chunks_total",
        "done": f"{p}:chunks_done",
        "sent": f"{p}:sent",
        "failed": f"{p}:failed",
    }


def _safe_incr(key: str, delta: int) -> None:
    if not delta:
        return
    try:
        cache.incr(key, delta)
    except ValueError:
        cur = cache.get(key, 0) or 0
        try:
            cur = int(cur)
        except (TypeError, ValueError):
            cur = 0
        cache.set(key, cur + delta, BROADCAST_CACHE_TTL)


def _incr_done_and_maybe_finalize(schema_name: str, campaign_id: int) -> None:
    keys = _broadcast_cache_keys(campaign_id)
    try:
        done = cache.incr(keys["done"], 1)
    except ValueError:
        cache.set(keys["done"], 1, BROADCAST_CACHE_TTL)
        done = 1

    total_raw = cache.get(keys["total"])
    try:
        total = int(total_raw or 0)
    except (TypeError, ValueError):
        total = 0

    if total <= 0 or done < total:
        return

    lock_key = f"maidan:broadcast:{campaign_id}:finalize_lock"
    if cache.add(lock_key, 1, timeout=3600):
        _finalize_broadcast_campaign(schema_name, campaign_id)


@shared_task(queue="messaging")
def process_message_queue(schema_name: str):
    """Process queued notifications for one tenant."""
    from .models import NotificationLog, get_whatsapp_provider

    sent = 0
    with schema_context(schema_name):
        queued = NotificationLog.objects.filter(status="queued")[:50]
        provider = get_whatsapp_provider()

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

    return {"schema": schema_name, "sent": sent}


@shared_task(queue="messaging")
def process_all_message_queues():
    """Periodic task: enqueue message drain per tenant."""
    dispatched = 0
    for schema_name in active_tenant_schema_names():
        process_message_queue.delay(schema_name)
        dispatched += 1
    return {"dispatched": dispatched}


@shared_task(queue="messaging")
def send_broadcast_campaign(campaign_id: int, schema_name: str | None = None):
    """Enqueue chunked sends for a campaign within the given tenant schema."""
    if not schema_name:
        logger.warning("send_broadcast_campaign missing schema_name")
        return {"error": "schema_name required"}

    with schema_context(schema_name):
        return _orchestrate_broadcast(campaign_id, schema_name)


def _orchestrate_broadcast(campaign_id: int, schema_name: str):
    from apps.students.models import Student
    from .models import BroadcastCampaign

    try:
        campaign = BroadcastCampaign.objects.get(id=campaign_id)
    except BroadcastCampaign.DoesNotExist:
        return {"error": "campaign not found"}

    campaign.status = BroadcastCampaign.Status.RUNNING
    campaign.started_at = timezone.now()
    campaign.save(update_fields=["status", "started_at"])

    student_ids = list(
        Student.objects.filter(deleted_at__isnull=True, **campaign.audience_filter).values_list(
            "id", flat=True
        )
    )

    keys = _broadcast_cache_keys(campaign_id)
    cache.set(keys["sent"], 0, BROADCAST_CACHE_TTL)
    cache.set(keys["failed"], 0, BROADCAST_CACHE_TTL)

    chunks = list(chunked(student_ids, BROADCAST_CHUNK_SIZE))
    total_chunks = len(chunks)
    cache.set(keys["total"], total_chunks, BROADCAST_CACHE_TTL)
    cache.set(keys["done"], 0, BROADCAST_CACHE_TTL)

    if total_chunks == 0:
        campaign.status = BroadcastCampaign.Status.COMPLETED
        campaign.completed_at = timezone.now()
        campaign.sent_count = 0
        campaign.failed_count = 0
        campaign.actual_recipients = 0
        campaign.save()
        return {"chunks": 0, "recipients": 0}

    for chunk_ids in chunks:
        send_broadcast_campaign_chunk.delay(schema_name, campaign_id, chunk_ids)

    return {"chunks": total_chunks, "recipients": len(student_ids)}


@shared_task(queue="messaging")
def send_broadcast_campaign_chunk(schema_name: str, campaign_id: int, student_ids: list):
    """Send one chunk of a broadcast; finalize campaign when all chunks complete."""
    from apps.students.models import Student
    from .models import BroadcastCampaign, NotificationLog, get_whatsapp_provider

    sent = 0
    failed = 0

    with schema_context(schema_name):
        try:
            campaign = BroadcastCampaign.objects.select_related("template").get(id=campaign_id)
        except BroadcastCampaign.DoesNotExist:
            return {"error": "campaign missing"}

        if campaign.status != BroadcastCampaign.Status.RUNNING:
            return {"skipped": campaign.status}

        provider = get_whatsapp_provider()

        for sid in student_ids:
            try:
                student = Student.objects.select_related("location").get(id=sid)
            except Student.DoesNotExist:
                failed += 1
                continue

            phone = student.whatsapp or student.phone
            if not phone:
                failed += 1
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

    keys = _broadcast_cache_keys(campaign_id)
    _safe_incr(keys["sent"], sent)
    _safe_incr(keys["failed"], failed)
    _incr_done_and_maybe_finalize(schema_name, campaign_id)

    return {"sent": sent, "failed": failed}


def _finalize_broadcast_campaign(schema_name: str, campaign_id: int):
    keys = _broadcast_cache_keys(campaign_id)
    try:
        sent = int(cache.get(keys["sent"]) or 0)
        failed = int(cache.get(keys["failed"]) or 0)
    except (TypeError, ValueError):
        sent = failed = 0

    with schema_context(schema_name):
        from .models import BroadcastCampaign

        try:
            campaign = BroadcastCampaign.objects.get(id=campaign_id)
        except BroadcastCampaign.DoesNotExist:
            return

        campaign.status = BroadcastCampaign.Status.COMPLETED
        campaign.completed_at = timezone.now()
        campaign.sent_count = sent
        campaign.failed_count = failed
        campaign.actual_recipients = sent + failed
        campaign.save()
