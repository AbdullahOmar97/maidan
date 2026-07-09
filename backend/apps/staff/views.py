from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db import transaction
from django.shortcuts import get_object_or_404
from decimal import Decimal


from shared.permissions import RoleChoices
from .models import StaffMember, StaffSalaryConfig, PayrollRun, StaffPayslip, StaffDocument
from .serializers import (
    StaffSalaryConfigSerializer,
    PayrollRunSerializer,
    StaffPayslipSerializer,
    StaffDocumentSerializer
)


class CanManagePayrollPermission(permissions.BasePermission):
    """
    Permission check for payroll and salary management.
    Accessible by Platform Admins, Tenant Owners, Managers,
    or users with can_manage_staff/can_view_billing permissions.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role in [RoleChoices.PLATFORM_ADMIN, RoleChoices.TENANT_OWNER, RoleChoices.MANAGER]:
            return True
        user_permissions = getattr(user, "permissions", {}) or {}
        return (
            user_permissions.get("can_manage_staff", False) is True
            or user_permissions.get("can_view_billing", False) is True
        )


class StaffSalaryConfigViewSet(viewsets.ModelViewSet):
    queryset = StaffSalaryConfig.objects.all()
    serializer_class = StaffSalaryConfigSerializer
    permission_classes = [CanManagePayrollPermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["employment_type", "currency"]

    def list(self, request, *args, **kwargs):
        # Auto-ensure all staff members have a salary config
        staff_members = StaffMember.objects.all()
        for member in staff_members:
            StaffSalaryConfig.objects.get_or_create(staff_member=member)
        return super().list(request, *args, **kwargs)


class PayrollRunViewSet(viewsets.ModelViewSet):
    queryset = PayrollRun.objects.all()
    serializer_class = PayrollRunSerializer
    permission_classes = [CanManagePayrollPermission]

    def perform_create(self, serializer):
        with transaction.atomic():
            payroll_run = serializer.save()
            self._generate_payslips_for_run(payroll_run)

    def _generate_payslips_for_run(self, payroll_run):
        from apps.attendance.models import ClassSession

        # Get all staff members
        staff_members = StaffMember.objects.all()
        for member in staff_members:
            # Skip if staff user is inactive
            if not member.user.is_active:
                continue

            # Ensure config exists
            config, _ = StaffSalaryConfig.objects.get_or_create(
                staff_member=member,
                defaults={
                    "employment_type": StaffSalaryConfig.EmploymentType.FULL_TIME,
                    "basic_salary": Decimal("0.00"),
                    "currency": "JOD"
                }
            )

            basic_salary = Decimal("0.00")
            calculated_units = Decimal("0.00")
            unit_rate = Decimal("0.00")

            if config.employment_type == StaffSalaryConfig.EmploymentType.FULL_TIME:
                basic_salary = config.basic_salary
            elif config.employment_type == StaffSalaryConfig.EmploymentType.PART_TIME:
                unit_rate = config.hourly_rate
                # Default units to 0.00, can be filled in manually
                calculated_units = Decimal("0.00")
            elif config.employment_type == StaffSalaryConfig.EmploymentType.SESSION_BASED:
                unit_rate = config.session_rate
                # Scan completed sessions taught by this instructor
                sessions_count = ClassSession.objects.filter(
                    instructor_id=member.user.id,
                    date__year=payroll_run.year,
                    date__month=payroll_run.month,
                    status="completed"
                ).count()
                calculated_units = Decimal(sessions_count)

            # Create or update payslip
            StaffPayslip.objects.update_or_create(
                payroll_run=payroll_run,
                staff_member=member,
                defaults={
                    "employment_type": config.employment_type,
                    "basic_salary": basic_salary,
                    "calculated_units": calculated_units,
                    "unit_rate": unit_rate,
                    "status": StaffPayslip.Status.PENDING,
                }
            )

    @action(detail=True, methods=["post"])
    def recalculate(self, request, pk=None):
        """Recalculate session-based payslips for a draft payroll run."""
        payroll_run = self.get_object()
        if payroll_run.status != PayrollRun.Status.DRAFT:
            return Response(
                {"detail": "يمكن إعادة حساب الرواتب للمسودات فقط."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            self._generate_payslips_for_run(payroll_run)
            
        serializer = self.get_serializer(payroll_run)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve the payroll run."""
        payroll_run = self.get_object()
        if payroll_run.status != PayrollRun.Status.DRAFT:
            return Response(
                {"detail": "يمكن اعتماد الرواتب للمسودات فقط."},
                status=status.HTTP_400_BAD_REQUEST
            )
        payroll_run.status = PayrollRun.Status.APPROVED
        payroll_run.save()
        return Response({"status": "approved", "detail": "تم اعتماد مسير الرواتب بنجاح."})

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        """Mark the payroll run and all its payslips as paid."""
        payroll_run = self.get_object()
        if payroll_run.status not in [PayrollRun.Status.DRAFT, PayrollRun.Status.APPROVED]:
            return Response(
                {"detail": "لا يمكن دفع مسير رواتب مدفوع بالفعل."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            payroll_run.status = PayrollRun.Status.PAID
            payroll_run.save()
            
            # Update all payslips
            payslips = payroll_run.payslips.all()
            for payslip in payslips:
                payslip.status = StaffPayslip.Status.PAID
                if not payslip.payment_date:
                    payslip.payment_date = timezone.now().date()
                payslip.save()

        return Response({"status": "paid", "detail": "تم تسجيل دفع الرواتب لجميع الموظفين بنجاح."})


class StaffPayslipViewSet(viewsets.ModelViewSet):
    queryset = StaffPayslip.objects.all()
    serializer_class = StaffPayslipSerializer
    permission_classes = [CanManagePayrollPermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["payroll_run", "staff_member", "status"]

    def update(self, request, *args, **kwargs):
        payslip = self.get_object()
        if payslip.payroll_run.status == PayrollRun.Status.PAID:
            return Response(
                {"detail": "لا يمكن تعديل قسيمة راتب في مسير رواتب مدفوع."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().update(request, *args, **kwargs)


class StaffDocumentViewSet(viewsets.ModelViewSet):
    queryset = StaffDocument.objects.all()
    serializer_class = StaffDocumentSerializer
    permission_classes = [CanManagePayrollPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["staff_member"]
    search_fields = ["name", "notes"]

    def perform_create(self, serializer):
        # Allow specifying staff_member in request data
        serializer.save()
