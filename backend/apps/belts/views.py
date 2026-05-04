"""MAIDAN — Belts App Views"""
from rest_framework import filters, permissions, serializers, viewsets
from shared.permissions import IsStaff, IsTenantOwnerOrManager
from .models import BeltRank, StudentBelt, PromotionEligibility


class BeltRankSerializer(serializers.ModelSerializer):
    class Meta:
        model = BeltRank
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
    queryset = BeltRank.objects.filter(is_active=True).order_by("martial_art", "order_index")
    serializer_class = BeltRankSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    filter_backends = [filters.SearchFilter]
    filterset_fields = ["martial_art"]


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
