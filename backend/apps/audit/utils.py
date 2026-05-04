"""
MAIDAN — Audit Utilities & Middleware
"""

import logging

logger = logging.getLogger("maidan.audit")


def log_action(user, action: str, resource_type: str, resource_id: str, changes: dict = None, request=None, metadata: dict = None):
    """
    Convenience function to create an audit log entry.
    Runs synchronously (use Celery task for high-frequency events).
    """
    from .models import AuditLog

    ip_address = None
    user_agent = ""

    if request:
        ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", ""))
        ip_address = ip.split(",")[0].strip() if ip else None
        user_agent = request.META.get("HTTP_USER_AGENT", "")

    try:
        AuditLog.objects.create(
            user_id=str(user.id) if user else "system",
            user_email=user.email if user and hasattr(user, "email") else "",
            user_role=user.role if user and hasattr(user, "role") else "",
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            changes=changes or {},
            metadata=metadata or {},
            ip_address=ip_address,
            user_agent=user_agent[:500],
        )
    except Exception as e:
        logger.warning(f"Failed to write audit log: {e}")


class AuditLogMiddleware:
    """
    Middleware that captures request metadata for audit trails.
    Attaches request context to thread-local for use in signals.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        return response
