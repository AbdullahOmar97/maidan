"""MAIDAN — Reporting URLs"""
from django.urls import path
from . import views

urlpatterns = [
    path("dashboard/", views.DashboardKPIView.as_view(), name="dashboard-kpi"),
    path("revenue/", views.RevenueChartView.as_view(), name="revenue-chart"),
    path("attendance/", views.AttendanceAnalyticsView.as_view(), name="attendance-analytics"),
    path("retention/", views.RetentionReportView.as_view(), name="retention-report"),
    path("belts/", views.BeltDistributionView.as_view(), name="belt-distribution"),
]
