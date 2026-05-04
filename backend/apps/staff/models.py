from django.db import models
from django.conf import settings


class StaffMember(models.Model):
    """
    Links a global User to a specific tenant schema.
    Since the 'staff' app is in TENANT_APPS, this model lives in the tenant schema.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_memberships"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Staff Member"
        verbose_name_plural = "Staff Members"
        # Ensure a user is only listed once per tenant
        unique_together = ("user",)

    def __str__(self):
        return f"{self.user.get_full_name()} in current tenant"
