"""
MAIDAN — Billing App Views + Serializers + URLs
"""

from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import filters, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from shared.permissions import CanManageBilling, IsStaff
from .models import Invoice, Membership, MembershipPlan
from apps.payments.models import Payment, get_payment_provider


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------

class MembershipPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = MembershipPlan
        fields = [
            "id", "name", "name_ar", "description", "billing_cycle",
            "price", "currency", "setup_fee", "tax_rate",
            "max_classes_per_week", "is_unlimited", "is_active", "is_public",
            "sort_order", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class MembershipSerializer(serializers.ModelSerializer):
    plan_name = serializers.ReadOnlyField(source="plan.name")
    student_name = serializers.SerializerMethodField()
    price = serializers.ReadOnlyField(source="plan.price")
    currency = serializers.ReadOnlyField(source="plan.currency")

    class Meta:
        model = Membership
        fields = [
            "id", "student_id", "student_name", "plan_id", "plan_name",
            "start_date", "end_date", "status", "auto_renew",
            "price", "currency", "notes", "created_at",
        ]
        read_only_fields = ["id", "plan_name", "student_name", "price", "currency", "created_at"]

    def get_student_name(self, obj):
        return obj.student.full_name


class InvoiceSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    amount_due = serializers.ReadOnlyField()

    class Meta:
        model = Invoice
        fields = [
            "id", "invoice_number", "student_id", "student_name",
            "membership_id", "subtotal", "discount_amount", "tax_rate",
            "tax_amount", "total_amount", "amount_paid", "amount_due",
            "currency", "status", "due_date", "paid_at",
            "notes", "is_recurring", "created_at",
        ]
        read_only_fields = [
            "id", "invoice_number", "student_name", "tax_amount",
            "total_amount", "amount_due", "created_at",
        ]

    def get_student_name(self, obj):
        return obj.student.full_name


class PaymentSerializer(serializers.ModelSerializer):
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
        return [permissions.IsAuthenticated()]


class MembershipViewSet(viewsets.ModelViewSet):
    queryset = Membership.objects.select_related("student", "plan").all()
    serializer_class = MembershipSerializer
    permission_classes = [permissions.IsAuthenticated, CanManageBilling]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "student_id", "plan_id"]
    search_fields = ["student__first_name", "student__last_name", "student__student_number"]
    ordering = ["-created_at"]

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        membership = self.get_object()
        membership.status = Membership.Status.CANCELLED
        membership.cancelled_at = timezone.now()
        membership.cancellation_reason = request.data.get("reason", "")
        membership.save()
        return Response({"message": "Membership cancelled."})

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        membership = self.get_object()
        membership.status = Membership.Status.PAUSED
        membership.paused_at = timezone.now()
        membership.pause_reason = request.data.get("reason", "")
        membership.save()
        return Response({"message": "Membership paused."})


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related("student", "membership__plan").all()
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated, CanManageBilling]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "student_id", "is_recurring"]
    search_fields = ["invoice_number", "student__first_name", "student__last_name"]
    ordering = ["-created_at"]

    def perform_create(self, serializer):
        serializer.save(created_by_id=self.request.user.id)

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
