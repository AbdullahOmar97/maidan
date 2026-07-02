from django.contrib import admin
from .models import StudentBelt, PromotionEligibility


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
