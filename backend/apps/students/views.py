"""
MAIDAN — Students App Views
"""

from decimal import Decimal
import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
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
    FamilyDetailSerializer,
    FamilyMemberSerializer,
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
    due_membership = django_filters.BooleanFilter(method="filter_due_membership")
    is_archived = django_filters.BooleanFilter(field_name="is_archived")

    def filter_active_membership(self, queryset, name, value):
        if value:
            return queryset.filter(memberships__status="active").distinct()
        return queryset.exclude(memberships__status="active").distinct()

    def filter_trial_expiring(self, queryset, name, value):
        from django.utils import timezone
        import datetime
        cutoff = timezone.now().date() + datetime.timedelta(days=int(value))
        return queryset.filter(status="trial", trial_end_date__lte=cutoff)

    def filter_due_membership(self, queryset, name, value):
        from django.utils import timezone
        from django.db.models import Q
        import datetime
        today = timezone.now().date()
        cutoff = today + datetime.timedelta(days=7)

        # Invoices overdue or past-due pending (financial dues - old and new)
        has_invoice_due = (
            Q(invoices__status="overdue") |
            (Q(invoices__status__in=["pending", "partially_paid"]) & Q(invoices__due_date__lte=today))
        )

        # Pending memberships awaiting payment or approval
        has_pending_membership = Q(memberships__status__in=["pending", "pending_approval"])

        # Active memberships expiring soon or today (حديث)
        has_expiring_membership = Q(memberships__status="active", memberships__end_date__lte=cutoff)

        # Expired memberships in the past without a future active membership (القديم)
        has_expired_membership = (
            (Q(memberships__status="expired") | Q(memberships__end_date__lt=today)) &
            ~Q(memberships__status="active", memberships__end_date__gt=cutoff)
        )

        due_condition = has_invoice_due | has_pending_membership | has_expiring_membership | has_expired_membership
        if value:
            return queryset.filter(due_condition).distinct()
        return queryset.exclude(due_condition).distinct()

    class Meta:
        model = Student
        fields = ["status", "location", "gender", "due_membership", "is_archived"]


