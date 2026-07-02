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
                    # 1. Enforce max locations limit on creation/activation
                    is_activating = False
                    if not self.instance:
                        is_activating = attrs.get("is_active", True)
                    else:
                        is_activating = attrs.get("is_active", False) and not self.instance.is_active

                    if is_activating:
                        active_locations_count = Location.objects.filter(is_active=True).count()
                        if active_locations_count >= plan.max_locations:
                            raise serializers.ValidationError(
                                {"non_field_errors": f"لقد تجاوزت الحد الأقصى لعدد الفروع النشطة المسموح به في باقتك الحالية ({plan.max_locations} فرع)."}
                            )

                    # 2. Enforce sum of capacities across all active branches does not exceed plan.max_students
                    from django.db.models import Sum
                    capacity_val = attrs.get("capacity")
                    if capacity_val is None:
                        if self.instance:
                            capacity_val = self.instance.capacity
                        else:
                            capacity_val = 50  # default capacity

                    is_active_after_save = attrs.get("is_active")
                    if is_active_after_save is None:
                        is_active_after_save = self.instance.is_active if self.instance else True

                    if is_active_after_save:
                        query = Location.objects.filter(is_active=True)
                        if self.instance and self.instance.pk:
                            query = query.exclude(pk=self.instance.pk)

                        other_branches_capacity = query.aggregate(total=Sum("capacity"))["total"] or 0
                        total_capacity = other_branches_capacity + capacity_val

                        if total_capacity > plan.max_students:
                            raise serializers.ValidationError(
                                {"capacity": f"إجمالي الطاقة الاستيعابية للفروع النشطة يتجاوز الحد الأقصى لعدد الطلاب المسموح به في باقتك الحالية ({plan.max_students} طالب). السعة المتاحة لباقي الفروع النشطة هي {other_branches_capacity} طالب."}
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


class FamilyMemberSerializer(serializers.ModelSerializer):
    """Compact student snapshot for family member list."""
    full_name = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()
    photo_url = serializers.SerializerMethodField()
    current_belt = serializers.SerializerMethodField()
    active_membership = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            "id", "student_number", "first_name", "last_name", "full_name",
            "photo_url", "age", "gender", "phone", "email",
            "status", "current_belt", "active_membership", "created_at",
        ]

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.photo.url)
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

    def get_active_membership(self, obj):
        membership = obj.memberships.filter(status="active").first()
        if membership:
            return {
                "id": membership.id,
                "plan_name": membership.plan.name,
                "status": membership.status,
                "end_date": membership.end_date,
            }
        return None


class FamilyDetailSerializer(FamilySerializer):
    """Full family detail with member list and aggregated stats."""
    members = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    class Meta(FamilySerializer.Meta):
        fields = FamilySerializer.Meta.fields + ["members", "stats"]

    def get_members(self, obj):
        qs = obj.members.prefetch_related(
            "belt_history__belt_rank", "memberships__plan"
        ).all()
        return FamilyMemberSerializer(qs, many=True, context=self.context).data

    def get_stats(self, obj):
        from django.db.models import Sum, Q
        members = obj.members.all()
        member_ids = list(members.values_list("id", flat=True))

        active_count = members.filter(status="active").count()
        active_memberships = members.filter(memberships__status="active").distinct().count()

        # Total invoices and outstanding balance
        from apps.billing.models import Invoice
        invoices = Invoice.objects.filter(student_id__in=member_ids)
        total_billed = invoices.aggregate(t=Sum("total_amount"))["t"] or 0
        outstanding = invoices.filter(
            status__in=["pending", "overdue"]
        ).aggregate(t=Sum("amount_due"))["t"] or 0

        # Attendance count (last 90 days)
        from apps.attendance.models import AttendanceRecord
        from django.utils import timezone
        import datetime
        since = timezone.now() - datetime.timedelta(days=90)
        attendance_count = AttendanceRecord.objects.filter(
            student_id__in=member_ids,
            checked_in_at__gte=since,
        ).count()

        return {
            "member_count": len(member_ids),
            "active_count": active_count,
            "active_memberships": active_memberships,
            "total_billed": float(total_billed),
            "outstanding_balance": float(outstanding),
            "attendance_last_90_days": attendance_count,
        }


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
        if request and hasattr(request, "tenant") and request.tenant:
            tenant = request.tenant
            if tenant.schema_name != "public":
                plan = tenant.plan
                if plan:
                    is_activating = False
                    new_status = attrs.get("status")
                    if not self.instance:
                        is_activating = (new_status == "active")
                    else:
                        is_activating = (new_status == "active") and (self.instance.status != "active")

                    if is_activating:
                        active_students = Student.objects.filter(status="active", deleted_at__isnull=True).count()
                        if active_students >= plan.max_students:
                            raise serializers.ValidationError(
                                {"non_field_errors": f"لقد تجاوزت الحد الأقصى لعدد الطلاب النشطين المسموح به في باقتك الحالية ({plan.max_students} طالب)."}
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
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = StudentNote
        fields = ["id", "student_id", "author_id", "author_name", "note_type", "content", "is_private", "created_at"]
        read_only_fields = ["id", "author_id", "created_at"]

    def get_author_name(self, obj):
        if not obj.author_id:
            return None
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.only("first_name", "last_name").get(id=obj.author_id)
            return user.get_full_name() or str(obj.author_id)
        except User.DoesNotExist:
            return str(obj.author_id)


class StudentDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentDocument
        fields = [
            "id", "student_id", "document_type", "name", "file",
            "uploaded_by_id", "notes", "expires_at", "created_at",
        ]
        read_only_fields = ["id", "uploaded_by_id", "created_at"]
