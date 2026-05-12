"""MAIDAN — Accounts Celery Tasks"""
import logging
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger("maidan.accounts")

@shared_task(queue="default")
def send_password_reset_email(user_email, user_name, token, base_url):
    """
    Send a password reset email to the user.
    """
    subject = "إعادة تعيين كلمة المرور - MAIDAN"
    reset_url = f"{base_url}/reset-password?token={token}"
    
    context = {
        "user_name": user_name,
        "reset_url": reset_url,
        "platform_name": getattr(settings, "PLATFORM_NAME", "MAIDAN"),
    }
    
    html_message = render_to_string("accounts/password_reset_email.html", context)
    plain_message = strip_tags(html_message)
    
    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user_email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Password reset email sent to {user_email}")
    except Exception as e:
        logger.error(f"Failed to send password reset email to {user_email}: {e}")
        raise e
