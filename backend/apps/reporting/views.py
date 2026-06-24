"""
MAIDAN — Reporting App Views

Analytics endpoints for dashboard KPIs, retention, attendance, revenue.
"""

from datetime import timedelta

from django.core.cache import cache
from django.db import connection
from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth, TruncWeek
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from shared.permissions import CanViewReports
from apps.students.models import Student
from apps.attendance.models import AttendanceRecord, ClassSession
from apps.billing.models import Invoice, Membership

TTL_DASHBOARD_KPI = 120
TTL_REVENUE_CHART = 300
TTL_ATTENDANCE_ANALYTICS = 300
TTL_RETENTION = 180
TTL_BELT_DISTRIBUTION = 300


def _rpt_cache_key(*parts: str) -> str:
    schema = getattr(connection, "schema_name", None) or "public"
    return "maidan:rpt:" + ":".join([schema] + list(parts))


def _compute_dashboard_kpi(tenant=None):
    today = timezone.now().date()
    start_of_month = today.replace(day=1)
    last_month_start = (start_of_month - timedelta(days=1)).replace(day=1)
    last_month_end = start_of_month - timedelta(days=1)

    students = Student.objects.filter(deleted_at__isnull=True)
    active_students = students.filter(status="active").count()
    trial_students = students.filter(status="trial").count()
    new_this_month = students.filter(created_at__gte=start_of_month).count()

    invoices = Invoice.objects.all()
    revenue_this_month = invoices.filter(
        status="paid",
        paid_at__gte=start_of_month,
    ).aggregate(total=Sum("total_amount"))["total"] or 0

    revenue_last_month = invoices.filter(
        status="paid",
        paid_at__date__gte=last_month_start,
        paid_at__date__lte=last_month_end,
    ).aggregate(total=Sum("total_amount"))["total"] or 0

    overdue_amount = invoices.filter(
        status__in=["overdue", "pending"],
        due_date__lt=today,
    ).aggregate(total=Sum("total_amount"))["total"] or 0

    attendance_today = AttendanceRecord.objects.filter(
        session__date=today,
    ).count()

    active_sessions = ClassSession.objects.filter(
        date=today,
        status__in=["scheduled", "in_progress"],
    ).count()

    from apps.belts.models import StudentBelt

    promotions_this_month = StudentBelt.objects.filter(
        promoted_at__gte=start_of_month,
    ).count()

    revenue_change = 0
    if revenue_last_month > 0:
        revenue_change = ((revenue_this_month - revenue_last_month) / revenue_last_month) * 100

    return {
        "students": {
            "active": active_students,
            "trial": trial_students,
            "new_this_month": new_this_month,
        },
        "revenue": {
            "this_month": float(revenue_this_month),
            "last_month": float(revenue_last_month),
            "change_pct": round(float(revenue_change), 1),
            "overdue": float(overdue_amount),
            "currency": tenant.default_currency if tenant else "JOD",
        },
        "attendance": {
            "today": attendance_today,
            "active_sessions": active_sessions,
        },
        "promotions": {
            "this_month": promotions_this_month,
        },
    }


class DashboardKPIView(APIView):
    """Main dashboard KPIs — single endpoint for the dashboard overview."""

    permission_classes = [permissions.IsAuthenticated, CanViewReports]

    def get(self, request):
        cache_key = _rpt_cache_key("dashboard_kpi", timezone.now().date().isoformat())
        data = cache.get(cache_key)
        if data is None:
            data = _compute_dashboard_kpi(tenant=request.tenant)
            cache.set(cache_key, data, TTL_DASHBOARD_KPI)
        return Response(data)


def _compute_revenue_chart(months: int):
    start_date = timezone.now() - timedelta(days=30 * months)
    data = (
        Invoice.objects.filter(status="paid", paid_at__gte=start_date)
        .annotate(month=TruncMonth("paid_at"))
        .values("month")
        .annotate(total=Sum("total_amount"), count=Count("id"))
        .order_by("month")
    )
    return [
        {
            "month": item["month"].strftime("%Y-%m"),
            "revenue": float(item["total"]),
            "invoices": item["count"],
        }
        for item in data
    ]


