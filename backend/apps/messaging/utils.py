from apps.messaging.models import NotificationLog


def create_in_app_notification(
    content: str,
    subject: str = "",
    student=None,
    topic: str = "general",
) -> NotificationLog:
    """
    Create an internal in-app notification for the sports club managers/staff.
    `topic` categorizes the notification ("billing", "attendance", "promotions", "security", "general")
    so user `notification_preferences.in_app` filters can be applied.
    """
    recipient_phone = ""
    recipient_email = ""
    if student:
        recipient_phone = getattr(student, "phone", "") or ""
        recipient_email = getattr(student, "email", "") or ""

    return NotificationLog.objects.create(
        channel=NotificationLog.Channel.IN_APP,
        status=NotificationLog.Status.SENT,
        content=content,
        subject=subject,
        student=student,
        recipient_phone=recipient_phone,
        recipient_email=recipient_email,
        provider_response={"topic": topic},
    )
