"""
MAIDAN — Email Service Layer

All email rendering and sending logic lives here.
Celery tasks in tasks.py are thin wrappers that delegate to these functions.
"""

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger("maidan.emails")

_PLATFORM_NAME = lambda: getattr(settings, "PLATFORM_NAME", "MAIDAN")  # noqa: E731


def _dispatch(subject: str, template: str, context: dict, recipient: str) -> None:
    """
    Render an HTML template and send it via Django's mail backend.
    Raises on failure — callers (Celery tasks) handle retries.
    """
    html_body = render_to_string(template, context)
    plain_body = strip_tags(html_body)

    send_mail(
        subject=subject,
        message=plain_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient],
        html_message=html_body,
        fail_silently=False,
    )
    logger.info("Email '%s' sent to %s", subject, recipient)


# ---------------------------------------------------------------------------
# Password Reset
# ---------------------------------------------------------------------------

def send_password_reset(*, user_email: str, user_name: str, token: str, base_url: str) -> None:
    """Send a password-reset email to the user."""
    reset_url = f"{base_url}/reset-password?token={token}"
    _dispatch(
        subject=f"إعادة تعيين كلمة المرور - {_PLATFORM_NAME()}",
        template="accounts/password_reset_email.html",
        context={
            "user_name": user_name,
            "reset_url": reset_url,
            "platform_name": _PLATFORM_NAME(),
        },
        recipient=user_email,
    )


# ---------------------------------------------------------------------------
# Staff Invitation (new staff member — initial password setup)
# ---------------------------------------------------------------------------

def send_staff_invitation(*, user_email: str, user_name: str, setup_url: str) -> None:
    """
    Send a welcome / account-activation email to a newly created staff member.
    The setup_url points to /password/setup on the tenant's frontend domain.
    """
    _dispatch(
        subject=f"مرحباً بك في {_PLATFORM_NAME()} — تفعيل حسابك",
        template="accounts/staff_invitation_email.html",
        context={
            "user_name": user_name,
            "setup_url": setup_url,
            "platform_name": _PLATFORM_NAME(),
        },
        recipient=user_email,
    )


# ---------------------------------------------------------------------------
# Tenant Welcome (new academy registration)
# ---------------------------------------------------------------------------

def send_tenant_welcome(
    *,
    user_email: str,
    user_name: str,
    tenant_name: str,
    login_url: str,
) -> None:
    """
    Send a welcome email to the tenant owner after successful registration.
    The login_url points to the tenant's subdomain login page.
    """
    _dispatch(
        subject=f"مرحباً في {_PLATFORM_NAME()} — تم استلام طلب تسجيل ناديك",
        template="accounts/welcome_email.html",
        context={
            "user_name": user_name,
            "tenant_name": tenant_name,
            "login_url": login_url,
            "platform_name": _PLATFORM_NAME(),
        },
        recipient=user_email,
    )
