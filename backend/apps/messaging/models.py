"""
MAIDAN — Messaging App Models + WhatsApp Provider Abstraction
"""

import logging
from abc import ABC, abstractmethod
from typing import Optional

from django.db import models
from django.conf import settings

from apps.students.models import Student

logger = logging.getLogger("maidan.messaging")


# ---------------------------------------------------------------------------
# WhatsApp Provider Abstraction
# ---------------------------------------------------------------------------

class WhatsAppProvider(ABC):
    """Abstract base for WhatsApp message providers."""

    @abstractmethod
    def send_message(self, to_phone: str, message: str, template_name: Optional[str] = None) -> dict:
        """Send a WhatsApp message."""
        ...

    @abstractmethod
    def send_template(self, to_phone: str, template_name: str, parameters: list) -> dict:
        """Send a template message (required for outbound business messages)."""
        ...


class StubWhatsAppProvider(WhatsAppProvider):
    """Development stub — logs messages, no actual API calls."""

    def send_message(self, to_phone: str, message: str, template_name: Optional[str] = None) -> dict:
        logger.info(f"[WhatsApp STUB] To: {to_phone} | Message: {message[:100]}...")
        return {"status": "sent", "provider": "stub", "to": to_phone}

    def send_template(self, to_phone: str, template_name: str, parameters: list) -> dict:
        logger.info(f"[WhatsApp STUB] To: {to_phone} | Template: {template_name} | Params: {parameters}")
        return {"status": "sent", "provider": "stub", "template": template_name}


class TwilioWhatsAppProvider(WhatsAppProvider):
    """Twilio WhatsApp provider."""

    def __init__(self):
        from twilio.rest import Client
        self.client = Client(
            settings.TWILIO_ACCOUNT_SID,
            settings.TWILIO_AUTH_TOKEN,
        )
        self.from_number = f"whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}"

    def send_message(self, to_phone: str, message: str, template_name: Optional[str] = None) -> dict:
        try:
            msg = self.client.messages.create(
                body=message,
                from_=self.from_number,
                to=f"whatsapp:{to_phone}",
            )
            return {"status": "sent", "sid": msg.sid, "provider": "twilio"}
        except Exception as e:
            logger.exception(f"Twilio send_message error: {e}")
            return {"status": "failed", "error": str(e)}

    def send_template(self, to_phone: str, template_name: str, parameters: list) -> dict:
        # Twilio uses content templates
        body = template_name.format(*parameters)
        return self.send_message(to_phone, body)


def get_whatsapp_provider() -> WhatsAppProvider:
    """Factory — returns configured WhatsApp provider."""
    provider_name = settings.WHATSAPP_PROVIDER.lower()
    if provider_name == "twilio":
        return TwilioWhatsAppProvider()
    # Default to stub
    return StubWhatsAppProvider()


# ---------------------------------------------------------------------------
# Message Models
# ---------------------------------------------------------------------------

class MessageTemplate(models.Model):
    """Pre-defined message templates with variable substitution."""

    class TemplateType(models.TextChoices):
        RENEWAL_REMINDER = "renewal_reminder", "Renewal Reminder"
        OVERDUE_NOTICE = "overdue_notice", "Overdue Payment Notice"
        WELCOME = "welcome", "Welcome Message"
        PROMOTION_ALERT = "promotion_alert", "Belt Promotion Alert"
        TRIAL_FOLLOWUP = "trial_followup", "Trial Follow-up"
        BROADCAST = "broadcast", "Broadcast Announcement"
        CLASS_REMINDER = "class_reminder", "Class Reminder"
        BIRTHDAY = "birthday", "Birthday Message"

    name = models.CharField(max_length=200)
    template_type = models.CharField(max_length=30, choices=TemplateType.choices)
    language = models.CharField(max_length=5, default="ar")
    subject = models.CharField(max_length=200, blank=True)
    body_template = models.TextField(
        help_text="Use {student_name}, {amount}, {due_date}, {location_name} etc."
    )
    whatsapp_template_name = models.CharField(max_length=200, blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [["template_type", "language"]]

    def __str__(self):
        return f"{self.name} ({self.language})"

    def render(self, context: dict) -> str:
        """Render template with context variables."""
        return self.body_template.format(**context)


class NotificationLog(models.Model):
    """Log of all sent notifications."""

    class Channel(models.TextChoices):
        WHATSAPP = "whatsapp", "WhatsApp"
        EMAIL = "email", "Email"
        SMS = "sms", "SMS"
        PUSH = "push", "Push Notification"
        IN_APP = "in_app", "In-App"

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        SENT = "sent", "Sent"
        DELIVERED = "delivered", "Delivered"
        FAILED = "failed", "Failed"
        READ = "read", "Read"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="notifications", null=True, blank=True)
    recipient_phone = models.CharField(max_length=30, blank=True)
    recipient_email = models.EmailField(blank=True)

    channel = models.CharField(max_length=20, choices=Channel.choices)
    template = models.ForeignKey(MessageTemplate, on_delete=models.SET_NULL, null=True, blank=True)
    subject = models.CharField(max_length=200, blank=True)
    content = models.TextField()

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    provider_response = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)

    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    triggered_by_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["student", "channel"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"[{self.channel}] {self.status} → {self.recipient_phone or self.recipient_email}"


class BroadcastCampaign(models.Model):
    """Bulk messaging campaigns with audience segmentation."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SCHEDULED = "scheduled", "Scheduled"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    name = models.CharField(max_length=200)
    template = models.ForeignKey(MessageTemplate, on_delete=models.PROTECT)
    channel = models.CharField(max_length=20, choices=NotificationLog.Channel.choices)

    # Audience segmentation
    audience_filter = models.JSONField(
        default=dict,
        help_text='JSON filter: {"status": "active", "location_id": 1, "belt_rank": "white"}',
    )
    estimated_recipients = models.PositiveIntegerField(default=0)
    actual_recipients = models.PositiveIntegerField(default=0)
    sent_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    created_by_id = models.BigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Campaign: {self.name} ({self.status})"
