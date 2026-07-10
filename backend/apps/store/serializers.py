from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from apps.students.models import Student
from apps.billing.models import Invoice
from .models import Product, ProductOption, Order, OrderItem


class ProductOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductOption
        fields = ["id", "name", "value", "additional_price", "stock", "min_stock_threshold"]


class ProductSerializer(serializers.ModelSerializer):
    options = ProductOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "description",
            "price",
            "currency",
            "image",
            "is_active",
            "options",
            "created_at",
            "updated_at",
        ]


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    option_value = serializers.CharField(source="option.value", read_only=True)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product",
            "product_name",
            "option",
            "option_value",
            "quantity",
            "unit_price",
            "total_price",
        ]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
    student_name = serializers.SerializerMethodField()
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "student",
            "student_name",
            "buyer_name",
            "buyer_phone",
            "buyer_email",
            "status",
            "payment_method",
            "payment_status",
            "invoice",
            "invoice_number",
            "total_amount",
            "notes",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["invoice", "total_amount", "payment_status"]

    def get_student_name(self, obj):
        if obj.student:
            return f"{obj.student.first_name} {obj.student.last_name}"
        return obj.buyer_name or "مشتري خارجي"

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("الطلب يجب أن يحتوي على منتج واحد على الأقل.")
        return value

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        student = validated_data.pop("student", None)
        buyer_name = validated_data.pop("buyer_name", None)
        buyer_phone = validated_data.pop("buyer_phone", None)
        buyer_email = validated_data.pop("buyer_email", None)
        payment_method = validated_data.pop("payment_method", Order.PaymentMethod.CASH)

        if not student and not buyer_name:
            raise serializers.ValidationError("يجب تحديد طالب أو تزويد بيانات المشتري الخارجي لإنشاء الطلب.")

        with transaction.atomic():
            # Create a placeholder order to get ID and update it later with total_amount
            order = Order.objects.create(
                student=student,
                buyer_name=buyer_name,
                buyer_phone=buyer_phone,
                buyer_email=buyer_email,
                total_amount=0.00,
                payment_method=payment_method,
                **validated_data
            )

            total_amount = 0
            order_items = []

            for item_data in items_data:
                product = item_data["product"]
                option = item_data.get("option", None)
                quantity = item_data["quantity"]

                if not product.is_active:
                    raise serializers.ValidationError(f"المنتج {product.name} غير متاح حالياً.")

                # Check stock and calculate price
                unit_price = product.price
                if option:
                    if option.product != product:
                        raise serializers.ValidationError(
                            f"الخيار {option.value} لا ينتمي للمنتج {product.name}."
                        )
                    if option.stock < quantity:
                        raise serializers.ValidationError(
                            f"المخزون غير كافٍ للخيار {option.value} للمنتج {product.name}. المتاح: {option.stock}."
                        )
                    # Deduct option stock
                    option.stock -= quantity
                    option.save()
                    unit_price += option.additional_price
                else:
                    # If product has options but user did not select one, check if product has active options
                    if product.options.exists():
                        raise serializers.ValidationError(
                            f"يجب اختيار حجم أو لون للمنتج {product.name}."
                        )
                    # Wait, if product has no options, does it have a global stock?
                    # Since our model only stores stock on options, we assume a product either has options
                    # or is custom. Let's assume for simplicity that products without options have unlimited stock
                    # or custom stock. Let's let them pass, or check if we want to enforce it.
                    pass

                item_total = unit_price * quantity
                total_amount += item_total

                order_items.append(
                    OrderItem(
                        order=order,
                        product=product,
                        option=option,
                        quantity=quantity,
                        unit_price=unit_price,
                        total_price=item_total
                    )
                )

            # Bulk create items
            OrderItem.objects.bulk_create(order_items)

            # Update total amount
            order.total_amount = total_amount

            # Create an invoice in Maidan billing system if the order belongs to a student
            if student:
                # Since Maidan Invoice requires a due date, let's set it to today
                due_date = timezone.now().date()
                
                # Tax calculations (standard 15% like membership plan, or let's use subtotal equal to total_amount)
                tax_rate = Decimal("15.0")  # standard
                subtotal = total_amount / (Decimal("1.0") + (tax_rate / Decimal("100.0")))
                tax_amount = total_amount - subtotal

                invoice = Invoice.objects.create(
                    student=student,
                    subtotal=subtotal,
                    discount_amount=0,
                    tax_rate=tax_rate,
                    tax_amount=tax_amount,
                    total_amount=total_amount,
                    amount_paid=0.00,
                    currency=product.currency,
                    status=Invoice.Status.PENDING,
                    due_date=due_date,
                    is_recurring=False,
                    notes=f"فاتورة طلب متجر #{order.id}"
                )

                order.invoice = invoice
                order.save()

            return order
