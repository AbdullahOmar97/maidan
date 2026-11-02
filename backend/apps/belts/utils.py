"""
MAIDAN — Belt Promotion Certificate Utilities

Cryptographic signing, serial number generation, and certificate issuance logic.
Adheres to W3C Verifiable Credentials and Open Badges digital trust principles.
"""

import hashlib
import hmac
import random
import string
from django.conf import settings
from django.db import connection, transaction
from .models import PromotionCertificate, StudentBelt, ExamCandidate, Belt


def generate_certificate_serial(issue_year: int, sport: str = "BJJ") -> str:
    """Generates a human-readable, unique certificate serial number."""
    clean_sport = "".join(ch for ch in sport if ch.isalnum()).upper()[:4] or "RANK"
    random_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"CERT-{issue_year}-{clean_sport}-{random_code}"


def calculate_certificate_fingerprint(
    cert_number: str,
    student_id: int,
    belt_id: int,
    exam_id: int | None,
    issue_date_str: str,
    tenant_identifier: str = "",
) -> str:
    """
    Computes a tamper-evident SHA-256 HMAC digital fingerprint for the certificate.
    Any alteration of student, belt, date, or serial number will invalidate this hash.
    """
    secret = getattr(settings, "SECRET_KEY", "maidan-default-signing-key").encode("utf-8")
    payload = f"{cert_number}:{student_id}:{belt_id}:{exam_id or 'none'}:{issue_date_str}:{tenant_identifier}"
    return hmac.new(secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_certificate_fingerprint(cert: PromotionCertificate) -> bool:
    """Verifies that the certificate's stored fingerprint matches the recomputed HMAC."""
    tenant = getattr(connection, "tenant", None)
    tenant_identifier = getattr(tenant, "schema_name", "public")
    expected = calculate_certificate_fingerprint(
        cert_number=cert.certificate_number,
        student_id=cert.student_id,
        belt_id=cert.belt_rank_id,
        exam_id=cert.exam_id,
        issue_date_str=cert.issue_date.isoformat(),
        tenant_identifier=tenant_identifier,
    )
    return hmac.compare_digest(cert.digital_fingerprint, expected)


def issue_or_get_candidate_certificate(
    candidate: ExamCandidate,
    signed_by_name: str = "",
    signed_by_title: str = "المدرب المعتمد / Authorized Examiner",
) -> PromotionCertificate:
    """
    Idempotently issues or retrieves an electronic promotion certificate for an exam candidate.
    """
    if hasattr(candidate, "certificate") and candidate.certificate:
        return candidate.certificate

    tenant = getattr(connection, "tenant", None)
    tenant_identifier = getattr(tenant, "schema_name", "public")
    belt = candidate.double_promotion_belt or candidate.target_belt
    student = candidate.student
    exam = candidate.exam
    issue_date = exam.date

    # Find matching StudentBelt if created during candidate promotion
    student_belt = StudentBelt.objects.filter(
        student=student, belt_rank=belt, promoted_at=exam.date
    ).first()

    with transaction.atomic():
        # Generate unique certificate serial
        cert_number = generate_certificate_serial(issue_date.year, belt.martial_art)
        while PromotionCertificate.objects.filter(certificate_number=cert_number).exists():
            cert_number = generate_certificate_serial(issue_date.year, belt.martial_art)

        fingerprint = calculate_certificate_fingerprint(
            cert_number=cert_number,
            student_id=student.id,
            belt_id=belt.id,
            exam_id=exam.id,
            issue_date_str=issue_date.isoformat(),
            tenant_identifier=tenant_identifier,
        )

        metadata = {
            "tenant_name": getattr(tenant, "name", "MAIDAN"),
            "tenant_business_name": getattr(tenant, "business_name", ""),
            "student_name": student.full_name,
            "student_number": student.student_number,
            "belt_name": belt.name,
            "belt_name_ar": belt.name_ar,
            "belt_color": belt.color_hex,
            "martial_art": belt.martial_art,
            "exam_name": exam.name,
            "exam_date": exam.date.isoformat(),
            "technical_grade": candidate.technical_grade,
        }

        cert = PromotionCertificate.objects.create(
            certificate_number=cert_number,
            student=student,
            belt_rank=belt,
            exam=exam,
            exam_candidate=candidate,
            student_belt=student_belt,
            issue_date=issue_date,
            status=PromotionCertificate.Status.ACTIVE,
            technical_grade=candidate.technical_grade or "Pass",
            signed_by_name=signed_by_name or getattr(tenant, "name", "Head Coach"),
            signed_by_title=signed_by_title,
            digital_fingerprint=fingerprint,
            metadata=metadata,
        )

        if student_belt and not student_belt.certificate_url:
            student_belt.certificate_url = f"/verify/certificate/{cert.uuid}"
            student_belt.save(update_fields=["certificate_url"])

        return cert


def issue_or_get_promotion_certificate(
    student_belt: StudentBelt,
    signed_by_name: str = "",
    signed_by_title: str = "المدرب المعتمد / Authorized Examiner",
) -> PromotionCertificate:
    """
    Idempotently issues or retrieves an electronic promotion certificate for a direct StudentBelt promotion.
    """
    if hasattr(student_belt, "certificate") and student_belt.certificate:
        return student_belt.certificate

    tenant = getattr(connection, "tenant", None)
    tenant_identifier = getattr(tenant, "schema_name", "public")
    belt = student_belt.belt_rank
    student = student_belt.student
    issue_date = student_belt.promoted_at

    with transaction.atomic():
        cert_number = generate_certificate_serial(issue_date.year, belt.martial_art)
        while PromotionCertificate.objects.filter(certificate_number=cert_number).exists():
            cert_number = generate_certificate_serial(issue_date.year, belt.martial_art)

        fingerprint = calculate_certificate_fingerprint(
            cert_number=cert_number,
            student_id=student.id,
            belt_id=belt.id,
            exam_id=None,
            issue_date_str=issue_date.isoformat(),
            tenant_identifier=tenant_identifier,
        )

        metadata = {
            "tenant_name": getattr(tenant, "name", "MAIDAN"),
            "tenant_business_name": getattr(tenant, "business_name", ""),
            "student_name": student.full_name,
            "student_number": student.student_number,
            "belt_name": belt.name,
            "belt_name_ar": belt.name_ar,
            "belt_color": belt.color_hex,
            "martial_art": belt.martial_art,
            "exam_name": "ترقية مباشرة / Direct Promotion",
            "exam_date": issue_date.isoformat(),
            "technical_grade": "Pass",
        }

        cert = PromotionCertificate.objects.create(
            certificate_number=cert_number,
            student=student,
            belt_rank=belt,
            exam=None,
            exam_candidate=None,
            student_belt=student_belt,
            issue_date=issue_date,
            status=PromotionCertificate.Status.ACTIVE,
            technical_grade="Pass",
            signed_by_name=signed_by_name or getattr(tenant, "name", "Head Coach"),
            signed_by_title=signed_by_title,
            digital_fingerprint=fingerprint,
            metadata=metadata,
        )

        if not student_belt.certificate_url:
            student_belt.certificate_url = f"/verify/certificate/{cert.uuid}"
            student_belt.save(update_fields=["certificate_url"])

        return cert
