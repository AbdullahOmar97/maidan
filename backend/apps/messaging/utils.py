from apps.messaging.models import NotificationLog

def create_in_app_notification(content: str, subject: str = "", student=None) -> NotificationLog:
    """
    Create an internal in-app notification for the sports club managers/staff.
    """
    return NotificationLog.objects.create(
        channel=NotificationLog.Channel.IN_APP,
        status=NotificationLog.Status.SENT,
        content=content,
        subject=subject,
        student=student
    )
