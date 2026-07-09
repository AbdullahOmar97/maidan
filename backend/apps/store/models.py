"""
MAIDAN — Store App Models

Manages products, variations, orders, and order items.
Tenant-scoped (schema-specific).
"""

from django.db import models
from apps.students.models import Student
from apps.billing.models import Invoice
from apps.tenants.models import CURRENCY_CHOICES


class Product(models.Model):
    """SaaS tenant-scoped product catalog."""

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default="JOD")
    image = models.ImageField(upload_to="store/products/", null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.price} {self.currency})"


class ProductOption(models.Model):
    """Size, color, or other variations for a product."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="options")
    name = models.CharField(max_length=50)  # e.g., "Size", "Color"
    value = models.CharField(max_length=50)  # e.g., "M", "L", "Red"
    additional_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    stock = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("product", "name", "value")

    def __str__(self):
        opt_str = f"{self.name}: {self.value}"
        if self.additional_price > 0:
            opt_str += f" (+{self.additional_price})"
        return f"{self.product.name} - {opt_str} (Stock: {self.stock})"


class Order(models.Model):
    """Order placed by or on behalf of a student."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready for Pickup"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    class PaymentMethod(models.TextChoices):
        CASH = "cash", "Cash/Manual"
        ONLINE = "online", "Online Payment"

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        REFUNDED = "refunded", "Refunded"
        FAILED = "failed", "Failed"

    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="store_orders")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    invoice = models.ForeignKey(Invoice, on_delete=models.SET_NULL, null=True, blank=True, related_name="store_orders")
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Order #{self.id} — {self.student.first_name} {self.student.last_name} ({self.status})"


class OrderItem(models.Model):
    """Individual item inside a store order."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")
    option = models.ForeignKey(ProductOption, on_delete=models.SET_NULL, null=True, blank=True, related_name="order_items")
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        opt_str = f" ({self.option.value})" if self.option else ""
        return f"{self.quantity}x {self.product.name}{opt_str} in Order #{self.order.id}"
