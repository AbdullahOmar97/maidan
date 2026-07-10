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
)
from .serializers import (
    BeltExamSerializer,
    ExamCandidateSerializer,
    ExamCandidateBulkCreateSerializer,
    BeltSyllabusRequirementSerializer,
    CandidateSyllabusGradeSerializer,
)


class BeltRankSerializer(serializers.ModelSerializer):
    class Meta:
        model = Belt
        fields = "__all__"
        read_only_fields = ["id", "created_at"]


class StudentBeltSerializer(serializers.ModelSerializer):
    belt_name = serializers.ReadOnlyField(source="belt_rank.name")
    belt_color = serializers.ReadOnlyField(source="belt_rank.color_hex")
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = StudentBelt
        fields = "__all__"
        read_only_fields = ["id", "created_at"]

    def get_student_name(self, obj):
        return obj.student.full_name


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
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    filter_backends = [filters.SearchFilter]
    filterset_fields = ["martial_art"]


class BeltSyllabusRequirementViewSet(viewsets.ModelViewSet):
    queryset = BeltSyllabusRequirement.objects.all()
    serializer_class = BeltSyllabusRequirementSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    filterset_fields = ["belt"]


class StudentBeltViewSet(viewsets.ModelViewSet):
    queryset = StudentBelt.objects.select_related("student", "belt_rank").order_by("-promoted_at")
    serializer_class = StudentBeltSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    filterset_fields = ["student_id", "is_current"]

    def perform_create(self, serializer):
        serializer.save(promoted_by_id=self.request.user.id)


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
