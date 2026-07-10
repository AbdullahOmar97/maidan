"""
MAIDAN — Attendance App Views + Serializers
"""

from django.utils import timezone
from django.db import connection
from rest_framework import filters, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
import datetime
from zoneinfo import ZoneInfo

from shared.permissions import CanCheckIn, IsStaff, CanManageSchedules, LocationFilterMixin
from .models import AttendanceRecord, ClassSchedule, ClassSession, ClassType


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------

class ClassTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassType
        fields = [
            "id", "name", "name_ar", "martial_art", "description",
            "default_duration_minutes", "color", "is_active", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ClassScheduleSerializer(serializers.ModelSerializer):
    class_type_id = serializers.PrimaryKeyRelatedField(
        queryset=ClassType.objects.all(), source="class_type"
    )
    from apps.students.models import Location
    location_id = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.all(), source="location"
    )
    class_type_name = serializers.ReadOnlyField(source="class_type.name")
    day_name = serializers.ReadOnlyField(source="get_day_of_week_display")

    class Meta:
        model = ClassSchedule
        fields = [
            "id", "class_type_id", "class_type_name", "location_id",
            "instructor_id", "day_of_week", "day_name",
            "start_time", "end_time", "capacity", "is_active", "notes",
        ]
        read_only_fields = ["id", "class_type_name", "day_name"]


class ClassSessionSerializer(serializers.ModelSerializer):
    class_name = serializers.ReadOnlyField(source="schedule.class_type.name")
    location_name = serializers.ReadOnlyField(source="schedule.location.name")

    class Meta:
        model = ClassSession
        fields = [
            "id", "schedule_id", "class_name", "location_name",
            "date", "instructor_id", "actual_start", "actual_end",
            "status", "cancellation_reason", "notes", "attendance_count",
        ]
        read_only_fields = ["id", "class_name", "location_name", "attendance_count"]


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    session_date = serializers.ReadOnlyField(source="session.date")

    class Meta:
        model = AttendanceRecord
        fields = [
            "id", "session_id", "student_id", "student_name",
            "session_date", "checked_in_at", "checked_in_by_id",
            "check_in_method", "notes",
        ]
        read_only_fields = ["id", "student_name", "session_date", "checked_in_at"]

    def get_student_name(self, obj):
        return obj.student.full_name


class KioskCheckInSerializer(serializers.Serializer):
    """Lightweight check-in for kiosk mode."""
    student_id = serializers.IntegerField(required=False)
    student_number = serializers.CharField(required=False)
    phone = serializers.CharField(required=False)
    session_id = serializers.IntegerField(required=False)


# ---------------------------------------------------------------------------
# ViewSets
# ---------------------------------------------------------------------------

class ClassTypeViewSet(viewsets.ModelViewSet):
    queryset = ClassType.objects.filter(is_active=True)
    serializer_class = ClassTypeSerializer
    
    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), CanManageSchedules()]
        return [permissions.IsAuthenticated(), IsStaff()]


class ClassScheduleViewSet(LocationFilterMixin, viewsets.ModelViewSet):
    serializer_class = ClassScheduleSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["location_id", "day_of_week", "is_active", "class_type_id"]
    location_field = "location_id"

    def get_queryset(self):
        qs = ClassSchedule.objects.select_related("class_type", "location").all()
        return self.get_location_filtered_queryset(qs)

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), CanManageSchedules()]
        return [permissions.IsAuthenticated(), IsStaff()]


class ClassSessionViewSet(LocationFilterMixin, viewsets.ModelViewSet):
    serializer_class = ClassSessionSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["date", "status", "schedule__location_id"]
    ordering = ["-date"]
    location_field = "schedule__location_id"

    def get_queryset(self):
        qs = ClassSession.objects.select_related("schedule__class_type", "schedule__location").all()
        return self.get_location_filtered_queryset(qs)

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), CanManageSchedules()]
        return [permissions.IsAuthenticated(), IsStaff()]

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def today(self, request):
        """Get today's sessions for the current location."""
        location_id = request.query_params.get("location_id")
        
        # Determine "today" based on location timezone if possible
        now = timezone.now()
        if location_id:
            from apps.students.models import Location
            try:
                location = Location.objects.get(id=location_id)
                tz = ZoneInfo(location.timezone or "UTC")
                today = now.astimezone(tz).date()
            except (Location.DoesNotExist, Exception):
                today = now.date()
        else:
            # Fallback to tenant timezone if available
            try:
                tenant = getattr(connection, "tenant", None)
                if tenant and hasattr(tenant, "timezone"):
                    tz = ZoneInfo(tenant.timezone or "UTC")
                    today = now.astimezone(tz).date()
                else:
                    today = now.date()
            except Exception:
                today = now.date()
            
        sessions = self.get_queryset().filter(date=today, status__in=["scheduled", "in_progress"])
        if location_id:
            sessions = sessions.filter(schedule__location_id=location_id)
            
        serializer = self.get_serializer(sessions, many=True)
        return Response(serializer.data)


