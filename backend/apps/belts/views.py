"""MAIDAN — Belts App Views"""
from rest_framework import filters, permissions, serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from shared.permissions import IsStaff, IsTenantOwnerOrManager
from apps.students.models import Student
from .models import (
    Belt,
    StudentBelt,
    PromotionEligibility,
    BeltExam,
    ExamCandidate,
    BeltSyllabusRequirement,
    CandidateSyllabusGrade,
    PromotionCertificate,
)
from .serializers import (
    BeltExamSerializer,
    ExamCandidateSerializer,
    ExamCandidateBulkCreateSerializer,
    BeltSyllabusRequirementSerializer,
    CandidateSyllabusGradeSerializer,
    PromotionCertificateSerializer,
    PublicCertificateVerificationSerializer,
)
from .utils import (
    issue_or_get_candidate_certificate,
    issue_or_get_promotion_certificate,
    verify_certificate_fingerprint,
)


class BeltRankSerializer(serializers.ModelSerializer):
    class Meta:
        model = Belt
        fields = "__all__"
        read_only_fields = ["id", "created_at"]


class StudentBeltSerializer(serializers.ModelSerializer):
    belt_name = serializers.ReadOnlyField(source="belt_rank.name")
    belt_name_ar = serializers.ReadOnlyField(source="belt_rank.name_ar")
    belt_color = serializers.ReadOnlyField(source="belt_rank.color_hex")
    martial_art = serializers.ReadOnlyField(source="belt_rank.martial_art")
    student_name = serializers.SerializerMethodField()
    certificate_uuid = serializers.SerializerMethodField()
    certificate_number = serializers.SerializerMethodField()
    create_invoice = serializers.BooleanField(write_only=True, required=False, default=False)
    fee_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, write_only=True, required=False, allow_null=True
    )
    tax_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = StudentBelt
        fields = "__all__"
        read_only_fields = [
            "id",
            "created_at",
            "invoice",
            "promoted_by_id",
            "certificate_uuid",
            "certificate_number",
        ]

    def get_student_name(self, obj):
        return obj.student.full_name

    def get_certificate_uuid(self, obj):
        cert = getattr(obj, "certificate", None)
        return str(cert.uuid) if cert else None

    def get_certificate_number(self, obj):
        cert = getattr(obj, "certificate", None)
        return cert.certificate_number if cert else None


class PromotionEligibilitySerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    next_belt_name = serializers.ReadOnlyField(source="next_belt.name")
    next_belt_color = serializers.ReadOnlyField(source="next_belt.color_hex")

    class Meta:
        model = PromotionEligibility
        fields = "__all__"

    def get_student_name(self, obj):
        return obj.student.full_name


class BeltRankViewSet(viewsets.ModelViewSet):
    queryset = Belt.objects.filter(is_active=True).order_by("martial_art", "order_index")
    serializer_class = BeltRankSerializer
    pagination_class = None
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    filter_backends = [filters.SearchFilter]
    filterset_fields = ["martial_art"]


class BeltSyllabusRequirementViewSet(viewsets.ModelViewSet):
    queryset = BeltSyllabusRequirement.objects.all()
    serializer_class = BeltSyllabusRequirementSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    filterset_fields = ["belt"]


