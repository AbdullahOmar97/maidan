from rest_framework import serializers
from apps.students.models import Student
from .models import Belt, StudentBelt, BeltExam, ExamCandidate


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
            "technical_grade",
            "instructor_notes",
            "status",
            "graded_by_id",
            "graded_at",
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
            "graded_at",
            "created_at",
        ]

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


class ExamCandidateBulkCreateSerializer(serializers.Serializer):
    student_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )
    target_belt_id = serializers.IntegerField()
