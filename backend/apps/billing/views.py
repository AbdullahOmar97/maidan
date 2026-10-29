"""
MAIDAN — Billing App Views + Serializers + URLs
"""

import calendar
from datetime import datetime, date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import filters, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
import django_filters
from django_filters.rest_framework import DjangoFilterBackend

from shared.permissions import (
    CanManageBilling, IsStaff,
    CanCreateInvoice, CanRenewSubscription,
    CanChangeSubscription, CanApproveSubscription,
    CanVoidInvoice, CanApplyDiscount, CanMarkInvoicePaid,
    BranchScopedMixin,
)
from .models import Invoice, Membership, MembershipPlan, ExpenseCategory, Expense, CreditNote
from apps.payments.models import Payment, get_payment_provider
from apps.students.models import Student


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------

class MembershipPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = MembershipPlan
        fields = [
            "id", "name", "description", "billing_cycle",
            "price", "currency", "setup_fee", "tax_rate",
            "max_classes_per_week", "is_unlimited", "is_active", "is_public",
            "sort_order", "created_at",
        ]
        read_only_fields = ["id", "created_at"]
        extra_kwargs = {
            "description": {"required": False},
            "setup_fee": {"required": False},
            "tax_rate": {"required": False},
            "max_classes_per_week": {"required": False},
            "is_unlimited": {"required": False},
            "is_active": {"required": False},
            "is_public": {"required": False},
            "sort_order": {"required": False},
        }


class MembershipSerializer(serializers.ModelSerializer):
    plan_name = serializers.ReadOnlyField(source="plan.name")
    student_name = serializers.SerializerMethodField()
    price = serializers.ReadOnlyField(source="plan.price")
    currency = serializers.ReadOnlyField(source="plan.currency")
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=Student.objects.all(), source="student"
    )
    plan_id = serializers.PrimaryKeyRelatedField(
        queryset=MembershipPlan.objects.all(), source="plan"
    )
    backbill_mode = serializers.ChoiceField(
        choices=["single", "unpaid", "paid"],
        default="single",
        write_only=True,
        required=False,
    )

    class Meta:
        model = Membership
        fields = [
            "id", "student_id", "student_name", "plan_id", "plan_name",
            "start_date", "end_date", "status", "auto_renew",
            "price", "currency", "notes",
            "backbill_mode",
            "approved_by_id", "approved_at",
            "created_by_id", "created_at",
        ]
        read_only_fields = [
            "id", "plan_name", "student_name", "price", "currency",
            "approved_by_id", "approved_at", "created_by_id", "created_at",
        ]

    def get_student_name(self, obj):
        return obj.student.full_name

    def create(self, validated_data):
        backbill_mode = validated_data.pop("backbill_mode", "single")
        plan = validated_data.get("plan")
        start_date = validated_data.get("start_date")
        today = timezone.now().date()

        cycles = []
        if (
            backbill_mode in ["unpaid", "paid"]
            and plan
            and plan.billing_cycle != MembershipPlan.BillingCycle.ONE_TIME
            and start_date
            and start_date < today
        ):
            cur_start = start_date
            loop_guard = 0
            while cur_start <= today and loop_guard < 120:
                loop_guard += 1
                cur_end = Membership.compute_end_date(cur_start, plan.billing_cycle)
                is_past = cur_end <= today
                cycles.append({
                    "start": cur_start,
                    "end": cur_end,
                    "is_past": is_past,
                })
                cur_start = cur_end

            if cycles:
                validated_data["end_date"] = cycles[-1]["end"]

        membership = Membership(**validated_data)
        membership._backbill_mode = backbill_mode
        membership._backbill_cycles = cycles
        membership.save()
        return membership


class CreditNoteSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    invoice_number = serializers.ReadOnlyField(source="invoice.invoice_number")
    issued_by_name = serializers.SerializerMethodField()
    reason_display = serializers.CharField(source="get_reason_display", read_only=True)
    refund_method_display = serializers.CharField(source="get_refund_method_display", read_only=True)

    class Meta:
        model = CreditNote
        fields = [
            "id", "credit_note_number", "invoice", "invoice_number",
            "student", "student_name", "amount", "tax_amount", "currency",
            "reason", "reason_display", "reason_details",
            "refund_method", "refund_method_display",
            "issued_by_id", "issued_by_name", "issued_at",
        ]
        read_only_fields = [
            "id", "credit_note_number", "student_name", "invoice_number",
            "issued_by_name", "issued_at",
        ]

    def _resolve_user_name(self, user_id):
        if not user_id:
            return None
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.only("first_name", "last_name").get(id=user_id)
            return user.get_full_name() or str(user_id)
        except User.DoesNotExist:
            return None

    def get_student_name(self, obj):
        return obj.student.full_name

    def get_issued_by_name(self, obj):
        return self._resolve_user_name(obj.issued_by_id)


class InvoiceSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_phone = serializers.ReadOnlyField(source="student.phone")
    student_email = serializers.ReadOnlyField(source="student.email")
    student_number = serializers.ReadOnlyField(source="student.student_number")
    location_name = serializers.SerializerMethodField()
    membership_details = serializers.SerializerMethodField()
    payments = serializers.SerializerMethodField()
    club_info = serializers.SerializerMethodField()
    plan_name = serializers.SerializerMethodField()
    amount_due = serializers.ReadOnlyField()
    is_overdue = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    paid_by_name = serializers.SerializerMethodField()
    voided_by_name = serializers.SerializerMethodField()
    archived_by_name = serializers.SerializerMethodField()
    credit_notes = CreditNoteSerializer(many=True, read_only=True)
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=Student.objects.all(), source="student"
    )
    membership_id = serializers.PrimaryKeyRelatedField(
        queryset=Membership.objects.all(), source="membership", required=False, allow_null=True
    )
    store_orders_count = serializers.SerializerMethodField()
    exam_candidacies_count = serializers.SerializerMethodField()
    student_status = serializers.ReadOnlyField(source="student.status")

    class Meta:
        model = Invoice
        fields = [
            "id", "invoice_number", "student_id", "student_name", "student_status",
            "student_phone", "student_email", "student_number", "location_name",
            "membership_id", "membership_details", "plan_name", "subtotal", "discount_amount", "tax_rate",
            "tax_amount", "total_amount", "amount_paid", "amount_due", "is_overdue",
            "currency", "status", "due_date", "paid_at",
            "notes", "is_recurring", "created_by_id", "created_by_name",
            "paid_by_id", "paid_by_name",
            "voided_at", "voided_by_id", "voided_by_name", "void_reason",
            "is_archived", "archived_at", "archive_reason", "archived_by_id", "archived_by_name",
            "credit_notes", "payments", "club_info", "store_orders_count", "exam_candidacies_count", "created_at",
        ]
        read_only_fields = [
            "id", "invoice_number", "student_name", "student_status",
            "student_phone", "student_email", "student_number", "location_name",
            "membership_details", "tax_amount",
            "total_amount", "amount_due", "is_overdue",
            "created_by_id", "created_by_name", "paid_by_id", "paid_by_name",
            "voided_at", "voided_by_id", "voided_by_name",
            "is_archived", "archived_at", "archive_reason", "archived_by_id", "archived_by_name",
            "credit_notes",
            "payments", "club_info", "store_orders_count", "exam_candidacies_count", "created_at",
        ]

    def get_store_orders_count(self, obj):
        return obj.store_orders.count() if hasattr(obj, "store_orders") else 0

    def get_exam_candidacies_count(self, obj):
        return obj.exam_candidates.count() if hasattr(obj, "exam_candidates") else 0

    def get_archived_by_name(self, obj):
        return self._resolve_user_name(obj.archived_by_id)

    def _resolve_user_name(self, user_id):
        """Return full name for a given user UUID, or None."""
        if not user_id:
            return None
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.only("first_name", "last_name").get(id=user_id)
            return user.get_full_name() or str(user_id)
        except User.DoesNotExist:
            return None

    def get_student_name(self, obj):
        return obj.student.full_name

    def get_plan_name(self, obj):
        if not obj.membership or not obj.membership.plan:
            return None
        return obj.membership.plan.name

    def get_is_overdue(self, obj):
        if obj.status in [Invoice.Status.PAID, Invoice.Status.VOID, Invoice.Status.REFUNDED]:
            return False
        return obj.due_date < timezone.now().date()

    def get_created_by_name(self, obj):
        return self._resolve_user_name(obj.created_by_id)

    def get_paid_by_name(self, obj):
        return self._resolve_user_name(obj.paid_by_id)

    def get_voided_by_name(self, obj):
        return self._resolve_user_name(obj.voided_by_id)

    def get_location_name(self, obj):
        if hasattr(obj.student, "location") and obj.student.location:
            return obj.student.location.name
        if obj.membership and obj.membership.plan and obj.membership.plan.location:
            return obj.membership.plan.location.name
        return None

    def get_membership_details(self, obj):
        if not obj.membership:
            return None
        m = obj.membership
        return {
            "id": m.id,
            "plan_name": m.plan.name if m.plan else None,
            "billing_cycle": m.plan.billing_cycle if m.plan else None,
            "start_date": m.start_date,
            "end_date": m.end_date,
            "status": m.status,
        }

    def get_payments(self, obj):
        if not hasattr(obj, "payments"):
            return []
        try:
            return [
                {
                    "id": p.id,
                    "amount": float(p.amount),
                    "currency": p.currency,
                    "provider": p.provider,
                    "provider_transaction_id": p.provider_transaction_id,
                    "status": p.status,
                    "paid_at": p.paid_at.isoformat() if p.paid_at else None,
                    "notes": p.notes,
                }
                for p in obj.payments.all()
            ]
        except Exception:
            return []

    def get_club_info(self, obj):
        request = self.context.get("request")
        tenant = getattr(request, "tenant", None) if request else None
        if tenant:
            return {
                "name": tenant.name,
                "business_name": getattr(tenant, "business_name", ""),
                "phone": getattr(tenant, "phone", ""),
                "email": getattr(tenant, "email", ""),
                "logo": tenant.logo.url if getattr(tenant, "logo", None) else None,
                "stamp": tenant.stamp.url if getattr(tenant, "stamp", None) else None,
                "signature": tenant.signature.url if getattr(tenant, "signature", None) else None,
                "currency": getattr(tenant, "default_currency", "JOD"),
                "country": getattr(tenant, "country", "JO"),
            }
        return None


class PaymentSerializer(serializers.ModelSerializer):
    invoice_id = serializers.PrimaryKeyRelatedField(
        queryset=Invoice.objects.all(), source="invoice"
    )
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=Student.objects.all(), source="student"
    )

    class Meta:
        model = Payment
        fields = [
            "id", "invoice_id", "student_id", "amount", "currency",
            "provider", "provider_transaction_id", "status",
            "paid_at", "receipt_url", "notes", "created_at",
        ]
        read_only_fields = [
            "id", "provider_transaction_id", "status",
            "paid_at", "receipt_url", "created_at",
        ]


class PaymentInitSerializer(serializers.Serializer):
    invoice_id = serializers.IntegerField()
    provider = serializers.ChoiceField(choices=["paytabs", "stripe", "cash", "manual"])
    return_url = serializers.URLField(required=False, default="http://localhost:3000/billing")
    callback_url = serializers.URLField(required=False, default="http://localhost:8000/api/v1/payments/webhook/")


# ---------------------------------------------------------------------------
# ViewSets
# ---------------------------------------------------------------------------

class MembershipPlanViewSet(viewsets.ModelViewSet):
    queryset = MembershipPlan.objects.filter(is_active=True)
    serializer_class = MembershipPlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), CanManageBilling()]
        return [permissions.IsAuthenticated(), IsStaff()]


class MembershipViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    serializer_class = MembershipSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "student_id", "plan_id"]
    search_fields = ["student__full_name", "student__first_name", "student__last_name", "student__student_number"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = Membership.objects.select_related("student", "plan").all()
        return self.get_location_filtered_queryset(qs)

    def get_permissions(self):
        """Read: authenticated staff. Write: requires granular billing permissions."""
        if self.action in ["create"]:
            return [permissions.IsAuthenticated(), CanRenewSubscription()]
        if self.action in ["update", "partial_update"]:
            return [permissions.IsAuthenticated(), CanChangeSubscription()]
        if self.action in ["destroy"]:
            return [permissions.IsAuthenticated(), CanManageBilling()]
        if self.action == "approve":
            return [permissions.IsAuthenticated(), CanApproveSubscription()]
        if self.action == "renew":
            return [permissions.IsAuthenticated(), CanRenewSubscription()]
        # list / retrieve — any authenticated staff
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        membership = serializer.save(created_by_id=self.request.user.id)
        if membership.status == Membership.Status.ACTIVE and membership.student.status in [
            Student.Status.LEAD,
            Student.Status.TRIAL,
        ]:
            membership.student.status = Student.Status.ACTIVE
            membership.student.save(update_fields=["status"])

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve a PENDING_APPROVAL membership → transitions to PENDING (awaiting payment)."""
        with transaction.atomic():
            membership = (
                self.get_queryset()
                .select_for_update()
                .select_related("plan", "student")
                .get(pk=self.kwargs["pk"])
            )
            if membership.status != Membership.Status.PENDING_APPROVAL:
                return Response(
                    {"error": "هذا الاشتراك ليس في حالة انتظار الموافقة."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            membership.status = Membership.Status.PENDING
            membership.approved_by_id = request.user.id
            membership.approved_at = timezone.now()
            membership.save(update_fields=["status", "approved_by_id", "approved_at", "updated_at"])

            if not membership.invoices.exists():
                plan = membership.plan
                subtotal = plan.price + plan.setup_fee
                tax_amount = subtotal * (plan.tax_rate / 100)
                total_amount = subtotal + tax_amount
                Invoice.objects.create(
                    student=membership.student,
                    membership=membership,
                    subtotal=subtotal,
                    discount_amount=0,
                    tax_rate=plan.tax_rate,
                    tax_amount=tax_amount,
                    total_amount=total_amount,
                    amount_paid=0,
                    currency=plan.currency,
                    status=Invoice.Status.PENDING,
                    due_date=membership.start_date or timezone.now().date(),
                    is_recurring=(plan.billing_cycle != MembershipPlan.BillingCycle.ONE_TIME),
                    created_by_id=request.user.id,
                )

        membership.refresh_from_db()
        serializer = self.get_serializer(membership)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def renew(self, request, pk=None):
        """Renew an existing membership by creating a new Membership starting after the current end_date."""
        membership = self.get_object()
        if membership.status not in [Membership.Status.ACTIVE, Membership.Status.EXPIRED]:
            return Response(
                {"error": "يمكن تجديد الاشتراكات النشطة أو المنتهية فقط."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_start = membership.end_date or timezone.now().date()
        plan = membership.plan
        new_end = Membership.compute_end_date(new_start, plan.billing_cycle)

        new_membership = Membership.objects.create(
            student=membership.student,
            plan=plan,
            start_date=new_start,
            end_date=new_end,
            status=Membership.Status.PENDING,
            auto_renew=membership.auto_renew,
            created_by_id=request.user.id,
        )
        serializer = self.get_serializer(new_membership)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        membership = self.get_object()
        membership.status = Membership.Status.CANCELLED
        membership.cancelled_at = timezone.now()
        membership.cancellation_reason = request.data.get("reason", "")
        membership.save()
        return Response({"message": "تم إلغاء الاشتراك."})

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        membership = self.get_object()
        membership.status = Membership.Status.PAUSED
        membership.paused_at = timezone.now()
        membership.pause_reason = request.data.get("reason", "")
        membership.save()
        return Response({"message": "تم إيقاف الاشتراك مؤقتاً."})


def parse_period_dates(period=None, start_date=None, end_date=None):
    """
    Parse a named period or explicit date range into (start_date, end_date).
    Supports: today, yesterday, this_week, last_week, this_month, last_month,
    last_30_days, last_90_days, this_quarter, this_year, last_year, all, or custom dates.
    """
    today = timezone.now().date()

    if start_date or end_date:
        s_date = None
        e_date = None
        if start_date:
            try:
                s_date = datetime.strptime(str(start_date).strip(), "%Y-%m-%d").date()
            except (ValueError, TypeError):
                pass
        if end_date:
            try:
                e_date = datetime.strptime(str(end_date).strip(), "%Y-%m-%d").date()
            except (ValueError, TypeError):
                pass
        return s_date, e_date

    if not period or period == "all":
        return None, None
    if period == "today":
        return today, today
    if period == "yesterday":
        yesterday = today - timedelta(days=1)
        return yesterday, yesterday
    if period == "this_week":
        start_week = today - timedelta(days=today.weekday())
        end_week = start_week + timedelta(days=6)
        return start_week, end_week
    if period == "last_week":
        start_this_week = today - timedelta(days=today.weekday())
        start_last_week = start_this_week - timedelta(days=7)
        end_last_week = start_this_week - timedelta(days=1)
        return start_last_week, end_last_week
    if period == "this_month":
        start_month = today.replace(day=1)
        last_day = calendar.monthrange(today.year, today.month)[1]
        end_month = today.replace(day=last_day)
        return start_month, end_month
    if period == "last_month":
        first_this_month = today.replace(day=1)
        end_last_month = first_this_month - timedelta(days=1)
        start_last_month = end_last_month.replace(day=1)
        return start_last_month, end_last_month
    if period == "last_30_days":
        return today - timedelta(days=30), today
    if period == "last_90_days":
        return today - timedelta(days=90), today
    if period == "this_quarter":
        quarter_start_month = ((today.month - 1) // 3) * 3 + 1
        start_quarter = today.replace(month=quarter_start_month, day=1)
        quarter_end_month = quarter_start_month + 2
        last_day = calendar.monthrange(today.year, quarter_end_month)[1]
        end_quarter = today.replace(month=quarter_end_month, day=last_day)
        return start_quarter, end_quarter
    if period == "this_year":
        return today.replace(month=1, day=1), today.replace(month=12, day=31)
    if period == "last_year":
        return today.replace(year=today.year - 1, month=1, day=1), today.replace(year=today.year - 1, month=12, day=31)

    return None, None


class InvoiceFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(field_name="status")
    student_id = django_filters.NumberFilter(field_name="student_id")
    location = django_filters.NumberFilter(field_name="student__location_id")
    location_id = django_filters.NumberFilter(field_name="student__location_id")
    plan = django_filters.NumberFilter(field_name="membership__plan_id")
    plan_id = django_filters.NumberFilter(field_name="membership__plan_id")
    is_recurring = django_filters.BooleanFilter(field_name="is_recurring")
    is_archived = django_filters.BooleanFilter(field_name="is_archived")

    date_from = django_filters.CharFilter(method="filter_date_from")
    date_to = django_filters.CharFilter(method="filter_date_to")
    start_date = django_filters.CharFilter(method="filter_date_from")
    end_date = django_filters.CharFilter(method="filter_date_to")
    period = django_filters.CharFilter(method="filter_period")
    date_by = django_filters.CharFilter(method="filter_noop")

    def filter_noop(self, queryset, name, value):
        return queryset

    def _get_target_field(self):
        date_by = self.data.get("date_by", "created_at")
        if date_by == "due_date":
            return "due_date"
        if date_by == "paid_at":
            return "paid_at__date"
        return "created_at__date"

    def filter_date_from(self, queryset, name, value):
        if not value:
            return queryset
        field = self._get_target_field()
        try:
            d = datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
            return queryset.filter(**{f"{field}__gte": d})
        except (ValueError, TypeError):
            return queryset

    def filter_date_to(self, queryset, name, value):
        if not value:
            return queryset
        field = self._get_target_field()
        try:
            d = datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
            return queryset.filter(**{f"{field}__lte": d})
        except (ValueError, TypeError):
            return queryset

    def filter_period(self, queryset, name, value):
        if not value or value == "all":
            return queryset
        if self.data.get("start_date") or self.data.get("end_date") or self.data.get("date_from") or self.data.get("date_to"):
            return queryset
        start, end = parse_period_dates(period=value)
        field = self._get_target_field()
        qs = queryset
        if start:
            qs = qs.filter(**{f"{field}__gte": start})
        if end:
            qs = qs.filter(**{f"{field}__lte": end})
        return qs


class InvoiceViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = InvoiceFilter
    search_fields = ["invoice_number", "student__full_name", "student__first_name", "student__last_name", "student__phone"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = Invoice.objects.select_related("student", "membership__plan").all()
        archived_param = self.request.query_params.get("is_archived")
        if archived_param is not None:
            if str(archived_param).lower() in ["true", "1"]:
                qs = qs.filter(is_archived=True)
            elif str(archived_param).lower() in ["false", "0"]:
                qs = qs.filter(is_archived=False)
        elif self.action == "list":
            qs = qs.filter(is_archived=False)
        return self.get_location_filtered_queryset(qs)

    def destroy(self, request, *args, **kwargs):
        """Invoice deletion is strictly prohibited to preserve tax compliance and financial ledger audit trails."""
        return Response(
            {
                "detail": "حذف الفواتير غير متاح نظامياً للحفاظ على الامتثال المالي والضريبي وتكامل القيود المحاسبية. يمكنك أرشفة الفاتورة أو إلغاؤها (Void).",
                "code": "invoice_deletion_not_allowed",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated(), CanCreateInvoice()]
        if self.action in ["void", "refund"]:
            return [permissions.IsAuthenticated(), CanVoidInvoice()]
        if self.action == "mark_paid":
            return [permissions.IsAuthenticated(), CanMarkInvoicePaid()]
        # All other write actions require general billing management
        if self.action in ["update", "partial_update", "destroy", "archive", "unarchive", "bulk_archive"]:
            return [permissions.IsAuthenticated(), CanManageBilling()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(created_by_id=self.request.user.id)

    @action(detail=True, methods=["post"])
    def void(self, request, pk=None):
        """Void an invoice — marks it as cancelled with no financial effect, revoking linked membership."""
        invoice = self.get_object()
        if invoice.status in [Invoice.Status.VOID, Invoice.Status.REFUNDED]:
            return Response(
                {"error": f"لا يمكن إلغاء فاتورة بحالة: {invoice.get_status_display()}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if invoice.status == Invoice.Status.PAID or invoice.amount_paid > Decimal("0.00"):
            return Response(
                {"error": "لا يمكن إلغاء فاتورة تم سدادها كلياً أو جزئياً. يجب إصدار إشعار دائن واسترداد (Refund / Credit Note)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = request.data.get("reason", "data_entry_error")
        reason_details = request.data.get("reason_details", "").strip()
        reason_text = f"{reason}" + (f": {reason_details}" if reason_details else "")

        with transaction.atomic():
            now = timezone.now()
            invoice.status = Invoice.Status.VOID
            invoice.amount_paid = Decimal("0.00")
            invoice.voided_at = now
            invoice.voided_by_id = request.user.id
            invoice.void_reason = reason_text
            audit_note = f"[ملغاة (Void) بواسطة {request.user.get_full_name()} في {now.date()}: {reason_text}]"
            invoice.notes = ((invoice.notes or "") + f"\n{audit_note}").strip()
            invoice.save(update_fields=["status", "amount_paid", "voided_at", "voided_by_id", "void_reason", "notes", "updated_at"])

            # 1. Cancel linked membership if no other paid invoices exist for it
            if invoice.membership:
                membership = invoice.membership
                has_other_paid = membership.invoices.filter(status=Invoice.Status.PAID).exclude(pk=invoice.pk).exists()
                if not has_other_paid:
                    membership.status = Membership.Status.CANCELLED
                    membership.auto_renew = False
                    membership.cancelled_at = now
                    membership.cancellation_reason = f"ملغاة تلقائياً بسبب إلغاء الفاتورة {invoice.invoice_number} ({reason_text})"
                    membership.save(update_fields=["status", "auto_renew", "cancelled_at", "cancellation_reason", "updated_at"])

            # 2. Cancel linked store orders and restore product inventory
            if hasattr(invoice, "store_orders"):
                for order in invoice.store_orders.all():
                    if order.status != "cancelled":
                        order.status = "cancelled"
                        order.payment_status = "failed"
                        for item in order.items.all():
                            if getattr(item, "variant", None):
                                item.variant.stock += item.quantity
                                item.variant.save(update_fields=["stock"])
                            elif getattr(item, "product", None):
                                item.product.stock += item.quantity
                                item.product.save(update_fields=["stock"])
                        order.save(update_fields=["status", "payment_status", "updated_at"])

            # 3. Unlink pending belt exam candidacies
            if hasattr(invoice, "exam_candidates"):
                invoice.exam_candidates.filter(status="pending").update(invoice=None)

            # 4. Check if student status was suspended due to overdue invoices and reactivate if clear
            student = invoice.student
            if student.status == Student.Status.SUSPENDED:
                from datetime import timedelta
                seven_days_ago = now.date() - timedelta(days=7)
                has_other_overdue = Invoice.objects.filter(
                    student=student,
                    status=Invoice.Status.OVERDUE,
                    due_date__lte=seven_days_ago,
                ).exclude(pk=invoice.pk).exists()
                if not has_other_overdue:
                    student.status = Student.Status.ACTIVE
                    student.save(update_fields=["status"])

        serializer = self.get_serializer(invoice)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def refund(self, request, pk=None):
        """
        Issue a formal Credit Note and refund for a paid/partially paid invoice.
        Adjusts invoice amount_paid, updates status to REFUNDED or PARTIALLY_PAID,
        reverses payment status if applicable, and revokes membership if requested.
        """
        invoice = self.get_object()
        if invoice.status in [Invoice.Status.VOID]:
            return Response(
                {"error": "لا يمكن استرداد فاتورة ملغاة مسبقاً."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if invoice.amount_paid <= Decimal("0.00"):
            return Response(
                {"error": "لا توجد مبالغ مدفوعة قابلة للاسترداد على هذه الفاتورة."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            refund_amount = Decimal(str(request.data.get("amount", invoice.amount_paid)))
        except (ValueError, TypeError):
            return Response({"error": "المبلغ المحدد غير صالح."}, status=status.HTTP_400_BAD_REQUEST)

        if refund_amount <= Decimal("0.00") or refund_amount > invoice.amount_paid:
            return Response(
                {"error": f"مبلغ الاسترداد يجب أن يكون أكبر من 0 ولا يتجاوز المدفوع ({invoice.amount_paid} {invoice.currency})."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = request.data.get("reason", CreditNote.Reason.DATA_ENTRY_ERROR)
        reason_details = request.data.get("reason_details", "").strip()
        refund_method = request.data.get("refund_method", CreditNote.RefundMethod.CASH)
        cancel_membership = request.data.get("cancel_membership", True)

        with transaction.atomic():
            now = timezone.now()

            # Proportional tax amount if applicable
            tax_amount = Decimal("0.00")
            if invoice.total_amount > Decimal("0.00") and invoice.tax_amount > Decimal("0.00"):
                tax_amount = (refund_amount / invoice.total_amount * invoice.tax_amount).quantize(Decimal("0.01"))

            credit_note = CreditNote.objects.create(
                invoice=invoice,
                student=invoice.student,
                amount=refund_amount,
                tax_amount=tax_amount,
                currency=invoice.currency,
                reason=reason,
                reason_details=reason_details,
                refund_method=refund_method,
                issued_by_id=request.user.id,
            )

            # Update Invoice
            new_amount_paid = invoice.amount_paid - refund_amount
            invoice.amount_paid = new_amount_paid
            if new_amount_paid <= Decimal("0.00"):
                invoice.status = Invoice.Status.REFUNDED
            else:
                invoice.status = Invoice.Status.PARTIALLY_PAID

            audit_note = (
                f"[إشعار دائن {credit_note.credit_note_number} — استرداد {refund_amount} {invoice.currency} "
                f"({credit_note.get_refund_method_display()}) بواسطة {request.user.get_full_name()} في {now.date()}"
                f"{(': ' + reason_details) if reason_details else ''}]"
            )
            invoice.notes = ((invoice.notes or "") + f"\n{audit_note}").strip()
            invoice.save(update_fields=["amount_paid", "status", "notes", "updated_at"])

            # Update Payments (mark success payments as refunded / partially refunded)
            for payment in invoice.payments.filter(status=Payment.Status.SUCCESS):
                if new_amount_paid <= Decimal("0.00"):
                    payment.status = Payment.Status.REFUNDED
                else:
                    payment.status = Payment.Status.PARTIALLY_REFUNDED
                payment.notes = ((payment.notes or "") + f"\n[استرداد بإشعار دائن {credit_note.credit_note_number}]").strip()
                payment.save(update_fields=["status", "notes"])

            # Revoke linked membership if requested or fully refunded
            if cancel_membership and invoice.membership:
                invoice.membership.status = Membership.Status.CANCELLED
                invoice.membership.cancelled_at = now
                invoice.membership.cancellation_reason = (
                    f"ملغاة تلقائياً بسبب استرداد الفاتورة {invoice.invoice_number} "
                    f"بإشعار دائن {credit_note.credit_note_number}"
                )
                invoice.membership.save(update_fields=["status", "cancelled_at", "cancellation_reason", "updated_at"])

        invoice_data = self.get_serializer(invoice).data
        cn_data = CreditNoteSerializer(credit_note).data
        return Response({
            "message": f"تم إصدار الإشعار الدائن {credit_note.credit_note_number} وتسجيل الاسترداد بنجاح.",
            "credit_note": cn_data,
            "invoice": invoice_data,
        })

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        """
        Manually confirm full or partial payment for an invoice, with surplus handling.
        Supports:
          - Full payment
          - Partial payment (status -> partially_paid)
          - Overpayment with excess credited to student wallet or returned as cash change.
        Requires `can_mark_invoice_paid` granular permission.
        """
        payment_method = request.data.get("payment_method", "cash")
        note = request.data.get("note", "")
        amount_received_raw = request.data.get("amount")
        surplus_action = request.data.get("surplus_action", "credit")  # "credit" or "change"

        UNPAYABLE_STATUSES = {Invoice.Status.PAID, Invoice.Status.VOID, Invoice.Status.REFUNDED}
        with transaction.atomic():
            try:
                invoice = (
                    self.get_queryset()
                    .select_related(None)
                    .select_for_update()
                    .get(pk=pk or self.kwargs.get("pk"))
                )
            except Invoice.DoesNotExist:
                return Response({"error": "الفاتورة غير موجودة."}, status=status.HTTP_404_NOT_FOUND)

            if invoice.status in UNPAYABLE_STATUSES:
                return Response(
                    {"error": f"لا يمكن تأكيد سداد فاتورة بحالة: {invoice.get_status_display()}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            current_due = invoice.total_amount - invoice.amount_paid
            if current_due <= Decimal("0.00"):
                return Response({"error": "تم سداد هذه الفاتورة بالكامل مسبقاً."}, status=status.HTTP_400_BAD_REQUEST)

            # Determine payment amount
            if amount_received_raw is not None and str(amount_received_raw).strip() != "":
                try:
                    amount_received = Decimal(str(amount_received_raw))
                except Exception:
                    return Response({"error": "قيمة المبلغ المدفوع غير صالحة."}, status=status.HTTP_400_BAD_REQUEST)
                if amount_received <= Decimal("0.00"):
                    return Response({"error": "المبلغ المدفوع يجب أن يكون أكبر من صفر."}, status=status.HTTP_400_BAD_REQUEST)
            else:
                amount_received = current_due

            now = timezone.now()
            user_display = request.user.get_full_name() or request.user.email

            surplus_amount = Decimal("0.00")
            student = invoice.student

            if amount_received > current_due:
                surplus_amount = amount_received - current_due
                actual_applied_to_invoice = current_due
                invoice.amount_paid = invoice.total_amount
                invoice.status = Invoice.Status.PAID
                invoice.paid_at = now

                surplus_msg = ""
                if surplus_action == "credit":
                    student = Student.objects.select_for_update().get(pk=invoice.student_id)
                    student.account_credit = (student.account_credit or Decimal("0.00")) + surplus_amount
                    student.save(update_fields=["account_credit"])
                    surplus_msg = f" — تم إيداع فائض {surplus_amount} {invoice.currency} كرصيد دائن بمحفظة الطالب"
                else:
                    surplus_msg = f" — تم إرجاع فائض {surplus_amount} {invoice.currency} نقداً للطالب"

                audit_note = (
                    f"[سداد يدوي — استلام {amount_received} {invoice.currency} عبر {payment_method} "
                    f"بواسطة {user_display} في {now.date()}{surplus_msg}]"
                )
            elif amount_received == current_due:
                actual_applied_to_invoice = current_due
                invoice.amount_paid = invoice.total_amount
                invoice.status = Invoice.Status.PAID
                invoice.paid_at = now
                audit_note = f"[سداد يدوي كامل — {payment_method} — بواسطة {user_display} في {now.date()}]"
            else:
                # Partial payment
                actual_applied_to_invoice = amount_received
                invoice.amount_paid = invoice.amount_paid + amount_received
                invoice.status = Invoice.Status.PARTIALLY_PAID
                audit_note = (
                    f"[سداد جزئي — استلام {amount_received} {invoice.currency} عبر {payment_method} "
                    f"بواسطة {user_display} في {now.date()} — المتبقي {invoice.total_amount - invoice.amount_paid} {invoice.currency}]"
                )

            if note:
                audit_note += f" ملاحظة: {note}"

            invoice.paid_by_id = request.user.id
            invoice.notes = ((invoice.notes or "") + f"\n{audit_note}").strip()
            invoice.save(
                update_fields=["status", "amount_paid", "paid_at", "paid_by_id", "notes", "updated_at"]
            )

            # Record AuditLog
            from apps.audit.utils import log_action
            log_action(
                user=request.user,
                action="payment",
                resource_type="invoice",
                resource_id=str(invoice.id),
                changes={
                    "amount_received": str(amount_received),
                    "applied_to_invoice": str(actual_applied_to_invoice),
                    "surplus_amount": str(surplus_amount),
                    "surplus_action": surplus_action,
                    "new_status": invoice.status,
                    "payment_method": payment_method,
                },
                metadata={"invoice_number": invoice.invoice_number, "student_id": invoice.student_id},
                request=request,
            )

        serializer = self.get_serializer(invoice)
        data = serializer.data
        data["surplus_amount"] = float(surplus_amount)
        data["surplus_action"] = surplus_action
        data["student_account_credit"] = float(student.account_credit)
        return Response(data)

    @action(detail=False, methods=["get"])
    def overdue(self, request):
        overdue = self.queryset.filter(
            status__in=["pending", "overdue"],
            due_date__lt=timezone.now().date(),
        )
        serializer = self.get_serializer(overdue, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Revenue and invoice summary with period, date range, location, and plan filtering."""
        base_qs = self.get_queryset()

        # Build filter parameters without 'status' so all status buckets remain visible for the filtered scope
        filter_params = request.query_params.copy()
        filter_params.pop("status", None)

        invoice_filter = InvoiceFilter(filter_params, queryset=base_qs, request=request)
        filtered_qs = invoice_filter.qs

        today = timezone.now().date()
        tenant = getattr(request, "tenant", None)
        currency = tenant.default_currency if tenant else "JOD"

        # Resolve active period bounds
        period = request.query_params.get("period", "this_month")
        start_param = request.query_params.get("start_date") or request.query_params.get("date_from")
        end_param = request.query_params.get("end_date") or request.query_params.get("date_to")
        resolved_start, resolved_end = parse_period_dates(period, start_param, end_param)

        paid_qs = filtered_qs.filter(status=Invoice.Status.PAID)
        pending_qs = filtered_qs.filter(status__in=[Invoice.Status.PENDING, Invoice.Status.PARTIALLY_PAID])
        overdue_qs = filtered_qs.filter(
            Q(status=Invoice.Status.OVERDUE) |
            (Q(status__in=[Invoice.Status.PENDING, Invoice.Status.PARTIALLY_PAID]) & Q(due_date__lt=today))
        )

        total_paid = paid_qs.aggregate(s=Sum("amount_paid"))["s"] or paid_qs.aggregate(s=Sum("total_amount"))["s"] or 0
        total_pending = pending_qs.aggregate(s=Sum("total_amount"))["s"] or 0
        total_overdue = overdue_qs.aggregate(s=Sum("total_amount"))["s"] or 0
        total_invoiced = filtered_qs.exclude(status=Invoice.Status.VOID).aggregate(s=Sum("total_amount"))["s"] or 0
        invoice_count = filtered_qs.exclude(status=Invoice.Status.VOID).count()

        denom = float(total_paid) + float(total_pending) + float(total_overdue)
        collected_pct = round((float(total_paid) / denom) * 100, 1) if denom > 0 else 0.0

        # Backwards compatibility paid_this_month
        paid_this_month = base_qs.filter(
            status=Invoice.Status.PAID,
            paid_at__month=today.month,
            paid_at__year=today.year,
        ).aggregate(s=Sum("total_amount"))["s"] or 0

        # Calculate archived invoices count for the location scope
        archived_count = self.get_location_filtered_queryset(Invoice.objects.all()).filter(is_archived=True).count()

        return Response({
            "total_paid": float(total_paid),
            "total_pending": float(total_pending),
            "total_overdue": float(total_overdue),
            "overdue_count": overdue_qs.count(),
            "total_invoiced": float(total_invoiced),
            "invoice_count": invoice_count,
            "archived_count": archived_count,
            "collection_rate": collected_pct,
            "paid_this_month": float(paid_this_month),
            "currency": currency,
            "period": period,
            "start_date": str(resolved_start) if resolved_start else None,
            "end_date": str(resolved_end) if resolved_end else None,
        })

    @action(detail=True, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def archive_precheck(self, request, pk=None):
        """Pre-archival audit of an invoice."""
        invoice = self.get_object()
        amount_due = invoice.total_amount - invoice.amount_paid
        is_clean = amount_due <= Decimal("0.00") or invoice.status in [Invoice.Status.PAID, Invoice.Status.VOID, Invoice.Status.REFUNDED]

        return Response({
            "id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "status": invoice.status,
            "total_amount": float(invoice.total_amount),
            "amount_paid": float(invoice.amount_paid),
            "amount_due": float(amount_due),
            "currency": invoice.currency,
            "is_archived": invoice.is_archived,
            "can_archive_cleanly": is_clean,
            "requires_debt_acknowledgment": not is_clean,
        })

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, CanManageBilling])
    def archive(self, request, pk=None):
        """Archive an invoice with documented audit trail."""
        invoice = self.get_object()
        if invoice.is_archived:
            return Response({"detail": "هذه الفاتورة مؤرشفة بالفعل."}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get("reason", "").strip()
        force_with_debt = bool(request.data.get("force_with_debt", False))

        amount_due = invoice.total_amount - invoice.amount_paid
        if amount_due > Decimal("0.00") and invoice.status not in [Invoice.Status.VOID, Invoice.Status.REFUNDED] and not force_with_debt:
            return Response(
                {
                    "detail": f"لا يمكن أرشفة الفاتورة لوجود رصيد مستحق بقيمة {amount_due} {invoice.currency}. يرجى تسديد الفاتورة أولاً أو تفعيل خيار إحالة المديونية كدين معلق/معدوم.",
                    "amount_due": float(amount_due),
                    "code": "outstanding_invoice_due",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        staff_name = request.user.get_full_name() or request.user.username
        audit_note = f"[مؤرشفة بواسطة {staff_name} في {now.date()}: {reason or 'أرشفة نظامية'}]"

        with transaction.atomic():
            invoice.is_archived = True
            invoice.archived_at = now
            invoice.archive_reason = reason
            user_id = request.user.id
            if user_id:
                try:
                    import uuid
                    if isinstance(user_id, uuid.UUID):
                        invoice.archived_by_id = user_id
                    elif isinstance(user_id, str):
                        invoice.archived_by_id = uuid.UUID(user_id)
                except Exception:
                    pass
            invoice.notes = ((invoice.notes or "") + f"\n{audit_note}").strip()
            invoice.save(update_fields=["is_archived", "archived_at", "archive_reason", "archived_by_id", "notes", "updated_at"])

        serializer = self.get_serializer(invoice)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, CanManageBilling])
    def unarchive(self, request, pk=None):
        """Restore an archived invoice back to active accounts."""
        invoice = self.get_object()
        if not invoice.is_archived:
            return Response({"detail": "هذه الفاتورة غير مؤرشفة."}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        staff_name = request.user.get_full_name() or request.user.username
        audit_note = f"[تمت استعادة الفاتورة من الأرشيف بواسطة {staff_name} في {now.date()}]"

        with transaction.atomic():
            invoice.is_archived = False
            invoice.archived_at = None
            invoice.archive_reason = ""
            invoice.archived_by_id = None
            invoice.notes = ((invoice.notes or "") + f"\n{audit_note}").strip()
            invoice.save(update_fields=["is_archived", "archived_at", "archive_reason", "archived_by_id", "notes", "updated_at"])

        serializer = self.get_serializer(invoice)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated, CanManageBilling])
    def bulk_archive(self, request):
        """Bulk archive invoices (e.g. for settled fiscal periods)."""
        invoice_ids = request.data.get("invoice_ids", [])
        if not isinstance(invoice_ids, list) or not invoice_ids:
            return Response({"error": "يجب تحديد قائمة معرفات الفواتير المراد أرشفتها."}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get("reason", "أرشفة جماعية للفواتير").strip()
        force_with_debt = bool(request.data.get("force_with_debt", False))

        invoices = Invoice.objects.filter(id__in=invoice_ids, is_archived=False)
        archived_count = 0
        skipped_count = 0
        now = timezone.now()
        staff_name = request.user.get_full_name() or request.user.username

        with transaction.atomic():
            for inv in invoices:
                due = inv.total_amount - inv.amount_paid
                if due > Decimal("0.00") and inv.status not in [Invoice.Status.VOID, Invoice.Status.REFUNDED] and not force_with_debt:
                    skipped_count += 1
                    continue
                inv.is_archived = True
                inv.archived_at = now
                inv.archive_reason = reason
                inv.notes = ((inv.notes or "") + f"\n[مؤرشفة جماعياً بواسطة {staff_name} في {now.date()}: {reason}]").strip()
                inv.save(update_fields=["is_archived", "archived_at", "archive_reason", "notes", "updated_at"])
                archived_count += 1

        return Response({
            "archived_count": archived_count,
            "skipped_due_count": skipped_count,
            "message": f"تمت أرشفة {archived_count} فاتورة بنجاح." + (f" تم تجاوز {skipped_count} فاتورة لوجود رصيد غير مسدد." if skipped_count else "")
        })


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("invoice", "student").all()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, CanManageBilling]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["status", "provider", "student_id", "invoice_id"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "head", "options"]

    @action(detail=False, methods=["post"])
    def initiate(self, request):
        """Initiate a payment for an invoice."""
        serializer = PaymentInitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            invoice = Invoice.objects.get(id=data["invoice_id"])
        except Invoice.DoesNotExist:
            return Response({"error": "Invoice not found."}, status=status.HTTP_404_NOT_FOUND)

        if invoice.status == Invoice.Status.PAID:
            return Response({"error": "Invoice is already paid."}, status=status.HTTP_400_BAD_REQUEST)

        provider = get_payment_provider(data["provider"])
        result = provider.create_payment(
            invoice_number=invoice.invoice_number,
            amount=invoice.amount_due,
            currency=invoice.currency,
            customer_email=invoice.student.email,
            customer_name=invoice.student.full_name,
            description=f"MAIDAN Invoice {invoice.invoice_number}",
            callback_url=data["callback_url"],
            return_url=data["return_url"],
            metadata={"student_id": invoice.student_id, "phone": invoice.student.phone},
        )

        # Record the payment attempt
        payment = Payment.objects.create(
            invoice=invoice,
            student=invoice.student,
            amount=invoice.amount_due,
            currency=invoice.currency,
            provider=data["provider"],
            provider_transaction_id=result.transaction_id,
            provider_response=result.raw_response,
            status=result.status.value,
            processed_by_id=request.user.id,
        )

        if result.status.value == "success":
            payment.mark_successful(result.transaction_id, result.receipt_url or "")

        return Response({
            "payment_id": payment.id,
            "status": result.status.value,
            "redirect_url": result.redirect_url,
            "transaction_id": result.transaction_id,
            "error": result.error_message,
            "metadata": result.metadata,
        })


