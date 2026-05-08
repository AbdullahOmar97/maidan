"""
MAIDAN — Billing App Views + Serializers + URLs
"""

from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import filters, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from shared.permissions import (
    CanManageBilling, IsStaff,
    CanCreateInvoice, CanRenewSubscription,
    CanChangeSubscription, CanApproveSubscription,
    CanVoidInvoice, CanApplyDiscount, CanMarkInvoicePaid,
    BranchScopedMixin,
)
from .models import Invoice, Membership, MembershipPlan
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

    class Meta:
        model = Membership
        fields = [
            "id", "student_id", "student_name", "plan_id", "plan_name",
            "start_date", "end_date", "status", "auto_renew",
            "price", "currency", "notes",
            "approved_by_id", "approved_at",
            "created_by_id", "created_at",
        ]
        read_only_fields = [
            "id", "plan_name", "student_name", "price", "currency",
            "approved_by_id", "approved_at", "created_by_id", "created_at",
        ]

    def get_student_name(self, obj):
        return obj.student.full_name


class InvoiceSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    plan_name = serializers.SerializerMethodField()
    amount_due = serializers.ReadOnlyField()
    is_overdue = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    paid_by_name = serializers.SerializerMethodField()
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=Student.objects.all(), source="student"
    )
    membership_id = serializers.PrimaryKeyRelatedField(
        queryset=Membership.objects.all(), source="membership", required=False, allow_null=True
    )

    class Meta:
        model = Invoice
        fields = [
            "id", "invoice_number", "student_id", "student_name",
            "membership_id", "plan_name", "subtotal", "discount_amount", "tax_rate",
            "tax_amount", "total_amount", "amount_paid", "amount_due", "is_overdue",
            "currency", "status", "due_date", "paid_at",
            "notes", "is_recurring", "created_by_id", "created_by_name",
            "paid_by_id", "paid_by_name", "created_at",
        ]
        read_only_fields = [
            "id", "invoice_number", "student_name", "tax_amount",
            "total_amount", "amount_due", "is_overdue",
            "created_by_id", "created_by_name", "paid_by_id", "paid_by_name", "created_at",
        ]

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
        # list / retrieve — still requires explicit package management permission
        return [permissions.IsAuthenticated(), CanManageBilling()]


class MembershipViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    serializer_class = MembershipSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "student_id", "plan_id"]
    search_fields = ["student__first_name", "student__last_name", "student__student_number"]
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
        serializer.save(created_by_id=self.request.user.id)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve a PENDING_APPROVAL membership → transitions to PENDING (awaiting payment)."""
        membership = self.get_object()
        if membership.status != Membership.Status.PENDING_APPROVAL:
            return Response(
                {"error": "هذا الاشتراك ليس في حالة انتظار الموافقة."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        membership.status = Membership.Status.PENDING
        membership.approved_by_id = request.user.id
        membership.approved_at = timezone.now()
        membership.save(update_fields=["status", "approved_by_id", "approved_at"])

        # Now that it's approved, create the invoice if not already present
        if not membership.invoices.exists():
            from .models import MembershipPlan
            plan = membership.plan
            from decimal import Decimal
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

        from datetime import timedelta
        new_start = membership.end_date or timezone.now().date()
        plan = membership.plan
        # Compute new end_date based on billing cycle
        cycle_days = {
            "weekly": 7, "monthly": 30, "quarterly": 90,
            "semi_annual": 180, "annual": 365,
        }
        days = cycle_days.get(plan.billing_cycle, 30)
        new_end = new_start + timedelta(days=days)

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


class InvoiceViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "student_id", "is_recurring"]
    search_fields = ["invoice_number", "student__first_name", "student__last_name"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = Invoice.objects.select_related("student", "membership__plan").all()
        return self.get_location_filtered_queryset(qs)

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated(), CanCreateInvoice()]
        if self.action == "void":
            return [permissions.IsAuthenticated(), CanVoidInvoice()]
        if self.action == "mark_paid":
            return [permissions.IsAuthenticated(), CanMarkInvoicePaid()]
        # All other write actions require general billing management
        if self.action in ["update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), CanManageBilling()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(created_by_id=self.request.user.id)

    @action(detail=True, methods=["post"])
    def void(self, request, pk=None):
        """Void an invoice — marks it as cancelled with no financial effect."""
        invoice = self.get_object()
        if invoice.status in [Invoice.Status.PAID, Invoice.Status.VOID]:
            return Response(
                {"error": "لا يمكن إلغاء فاتورة مدفوعة أو ملغاة مسبقاً."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invoice.status = Invoice.Status.VOID
        invoice.notes = (invoice.notes + f"\n[ملغاة بواسطة {request.user.get_full_name()} في {timezone.now().date()}]").strip()
        invoice.save(update_fields=["status", "notes"])
        return Response({"message": "تم إلغاء الفاتورة."})

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        """
        Manually confirm full payment for an invoice (cash / offline).
        Sets status=PAID, amount_paid=total_amount, paid_at=now.
        Requires `can_mark_invoice_paid` granular permission.
        """
        invoice = self.get_object()

        UNPAYABLE_STATUSES = {Invoice.Status.PAID, Invoice.Status.VOID, Invoice.Status.REFUNDED}
        if invoice.status in UNPAYABLE_STATUSES:
            return Response(
                {"error": f"لا يمكن تأكيد سداد فاتورة بحالة: {invoice.get_status_display()}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment_method = request.data.get("payment_method", "cash")
        note = request.data.get("note", "")

        now = timezone.now()
        invoice.status = Invoice.Status.PAID
        invoice.amount_paid = invoice.total_amount
        invoice.paid_at = now
        invoice.paid_by_id = request.user.id
        audit_note = f"[سداد يدوي — {payment_method} — بواسطة {request.user.get_full_name()} في {now.date()}]"
        if note:
            audit_note += f" {note}"
        invoice.notes = (invoice.notes + f"\n{audit_note}").strip()
        invoice.save(update_fields=["status", "amount_paid", "paid_at", "paid_by_id", "notes"])

        serializer = self.get_serializer(invoice)
        return Response(serializer.data)

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
        """Revenue summary for dashboard."""
        qs = self.get_queryset()
        today = timezone.now().date()
        return Response({
            "total_paid": qs.filter(status="paid").aggregate(s=Sum("total_amount"))["s"] or 0,
            "total_pending": qs.filter(status="pending").aggregate(s=Sum("total_amount"))["s"] or 0,
            "total_overdue": qs.filter(status="overdue").aggregate(s=Sum("total_amount"))["s"] or 0,
            "overdue_count": qs.filter(status="overdue").count(),
            "paid_this_month": qs.filter(
                status="paid",
                paid_at__month=today.month,
                paid_at__year=today.year,
            ).aggregate(s=Sum("total_amount"))["s"] or 0,
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
