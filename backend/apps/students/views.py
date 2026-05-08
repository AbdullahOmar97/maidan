"""
MAIDAN — Students App Views
"""

import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from shared.mixins import AuditMixin, SoftDeleteMixin
from shared.permissions import (
    CanCheckIn, 
    IsStaff, 
    IsTenantOwnerOrManager, 
    LocationFilterMixin,
    CanManageLocations,
    CanManageStudents
)
from .models import Family, Location, Student, StudentDocument, StudentNote
from .serializers import (
    FamilySerializer,
    LocationSerializer,
    StudentDetailSerializer,
    StudentDocumentSerializer,
    StudentListSerializer,
    StudentNoteSerializer,
    KioskStudentSerializer,
)


class CharInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    pass


class NumberInFilter(django_filters.BaseInFilter, django_filters.NumberFilter):
    pass


class StudentFilter(django_filters.FilterSet):
    status = CharInFilter(field_name="status", lookup_expr="in")
    location = NumberInFilter(field_name="location_id", lookup_expr="in")
    gender = django_filters.ChoiceFilter(choices=Student.Gender.choices)
    belt_rank = NumberInFilter(field_name="belt_history__belt_rank_id", lookup_expr="in", distinct=True)
    family = django_filters.NumberFilter(field_name="family_id")
    has_active_membership = django_filters.BooleanFilter(method="filter_active_membership")
    trial_expiring_days = django_filters.NumberFilter(method="filter_trial_expiring")

    def filter_active_membership(self, queryset, name, value):
        if value:
            return queryset.filter(memberships__status="active").distinct()
        return queryset.exclude(memberships__status="active").distinct()

    def filter_trial_expiring(self, queryset, name, value):
        from django.utils import timezone
        import datetime
        cutoff = timezone.now().date() + datetime.timedelta(days=int(value))
        return queryset.filter(status="trial", trial_end_date__lte=cutoff)

    class Meta:
        model = Student
        fields = ["status", "location", "gender"]


class LocationViewSet(LocationFilterMixin, viewsets.ModelViewSet):
    """CRUD for dojo locations/branches."""
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    location_field = "id"

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), CanManageLocations()]
        return [permissions.IsAuthenticated(), IsStaff()]

    def get_queryset(self):
        qs = Location.objects.all()
        return self.get_location_filtered_queryset(qs)

    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "name_ar", "city"]


class FamilyViewSet(viewsets.ModelViewSet):
    """CRUD for family groups."""
    queryset = Family.objects.all()
    serializer_class = FamilySerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "primary_contact_name", "primary_contact_phone"]


