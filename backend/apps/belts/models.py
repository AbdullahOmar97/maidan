"""
MAIDAN — Belts App Models

Belt rank system, student promotions, milestones.
"""

from django.db import models
from apps.students.models import Student


class Belt(models.Model):
    """Martial arts belt/rank definition scoped per tenant."""

    martial_art = models.CharField(max_length=100, default="BJJ")
    name = models.CharField(max_length=100)
    name_ar = models.CharField(max_length=100, blank=True)
    color_hex = models.CharField(max_length=7, default="#FFFFFF")
    order_index = models.PositiveIntegerField(default=0)  # Rank progression order

    # Requirements for promotion
    min_attendance_sessions = models.PositiveIntegerField(default=0)
    min_months_since_last = models.PositiveIntegerField(default=0)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["martial_art", "order_index"]
        verbose_name = "Belt"
        verbose_name_plural = "Belts"

    def __str__(self):
        return f"[{self.martial_art}] {self.name} ({self.name_ar})"


class StudentBelt(models.Model):
    """Record of a student's current and historical belt ranks."""

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="belt_history")
    belt_rank = models.ForeignKey("Belt", on_delete=models.PROTECT, related_name="promotions")
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
    next_belt = models.ForeignKey("Belt", on_delete=models.SET_NULL, null=True, blank=True)
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


class BeltExam(models.Model):
    """SaaS tenant-scoped promotion exam event."""

    name = models.CharField(max_length=200)
    date = models.DateField()
    martial_art = models.CharField(max_length=100, default="BJJ")
    location = models.ForeignKey("students.Location", on_delete=models.CASCADE, related_name="belt_exams")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.name} on {self.date} ({self.martial_art})"


class ExamCandidate(models.Model):
    """Student candidate registered for a promotion exam."""

    class Result(models.TextChoices):
        PENDING = "pending", "Pending Evaluation"
        PASSED = "passed", "Passed & Promoted"
        FAILED = "failed", "Retry Recommended"

    exam = models.ForeignKey(BeltExam, on_delete=models.CASCADE, related_name="candidates")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="exam_candidacies")
    target_belt = models.ForeignKey(Belt, on_delete=models.PROTECT, related_name="exam_candidates")
    
    technical_grade = models.CharField(max_length=10, blank=True)  # e.g., "A+", "B", "95"
    instructor_notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Result.choices, default=Result.PENDING)
    
    graded_by_id = models.UUIDField(null=True, blank=True)
    graded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["student__first_name", "student__last_name"]
        unique_together = ("exam", "student")

    def __str__(self):
        return f"{self.student.first_name} {self.student.last_name} for {self.target_belt.name} in {self.exam.name}"

    def save(self, *args, **kwargs):
        from django.db import transaction
        from django.utils import timezone
        from apps.belts.models import StudentBelt

        # Check if status is transitioning to PASSED
        is_new = self.pk is None
        old_status = None
        if not is_new:
            old_status = ExamCandidate.objects.filter(pk=self.pk).values_list("status", flat=True).first()

        with transaction.atomic():
            if self.status == self.Result.PASSED:
                self.graded_at = timezone.now()
            super().save(*args, **kwargs)

            # If transitioned to PASSED, automatically promote student
            if self.status == self.Result.PASSED and (is_new or old_status != self.Result.PASSED):
                StudentBelt.objects.create(
                    student=self.student,
                    belt_rank=self.target_belt,
                    promoted_at=self.exam.date,
                    promoted_by_id=self.graded_by_id,
                    is_current=True,
                    notes=f"تمت الترقية بنجاح عبر اختبار: {self.exam.name}. {self.instructor_notes}".strip()
                )
