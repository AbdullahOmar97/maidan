"""
MAIDAN — Accounts Celery Tasks

Thin wrappers around the email service layer (emails.py).
All rendering/dispatch logic lives in emails.py; retries are handled here.
"""

import logging

from celery import shared_task

from .emails import (
    send_password_reset,
    send_staff_invitation,
    send_tenant_welcome,
)

logger = logging.getLogger("maidan.accounts")

_RETRY_KWARGS = dict(max_retries=3, default_retry_delay=60)


@shared_task(queue="default", **_RETRY_KWARGS)
def send_password_reset_email(user_email: str, user_name: str, token: str, base_url: str) -> None:
    """Queue a password-reset email."""
    try:
        send_password_reset(
            user_email=user_email,
            user_name=user_name,
            token=token,
            base_url=base_url,
        )
    except Exception as exc:
        logger.error("Failed to send password-reset email to %s: %s", user_email, exc)
        raise send_password_reset_email.retry(exc=exc)


@shared_task(queue="default", **_RETRY_KWARGS)
def send_staff_invitation_task(user_email: str, user_name: str, setup_url: str) -> None:
    """Queue a staff invitation / account-activation email."""
    try:
        send_staff_invitation(
            user_email=user_email,
            user_name=user_name,
            setup_url=setup_url,
        )
    except Exception as exc:
        logger.error("Failed to send staff invitation email to %s: %s", user_email, exc)
        raise send_staff_invitation_task.retry(exc=exc)


@shared_task(queue="default", **_RETRY_KWARGS)
def send_tenant_welcome_task(
    user_email: str,
    user_name: str,
    tenant_name: str,
    login_url: str,
) -> None:
    """Queue a tenant-welcome email to the new academy owner."""
    try:
        send_tenant_welcome(
            user_email=user_email,
            user_name=user_name,
            tenant_name=tenant_name,
            login_url=login_url,
        )
    except Exception as exc:
        logger.error("Failed to send tenant welcome email to %s: %s", user_email, exc)
        raise send_tenant_welcome_task.retry(exc=exc)
