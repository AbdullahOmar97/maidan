"""
MAIDAN — Students App Serializers
"""

from rest_framework import serializers
from .models import Student, StudentNote, StudentDocument, Location, Family


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = [
            "id", "name", "address", "city", "country",
            "phone", "email", "timezone", "capacity", "is_active",
            "manager_id", "photo", "map_lat", "map_lng", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        if request and hasattr(request, "tenant") and request.tenant:
            tenant = request.tenant
            if tenant.schema_name != "public":
                plan = tenant.plan
                if plan:
                    # 1. Enforce max locations limit on creation
                    if not self.instance:
                        current_locations_count = Location.objects.count()
                        if current_locations_count >= plan.max_locations:
                            raise serializers.ValidationError(
                                {"non_field_errors": f"لقد تجاوزت الحد الأقصى لعدد الفروع المسموح به في باقتك الحالية ({plan.max_locations} فرع)."}
                            )
                    
                    # 2. Enforce sum of capacities across all branches does not exceed plan.max_students
                    from django.db.models import Sum
                    capacity_val = attrs.get("capacity")
                    if capacity_val is None:
                        if self.instance:
                            capacity_val = self.instance.capacity
                        else:
                            capacity_val = 50  # default capacity

                    query = Location.objects.all()
                    if self.instance and self.instance.pk:
                        query = query.exclude(pk=self.instance.pk)

                    other_branches_capacity = query.aggregate(total=Sum("capacity"))["total"] or 0
                    total_capacity = other_branches_capacity + capacity_val

                    if total_capacity > plan.max_students:
                        raise serializers.ValidationError(
                            {"capacity": f"إجمالي الطاقة الاستيعابية لجميع الفروع ({total_capacity}) يتجاوز الحد الأقصى المسموح به في الباقة للطلاب ({plan.max_students} طالب). الطاقة الاستيعابية المتاحة للفروع الأخرى هي {other_branches_capacity}."}
                        )
        return attrs



class FamilySerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Family
        fields = [
            "id", "name", "primary_contact_name", "primary_contact_phone",
            "primary_contact_email", "billing_address", "notes",
            "member_count", "created_at",
        ]
        read_only_fields = ["id", "member_count", "created_at"]

    def get_member_count(self, obj):
        return obj.members.count()


class KioskStudentSerializer(serializers.ModelSerializer):
    """Minimal student data for kiosk search."""
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = Student
        fields = ["id", "full_name", "first_name", "last_name", "phone"]
        read_only_fields = ["id", "full_name"]


class StudentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    full_name = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()
    current_belt = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            "id", "student_number", "first_name", "last_name", "full_name",
            "photo", "photo_url", "age", "gender",
            "phone", "email", "whatsapp",
            "status", "source", "location", "location_id",
            "current_belt", "created_at",
        ]
        read_only_fields = ["id", "student_number", "full_name", "age", "created_at"]

    def get_current_belt(self, obj):
        belt = obj.belt_history.filter(is_current=True).first()
        if belt:
            return {
                "name": belt.belt_rank.name,
                "color": belt.belt_rank.color_hex,
                "promoted_at": belt.promoted_at,
            }
        return None

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.photo.url)
        return None


class StudentDetailSerializer(serializers.ModelSerializer):
    """Full student detail serializer."""
    full_name = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()
    family = FamilySerializer(read_only=True)
    family_id = serializers.PrimaryKeyRelatedField(
        queryset=Family.objects.all(), source="family", write_only=True, required=False, allow_null=True
    )
    location = LocationSerializer(read_only=True)
    location_id = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.all(), source="location", write_only=True
    )
    photo_url = serializers.SerializerMethodField()
    active_membership = serializers.SerializerMethodField()
    current_belt = serializers.SerializerMethodField()
    belt_history = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            "id", "student_number",
            "first_name", "last_name", "full_name",
            "date_of_birth", "age", "gender", "nationality",
            "phone", "email", "whatsapp",
            "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation",
            "medical_notes", "blood_type", "allergies",
            "photo", "photo_url",
            "family", "family_id", "location", "location_id",
            "status", "source", "referred_by_id",
            "trial_start_date", "trial_end_date", "trial_sessions_used",
            "waiver_signed", "waiver_signed_at", "photo_consent",
            "notes",
            "active_membership", "current_belt", "belt_history",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "student_number", "full_name", "age",
            "active_membership", "current_belt", "belt_history",
            "created_at", "updated_at",
        ]
        validators = [
            serializers.UniqueTogetherValidator(
                queryset=Student.objects.all(),
                fields=["first_name", "last_name", "phone", "location"],
                message="هذا الطالب موجود بالفعل في هذا الفرع بنفس البيانات (الاسم ورقم الهاتف)."
            )
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        
        # Plan student capacity check
        request = self.context.get("request")
        if not self.instance and request and hasattr(request, "tenant") and request.tenant:
            tenant = request.tenant
            if tenant.schema_name != "public":
                plan = tenant.plan
                if plan:
                    current_students = Student.objects.filter(deleted_at__isnull=True).count()
                    if current_students >= plan.max_students:
                        raise serializers.ValidationError(
                            {"non_field_errors": f"لقد تجاوزت الحد الأقصى لعدد الطلاب المسموح به في باقتك الحالية ({plan.max_students} طالب)."}
                        )

        # Branch capacity validation
        location = attrs.get("location")
        status_val = attrs.get("status")
        
        # If updating, get values from self.instance if not provided in attrs
        if self.instance:
            if location is None:
                location = self.instance.location
            if status_val is None:
                status_val = self.instance.status
        else:
            if status_val is None:
                status_val = "lead"
                
        # Only check capacity if the student's status is 'active' or 'trial'
        if status_val in ["active", "trial"] and location:
            # Count other active/trial students in this location
            query = Student.objects.filter(
                location=location,
                status__in=["active", "trial"],
                deleted_at__isnull=True
            )
            if self.instance and self.instance.pk:
                query = query.exclude(pk=self.instance.pk)
                
            current_active_count = query.count()
            if current_active_count >= location.capacity:
                raise serializers.ValidationError({
                    "location_id": f"لقد تجاوز عدد الطلاب في هذا الفرع السعة الاستيعابية المتاحة ({location.capacity} طلاب)."
                })
                
        return attrs

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.photo.url)
        return None

    def get_active_membership(self, obj):
        membership = obj.memberships.filter(status="active").first()
        if membership:
            return {
                "id": membership.id,
                "plan_name": membership.plan.name,
                "start_date": membership.start_date,
                "end_date": membership.end_date,
                "status": membership.status,
            }
        return None

    def get_current_belt(self, obj):
        belt = obj.belt_history.filter(is_current=True).first()
        if belt:
            return {
                "name": belt.belt_rank.name,
                "color": belt.belt_rank.color_hex,
                "promoted_at": belt.promoted_at,
            }
        return None

    def get_belt_history(self, obj):
        return [
            {
                "belt_name": h.belt_rank.name,
                "color": h.belt_rank.color_hex,
                "promoted_at": h.promoted_at,
                "is_current": h.is_current,
            }
            for h in obj.belt_history.all()[:10]
        ]


class StudentNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentNote
        fields = ["id", "student_id", "author_id", "note_type", "content", "is_private", "created_at"]
        read_only_fields = ["id", "author_id", "created_at"]


class StudentDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentDocument
        fields = [
            "id", "student_id", "document_type", "name", "file",
            "uploaded_by_id", "notes", "expires_at", "created_at",
        ]
        read_only_fields = ["id", "uploaded_by_id", "created_at"]
