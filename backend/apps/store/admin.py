from django.contrib import admin
from .models import Product, ProductOption, Order, OrderItem


class ProductOptionInline(admin.TabularInline):
    model = ProductOption
    extra = 1


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["name", "price", "currency", "is_active", "created_at"]
    list_filter = ["is_active", "currency"]
    search_fields = ["name", "description"]
    inlines = [ProductOptionInline]


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ["product", "option", "quantity", "unit_price", "total_price"]


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["id", "student", "status", "payment_method", "payment_status", "total_amount", "created_at"]
    list_filter = ["status", "payment_method", "payment_status", "created_at"]
    search_fields = ["student__first_name", "student__last_name", "id"]
    inlines = [OrderItemInline]
    readonly_fields = ["invoice", "total_amount"]
