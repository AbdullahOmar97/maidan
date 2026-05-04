"""
MAIDAN — Reporting App Views

Analytics endpoints for dashboard KPIs, retention, attendance, revenue.
"""

from datetime import timedelta

from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncMonth, TruncWeek
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from shared.permissions import CanViewReports
from apps.students.models import Student
from apps.attendance.models import AttendanceRecord, ClassSession
from apps.billing.models import Invoice, Membership


class DashboardKPIView(APIView):
    """Main dashboard KPIs — single endpoint for the dashboard overview."""

    permission_classes = [permissions.IsAuthenticated, CanViewReports]

    def get(self, request):
        today = timezone.now().date()
        start_of_month = today.replace(day=1)
        last_month_start = (start_of_month - timedelta(days=1)).replace(day=1)
        last_month_end = start_of_month - timedelta(days=1)

        # Student counts
        students = Student.objects.filter(deleted_at__isnull=True)
        active_students = students.filter(status="active").count()
        trial_students = students.filter(status="trial").count()
        new_this_month = students.filter(created_at__gte=start_of_month).count()

        # Revenue
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

        # Attendance today
        attendance_today = AttendanceRecord.objects.filter(
            session__date=today,
        ).count()

        # Active sessions today
        active_sessions = ClassSession.objects.filter(
            date=today,
            status__in=["scheduled", "in_progress"],
        ).count()

        # Belt promotions this month
        from apps.belts.models import StudentBelt
        promotions_this_month = StudentBelt.objects.filter(
            promoted_at__gte=start_of_month,
        ).count()

        # Revenue change %
        revenue_change = 0
        if revenue_last_month > 0:
            revenue_change = ((revenue_this_month - revenue_last_month) / revenue_last_month) * 100

        return Response({
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
                "currency": "SAR",
            },
            "attendance": {
                "today": attendance_today,
                "active_sessions": active_sessions,
            },
            "promotions": {
                "this_month": promotions_this_month,
            },
        })


class RevenueChartView(APIView):
    """Monthly revenue chart data for the last 12 months."""

    permission_classes = [permissions.IsAuthenticated, CanViewReports]

    def get(self, request):
        months = int(request.query_params.get("months", 12))
        start_date = timezone.now() - timedelta(days=30 * months)

        data = (
            Invoice.objects.filter(status="paid", paid_at__gte=start_date)
            .annotate(month=TruncMonth("paid_at"))
            .values("month")
            .annotate(total=Sum("total_amount"), count=Count("id"))
            .order_by("month")
        )

        return Response([
            {
                "month": item["month"].strftime("%Y-%m"),
                "revenue": float(item["total"]),
                "invoices": item["count"],
            }
            for item in data
        ])


class AttendanceAnalyticsView(APIView):
    """Attendance trends — weekly/monthly."""

    permission_classes = [permissions.IsAuthenticated, CanViewReports]

    def get(self, request):
        period = request.query_params.get("period", "monthly")
        weeks = int(request.query_params.get("weeks", 12))
        start_date = timezone.now() - timedelta(weeks=weeks)

        if period == "weekly":
            data = (
                AttendanceRecord.objects.filter(checked_in_at__gte=start_date)
                .annotate(week=TruncWeek("checked_in_at"))
                .values("week")
                .annotate(count=Count("id"))
                .order_by("week")
            )
            return Response([
                {"week": item["week"].strftime("%Y-%W"), "count": item["count"]}
                for item in data
            ])
        else:
            data = (
                AttendanceRecord.objects.filter(checked_in_at__gte=start_date)
                .annotate(month=TruncMonth("checked_in_at"))
                .values("month")
                .annotate(count=Count("id"))
                .order_by("month")
            )
            return Response([
                {"month": item["month"].strftime("%Y-%m"), "count": item["count"]}
                for item in data
            ])


class RetentionReportView(APIView):
    """Student retention analysis."""

    permission_classes = [permissions.IsAuthenticated, CanViewReports]

    def get(self, request):
        today = timezone.now().date()
        students = Student.objects.filter(deleted_at__isnull=True)

        total = students.count()
        active = students.filter(status="active").count()
        inactive = students.filter(status="inactive").count()
        churned_30d = students.filter(
            status="inactive",
            updated_at__gte=timezone.now() - timedelta(days=30),
        ).count()

        # Trial conversion rate
        total_trials = students.filter(status__in=["trial", "active", "inactive"]).count()
        converted = students.filter(
            status="active",
            memberships__start_date__isnull=False,
        ).distinct().count()
        conversion_rate = (converted / total_trials * 100) if total_trials > 0 else 0

        # Memberships expiring in 30 days
        expiring_soon = Membership.objects.filter(
            status="active",
            end_date__lte=today + timedelta(days=30),
            end_date__gte=today,
        ).count()

        return Response({
            "total_students": total,
            "active": active,
            "inactive": inactive,
            "churned_last_30d": churned_30d,
            "retention_rate": round((active / total * 100) if total > 0 else 0, 1),
            "trial_conversion_rate": round(conversion_rate, 1),
            "memberships_expiring_30d": expiring_soon,
        })


class BeltDistributionView(APIView):
    """Belt/rank distribution across all active students."""

    permission_classes = [permissions.IsAuthenticated, CanViewReports]

    def get(self, request):
        from apps.belts.models import StudentBelt
        distribution = (
            StudentBelt.objects.filter(is_current=True)
            .values("belt_rank__name", "belt_rank__color_hex", "belt_rank__martial_art")
            .annotate(count=Count("id"))
            .order_by("belt_rank__order_index")
        )
        return Response([
            {
                "belt_name": item["belt_rank__name"],
                "color": item["belt_rank__color_hex"],
                "martial_art": item["belt_rank__martial_art"],
                "count": item["count"],
            }
            for item in distribution
        ])