class StudentBeltViewSet(viewsets.ModelViewSet):
    queryset = StudentBelt.objects.select_related("student", "belt_rank", "invoice").order_by("-promoted_at")
    serializer_class = StudentBeltSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    filterset_fields = ["student_id", "is_current"]

    def create(self, request, *args, **kwargs):
        import logging
        import traceback
        logger = logging.getLogger("maidan.belts")
        try:
            return super().create(request, *args, **kwargs)
        except Exception as exc:
            logger.exception("Belt promotion creation failed")
            return Response(
                {
                    "error": str(exc),
                    "error_class": exc.__class__.__name__,
                    "detail": traceback.format_exc(),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    def perform_create(self, serializer):
        from decimal import Decimal
        from django.db import transaction
        from apps.billing.models import Invoice

        validated_data = serializer.validated_data
        create_invoice = validated_data.pop("create_invoice", False)
        fee_amount = validated_data.pop("fee_amount", None)
        tax_rate = validated_data.pop("tax_rate", None)
        user_id = self.request.user.id if getattr(self.request, "user", None) and self.request.user.is_authenticated else None

        with transaction.atomic():
            instance = serializer.save(promoted_by_id=user_id)
            belt = instance.belt_rank
            student = instance.student

            # Determine invoice fee
            final_fee = fee_amount if fee_amount is not None else belt.promotion_fee

            # Determine tax rate (optional: custom rate -> belt rate -> 0.00)
            if tax_rate is not None:
                final_tax_rate = Decimal(str(tax_rate))
            elif getattr(belt, "tax_rate", None) is not None:
                final_tax_rate = Decimal(str(belt.tax_rate))
            else:
                final_tax_rate = Decimal("0.00")

            if create_invoice and final_fee and Decimal(str(final_fee)) > 0:
                fee_dec = Decimal(str(final_fee)).quantize(Decimal("0.01"))
                tax_dec = final_tax_rate.quantize(Decimal("0.01"))
                tax_amount = (fee_dec * (tax_dec / Decimal("100"))).quantize(Decimal("0.01"))
                total_amount = (fee_dec + tax_amount).quantize(Decimal("0.01"))

                invoice = Invoice.objects.create(
                    student=student,
                    subtotal=fee_dec,
                    tax_rate=tax_dec,
                    tax_amount=tax_amount,
                    total_amount=total_amount,
                    discount_amount=Decimal("0.00"),
                    amount_paid=Decimal("0.00"),
                    status=Invoice.Status.PENDING,
                    due_date=instance.promoted_at,
                    notes=f"رسوم الترقية إلى حزام: {belt.name}",
                    created_by_id=user_id,
                )
                instance.invoice = invoice
                instance.save(update_fields=["invoice"])

            # Send in-app notification to student
            try:
                from apps.messaging.utils import create_in_app_notification
                create_in_app_notification(
                    subject="ترقية حزام جديدة",
                    content=f"تهانينا! تمت ترقيتك إلى حزام {belt.name}.",
                    student=student,
                    topic="promotions",
                )
            except Exception as e:
                import logging
                logging.getLogger("maidan.belts").warning(f"Failed to create promotion notification: {e}")

            # Auto-issue electronic promotion certificate with QR & cryptographic fingerprint
            try:
                cert = issue_or_get_promotion_certificate(instance)
                instance.certificate_url = f"/verify/certificate/{cert.uuid}"
                instance.save(update_fields=["certificate_url"])
            except Exception as e:
                import logging
                logging.getLogger("maidan.belts").warning(f"Failed to auto-issue promotion certificate: {e}")

    @action(detail=True, methods=["post"], url_path="issue-certificate")
    def issue_certificate(self, request, pk=None):
        student_belt = self.get_object()
        signed_by_name = request.data.get("signed_by_name", "")
        signed_by_title = request.data.get("signed_by_title", "المدرب المعتمد / Authorized Examiner")
        cert = issue_or_get_promotion_certificate(
            student_belt=student_belt,
            signed_by_name=signed_by_name,
            signed_by_title=signed_by_title,
        )
        return Response(PromotionCertificateSerializer(cert).data, status=status.HTTP_200_OK)


class PromotionEligibilityViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PromotionEligibility.objects.filter(is_eligible=True).select_related(
        "student", "next_belt"
    )
    serializer_class = PromotionEligibilitySerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]


class BeltExamViewSet(viewsets.ModelViewSet):
    queryset = BeltExam.objects.prefetch_related("candidates").all()
    serializer_class = BeltExamSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]

    @action(detail=True, methods=["get"])
    def candidates(self, request, pk=None):
        exam = self.get_object()
        candidates = exam.candidates.select_related("student", "target_belt").all()
        serializer = ExamCandidateSerializer(candidates, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="add-candidates")
    def add_candidates(self, request, pk=None):
        exam = self.get_object()
        serializer = ExamCandidateBulkCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        student_ids = serializer.validated_data["student_ids"]
        target_belt_id = serializer.validated_data["target_belt_id"]

        try:
            target_belt = Belt.objects.get(id=target_belt_id)
        except Belt.DoesNotExist:
            return Response({"error": "الحزام المحدد غير موجود."}, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        for student_id in student_ids:
            try:
                student = Student.objects.get(id=student_id)
            except Student.DoesNotExist:
                continue
            
            _, created = ExamCandidate.objects.get_or_create(
                exam=exam,
                student=student,
                defaults={"target_belt": target_belt}
            )
            if created:
                created_count += 1

        return Response({"success": True, "created_count": created_count}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="grade")
    def grade(self, request, pk=None):
        exam = self.get_object()
        candidate_id = request.data.get("candidate_id")
        technical_grade = request.data.get("technical_grade", "")
        instructor_notes = request.data.get("instructor_notes", "")
        result_status = request.data.get("status")
        double_promotion_belt_id = request.data.get("double_promotion_belt_id")

        if not candidate_id:
            return Response({"error": "يجب تحديد المرشح للاختبار."}, status=status.HTTP_400_BAD_REQUEST)

        if result_status not in ExamCandidate.Result.values:
            return Response({"error": "حالة النتيجة غير صالحة."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            candidate = exam.candidates.get(id=candidate_id)
        except ExamCandidate.DoesNotExist:
            return Response({"error": "المرشح غير موجود في هذا اختبار."}, status=status.HTTP_404_NOT_FOUND)

        if double_promotion_belt_id:
            try:
                double_belt = Belt.objects.get(id=double_promotion_belt_id)
                candidate.double_promotion_belt = double_belt
            except Belt.DoesNotExist:
                return Response({"error": "الحزام الاستثنائي المحدد غير موجود."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            candidate.double_promotion_belt = None

        candidate.technical_grade = technical_grade
        candidate.instructor_notes = instructor_notes
        candidate.status = result_status
        candidate.graded_by_id = request.user.id
        candidate.save()

        return Response(ExamCandidateSerializer(candidate).data)

    @action(detail=True, methods=["post"], url_path="grade-syllabus")
    def grade_syllabus(self, request, pk=None):
        exam = self.get_object()
        candidate_id = request.data.get("candidate_id")
        grades_data = request.data.get("grades", [])

        if not candidate_id:
            return Response({"error": "يجب تحديد المرشح للاختبار."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            candidate = exam.candidates.get(id=candidate_id)
        except ExamCandidate.DoesNotExist:
            return Response({"error": "المرشح غير موجود في هذا اختبار."}, status=status.HTTP_404_NOT_FOUND)

        from django.db import transaction
        with transaction.atomic():
            for g in grades_data:
                req_id = g.get("requirement_id")
                score = g.get("score", 0)
                notes = g.get("notes", "")
                if not req_id:
                    continue
                try:
                    req = BeltSyllabusRequirement.objects.get(id=req_id, belt=candidate.target_belt)
                except BeltSyllabusRequirement.DoesNotExist:
                    continue
                 
                CandidateSyllabusGrade.objects.update_or_create(
                    candidate=candidate,
                    requirement=req,
                    defaults={"score": score, "notes": notes}
                )

            # Recalculate average technical grade if scores are numeric
            all_grades = candidate.syllabus_grades.all()
            if all_grades.exists():
                total_score = sum(cg.score for cg in all_grades)
                max_possible = sum(cg.requirement.max_score for cg in all_grades)
                if max_possible > 0:
                    percentage = (total_score / max_possible) * 100
                    candidate.technical_grade = f"{percentage:.1f}%"
                    candidate.save(update_fields=["technical_grade"])

        return Response(ExamCandidateSerializer(candidate).data)

    @action(detail=True, methods=["post"], url_path="issue-certificates")
    def issue_certificates(self, request, pk=None):
        exam = self.get_object()
        signed_by_name = request.data.get("signed_by_name", "")
        signed_by_title = request.data.get("signed_by_title", "المدرب المعتمد / Authorized Examiner")
        passed_candidates = exam.candidates.filter(status=ExamCandidate.Result.PASSED)

        issued = []
        for cand in passed_candidates:
            cert = issue_or_get_candidate_certificate(
                candidate=cand,
                signed_by_name=signed_by_name,
                signed_by_title=signed_by_title,
            )
            issued.append(cert)

        return Response(
            {
                "success": True,
                "issued_count": len(issued),
                "certificates": PromotionCertificateSerializer(issued, many=True).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="candidate-certificate")
    def candidate_certificate(self, request, pk=None):
        exam = self.get_object()
        candidate_id = request.data.get("candidate_id")
        if not candidate_id:
            return Response({"error": "يجب تحديد المرشح."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            cand = exam.candidates.get(id=candidate_id)
        except ExamCandidate.DoesNotExist:
            return Response({"error": "المرشح غير موجود في هذا الاختبار."}, status=status.HTTP_404_NOT_FOUND)

        if cand.status != ExamCandidate.Result.PASSED:
            return Response(
                {"error": "لا يمكن إصدار شهادة إلا بعد اجتياز الاختبار بنجاح."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        signed_by_name = request.data.get("signed_by_name", "")
        signed_by_title = request.data.get("signed_by_title", "المدرب المعتمد / Authorized Examiner")
        cert = issue_or_get_candidate_certificate(
            candidate=cand,
            signed_by_name=signed_by_name,
            signed_by_title=signed_by_title,
        )
        return Response(PromotionCertificateSerializer(cert).data)


class PromotionCertificateViewSet(viewsets.ModelViewSet):
    """
    CRUD for Promotion Certificates (Staff only) + Public Verification Endpoint.
    """

    queryset = (
        PromotionCertificate.objects.select_related(
            "student", "belt_rank", "exam", "student_belt"
        ).all()
    )
    serializer_class = PromotionCertificateSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    filterset_fields = ["student", "belt_rank", "exam", "status"]
    search_fields = ["certificate_number", "student__first_name", "student__last_name", "student__student_number"]

    @action(detail=True, methods=["post"], url_path="revoke")
    def revoke(self, request, pk=None):
        cert = self.get_object()
        reason = request.data.get("reason", "تم إلغاء الشهادة بقرار إداري / Revoked by admin")
        cert.status = PromotionCertificate.Status.REVOKED
        cert.revocation_reason = reason
        cert.save(update_fields=["status", "revocation_reason", "updated_at"])
        return Response(PromotionCertificateSerializer(cert).data)

    @action(
        detail=False,
        methods=["get"],
        url_path=r"verify/(?P<token>[0-9a-fA-F-]+)",
        permission_classes=[permissions.AllowAny],
    )
    def verify(self, request, token=None):
        try:
            cert = PromotionCertificate.objects.select_related(
                "student", "belt_rank", "exam"
            ).get(uuid=token)
        except (PromotionCertificate.DoesNotExist, ValueError):
            return Response(
                {"detail": "الشهادة غير موجودة أو الرابط غير صالح.", "is_valid": False},
                status=status.HTTP_404_NOT_FOUND,
            )

        is_tampered = not verify_certificate_fingerprint(cert)
        data = PublicCertificateVerificationSerializer(cert).data
        data["is_tampered"] = is_tampered
        if is_tampered:
            data["is_valid"] = False
            data["tamper_warning"] = (
                "فشل التحقق من البصمة الرقمية للشهادة. قد تكون البيانات تعرضت للتعديل."
            )
        return Response(data)


from rest_framework.decorators import api_view, permission_classes


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def public_verify_certificate_cross_tenant(request, token):
    """
    Public fallback verification view that works across public and tenant schemas.
    """
    # 1. Try local schema
    try:
        cert = PromotionCertificate.objects.select_related("student", "belt_rank", "exam").get(uuid=token)
        is_tampered = not verify_certificate_fingerprint(cert)
        data = PublicCertificateVerificationSerializer(cert).data
        data["is_tampered"] = is_tampered
        if is_tampered:
            data["is_valid"] = False
            data["tamper_warning"] = "فشل التحقق من البصمة الرقمية للشهادة. قد تكون البيانات تعرضت للتعديل."
        return Response(data)
    except Exception:
        pass

    # 2. Iterate tenants if on public schema
    from django_tenants.utils import schema_context
    from apps.tenants.models import Tenant

    for tenant in Tenant.objects.exclude(schema_name="public"):
        try:
            with schema_context(tenant.schema_name):
                cert = PromotionCertificate.objects.select_related("student", "belt_rank", "exam").get(uuid=token)
                is_tampered = not verify_certificate_fingerprint(cert)
                data = PublicCertificateVerificationSerializer(cert).data
                data["is_tampered"] = is_tampered
                if is_tampered:
                    data["is_valid"] = False
                    data["tamper_warning"] = "فشل التحقق من البصمة الرقمية للشهادة. قد تكون البيانات تعرضت للتعديل."
                return Response(data)
        except Exception:
            continue

    return Response(
        {"detail": "الشهادة غير موجودة أو الرابط غير صالح.", "is_valid": False},
        status=status.HTTP_404_NOT_FOUND,
    )
