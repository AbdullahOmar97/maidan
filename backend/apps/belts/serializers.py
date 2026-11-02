from rest_framework import serializers
from apps.students.models import Student
from .models import (
    Belt,
    StudentBelt,
    BeltExam,
    ExamCandidate,
    BeltSyllabusRequirement,
    CandidateSyllabusGrade,
    PromotionCertificate,
)


class BeltSyllabusRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = BeltSyllabusRequirement
        fields = ["id", "belt", "name", "name_ar", "max_score"]
        read_only_fields = ["id"]


class CandidateSyllabusGradeSerializer(serializers.ModelSerializer):
    requirement_name = serializers.ReadOnlyField(source="requirement.name")
    requirement_name_ar = serializers.ReadOnlyField(source="requirement.name_ar")
    max_score = serializers.ReadOnlyField(source="requirement.max_score")

    class Meta:
        model = CandidateSyllabusGrade
        fields = [
            "id",
            "candidate",
            "requirement",
            "requirement_name",
            "requirement_name_ar",
            "max_score",
            "score",
            "notes",
        ]
        read_only_fields = ["id", "requirement_name", "requirement_name_ar", "max_score"]


class BeltExamSerializer(serializers.ModelSerializer):
    location_name = serializers.ReadOnlyField(source="location.name")
    candidates_count = serializers.SerializerMethodField()

    class Meta:
        model = BeltExam
        fields = [
            "id",
            "name",
            "date",
            "martial_art",
            "location",
            "location_name",
            "notes",
            "registration_fee",
            "auto_create_invoice",
            "candidates_count",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_candidates_count(self, obj):
        return obj.candidates.count()


class ExamCandidateSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source="student.full_name")
    student_photo = serializers.SerializerMethodField()
    current_belt_name = serializers.SerializerMethodField()
    current_belt_color = serializers.SerializerMethodField()
    target_belt_name = serializers.ReadOnlyField(source="target_belt.name")
    target_belt_color = serializers.ReadOnlyField(source="target_belt.color_hex")
    
    invoice_status = serializers.SerializerMethodField()
    invoice_amount = serializers.SerializerMethodField()
    double_promotion_belt_name = serializers.ReadOnlyField(source="double_promotion_belt.name")
    syllabus_grades = CandidateSyllabusGradeSerializer(many=True, read_only=True)
    certificate_uuid = serializers.SerializerMethodField()
    certificate_number = serializers.SerializerMethodField()

    class Meta:
        model = ExamCandidate
        fields = [
            "id",
            "exam",
            "student",
            "student_name",
            "student_photo",
            "current_belt_name",
            "current_belt_color",
            "target_belt",
            "target_belt_name",
            "target_belt_color",
            "invoice",
            "invoice_status",
            "invoice_amount",
            "double_promotion_belt",
            "double_promotion_belt_name",
            "syllabus_grades",
            "technical_grade",
            "instructor_notes",
            "status",
            "graded_by_id",
            "graded_at",
            "certificate_uuid",
            "certificate_number",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "student_name",
            "student_photo",
            "current_belt_name",
            "current_belt_color",
            "target_belt_name",
            "target_belt_color",
            "invoice",
            "invoice_status",
            "invoice_amount",
            "double_promotion_belt_name",
            "syllabus_grades",
            "graded_at",
            "certificate_uuid",
            "certificate_number",
            "created_at",
        ]

    def get_certificate_uuid(self, obj):
        cert = getattr(obj, "certificate", None)
        return str(cert.uuid) if cert else None

    def get_certificate_number(self, obj):
        cert = getattr(obj, "certificate", None)
        return cert.certificate_number if cert else None

    def get_student_photo(self, obj):
        if obj.student.photo:
            return obj.student.photo.url
        return None

    def get_current_belt_name(self, obj):
        current = obj.student.belt_history.filter(is_current=True).first()
        return current.belt_rank.name if current else "بدون حزام"

    def get_current_belt_color(self, obj):
        current = obj.student.belt_history.filter(is_current=True).first()
        return current.belt_rank.color_hex if current else "#FFFFFF"

    def get_invoice_status(self, obj):
        return obj.invoice.status if obj.invoice else None

    def get_invoice_amount(self, obj):
        return float(obj.invoice.total_amount) if obj.invoice else 0.0