# ---------------------------------------------------------------------------
# Expense & Outflow Accounting Serializers & ViewSets
# ---------------------------------------------------------------------------

class ExpenseCategorySerializer(serializers.ModelSerializer):
    expenses_count = serializers.IntegerField(read_only=True, default=0)
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, default=0)

    class Meta:
        model = ExpenseCategory
        fields = [
            "id", "name", "code", "description",
            "is_system", "is_active", "sort_order",
            "expenses_count", "total_amount",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "is_system", "created_at", "updated_at"]


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source="category.name")
    location_name = serializers.ReadOnlyField(source="location.name")
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payment_method_display = serializers.CharField(source="get_payment_method_display", read_only=True)

    class Meta:
        model = Expense
        fields = [
            "id", "expense_number", "title",
            "category", "category_name",
            "location", "location_name",
            "vendor_name", "vendor_tax_number", "invoice_reference",
            "amount", "tax_rate", "tax_amount", "total_amount", "currency",
            "payment_method", "payment_method_display", "payment_reference",
            "expense_date", "payment_date",
            "status", "status_display",
            "receipt_url", "is_recurring", "notes",
            "created_by_id", "approved_by_id", "paid_by_id",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "expense_number", "tax_amount", "total_amount", "created_at", "updated_at"]

    def validate(self, attrs):
        amount = attrs.get("amount", getattr(self.instance, "amount", 0))
        tax_rate = attrs.get("tax_rate", getattr(self.instance, "tax_rate", 0))
        if amount and tax_rate is not None:
            tax_amount = round(amount * (tax_rate / 100), 2)
            attrs["tax_amount"] = tax_amount
            attrs["total_amount"] = amount + tax_amount
        return attrs


class ExpenseFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(field_name="status")
    category = django_filters.NumberFilter(field_name="category_id")
    category_id = django_filters.NumberFilter(field_name="category_id")
    location = django_filters.NumberFilter(field_name="location_id")
    location_id = django_filters.NumberFilter(field_name="location_id")
    payment_method = django_filters.CharFilter(field_name="payment_method")
    is_recurring = django_filters.BooleanFilter(field_name="is_recurring")

    date_from = django_filters.CharFilter(method="filter_date_from")
    date_to = django_filters.CharFilter(method="filter_date_to")
    start_date = django_filters.CharFilter(method="filter_date_from")
    end_date = django_filters.CharFilter(method="filter_date_to")
    period = django_filters.CharFilter(method="filter_period")

    def filter_date_from(self, queryset, name, value):
        if not value:
            return queryset
        try:
            d = datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
            return queryset.filter(expense_date__gte=d)
        except (ValueError, TypeError):
            return queryset

    def filter_date_to(self, queryset, name, value):
        if not value:
            return queryset
        try:
            d = datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
            return queryset.filter(expense_date__lte=d)
        except (ValueError, TypeError):
            return queryset

    def filter_period(self, queryset, name, value):
        if not value or value == "all":
            return queryset
        if self.data.get("start_date") or self.data.get("end_date") or self.data.get("date_from") or self.data.get("date_to"):
            return queryset
        start, end = parse_period_dates(period=value)
        qs = queryset
        if start:
            qs = qs.filter(expense_date__gte=start)
        if end:
            qs = qs.filter(expense_date__lte=end)
        return qs