class StudentViewSet(SoftDeleteMixin, AuditMixin, LocationFilterMixin, viewsets.ModelViewSet):
    """
    Full CRUD + custom actions for students.
    Includes search, filter, ordering, pagination.
    """

    queryset = Student.objects.select_related("family", "location").prefetch_related(
        "belt_history__belt_rank", "memberships__plan"
    )
    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), CanManageStudents()]
        return [permissions.IsAuthenticated(), IsStaff()]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = StudentFilter
    search_fields = [
        "first_name", "last_name",
        "email", "phone", "student_number", "whatsapp",
    ]

    def filter_queryset(self, queryset):
        search_query = self.request.query_params.get("search", "")
        if " " in search_query:
            # Handle full name search (e.g. "Abdullah Omar")
            from django.db.models import Q
            parts = search_query.split()
            if len(parts) >= 2:
                q_obj = Q()
                for part in parts:
                    q_obj &= (Q(first_name__icontains=part) | Q(last_name__icontains=part))
                return queryset.filter(q_obj)
        return super().filter_queryset(queryset)
    ordering_fields = ["created_at", "first_name", "last_name", "status"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return StudentListSerializer
        return StudentDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset().filter(deleted_at__isnull=True)
        return self.get_location_filtered_queryset(qs)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, CanCheckIn])
    def quick_checkin(self, request, pk=None):
        """One-tap check-in for a student to today's appropriate session."""
        student = self.get_object()
        
        from django.utils import timezone
        from zoneinfo import ZoneInfo
        from apps.attendance.models import ClassSession, AttendanceRecord, ClassSchedule
        import datetime

        # 1. Determine local time at student's location
        tz_name = student.location.timezone or "Asia/Riyadh"
        try:
            tz = ZoneInfo(tz_name)
        except Exception:
            tz = ZoneInfo("UTC")
            
        now_local = timezone.now().astimezone(tz)
        today_local = now_local.date()
        time_local = now_local.time()
        day_of_week = today_local.weekday()

        # 2. Look for an existing session that is active or recently started
        sessions = ClassSession.objects.filter(
            date=today_local,
            schedule__location=student.location,
            status__in=["scheduled", "in_progress"],
        ).select_related("schedule")

        session = None
        
        # Heuristic: Find session where current time is between [start - 45m, end + 30m]
        for s in sessions:
            s_start = s.schedule.start_time
            s_end = s.schedule.end_time
            
            # Use datetime for comparison to handle wrap-around if needed (though time fields are usually enough for same day)
            dt_start = datetime.datetime.combine(today_local, s_start)
            dt_end = datetime.datetime.combine(today_local, s_end)
            dt_now = datetime.datetime.combine(today_local, time_local)
            
            if (dt_start - datetime.timedelta(minutes=45)) <= dt_now <= (dt_end + datetime.timedelta(minutes=30)):
                session = s
                break
        
        if not session and sessions.exists():
            session = sessions.first()
        
        # 3. If no session exists, try to find a schedule and create a session on-the-fly
        if not session:
            schedules = ClassSchedule.objects.filter(
                location=student.location,
                day_of_week=day_of_week,
                is_active=True
            ).order_by("start_time")
            
            if schedules.exists():
                best_sched = None
                dt_now = datetime.datetime.combine(today_local, time_local)
                
                for sched in schedules:
                    dt_start = datetime.datetime.combine(today_local, sched.start_time)
                    dt_end = datetime.datetime.combine(today_local, sched.end_time)
                    
                    if (dt_start - datetime.timedelta(minutes=45)) <= dt_now <= (dt_end + datetime.timedelta(minutes=30)):
                        best_sched = sched
                        break
                
                if not best_sched:
                    # If nothing is "right now", pick the next upcoming or last one
                    best_sched = schedules.filter(start_time__gte=time_local).first() or schedules.last()
                
                if best_sched:
                    session, created = ClassSession.objects.get_or_create(
                        schedule=best_sched,
                        date=today_local,
                        defaults={"status": "scheduled"}
                    )

        if not session:
            return Response(
                {"error": "لم يتم العثور على حصة تدريبية متاحة حالياً في هذا الفرع."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        record, created = AttendanceRecord.objects.get_or_create(
            session=session,
            student=student,
            defaults={
                "checked_in_by_id": request.user.id if hasattr(request.user, 'id') and not isinstance(request.user.id, str) else None,
                "check_in_method": "manual",
            },
        )

        if not created:
            return Response({
                "message": "تم تسجيل الحضور مسبقاً لهذه الحصة.",
                "already_checked_in": True,
                "session_name": session.schedule.class_type.name,
            })

        from apps.audit.utils import log_action
        log_action(request.user, "checkin", "attendance", str(record.id), request=request)

        return Response({
            "message": f"تم تسجيل حضور {student.full_name} بنجاح في {session.schedule.class_type.name}.",
            "session_id": session.id,
            "session_name": session.schedule.class_type.name,
            "checked_in_at": record.checked_in_at,
            "already_checked_in": False,
        })

    @action(detail=True, methods=["get"], permission_classes=[permissions.IsAuthenticated, IsStaff])
    def potential_sessions(self, request, pk=None):
        """List sessions and schedules for a specific date to allow manual check-in."""
        student = self.get_object()
        date_str = request.query_params.get("date")
        
        from django.utils import timezone
        import datetime
        
        if not date_str:
            date_obj = timezone.now().date()
        else:
            try:
                date_obj = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        from apps.attendance.models import ClassSession, ClassSchedule
        
        # 1. Existing sessions for the student's location
        sessions = ClassSession.objects.filter(
            date=date_obj,
            schedule__location=student.location
        ).select_related("schedule__class_type")
        
        # 2. Potential schedules for this weekday at student's location
        day_of_week = date_obj.weekday()
        schedules = ClassSchedule.objects.filter(
            location=student.location,
            day_of_week=day_of_week,
            is_active=True
        ).select_related("class_type")
        
        # Exclude schedules that already have a session object
        existing_schedule_ids = sessions.values_list("schedule_id", flat=True)
        potential_schedules = schedules.exclude(id__in=existing_schedule_ids)
        
        data = {
            "existing": [
                {
                    "id": s.id,
                    "class_name": s.schedule.class_type.name,
                    "start_time": s.schedule.start_time.strftime("%H:%M"),
                    "end_time": s.schedule.end_time.strftime("%H:%M"),
                    "status": s.status,
                } for s in sessions
            ],
            "schedules": [
                {
                    "id": s.id,
                    "class_name": s.class_type.name,
                    "start_time": s.start_time.strftime("%H:%M"),
                    "end_time": s.end_time.strftime("%H:%M"),
                } for s in potential_schedules
            ]
        }
        return Response(data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, CanCheckIn])
    def manual_checkin(self, request, pk=None):
        """Manually record attendance for a specific session or schedule+date."""
        student = self.get_object()
        session_id = request.data.get("session_id")
        schedule_id = request.data.get("schedule_id")
        date_str = request.data.get("date")

        from apps.attendance.models import ClassSession, AttendanceRecord, ClassSchedule
        import datetime

        session = None
        if session_id:
            try:
                session = ClassSession.objects.get(id=session_id)
            except ClassSession.DoesNotExist:
                return Response({"error": "الحصة غير موجودة."}, status=status.HTTP_404_NOT_FOUND)
        elif schedule_id and date_str:
            try:
                date_obj = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
                schedule = ClassSchedule.objects.get(id=schedule_id)
                # Create session on the fly if needed
                session, created = ClassSession.objects.get_or_create(
                    schedule=schedule,
                    date=date_obj,
                    defaults={"status": "scheduled"}
                )
            except (ValueError, ClassSchedule.DoesNotExist):
                return Response({"error": "بيانات الجدول أو التاريخ غير صحيحة."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"error": "يجب تحديد الحصة أو الجدول مع التاريخ."}, status=status.HTTP_400_BAD_REQUEST)

        record, created = AttendanceRecord.objects.get_or_create(
            session=session,
            student=student,
            defaults={
                "checked_in_by_id": request.user.id if hasattr(request.user, 'id') and not isinstance(request.user.id, str) else None,
                "check_in_method": "manual",
            },
        )

        if not created:
            return Response({
                "message": "تم تسجيل الحضور مسبقاً لهذه الحصة.",
                "already_exists": True
            }, status=status.HTTP_400_BAD_REQUEST)

        from apps.audit.utils import log_action
        log_action(request.user, "checkin", "attendance", str(record.id), request=request)

        return Response({
            "message": f"تم تسجيل حضور {student.full_name} بنجاح.",
            "session_id": session.id,
            "checked_in_at": record.checked_in_at,
        })

    @action(detail=True, methods=["get"])
    def attendance_history(self, request, pk=None):
        """Get student's attendance history."""
        from apps.attendance.models import AttendanceRecord
        student = self.get_object()
        records = AttendanceRecord.objects.filter(student=student).select_related(
            "session__schedule__class_type"
        ).order_by("-checked_in_at")[:50]

        data = [
            {
                "session_id": r.session_id,
                "class_name": r.session.schedule.class_type.name,
                "date": r.session.date,
                "checked_in_at": r.checked_in_at,
                "method": r.check_in_method,
            }
            for r in records
        ]
        return Response(data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Quick stats summary for dashboard."""
        from django.db.models import Count
        qs = self.get_queryset()
        stats = qs.aggregate(
            total=Count("id"),
            active=Count("id", filter=__import__("django.db.models", fromlist=["Q"]).Q(status="active")),
            trials=Count("id", filter=__import__("django.db.models", fromlist=["Q"]).Q(status="trial")),
            leads=Count("id", filter=__import__("django.db.models", fromlist=["Q"]).Q(status="lead")),
        )
        return Response(stats)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated, IsStaff])
    def kiosk_search(self, request):
        """Minimal student search for kiosk mode."""
        search_query = request.query_params.get("search", "")
        if len(search_query) < 2:
            return Response([])

        qs = self.get_queryset().filter(
            status__in=["active", "trial"],
            deleted_at__isnull=True
        )

        from django.db.models import Q
        location_id = request.query_params.get("location_id")
        
        qs = qs.filter(
            Q(first_name__icontains=search_query) |
            Q(last_name__icontains=search_query) |
            Q(phone__icontains=search_query)
        )

        if location_id:
            qs = qs.filter(location_id=location_id)

        qs = qs[:10]

        serializer = KioskStudentSerializer(qs, many=True)
        return Response(serializer.data)


class StudentNoteViewSet(viewsets.ModelViewSet):
    """Student notes CRUD."""
    serializer_class = StudentNoteSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]

    def get_queryset(self):
        student_id = self.kwargs.get("student_pk")
        qs = StudentNote.objects.filter(student_id=student_id)
        if not self.request.user.role in ["platform_admin", "tenant_owner", "manager"]:
            qs = qs.filter(is_private=False)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            student_id=self.kwargs["student_pk"],
            author_id=self.request.user.id,
        )


class StudentDocumentViewSet(viewsets.ModelViewSet):
    """Student documents CRUD."""
    serializer_class = StudentDocumentSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]

    def get_queryset(self):
        return StudentDocument.objects.filter(student_id=self.kwargs.get("student_pk"))

    def perform_create(self, serializer):
        serializer.save(
            student_id=self.kwargs["student_pk"],
            uploaded_by_id=self.request.user.id,
        )