class RevenueChartView(APIView):
    """Monthly revenue chart data for the last N months."""

    permission_classes = [permissions.IsAuthenticated, CanViewReports]

    def get(self, request):
        months = int(request.query_params.get("months", 12))
        cache_key = _rpt_cache_key("revenue_chart", str(months))
        data = cache.get(cache_key)
        if data is None:
            data = _compute_revenue_chart(months)
            cache.set(cache_key, data, TTL_REVENUE_CHART)
        return Response(data)


def _compute_attendance_analytics(period: str, weeks: int):
    start_date = timezone.now() - timedelta(weeks=weeks)

    if period == "weekly":
        data = (
            AttendanceRecord.objects.filter(checked_in_at__gte=start_date)
            .annotate(week=TruncWeek("checked_in_at"))
            .values("week")
            .annotate(count=Count("id"))
            .order_by("week")
        )
        return [
            {"week": item["week"].strftime("%Y-%W"), "count": item["count"]}
            for item in data
        ]

    data = (
        AttendanceRecord.objects.filter(checked_in_at__gte=start_date)
        .annotate(month=TruncMonth("checked_in_at"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )
    return [
        {"month": item["month"].strftime("%Y-%m"), "count": item["count"]}
        for item in data
    ]


class AttendanceAnalyticsView(APIView):
    """Attendance trends — weekly/monthly."""

    permission_classes = [permissions.IsAuthenticated, CanViewReports]

    def get(self, request):
        period = request.query_params.get("period", "monthly")
        weeks = int(request.query_params.get("weeks", 12))
        cache_key = _rpt_cache_key("attendance", period, str(weeks))
        data = cache.get(cache_key)
        if data is None:
            data = _compute_attendance_analytics(period, weeks)
            cache.set(cache_key, data, TTL_ATTENDANCE_ANALYTICS)
        return Response(data)


def _compute_retention_report():
    today = timezone.now().date()
    students = Student.objects.filter(deleted_at__isnull=True)

    total = students.count()
    active = students.filter(status="active").count()
    inactive = students.filter(status="inactive").count()
    churned_30d = students.filter(
        status="inactive",
        updated_at__gte=timezone.now() - timedelta(days=30),
    ).count()

    total_trials = students.filter(status__in=["trial", "active", "inactive"]).count()
    converted = students.filter(
        status="active",
        memberships__start_date__isnull=False,
    ).distinct().count()
    conversion_rate = (converted / total_trials * 100) if total_trials > 0 else 0

    expiring_soon = Membership.objects.filter(
        status="active",
        end_date__lte=today + timedelta(days=30),
        end_date__gte=today,
    ).count()

    return {
        "total_students": total,
        "active": active,
        "inactive": inactive,
        "churned_last_30d": churned_30d,
        "retention_rate": round((active / total * 100) if total > 0 else 0, 1),
        "trial_conversion_rate": round(conversion_rate, 1),
        "memberships_expiring_30d": expiring_soon,
    }


class RetentionReportView(APIView):
    """Student retention analysis."""

    permission_classes = [permissions.IsAuthenticated, CanViewReports]

    def get(self, request):
        cache_key = _rpt_cache_key("retention", timezone.now().date().isoformat())
        data = cache.get(cache_key)
        if data is None:
            data = _compute_retention_report()
            cache.set(cache_key, data, TTL_RETENTION)
        return Response(data)


def _compute_belt_distribution():
    from apps.belts.models import StudentBelt

    distribution = (
        StudentBelt.objects.filter(is_current=True)
        .values("belt_rank__name", "belt_rank__color_hex", "belt_rank__martial_art")
        .annotate(count=Count("id"))
        .order_by("belt_rank__order_index")
    )
    return [
        {
            "belt_name": item["belt_rank__name"],
            "color": item["belt_rank__color_hex"],
            "martial_art": item["belt_rank__martial_art"],
            "count": item["count"],
        }
        for item in distribution
    ]


class BeltDistributionView(APIView):
    """Belt/rank distribution across all active students."""

    permission_classes = [permissions.IsAuthenticated, CanViewReports]

    def get(self, request):
        cache_key = _rpt_cache_key("belt_distribution")
        data = cache.get(cache_key)
        if data is None:
            data = _compute_belt_distribution()
            cache.set(cache_key, data, TTL_BELT_DISTRIBUTION)
        return Response(data)