DEFAULT_EXPENSE_CATEGORIES = [
    {"name": "إيجار ومرافق المقر", "code": "rent", "description": "إيجار الصالات والمقرات ومرافق الأكاديمية", "sort_order": 1},
    {"name": "كهرباء ومياه وإنترنت", "code": "utilities", "description": "فواتير الخدمات والاتصالات", "sort_order": 2},
    {"name": "شراء وصيانة معدات", "code": "equipment", "description": "بسطات، قفازات، أدوات تدريب وصيانة أجهزة", "sort_order": 3},
    {"name": "مستلزمات وضيافة", "code": "supplies", "description": "ضيافة أولياء الأمور والطلاب وقرطاسية", "sort_order": 4},
    {"name": "تسويق وإعلانات", "code": "marketing", "description": "حملات السوشيال ميديا والتصوير والطباعة", "sort_order": 5},
    {"name": "اشتراكات وبرمجيات", "code": "software", "description": "تطبيقات وأنظمة وسيرفرات", "sort_order": 6},
    {"name": "بطولات ومعسكرات", "code": "events", "description": "رسوم اشتراك البطولات ومصروفات السفر", "sort_order": 7},
    {"name": "رسوم وتراخيص حكومية", "code": "fees", "description": "تراخيص الاتحادات والرسوم البنكية", "sort_order": 8},
    {"name": "أجور ومكافآت متنوعة", "code": "salaries", "description": "أتعاب مدربين زائرين ومكافآت إضافية", "sort_order": 9},
    {"name": "مصاريف تشغيلية متنوعة", "code": "other", "description": "أي نفقات تشغيلية أخرى", "sort_order": 10},
]


