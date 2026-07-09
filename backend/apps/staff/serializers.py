from rest_framework import serializers
from apps.accounts.serializers import UserSerializer
from .models import StaffMember, StaffSalaryConfig, PayrollRun, StaffPayslip, StaffDocument


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
            "allowances", "deductions", "net_salary", "status", "payment_date",
            "payment_method", "notes", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "payroll_run", "staff_member", "net_salary", "created_at", "updated_at"
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
