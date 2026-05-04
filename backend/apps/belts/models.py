"""
MAIDAN — Belts App Models

Belt rank system, student promotions, milestones.
"""

from django.db import models
from apps.students.models import Student


class BeltRank(models.Model):
    """Martial arts belt/rank definition."""

    martial_art = models.CharField(max_length=100, default="General")
    name = models.CharField(max_length=100)
    name_ar = models.CharField(max_length=100, blank=True)
    color_hex = models.CharField(max_length=7, default="#FFFFFF")
    order_index = models.PositiveIntegerField(default=0)  # Rank progression order

    # Requirements for promotion
    min_attendance_sessions = models.PositiveIntegerField(default=0)
    min_months_since_last = models.PositiveIntegerField(default=0)
    min_age = models.PositiveIntegerField(null=True, blank=True)
    max_age = models.PositiveIntegerField(null=True, blank=True)

    # Exam requirements
    requires_exam = models.BooleanField(default=False)
    exam_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    description = models.TextField(blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["martial_art", "order_index"]
        unique_together = [["martial_art", "order_index"]]

    def __str__(self):
        return f"{self.martial_art} — {self.name}"


class StudentBelt(models.Model):
    """Record of a student's current and historical belt ranks."""

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="belt_history")
    belt_rank = models.ForeignKey(BeltRank, on_delete=models.PROTECT, related_name="promotions")
    promoted_at = models.DateField()
    promoted_by_id = models.UUIDField(null=True, blank=True)
    is_current = models.BooleanField(default=True)  # Only one is_current=True per student
    attendance_at_promotion = models.PositiveIntegerField(default=0)
    certificate_url = models.URLField(blank=True)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-promoted_at"]
        indexes = [
            models.Index(fields=["student", "is_current"]),
        ]

    def __str__(self):
        return f"{self.student} → {self.belt_rank} on {self.promoted_at}"

    def save(self, *args, **kwargs):
        if self.is_current:
            # Ensure only one current belt per student
            StudentBelt.objects.filter(student=self.student, is_current=True).update(is_current=False)
        super().save(*args, **kwargs)


class PromotionEligibility(models.Model):
    """Pre-computed promotion eligibility status (updated by Celery)."""

    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name="promotion_eligibility")
    next_belt = models.ForeignKey(BeltRank, on_delete=models.SET_NULL, null=True, blank=True)
    sessions_completed = models.PositiveIntegerField(default=0)
    sessions_required = models.PositiveIntegerField(default=0)
    months_since_last = models.PositiveIntegerField(default=0)
    is_eligible = models.BooleanField(default=False)
    alert_sent = models.BooleanField(default=False)
    checked_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Promotion Eligibilities"

    def __str__(self):
        return f"{self.student} — eligible: {self.is_eligible}"