class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    queryset = ExpenseCategory.objects.all()
    serializer_class = ExpenseCategorySerializer
    permission_classes = [permissions.IsAuthenticated, CanManageBilling]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code", "description"]
    ordering = ["sort_order", "name"]

    def get_queryset(self):
        qs = super().get_queryset()
        if not qs.exists():
            for cat in DEFAULT_EXPENSE_CATEGORIES:
                ExpenseCategory.objects.create(is_system=True, **cat)
            qs = super().get_queryset()
        return qs.annotate(
            expenses_count=Count("expenses"),
            total_amount=Sum("expenses__total_amount", filter=Q(expenses__status=Expense.Status.PAID))
        )


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related("category", "location").all()
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated, CanManageBilling]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ExpenseFilter
    search_fields = ["title", "expense_number", "vendor_name", "invoice_reference", "notes"]
    ordering = ["-expense_date", "-created_at"]

    def perform_create(self, serializer):
        serializer.save(created_by_id=self.request.user.id)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        expense = self.get_object()
        expense.status = Expense.Status.APPROVED
        expense.approved_by_id = request.user.id
        expense.save(update_fields=["status", "approved_by_id", "updated_at"])
        return Response(self.get_serializer(expense).data)

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        expense = self.get_object()
        expense.status = Expense.Status.PAID
        expense.paid_by_id = request.user.id
        if not expense.payment_date:
            expense.payment_date = timezone.now().date()
        payment_method = request.data.get("payment_method")
        if payment_method:
            expense.payment_method = payment_method
        payment_reference = request.data.get("payment_reference")
        if payment_reference:
            expense.payment_reference = payment_reference
        expense.save(update_fields=["status", "paid_by_id", "payment_date", "payment_method", "payment_reference", "updated_at"])
        return Response(self.get_serializer(expense).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        expense = self.get_object()
        expense.status = Expense.Status.CANCELLED
        expense.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(expense).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """KPI summary for expenses across periods and locations."""
        base_qs = self.get_queryset()
        filter_params = request.query_params.copy()
        filter_params.pop("status", None)

        exp_filter = ExpenseFilter(filter_params, queryset=base_qs, request=request)
        filtered_qs = exp_filter.qs

        tenant = getattr(request, "tenant", None)
        currency = tenant.default_currency if tenant else "JOD"

        paid_qs = filtered_qs.filter(status=Expense.Status.PAID)
        pending_qs = filtered_qs.filter(status__in=[Expense.Status.PENDING, Expense.Status.APPROVED])
        draft_qs = filtered_qs.filter(status=Expense.Status.DRAFT)

        total_paid = paid_qs.aggregate(s=Sum("total_amount"))["s"] or 0
        total_tax_paid = paid_qs.aggregate(s=Sum("tax_amount"))["s"] or 0
        total_pending = pending_qs.aggregate(s=Sum("total_amount"))["s"] or 0
        total_draft = draft_qs.aggregate(s=Sum("total_amount"))["s"] or 0

        category_breakdown = list(
            paid_qs.values("category__id", "category__name")
            .annotate(total=Sum("total_amount"), count=Count("id"))
            .order_by("-total")[:8]
        )

        return Response({
            "total_paid": float(total_paid),
            "total_tax_paid": float(total_tax_paid),
            "total_pending": float(total_pending),
            "total_draft": float(total_draft),
            "count_paid": paid_qs.count(),
            "count_pending": pending_qs.count(),
            "currency": currency,
            "category_breakdown": [
                {
                    "category_id": item["category__id"],
                    "category_name": item["category__name"],
                    "total": float(item["total"]),
                    "count": item["count"],
                    "pct": round((float(item["total"]) / float(total_paid) * 100), 1) if float(total_paid) > 0 else 0,
                }
                for item in category_breakdown
            ],
        })

    @action(detail=False, methods=["get"])
    def cash_flow(self, request):
        """
        Executive Financial Statement & Cash Flow Analysis:
        Compares Inflows (Student Revenue Collections) vs Outflows (Operational Expenses, Staff Payroll, Advances).
        """
        from apps.billing.models import Invoice
        from apps.staff.models import StaffPayslip, StaffAdvance

        period = request.query_params.get("period", "this_month")
        start_param = request.query_params.get("start_date") or request.query_params.get("date_from")
        end_param = request.query_params.get("end_date") or request.query_params.get("date_to")
        start, end = parse_period_dates(period, start_param, end_param)

        location_id = request.query_params.get("location_id") or request.query_params.get("location")

        tenant = getattr(request, "tenant", None)
        currency = tenant.default_currency if tenant else "JOD"

        # 1. Inflows (Revenues Collected)
        inv_qs = Invoice.objects.filter(status__in=[Invoice.Status.PAID, Invoice.Status.PARTIALLY_PAID])
        if location_id:
            inv_qs = inv_qs.filter(student__location_id=location_id)
        if start:
            inv_qs = inv_qs.filter(Q(paid_at__date__gte=start) | (Q(paid_at__isnull=True) & Q(created_at__date__gte=start)))
        if end:
            inv_qs = inv_qs.filter(Q(paid_at__date__lte=end) | (Q(paid_at__isnull=True) & Q(created_at__date__lte=end)))

        total_inflows = inv_qs.aggregate(s=Sum("amount_paid"))["s"] or inv_qs.aggregate(s=Sum("total_amount"))["s"] or 0
        inflows_count = inv_qs.count()

        # 2. Operational Expenses
        exp_qs = Expense.objects.filter(status=Expense.Status.PAID)
        if location_id:
            exp_qs = exp_qs.filter(location_id=location_id)
        if start:
            exp_qs = exp_qs.filter(expense_date__gte=start)
        if end:
            exp_qs = exp_qs.filter(expense_date__lte=end)

        total_operating_expenses = exp_qs.aggregate(s=Sum("total_amount"))["s"] or 0
        total_tax_expenses = exp_qs.aggregate(s=Sum("tax_amount"))["s"] or 0
        expenses_count = exp_qs.count()

        # 3. Staff Payroll Outflows
        payslip_qs = StaffPayslip.objects.filter(status="paid")
        if start:
            payslip_qs = payslip_qs.filter(Q(payment_date__gte=start) | (Q(payment_date__isnull=True) & Q(created_at__date__gte=start)))
        if end:
            payslip_qs = payslip_qs.filter(Q(payment_date__lte=end) | (Q(payment_date__isnull=True) & Q(created_at__date__lte=end)))

        total_payroll = payslip_qs.aggregate(s=Sum("net_salary"))["s"] or 0
        payroll_count = payslip_qs.count()

        # 4. Staff Disbursed Advances Outflows
        adv_qs = StaffAdvance.objects.filter(status__in=[StaffAdvance.Status.DISBURSED, StaffAdvance.Status.REPAID])
        if start:
            adv_qs = adv_qs.filter(disbursed_at__date__gte=start)
        if end:
            adv_qs = adv_qs.filter(disbursed_at__date__lte=end)

        total_advances = adv_qs.aggregate(s=Sum("amount"))["s"] or 0
        advances_count = adv_qs.count()

        # 5. Grand Outflows & Net Cash Flow
        total_outflows = float(total_operating_expenses) + float(total_payroll) + float(total_advances)
        inflows_float = float(total_inflows)
        net_cash_flow = inflows_float - total_outflows

        profit_margin = round((net_cash_flow / inflows_float * 100), 1) if inflows_float > 0 else 0.0
        operating_expense_ratio = round((total_outflows / inflows_float * 100), 1) if inflows_float > 0 else 0.0

        categories_breakdown = list(
            exp_qs.values("category__name")
            .annotate(total=Sum("total_amount"), count=Count("id"))
            .order_by("-total")
        )

        return Response({
            "period": period,
            "start_date": str(start) if start else None,
            "end_date": str(end) if end else None,
            "currency": currency,
            "inflows": {
                "total": inflows_float,
                "count": inflows_count,
            },
            "outflows": {
                "total": total_outflows,
                "operating_expenses": float(total_operating_expenses),
                "operating_expenses_count": expenses_count,
                "tax_amount": float(total_tax_expenses),
                "payroll": float(total_payroll),
                "payroll_count": payroll_count,
                "advances": float(total_advances),
                "advances_count": advances_count,
            },
            "net_cash_flow": round(net_cash_flow, 2),
            "is_surplus": net_cash_flow >= 0,
            "profit_margin_pct": profit_margin,
            "operating_expense_ratio": operating_expense_ratio,
            "categories_breakdown": [
                {
                    "name": item["category__name"],
                    "total": float(item["total"]),
                    "count": item["count"],
                    "pct": round((float(item["total"]) / float(total_operating_expenses) * 100), 1) if float(total_operating_expenses) > 0 else 0,
                }
                for item in categories_breakdown
            ],
        })


class CreditNoteViewSet(BranchScopedMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = CreditNoteSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["credit_note_number", "invoice__invoice_number", "student__full_name", "student__first_name", "student__last_name"]
    ordering = ["-issued_at"]

    def get_queryset(self):
        qs = CreditNote.objects.select_related("invoice", "student").all()
        return self.get_location_filtered_queryset(qs)

