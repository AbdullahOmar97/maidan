"""
MAIDAN — Audit Log Models + Middleware
"""

from django.db import models


class AuditLog(models.Model):
    """
    Immutable audit trail of all significant actions in the system.
    """

    class Action(models.TextChoices):
        CREATE = "create", "Create"
        UPDATE = "update", "Update"
        DELETE = "delete", "Delete"
        VIEW = "view", "View"
        LOGIN = "login", "Login"
        LOGOUT = "logout", "Logout"
        EXPORT = "export", "Export"
        PAYMENT = "payment", "Payment"
        CHECKIN = "checkin", "Check-in"
        PROMOTION = "promotion", "Belt Promotion"
        SEND_MESSAGE = "send_message", "Send Message"
        PASSWORD_CHANGE = "password_change", "Password Change"

    user_id = models.CharField(max_length=50, db_index=True)  # UUID string
    user_email = models.EmailField(blank=True)
    user_role = models.CharField(max_length=30, blank=True)

    action = models.CharField(max_length=30, choices=Action.choices)
    resource_type = models.CharField(max_length=100)  # e.g., "student", "invoice"
    resource_id = models.CharField(max_length=100, blank=True)

    changes = models.JSONField(default=dict, blank=True)  # before/after for updates
    metadata = models.JSONField(default=dict, blank=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user_id"]),
            models.Index(fields=["resource_type", "resource_id"]),
            models.Index(fields=["action"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"[{self.action}] {self.user_email} on {self.resource_type}/{self.resource_id}"
