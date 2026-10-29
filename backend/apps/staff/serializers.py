from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from apps.accounts.serializers import UserSerializer
from .models import (
    StaffMember, StaffSalaryConfig, PayrollRun, StaffPayslip, StaffDocument,
    StaffAdvance, StaffAdvanceRepayment
)


class StaffSalaryConfigSerializer(serializers.ModelSerializer):
    staff_name = serializers.ReadOnlyField(source="staff_member.user.get_full_name")
    staff_email = serializers.ReadOnlyField(source="staff_member.user.email")
    staff_role = serializers.ReadOnlyField(source="staff_member.user.role")

    class Meta:
        model = StaffSalaryConfig
        fields = [
            "id", "staff_member", "staff_name", "staff_email", "staff_role",
            "employment_type", "basic_salary", "hourly_rate", "session_rate",
            "currency", "updated_at",
        ]
        read_only_fields = ["id", "staff_member", "updated_at"]


class StaffPayslipSerializer(serializers.ModelSerializer):
    staff_name = serializers.ReadOnlyField(source="staff_member.user.get_full_name")
    staff_email = serializers.ReadOnlyField(source="staff_member.user.email")
    staff_role = serializers.ReadOnlyField(source="staff_member.user.role")

    class Meta:
        model = StaffPayslip
        fields = [
            "id", "payroll_run", "staff_member", "staff_name", "staff_email", "staff_role",
            "employment_type", "basic_salary", "calculated_units", "unit_rate",
            "allowances", "deductions", "advance_deductions", "net_salary", "status", "payment_date",
            "payment_method", "notes", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "payroll_run", "staff_member", "net_salary", "created_at", "updated_at"
        ]


class StaffAdvanceRepaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffAdvanceRepayment
        fields = [
            "id", "advance", "payslip", "amount", "repayment_date",
            "repayment_method", "notes", "recorded_by_id", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class StaffAdvanceSerializer(serializers.ModelSerializer):
    staff_name = serializers.ReadOnlyField(source="staff_member.user.get_full_name")
    staff_email = serializers.ReadOnlyField(source="staff_member.user.email")
    staff_role = serializers.ReadOnlyField(source="staff_member.user.role")
    repayments = StaffAdvanceRepaymentSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    repayment_type_display = serializers.CharField(source="get_repayment_type_display", read_only=True)

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, "copy") else dict(data)
        staff_member_val = data.get("staff_member")
        if staff_member_val:
            try:
                import uuid
                uuid_obj = uuid.UUID(str(staff_member_val))
                member = StaffMember.objects.filter(user_id=uuid_obj).first()
                if member:
                    data["staff_member"] = member.id
            except (ValueError, TypeError):
                pass
        return super().to_internal_value(data)

    class Meta:
        model = StaffAdvance
        fields = [
            "id", "staff_member", "staff_name", "staff_email", "staff_role",
            "amount", "currency", "request_date", "disbursement_date",
            "status", "status_display", "repayment_type", "repayment_type_display",
            "installments_count", "monthly_installment", "total_repaid",
            "remaining_amount", "reason", "rejection_reason", "notes",
            "approved_by_id", "approved_at", "repayments",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "status_display", "repayment_type_display",
            "total_repaid", "remaining_amount", "approved_by_id", "approved_at",
            "created_at", "updated_at",
        ]


class PayrollRunSerializer(serializers.ModelSerializer):
    payslips = StaffPayslipSerializer(many=True, read_only=True)
    total_amount = serializers.SerializerMethodField()
    payslips_count = serializers.SerializerMethodField()

    class Meta:
        model = PayrollRun
        fields = [
            "id", "year", "month", "status", "notes", "payslips",
            "total_amount", "payslips_count", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        validators = [
            UniqueTogetherValidator(
                queryset=PayrollRun.objects.all(),
                fields=["year", "month"],
                message="لقد تم إنشاء مسير رواتب بالفعل لهذا الشهر والسنة. لا يمكن تكرار مسير لنفس الشهر."
            )
        ]

    def get_total_amount(self, obj):
        from django.db.models import Sum
        result = obj.payslips.aggregate(total=Sum("net_salary"))
        return result["total"] or 0.00

    def get_payslips_count(self, obj):
        return obj.payslips.count()

    def validate(self, attrs):
        year = attrs.get("year")
        month = attrs.get("month")
        
        # Prevent duplicate payroll run for the same year/month
        # On update, we should exclude the current instance
        qs = PayrollRun.objects.filter(year=year, month=month)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
            
        if qs.exists():
            raise serializers.ValidationError(
                {"month": "لقد تم إنشاء مسير رواتب بالفعل لهذا الشهر والسنة."}
            )
        return attrs


class StaffDocumentSerializer(serializers.ModelSerializer):
    staff_name = serializers.ReadOnlyField(source="staff_member.user.get_full_name")
    file_name = serializers.SerializerMethodField()
    file_size = serializers.SerializerMethodField()

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, "copy") else dict(data)
        staff_member_val = data.get("staff_member")
        if staff_member_val:
            try:
                import uuid
                uuid_obj = uuid.UUID(str(staff_member_val))
                member = StaffMember.objects.filter(user_id=uuid_obj).first()
                if member:
                    data["staff_member"] = member.id
            except (ValueError, TypeError):
                pass
        return super().to_internal_value(data)

    class Meta:
        model = StaffDocument
        fields = [
            "id", "staff_member", "staff_name", "name", "file", "notes",
            "file_name", "file_size", "uploaded_at",
        ]
        read_only_fields = ["id", "uploaded_at"]

    def get_file_name(self, obj):
        if obj.file:
            import os
            return os.path.basename(obj.file.name)
        return ""

    def get_file_size(self, obj):
        try:
            if obj.file:
                return obj.file.size
        except Exception:
            pass
        return 0
