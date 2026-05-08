"""
MAIDAN — Students App Models

CRM, student profiles, leads, trials.
Tenant-scoped (lives in per-tenant schema).
"""

import uuid

from django.conf import settings
from django.db import models


class Location(models.Model):
    """Physical dojo location / branch."""

    name = models.CharField(max_length=200)
    address = models.TextField()
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=2, default="SA")
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    timezone = models.CharField(max_length=50, default="Asia/Riyadh")
    capacity = models.PositiveIntegerField(default=50)
    is_active = models.BooleanField(default=True)
    manager_id = models.UUIDField(null=True, blank=True)  # FK to User

    # Media
    photo = models.ImageField(upload_to="locations/", null=True, blank=True)
    map_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    map_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Family(models.Model):
    """Family group — links multiple students with one billing account."""

    name = models.CharField(max_length=200)
    primary_contact_name = models.CharField(max_length=200)
    primary_contact_phone = models.CharField(max_length=30)
    primary_contact_email = models.EmailField(blank=True)
    billing_address = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Families"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Student(models.Model):
    """Core student / member profile."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"
        TRIAL = "trial", "Trial"
        LEAD = "lead", "Lead / Prospect"
        SUSPENDED = "suspended", "Suspended"
        GRADUATED = "graduated", "Graduated"

    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"
        PREFER_NOT = "prefer_not", "Prefer Not to Say"

    class LeadSource(models.TextChoices):
        WALK_IN = "walk_in", "Walk-in"
        REFERRAL = "referral", "Referral"
        SOCIAL_MEDIA = "social_media", "Social Media"
        WEBSITE = "website", "Website"
        GOOGLE = "google", "Google"
        EVENT = "event", "Event / Seminar"
        PHONE = "phone", "Phone Inquiry"
        OTHER = "other", "Other"

    # Identity
    student_number = models.CharField(max_length=20, unique=True, blank=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)

    # Demographics
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, choices=Gender.choices, blank=True)
    nationality = models.CharField(max_length=2, blank=True)

    # Contact
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    whatsapp = models.CharField(max_length=30, blank=True)

    # Emergency contact
    emergency_contact_name = models.CharField(max_length=200, blank=True)
    emergency_contact_phone = models.CharField(max_length=30, blank=True)
    emergency_contact_relation = models.CharField(max_length=100, blank=True)

    # Medical
    medical_notes = models.TextField(blank=True)
    blood_type = models.CharField(max_length=5, blank=True)
    allergies = models.TextField(blank=True)

    # Photo
    photo = models.ImageField(upload_to="students/%Y/%m/", null=True, blank=True)

    # Relationships
    family = models.ForeignKey(Family, on_delete=models.SET_NULL, null=True, blank=True, related_name="members")
    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="students")
    user_account = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="student_profile",
    )

    # CRM Status
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.LEAD)
    source = models.CharField(max_length=30, choices=LeadSource.choices, blank=True)
    referred_by = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="referrals"
    )

    # Trial tracking
    trial_start_date = models.DateField(null=True, blank=True)
    trial_end_date = models.DateField(null=True, blank=True)
    trial_sessions_used = models.PositiveIntegerField(default=0)

    # Documents & consent
    waiver_signed = models.BooleanField(default=False)
    waiver_signed_at = models.DateTimeField(null=True, blank=True)
    waiver_document = models.FileField(upload_to="waivers/", null=True, blank=True)
    photo_consent = models.BooleanField(default=False)

    # Notes
    notes = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)  # Staff only

    # Assignment
    assigned_to_id = models.UUIDField(null=True, blank=True)  # Staff FK

    # Soft delete
    deleted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by_id = models.UUIDField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["location"]),
            models.Index(fields=["student_number"]),
            models.Index(fields=["email"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["first_name", "last_name", "phone", "location"],
                name="unique_student_per_branch",
                violation_error_message="هذا الطالب موجود بالفعل في هذا الفرع بنفس البيانات (الاسم ورقم الهاتف)."
            )
        ]

    def __str__(self):
        return f"{self.full_name} ({self.student_number})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def age(self):
        if self.date_of_birth:
            from django.utils import timezone
            today = timezone.now().date()
            delta = today - self.date_of_birth
            return delta.days // 365
        return None

    def save(self, *args, **kwargs):
        if not self.student_number:
            self._generate_student_number()
        super().save(*args, **kwargs)

    def _generate_student_number(self):
        import random
        self.student_number = f"STU-{random.randint(10000, 99999)}"


class StudentNote(models.Model):
    """Notes/comments added by staff to a student profile."""

    class NoteType(models.TextChoices):
        GENERAL = "general", "General"
        MEDICAL = "medical", "Medical"
        BILLING = "billing", "Billing"
        BEHAVIOR = "behavior", "Behavior"
        PROGRESS = "progress", "Progress"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="student_notes")
    author_id = models.UUIDField()  # User FK
    note_type = models.CharField(max_length=20, choices=NoteType.choices, default=NoteType.GENERAL)
    content = models.TextField()
    is_private = models.BooleanField(default=False)  # Private = staff-only

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Note on {self.student} by {self.author_id}"


class StudentDocument(models.Model):
    """Documents attached to a student (ID, medical cert, etc.)."""

    class DocumentType(models.TextChoices):
        ID = "id", "National ID"
        PASSPORT = "passport", "Passport"
        MEDICAL = "medical", "Medical Certificate"
        WAIVER = "waiver", "Liability Waiver"
        PHOTO_CONSENT = "photo_consent", "Photo Consent"
        OTHER = "other", "Other"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=30, choices=DocumentType.choices)
    name = models.CharField(max_length=200)
    file = models.FileField(upload_to="student_docs/%Y/%m/")
    uploaded_by_id = models.UUIDField()
    notes = models.TextField(blank=True)
    expires_at = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
