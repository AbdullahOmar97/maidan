from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone

from shared.permissions import IsStaff, RoleChoices
from shared.mixins import AuditMixin
from apps.billing.models import Invoice
from .models import Product, ProductOption, Order, OrderItem
from .serializers import ProductSerializer, ProductOptionSerializer, OrderSerializer


class ProductViewSet(AuditMixin, viewsets.ModelViewSet):
    """ViewSet for managing products in the store."""

    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "add_option"]:
            return [IsStaff()]
        if self.action in ["list", "retrieve"]:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        # Clients (students/parents) can only see active products
        user = self.request.user
        if user.is_authenticated and (user.role in RoleChoices.STAFF_ROLES or user.is_staff):
            return Product.objects.all()
        return Product.objects.filter(is_active=True)

    @action(detail=True, methods=["post"], url_path="options")
    def add_option(self, request, pk=None):
        """Custom endpoint to add an option/variation to a product."""
        product = self.get_object()
        serializer = ProductOptionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(product=product)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OrderViewSet(AuditMixin, viewsets.ModelViewSet):
    """ViewSet for placing and managing store orders."""

    queryset = Order.objects.all()
    serializer_class = OrderSerializer

    def get_permissions(self):
        if self.action == "create":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Order.objects.none()
        if user.role in RoleChoices.STAFF_ROLES or user.is_staff:
            return Order.objects.all()

        # Filter by student account or parent's family
        if hasattr(user, "student_profile"):
            return Order.objects.filter(student=user.student_profile)
        
        # Parent mapping: filter by family primary email
        return Order.objects.filter(student__family__primary_contact_email=user.email)

    def perform_create(self, serializer):
        user = self.request.user
        if user and user.is_authenticated:
            if not (user.role in RoleChoices.STAFF_ROLES or user.is_staff):
                if hasattr(user, "student_profile"):
                    serializer.save(student=user.student_profile)
                    return
        serializer.save()

    @action(detail=True, methods=["post"], url_path="update-status", permission_classes=[IsStaff])
    def update_status(self, request, pk=None):
        """Update order and payment status (Staff only)."""
        order = self.get_object()
        new_status = request.data.get("status")
        payment_status = request.data.get("payment_status")

        if new_status and new_status not in Order.Status.values:
            return Response({"error": "حالة طلب غير صالحة."}, status=status.HTTP_400_BAD_REQUEST)

        if payment_status and payment_status not in Order.PaymentStatus.values:
            return Response({"error": "حالة دفع غير صالحة."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if new_status:
                # If changing to CANCELLED, restore stock
                if new_status == Order.Status.CANCELLED and order.status != Order.Status.CANCELLED:
                    self._restore_order_stock(order)
                    if order.invoice:
                        order.invoice.status = Invoice.Status.VOID
                        order.invoice.save()

                order.status = new_status

            if payment_status:
                order.payment_status = payment_status
                if payment_status == Order.PaymentStatus.PAID and order.invoice:
                    order.invoice.status = Invoice.Status.PAID
                    order.invoice.amount_paid = order.invoice.total_amount
                    order.invoice.paid_at = timezone.now()
                    order.invoice.save()

            order.save()

        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Cancel a pending order (accessible by the ordering student/parent or staff)."""
        order = self.get_object()
        user = request.user

        # Permission check: must be staff, or the student themselves
        is_owner = hasattr(user, "student_profile") and order.student == user.student_profile
        is_parent = order.student.family and order.student.family.primary_contact_email == user.email
        is_staff = user.role in RoleChoices.STAFF_ROLES or user.is_staff

        if not (is_owner or is_parent or is_staff):
            return Response(
                {"error": "لا تملك الصلاحية لإلغاء هذا الطلب."},
                status=status.HTTP_403_FORBIDDEN
            )

        if order.status == Order.Status.CANCELLED:
            return Response({"error": "الطلب ملغى بالفعل."}, status=status.HTTP_400_BAD_REQUEST)

        if order.status in [Order.Status.READY, Order.Status.COMPLETED] and not is_staff:
            return Response(
                {"error": "لا يمكن إلغاء الطلبات الجاهزة أو المكتملة إلا بواسطة الموظفين."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            self._restore_order_stock(order)
            order.status = Order.Status.CANCELLED
            if order.invoice:
                order.invoice.status = Invoice.Status.VOID
                order.invoice.save()
            order.save()

        return Response(OrderSerializer(order).data)

    def _restore_order_stock(self, order):
        """Helper to restore stock when an order is cancelled."""
        for item in order.items.all():
            if item.option:
                item.option.stock += item.quantity
                item.option.save()