class ExamCandidateBulkCreateSerializer(serializers.Serializer):
    student_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )
    target_belt_id = serializers.IntegerField()


class PromotionCertificateSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source="student.full_name")
    student_number = serializers.ReadOnlyField(source="student.student_number")
    belt_name = serializers.ReadOnlyField(source="belt_rank.name")
    belt_name_ar = serializers.ReadOnlyField(source="belt_rank.name_ar")
    belt_color = serializers.ReadOnlyField(source="belt_rank.color_hex")
    martial_art = serializers.ReadOnlyField(source="belt_rank.martial_art")
    exam_name = serializers.ReadOnlyField(source="exam.name")
    verification_url = serializers.SerializerMethodField()

    class Meta:
        model = PromotionCertificate
        fields = [
            "id",
            "uuid",
            "certificate_number",
            "student",
            "student_name",
            "student_number",
            "belt_rank",
            "belt_name",
            "belt_name_ar",
            "belt_color",
            "martial_art",
            "exam",
            "exam_name",
            "exam_candidate",
            "student_belt",
            "issue_date",
            "status",
            "revocation_reason",
            "technical_grade",
            "signed_by_name",
            "signed_by_title",
            "digital_fingerprint",
            "metadata",
            "verification_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "uuid",
            "certificate_number",
            "digital_fingerprint",
            "created_at",
            "updated_at",
        ]

    def get_verification_url(self, obj):
        return f"/verify/certificate/{obj.uuid}"


class PublicCertificateVerificationSerializer(serializers.ModelSerializer):
    """
    Sanitized public-facing serializer for QR code and link verification.
    Complies with data privacy: NO private phone numbers, IDs, or financial data.
    """
    student_name = serializers.ReadOnlyField(source="student.full_name")
    belt_name = serializers.ReadOnlyField(source="belt_rank.name")
    belt_name_ar = serializers.ReadOnlyField(source="belt_rank.name_ar")
    belt_color = serializers.ReadOnlyField(source="belt_rank.color_hex")
    martial_art = serializers.ReadOnlyField(source="belt_rank.martial_art")
    exam_name = serializers.ReadOnlyField(source="exam.name")
    tenant_info = serializers.SerializerMethodField()
    is_valid = serializers.SerializerMethodField()

    class Meta:
        model = PromotionCertificate
        fields = [
            "uuid",
            "certificate_number",
            "student_name",
            "belt_name",
            "belt_name_ar",
            "belt_color",
            "martial_art",
            "exam_name",
            "issue_date",
            "status",
            "is_valid",
            "revocation_reason",
            "technical_grade",
            "signed_by_name",
            "signed_by_title",
            "digital_fingerprint",
            "tenant_info",
            "created_at",
        ]

    def get_is_valid(self, obj):
        return obj.status == PromotionCertificate.Status.ACTIVE

    def get_tenant_info(self, obj):
        from django.db import connection
        tenant = getattr(connection, "tenant", None)
        logo_url = None
        stamp_url = None
        signature_url = None
        if tenant:
            if getattr(tenant, "logo", None):
                logo_url = tenant.logo.url
            if getattr(tenant, "stamp", None):
                stamp_url = tenant.stamp.url
            if getattr(tenant, "signature", None):
                signature_url = tenant.signature.url

        meta = obj.metadata or {}
        return {
            "name": getattr(tenant, "name", meta.get("tenant_name", "MAIDAN Club")),
            "business_name": getattr(tenant, "business_name", meta.get("tenant_business_name", "")),
            "logo_url": logo_url,
            "stamp_url": stamp_url,
            "signature_url": signature_url,
        }

