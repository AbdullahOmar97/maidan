from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db import models, transaction
from django.shortcuts import get_object_or_404
from decimal import Decimal


from shared.permissions import RoleChoices
from .models import (
    StaffMember, StaffSalaryConfig, PayrollRun, StaffPayslip, StaffDocument,
    StaffAdvance, StaffAdvanceRepayment
)
from .serializers import (
    StaffSalaryConfigSerializer,
    PayrollRunSerializer,
    StaffPayslipSerializer,
    StaffDocumentSerializer,
    StaffAdvanceSerializer,
    StaffAdvanceRepaymentSerializer
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

            # Calculate due advance deductions
            advance_deductions = Decimal("0.00")
            active_advances = StaffAdvance.objects.filter(
                staff_member=member,
                status=StaffAdvance.Status.DISBURSED,
                remaining_amount__gt=Decimal("0.00"),
            )
            for adv in active_advances:
                due = min(adv.monthly_installment, adv.remaining_amount)
                advance_deductions += due

            # Create or update payslip
            StaffPayslip.objects.update_or_create(
                payroll_run=payroll_run,
                staff_member=member,
                defaults={
                    "employment_type": config.employment_type,
                    "basic_salary": basic_salary,
                    "calculated_units": calculated_units,
                    "unit_rate": unit_rate,
                    "advance_deductions": advance_deductions,
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
        """Mark the payroll run and all its payslips as paid, settling advance deductions."""
        payroll_run = self.get_object()
        if payroll_run.status not in [PayrollRun.Status.DRAFT, PayrollRun.Status.APPROVED]:
            return Response(
                {"detail": "لا يمكن دفع مسير رواتب مدفوع بالفعل."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            payroll_run.status = PayrollRun.Status.PAID
            payroll_run.save()
            
            # Update all payslips and record advance repayments
            payslips = payroll_run.payslips.all()
            for payslip in payslips:
                payslip.status = StaffPayslip.Status.PAID
                if not payslip.payment_date:
                    payslip.payment_date = timezone.now().date()
                payslip.save()

                if payslip.advance_deductions > Decimal("0.00"):
                    remaining_to_deduct = payslip.advance_deductions
                    active_advances = StaffAdvance.objects.filter(
                        staff_member=payslip.staff_member,
                        status=StaffAdvance.Status.DISBURSED,
                        remaining_amount__gt=Decimal("0.00"),
                    ).order_by("request_date")
                    for adv in active_advances:
                        if remaining_to_deduct <= Decimal("0.00"):
                            break
                        repay_amount = min(remaining_to_deduct, min(adv.monthly_installment, adv.remaining_amount))
                        if repay_amount > Decimal("0.00"):
                            StaffAdvanceRepayment.objects.create(
                                advance=adv,
                                payslip=payslip,
                                amount=repay_amount,
                                repayment_date=payslip.payment_date,
                                repayment_method=StaffAdvanceRepayment.RepaymentMethod.PAYROLL_DEDUCTION,
                                notes=f"استقطاع من مسير رواتب {payroll_run.year}/{payroll_run.month:02d}",
                                recorded_by_id=request.user.id,
                            )
                            remaining_to_deduct -= repay_amount

        return Response({"status": "paid", "detail": "تم تسجيل دفع الرواتب واستقطاع السلف بنجاح."})


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


class StaffAdvanceFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(field_name="status")
    staff_member = django_filters.NumberFilter(field_name="staff_member_id")
    repayment_type = django_filters.CharFilter(field_name="repayment_type")
    date_from = django_filters.DateFilter(field_name="request_date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="request_date", lookup_expr="lte")
    period = django_filters.CharFilter(method="filter_period")

    def filter_period(self, queryset, name, value):
        from apps.billing.views import parse_period_dates
        start, end = parse_period_dates(value)
        if start:
            queryset = queryset.filter(request_date__gte=start)
        if end:
            queryset = queryset.filter(request_date__lte=end)
        return queryset


class StaffAdvanceViewSet(viewsets.ModelViewSet):
    queryset = StaffAdvance.objects.select_related("staff_member__user").prefetch_related("repayments").all()
    serializer_class = StaffAdvanceSerializer
    permission_classes = [CanManagePayrollPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = StaffAdvanceFilter
    search_fields = ["staff_member__user__first_name", "staff_member__user__last_name", "reason", "notes"]
    ordering = ["-created_at"]

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve a pending salary advance."""
        advance = self.get_object()
        if advance.status != StaffAdvance.Status.PENDING:
            return Response(
                {"error": "يمكن اعتماد السلف التي في حالة قيد الانتظار فقط."},
                status=status.HTTP_400_BAD_REQUEST
            )
        advance.status = StaffAdvance.Status.APPROVED
        advance.approved_by_id = request.user.id
        advance.approved_at = timezone.now()
        notes = request.data.get("notes", "")
        if notes:
            advance.notes = ((advance.notes or "") + f"\n{notes}").strip()
        advance.save()
        return Response(self.get_serializer(advance).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Reject a pending salary advance."""
        advance = self.get_object()
        if advance.status != StaffAdvance.Status.PENDING:
            return Response(
                {"error": "يمكن رفض السلف التي في حالة قيد الانتظار فقط."},
                status=status.HTTP_400_BAD_REQUEST
            )
        advance.status = StaffAdvance.Status.REJECTED
        advance.rejection_reason = request.data.get("reason", "")
        advance.save()
        return Response(self.get_serializer(advance).data)

    @action(detail=True, methods=["post"])
    def disburse(self, request, pk=None):
        """Disburse funds for an approved salary advance."""
        advance = self.get_object()
        if advance.status != StaffAdvance.Status.APPROVED:
            return Response(
                {"error": "يمكن صرف السلف المعتمدة فقط."},
                status=status.HTTP_400_BAD_REQUEST
            )
        advance.status = StaffAdvance.Status.DISBURSED
        advance.disbursement_date = timezone.now().date()
        disbursement_note = request.data.get("note", "")
        if disbursement_note:
            advance.notes = ((advance.notes or "") + f"\n[تم الصرف: {disbursement_note}]").strip()
        advance.save()
        return Response(self.get_serializer(advance).data)

    @action(detail=True, methods=["post"])
    def record_repayment(self, request, pk=None):
        """Record a manual direct repayment (e.g. cash returned by employee)."""
        advance = self.get_object()
        if advance.status not in [StaffAdvance.Status.DISBURSED, StaffAdvance.Status.APPROVED]:
            return Response(
                {"error": "يمكن تسجيل سداد لسلفة مصروفة أو معتمدة فقط."},
                status=status.HTTP_400_BAD_REQUEST
            )
        amount_val = request.data.get("amount")
        if not amount_val:
            return Response({"error": "يرجى تحديد مبلغ السداد."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            amount = Decimal(str(amount_val))
            if amount <= Decimal("0.00"):
                raise ValueError()
        except (ValueError, TypeError):
            return Response({"error": "مبلغ السداد يجب أن يكون رقماً موجباً."}, status=status.HTTP_400_BAD_REQUEST)

        if amount > advance.remaining_amount:
            return Response(
                {"error": f"المبلغ المدخل ({amount}) أكبر من المبلغ المتبقي للسداد ({advance.remaining_amount})."},
                status=status.HTTP_400_BAD_REQUEST
            )

        method = request.data.get("repayment_method", StaffAdvanceRepayment.RepaymentMethod.CASH)
        notes = request.data.get("notes", "")

        repayment = StaffAdvanceRepayment.objects.create(
            advance=advance,
            amount=amount,
            repayment_date=timezone.now().date(),
            repayment_method=method,
            notes=notes,
            recorded_by_id=request.user.id,
        )
        advance.refresh_from_db()
        return Response({
            "message": "تم تسجيل السداد بنجاح.",
            "advance": self.get_serializer(advance).data,
            "repayment": StaffAdvanceRepaymentSerializer(repayment).data
        })

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Summary KPI statistics for staff advances with period and contextual filtering."""
        from apps.billing.views import parse_period_dates
        period = request.query_params.get("period", "this_month")
        start_param = request.query_params.get("start_date") or request.query_params.get("date_from")
        end_param = request.query_params.get("end_date") or request.query_params.get("date_to")
        resolved_start, resolved_end = parse_period_dates(period, start_param, end_param)

        qs = self.get_queryset()
        repayments_qs = StaffAdvanceRepayment.objects.all()

        if resolved_start:
            qs = qs.filter(request_date__gte=resolved_start)
            repayments_qs = repayments_qs.filter(repayment_date__gte=resolved_start)
        if resolved_end:
            qs = qs.filter(request_date__lte=resolved_end)
            repayments_qs = repayments_qs.filter(repayment_date__lte=resolved_end)

        active_advances_qs = StaffAdvance.objects.filter(
            status=StaffAdvance.Status.DISBURSED,
            remaining_amount__gt=Decimal("0.00")
        )
        total_remaining = active_advances_qs.aggregate(s=models.Sum("remaining_amount"))["s"] or Decimal("0.00")
        total_disbursed_period = qs.filter(status__in=[StaffAdvance.Status.DISBURSED, StaffAdvance.Status.REPAID]).aggregate(s=models.Sum("amount"))["s"] or Decimal("0.00")
        total_repaid_period = repayments_qs.aggregate(s=models.Sum("amount"))["s"] or Decimal("0.00")
        pending_count = StaffAdvance.objects.filter(status=StaffAdvance.Status.PENDING).count()
        active_count = active_advances_qs.count()

        tenant = getattr(request, "tenant", None)
        currency = tenant.default_currency if tenant else "JOD"

        return Response({
            "total_active_advances": float(total_remaining),
            "total_disbursed_in_period": float(total_disbursed_period),
            "total_repaid_in_period": float(total_repaid_period),
            "pending_count": pending_count,
            "active_count": active_count,
            "currency": currency,
            "period": period,
            "start_date": str(resolved_start) if resolved_start else None,
            "end_date": str(resolved_end) if resolved_end else None,
        })