class LocationViewSet(LocationFilterMixin, viewsets.ModelViewSet):
    """CRUD for Sports Club locations/branches."""
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
    """CRUD + member management for family groups."""
    queryset = Family.objects.prefetch_related("members").all()
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "primary_contact_name", "primary_contact_phone", "primary_contact_email"]

    def get_serializer_class(self):
        from .serializers import FamilyDetailSerializer
        if self.action in ["retrieve", "members", "stats"]:
            return FamilyDetailSerializer
        return FamilySerializer

    @action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        """List all students belonging to this family."""
        from .serializers import FamilyMemberSerializer
        family = self.get_object()
        qs = family.members.prefetch_related(
            "belt_history__belt_rank", "memberships__plan"
        ).all()
        serializer = FamilyMemberSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="add_member")
    def add_member(self, request, pk=None):
        """Attach an existing student to this family."""
        family = self.get_object()
        student_id = request.data.get("student_id")
        if not student_id:
            return Response({"error": "يجب إرسال student_id."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            student = Student.objects.get(pk=student_id)
        except Student.DoesNotExist:
            return Response({"error": "الطالب غير موجود."}, status=status.HTTP_404_NOT_FOUND)

        if student.family_id == family.pk:
            return Response({"error": "الطالب مرتبط بهذه العائلة بالفعل."}, status=status.HTTP_400_BAD_REQUEST)

        # Detach from old family if any
        student.family = family
        student.save(update_fields=["family"])
        return Response({"message": f"تم ربط {student.full_name} بعائلة {family.name} بنجاح."})

    @action(detail=True, methods=["post"], url_path="remove_member")
    def remove_member(self, request, pk=None):
        """Detach a student from this family."""
        family = self.get_object()
        student_id = request.data.get("student_id")
        if not student_id:
            return Response({"error": "يجب إرسال student_id."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            student = Student.objects.get(pk=student_id, family=family)
        except Student.DoesNotExist:
            return Response({"error": "الطالب غير موجود في هذه العائلة."}, status=status.HTTP_404_NOT_FOUND)

        student.family = None
        student.save(update_fields=["family"])
        return Response({"message": f"تم فصل {student.full_name} عن عائلة {family.name}."})

    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        """Aggregated financial and attendance stats for the family."""
        family = self.get_object()
        serializer = self.get_serializer(family, context={"request": request})
        return Response(serializer.data.get("stats", {}))


class StudentViewSet(SoftDeleteMixin, AuditMixin, LocationFilterMixin, viewsets.ModelViewSet):
    """
    Full CRUD + custom actions for students.
    Includes search, filter, ordering, pagination.
    """

    queryset = Student.objects.select_related("family", "location").prefetch_related(
        "belt_history__belt_rank", "memberships__plan"
    )
    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "archive", "unarchive"]:
            return [permissions.IsAuthenticated(), CanManageStudents()]
        return [permissions.IsAuthenticated(), IsStaff()]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = StudentFilter
    search_fields = [
        "full_name", "first_name", "last_name",
        "email", "phone", "student_number", "whatsapp",
    ]

    def filter_queryset(self, queryset):
        search_query = self.request.query_params.get("search", "")
        if search_query:
            from django.db.models import Q
            q_obj = (
                Q(full_name__icontains=search_query) |
                Q(first_name__icontains=search_query) |
                Q(last_name__icontains=search_query) |
                Q(phone__icontains=search_query) |
                Q(student_number__icontains=search_query)
            )
            parts = search_query.split()
            if len(parts) >= 2:
                for part in parts:
                    q_obj |= Q(full_name__icontains=part)
            return queryset.filter(q_obj)
        return super().filter_queryset(queryset)
    ordering_fields = ["created_at", "full_name", "first_name", "last_name", "status"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return StudentListSerializer
        return StudentDetailSerializer

    def destroy(self, request, *args, **kwargs):
        """Student deletion is strictly prohibited in the system to protect financial & academic history."""
        return Response(
            {
                "detail": "حذف الطلاب غير متاح في النظام لضمان سلامة السجلات المالية والتدريبية. يرجى استخدام ميزة الأرشفة بدلاً من ذلك.",
                "code": "deletion_not_allowed",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    def get_queryset(self):
        qs = super().get_queryset().filter(deleted_at__isnull=True)
        archived_param = self.request.query_params.get("is_archived")
        if archived_param is not None:
            if str(archived_param).lower() in ["true", "1"]:
                qs = qs.filter(is_archived=True)
            elif str(archived_param).lower() in ["false", "0"]:
                qs = qs.filter(is_archived=False)
        elif self.action == "list":
            qs = qs.filter(is_archived=False)
        return self.get_location_filtered_queryset(qs)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, CanCheckIn])
    def quick_checkin(self, request, pk=None):
        """One-tap check-in for a student to today's appropriate session."""
        student = self.get_object()
        if student.is_archived:
            return Response(
                {"error": "لا يمكن تسجيل حضور طالب مؤرشف. يرجى استعادة الملف أولاً."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
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
        if student.is_archived:
            return Response(
                {"error": "لا يمكن تسجيل حضور طالب مؤرشف. يرجى استعادة الملف أولاً."},
                status=status.HTTP_400_BAD_REQUEST,
            )
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
        """Quick stats summary for dashboard and student list with filter support."""
        from django.db.models import Count, Q
        from django.utils import timezone
        import datetime

        base_qs = self.get_queryset()
        filter_params = request.query_params.copy()
        filter_params.pop("status", None)
        if hasattr(self, "filterset_class") and self.filterset_class:
            qs = self.filterset_class(filter_params, queryset=base_qs, request=request).qs
        else:
            qs = base_qs

        today = timezone.now().date()
        cutoff = today + datetime.timedelta(days=7)

        has_invoice_due = (
            Q(invoices__status="overdue") |
            (Q(invoices__status__in=["pending", "partially_paid"]) & Q(invoices__due_date__lte=today))
        )
        has_pending_membership = Q(memberships__status__in=["pending", "pending_approval"])
        has_expiring_membership = Q(memberships__status="active", memberships__end_date__lte=cutoff)
        has_expired_membership = (
            (Q(memberships__status="expired") | Q(memberships__end_date__lt=today)) &
            ~Q(memberships__status="active", memberships__end_date__gt=cutoff)
        )
        due_condition = has_invoice_due | has_pending_membership | has_expiring_membership | has_expired_membership

        stats = qs.aggregate(
            total=Count("id", distinct=True),
            active=Count("id", filter=Q(status="active"), distinct=True),
            trials=Count("id", filter=Q(status="trial"), distinct=True),
            leads=Count("id", filter=Q(status="lead"), distinct=True),
            due=Count("id", filter=due_condition, distinct=True),
        )
        # Compute archived students count for the branch/tenant
        all_students_qs = Student.objects.filter(deleted_at__isnull=True)
        if hasattr(self, "get_location_filtered_queryset"):
            all_students_qs = self.get_location_filtered_queryset(all_students_qs)
        stats["archived"] = all_students_qs.filter(is_archived=True).count()
        return Response(stats)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated, IsStaff])
    def kiosk_search(self, request):
        """Minimal student search for kiosk mode."""
        search_query = request.query_params.get("search", "")
        if len(search_query) < 2:
            return Response([])

        qs = self.get_queryset().filter(
            status__in=["active", "trial"],
            deleted_at__isnull=True,
            is_archived=False,
        )

        from django.db.models import Q
        location_id = request.query_params.get("location_id")
        
        qs = qs.filter(
            Q(full_name__icontains=search_query) |
            Q(first_name__icontains=search_query) |
            Q(last_name__icontains=search_query) |
            Q(phone__icontains=search_query)
        )

        if location_id:
            qs = qs.filter(location_id=location_id)

        qs = qs[:10]

        serializer = KioskStudentSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], permission_classes=[permissions.IsAuthenticated, IsStaff])
    def archive_precheck(self, request, pk=None):
        """
        Pre-flight audit before archiving a student.
        Gathers outstanding invoices, positive wallet credit, active memberships, and pending exams.
        """
        student = self.get_object()

        # 1. Unpaid or partially paid invoices
        unpaid_invoices_qs = student.invoices.filter(
            status__in=["pending", "overdue", "partially_paid"],
            is_archived=False,
        ).order_by("due_date")

        invoices_data = []
        total_due = Decimal("0.00")
        for inv in unpaid_invoices_qs:
            due_amount = inv.total_amount - inv.amount_paid
            if due_amount > Decimal("0.00"):
                total_due += due_amount
                invoices_data.append({
                    "id": inv.id,
                    "invoice_number": inv.invoice_number,
                    "status": inv.status,
                    "due_date": inv.due_date,
                    "total_amount": float(inv.total_amount),
                    "amount_paid": float(inv.amount_paid),
                    "due_amount": float(due_amount),
                    "currency": inv.currency,
                })

        # 2. Active memberships
        active_memberships = []
        for m in student.memberships.filter(status__in=["active", "paused", "pending", "pending_approval"]):
            active_memberships.append({
                "id": m.id,
                "plan_name": m.plan.name if m.plan else "اشتراك مخصص",
                "status": m.status,
                "start_date": m.start_date,
                "end_date": m.end_date,
            })

        # 3. Pending belt exam candidacies
        pending_exams_count = student.exam_candidacies.filter(status="pending").count()

        # 4. User portal account
        has_user_account = bool(student.user_account_id)

        return Response({
            "student_id": student.id,
            "student_name": student.full_name,
            "is_archived": student.is_archived,
            "total_due": float(total_due),
            "account_credit": float(student.account_credit),
            "outstanding_invoices": invoices_data,
            "active_memberships": active_memberships,
            "pending_exams_count": pending_exams_count,
            "has_user_account": has_user_account,
            "can_archive_cleanly": total_due <= Decimal("0.00"),
        })

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, CanManageStudents])
    def archive(self, request, pk=None):
        """
        Archive student profile.
        Terminates active memberships, deactivates user portal login, and enforces dues protocol.
        """
        student = self.get_object()
        if student.is_archived:
            return Response(
                {"detail": "هذا الطالب مؤرشف بالفعل في النظام."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = request.data.get("reason", "").strip()
        force_with_debt = bool(request.data.get("force_with_debt", False))

        # Check outstanding dues
        unpaid_invoices_qs = student.invoices.filter(
            status__in=["pending", "overdue", "partially_paid"],
            is_archived=False,
        )
        total_due = Decimal("0.00")
        for inv in unpaid_invoices_qs:
            diff = inv.total_amount - inv.amount_paid
            if diff > Decimal("0.00"):
                total_due += diff

        if total_due > Decimal("0.00") and not force_with_debt:
            return Response(
                {
                    "detail": f"لا يمكن أرشفة الطالب لوجود مستحقات مالية غير مسددة بقيمة {total_due} د.أ. يرجى تسديد الفواتير أولاً أو تفعيل خيار إحالة المديونية للتحصيل.",
                    "total_due": float(total_due),
                    "code": "outstanding_dues_required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.db import transaction
        with transaction.atomic():
            now = timezone.now()

            # 1. Update Student record
            student.is_archived = True
            student.archived_at = now
            student.archive_reason = reason
            user_id = request.user.id
            if user_id:
                try:
                    import uuid
                    if isinstance(user_id, uuid.UUID):
                        student.archived_by_id = user_id
                    elif isinstance(user_id, str):
                        student.archived_by_id = uuid.UUID(user_id)
                except Exception:
                    pass

            student.status = Student.Status.INACTIVE
            student.save(update_fields=["is_archived", "archived_at", "archive_reason", "archived_by_id", "status", "updated_at"])

            # 2. Terminate active/paused memberships
            for m in student.memberships.filter(status__in=["active", "paused", "pending", "pending_approval"]):
                m.status = "cancelled"
                cancellation_note = f"\nتم إلغاء الاشتراك تلقائياً بسبب أرشفة الطالب بتاريخ {now.strftime('%Y-%m-%d %H:%M')}"
                m.notes = (m.notes or "") + cancellation_note
                m.save(update_fields=["status", "notes"])

            # 3. Cancel pending exam candidacies
            student.exam_candidacies.filter(status="pending").delete()

            # 4. Deactivate linked User Account
            if student.user_account:
                student.user_account.is_active = False
                student.user_account.save(update_fields=["is_active"])

            # 5. Create audit StudentNote
            staff_name = request.user.get_full_name() or getattr(request.user, "username", "النظام")
            note_content = f"تمت أرشفة ملف الطالب بواسطة {staff_name}."
            if reason:
                note_content += f"\nسبب الأرشفة: {reason}"
            if total_due > Decimal("0.00"):
                note_content += f"\nتنبيه مالي: تم إقرار الأرشفة مع تعليق مديونية غير مسددة بقيمة {total_due} د.أ وإحالتها للمتابعة والتحصيل."

            import uuid
            author_id = user_id if isinstance(user_id, uuid.UUID) else uuid.uuid4()
            try:
                StudentNote.objects.create(
                    student=student,
                    author_id=author_id,
                    note_type=StudentNote.NoteType.BILLING if total_due > Decimal("0.00") else StudentNote.NoteType.GENERAL,
                    content=note_content,
                    is_private=True,
                )
            except Exception:
                pass

        serializer = self.get_serializer(student)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, CanManageStudents])
    def unarchive(self, request, pk=None):
        """Restore an archived student back to active database."""
        student = self.get_object()
        if not student.is_archived:
            return Response(
                {"detail": "هذا الطالب غير مؤرشف في النظام."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.db import transaction
        with transaction.atomic():
            now = timezone.now()
            student.is_archived = False
            student.archived_at = None
            student.archived_by_id = None
            student.archive_reason = ""
            student.status = Student.Status.INACTIVE
            student.save(update_fields=["is_archived", "archived_at", "archived_by_id", "archive_reason", "status", "updated_at"])

            # Reactivate linked user account if exists
            if student.user_account:
                student.user_account.is_active = True
                student.user_account.save(update_fields=["is_active"])

            # Audit note
            staff_name = request.user.get_full_name() or getattr(request.user, "username", "النظام")
            user_id = request.user.id
            import uuid
            author_id = user_id if isinstance(user_id, uuid.UUID) else uuid.uuid4()
            try:
                StudentNote.objects.create(
                    student=student,
                    author_id=author_id,
                    note_type=StudentNote.NoteType.GENERAL,
                    content=f"تم إلغاء أرشفة ملف الطالب واستعادته بواسطة {staff_name} بتاريخ {now.strftime('%Y-%m-%d %H:%M')}.",
                    is_private=True,
                )
            except Exception:
                pass

        serializer = self.get_serializer(student)
        return Response(serializer.data)


class StudentNoteViewSet(viewsets.ModelViewSet):
    """Student notes CRUD."""
    serializer_class = StudentNoteSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    pagination_class = None

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
    pagination_class = None

    def get_queryset(self):
        return StudentDocument.objects.filter(student_id=self.kwargs.get("student_pk"))

    def perform_create(self, serializer):
        serializer.save(
            student_id=self.kwargs["student_pk"],
            uploaded_by_id=self.request.user.id,
        )