class AttendanceRecordViewSet(viewsets.ModelViewSet):
    queryset = AttendanceRecord.objects.select_related("student", "session__schedule__class_type").all()
    serializer_class = AttendanceRecordSerializer
    permission_classes = [permissions.IsAuthenticated, CanCheckIn]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["session_id", "student_id", "check_in_method"]
    ordering = ["-checked_in_at"]

    def perform_create(self, serializer):
        serializer.save(checked_in_by_id=self.request.user.id)

    @action(detail=False, methods=["post"], permission_classes=[permissions.AllowAny])
    def kiosk(self, request):
        """
        Kiosk check-in endpoint — no auth required (runs in kiosk browser).
        Identified by student_id, auto-assigns to current session.
        """
        serializer = KioskCheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        from apps.students.models import Student
        from django.db.models import Q
        
        student_id = data.get("student_id")
        student_number = data.get("student_number")
        phone = data.get("phone")
        
        # Build query filter
        q_filter = Q()
        if student_id:
            q_filter &= Q(id=student_id)
        elif student_number:
            q_filter &= Q(student_number=student_number)
        elif phone:
            q_filter &= Q(phone=phone)
        else:
            return Response(
                {"error": "يجب تحديد معرف الطالب أو الرمز الخاص به أو رقم هاتفه."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            student = Student.objects.select_related("location").get(q_filter)
        except Student.DoesNotExist:
            return Response(
                {"error": "هذا الطالب غير مسجل أو البيانات غير صحيحة."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Student.MultipleObjectsReturned:
            if phone:
                return Response(
                    {"error": "يوجد أكثر من طالب مسجل بنفس رقم الهاتف. يرجى استخدام رمز الطالب أو بطاقة الـ QR."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {"error": "حدث خطأ أثناء تحديد بيانات الطالب."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate student status
        if student.status == Student.Status.SUSPENDED:
            from apps.messaging.utils import create_in_app_notification
            create_in_app_notification(
                subject="محاولة دخول مرفوضة",
                content=f"حاول الطالب معلق الحساب {student.full_name} تسجيل الحضور لحصة اليوم وتم حظره.",
                student=student
            )
            return Response(
                {"error": "عذراً، هذا الحساب معلق بسبب مستحقات مالية غير مدفوعة. يرجى مراجعة الإدارة."},
                status=status.HTTP_403_FORBIDDEN
            )
        if student.status not in [Student.Status.ACTIVE, Student.Status.TRIAL]:
            return Response(
                {"error": "عذراً، هذا الحساب غير نشط حالياً."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get local time for the student's location
        now = timezone.now()
        try:
            tz = ZoneInfo(student.location.timezone or "UTC")
        except Exception:
            tz = ZoneInfo("UTC")
            
        local_now = now.astimezone(tz)
        today = local_now.date()
        current_time = local_now.time()

        # Find candidate sessions for today at this location
        sessions = ClassSession.objects.filter(
            date=today,
            schedule__location=student.location,
            status__in=["scheduled", "in_progress"],
        ).select_related("schedule")

        if not sessions.exists():
            return Response(
                {"error": f"لا توجد حصص مجدولة لهذا اليوم ({today})."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Smart session detection: 
        # 1. Look for a session that is currently happening (start <= now <= end + 30m buffer)
        # 2. Or the one that started most recently
        
        def time_to_seconds(t):
            return t.hour * 3600 + t.minute * 60 + t.second

        now_sec = time_to_seconds(current_time)
        best_session = None
        
        # Buffer: allow check-in up to 30 mins after session ends
        buffer_sec = 30 * 60

        for session in sessions:
            start_sec = time_to_seconds(session.schedule.start_time)
            end_sec = time_to_seconds(session.schedule.end_time)
            
            # If currently within the class time (with buffer)
            if start_sec - 900 <= now_sec <= end_sec + buffer_sec: # 15m early to 30m late
                best_session = session
                break
        
        # Fallback to the first one if only one session exists today
        if not best_session and sessions.count() == 1:
            best_session = sessions.first()
            
        if not best_session:
            return Response(
                {"error": "لا توجد حصة نشطة حالياً. يمكنك تسجيل الحضور من 15 دقيقة قبل الحصة وحتى 30 دقيقة من بدايتها."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        record, created = AttendanceRecord.objects.get_or_create(
            session=best_session,
            student=student,
            defaults={"check_in_method": "kiosk"},
        )

        return Response({
            "success": True,
            "already_checked_in": not created,
            "student_name": student.full_name,
            "class_name": best_session.schedule.class_type.name,
            "checked_in_at": record.checked_in_at,
        })
