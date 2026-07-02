from django.contrib import admin
from .models import Belt, StudentBelt, PromotionEligibility


@admin.register(Belt)
class BeltAdmin(admin.ModelAdmin):
    list_display = ("name", "name_ar", "martial_art", "order_index", "min_attendance_sessions", "min_months_since_last", "is_active")
    list_filter = ("martial_art", "is_active")
    search_fields = ("name", "name_ar")
    ordering = ("martial_art", "order_index")


@admin.register(StudentBelt)
class StudentBeltAdmin(admin.ModelAdmin):
    list_display = ("student", "belt_rank", "promoted_at", "is_current")
    list_filter = ("is_current", "belt_rank")
    search_fields = ("student__first_name", "student__last_name")


@admin.register(PromotionEligibility)
class PromotionEligibilityAdmin(admin.ModelAdmin):
    list_display = ("student", "next_belt", "is_eligible", "checked_at")
    list_filter = ("is_eligible",)
    search_fields = ("student__first_name", "student__last_name")
