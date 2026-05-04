"""
MAIDAN — Attendance App Models

One-tap check-in, kiosk mode, session tracking.
"""

from django.db import models
from apps.students.models import Student, Location


class ClassType(models.Model):
    """Type of martial arts class (e.g., BJJ Fundamentals, Kids Karate)."""

    name = models.CharField(max_length=200)
    name_ar = models.CharField(max_length=200, blank=True)
    martial_art = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    default_duration_minutes = models.PositiveIntegerField(default=60)
    color = models.CharField(max_length=7, default="#6366f1")
    min_belt_rank = models.ForeignKey(
        "belts.BeltRank", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="minimum_class_types",
    )
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ClassSchedule(models.Model):
    """Recurring class schedule (e.g., BJJ every Mon/Wed at 7pm)."""

    class DayOfWeek(models.IntegerChoices):
        MONDAY = 0, "Monday"
        TUESDAY = 1, "Tuesday"
        WEDNESDAY = 2, "Wednesday"
        THURSDAY = 3, "Thursday"
        FRIDAY = 4, "Friday"
        SATURDAY = 5, "Saturday"
        SUNDAY = 6, "Sunday"

    class_type = models.ForeignKey(ClassType, on_delete=models.CASCADE, related_name="schedules")
    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name="class_schedules")
    instructor_id = models.UUIDField(null=True, blank=True)
    day_of_week = models.IntegerField(choices=DayOfWeek.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    capacity = models.PositiveIntegerField(default=20)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["day_of_week", "start_time"]
        indexes = [
            models.Index(fields=["location", "day_of_week"]),
        ]

    def __str__(self):
        return f"{self.class_type.name} — {self.get_day_of_week_display()} {self.start_time}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        
        if self.is_active:
            from django.utils import timezone
            from zoneinfo import ZoneInfo
            
            # Determine "today" based on location timezone
            now = timezone.now()
            tz_name = "UTC"
            if self.location and self.location.timezone:
                tz_name = self.location.timezone
                
            try:
                tz = ZoneInfo(tz_name)
            except Exception:
                tz = ZoneInfo("UTC")
                
            local_today = now.astimezone(tz).date()
            
            # If local today's weekday matches this schedule's day_of_week, create session
            # Python weekday(): Monday=0, Sunday=6 (Matches ClassSchedule.DayOfWeek)
            if local_today.weekday() == self.day_of_week:
                ClassSession.objects.get_or_create(
                    schedule=self,
                    date=local_today,
                    defaults={"status": "scheduled"}
                )


class ClassSession(models.Model):
    """Individual occurrence of a scheduled class."""

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    schedule = models.ForeignKey(ClassSchedule, on_delete=models.CASCADE, related_name="sessions")
    date = models.DateField()
    instructor_id = models.UUIDField(null=True, blank=True)
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    cancellation_reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    attendance_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [["schedule", "date"]]
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["date", "status"]),
            models.Index(fields=["schedule", "date"]),
        ]

    def __str__(self):
        return f"{self.schedule} on {self.date}"


class AttendanceRecord(models.Model):
    """Individual student check-in record for a class session."""

    class CheckInMethod(models.TextChoices):
        KIOSK = "kiosk", "Kiosk"
        MANUAL = "manual", "Manual (Staff)"
        APP = "app", "Mobile App"
        QR = "qr", "QR Code"

    session = models.ForeignKey(ClassSession, on_delete=models.CASCADE, related_name="attendance_records")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="attendance_records")
    checked_in_at = models.DateTimeField(auto_now_add=True)
    checked_in_by_id = models.UUIDField(null=True, blank=True)
    check_in_method = models.CharField(max_length=20, choices=CheckInMethod.choices, default=CheckInMethod.MANUAL)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = [["session", "student"]]
        ordering = ["-checked_in_at"]
        indexes = [
            models.Index(fields=["student", "session"]),
            models.Index(fields=["session"]),
        ]

    def __str__(self):
        return f"{self.student} @ {self.session}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update session attendance count
        self.session.attendance_count = AttendanceRecord.objects.filter(session=self.session).count()
        self.session.save(update_fields=["attendance_count"])
