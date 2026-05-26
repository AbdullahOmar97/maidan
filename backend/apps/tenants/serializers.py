"""MAIDAN — Tenants App Serializers"""
from django.db import transaction
from django.conf import settings
from rest_framework import serializers
from .models import Tenant, Domain, Plan, PlatformSettings, SubscriptionChangeRequest
from apps.accounts.models import User

class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

class DomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Domain
        fields = ["id", "domain", "is_primary"]

class TenantSerializer(serializers.ModelSerializer):
    domains = DomainSerializer(many=True, read_only=True)
    domain_input = serializers.CharField(write_only=True, required=False)
    
    active_students_count = serializers.SerializerMethodField()
    active_locations_count = serializers.SerializerMethodField()
    active_staff_count = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = [
            "id", "name", "business_name", "slug", "schema_name", "email", "phone", 
            "is_active", "plan", "on_trial", "trial_ends_at",
            "logo", "favicon", "default_language",
            "default_currency", "timezone", "country", "created_at",
            "domains", "domain_input",
            "active_students_count", "active_locations_count", "active_staff_count"
        ]
        read_only_fields = ["id", "slug", "schema_name", "created_at"]

    def get_active_students_count(self, obj):
        from django_tenants.utils import schema_context
        from apps.students.models import Student
        try:
            with schema_context(obj.schema_name):
                return Student.objects.filter(status="active", deleted_at__isnull=True).count()
        except Exception:
            return 0

    def get_active_locations_count(self, obj):
        from django_tenants.utils import schema_context
        from apps.students.models import Location
        try:
            with schema_context(obj.schema_name):
                return Location.objects.filter(is_active=True).count()
        except Exception:
            return 0

    def get_active_staff_count(self, obj):
        from django_tenants.utils import schema_context
        from apps.staff.models import StaffMember
        try:
            with schema_context(obj.schema_name):
                return StaffMember.objects.filter(user__is_active=True).count()
        except Exception:
            return 0


    def to_representation(self, instance):
        data = super().to_representation(instance)
        # If no logo or favicon, fall back to platform settings
        if not data.get("logo") or not data.get("favicon"):
            try:
                platform_settings = PlatformSettings.objects.first()
                if platform_settings:
                    request = self.context.get("request")
                    
                    if not data.get("logo") and platform_settings.logo:
                        if request:
                            data["logo"] = request.build_absolute_uri(platform_settings.logo.url)
                        else:
                            data["logo"] = platform_settings.logo.url
                            
                    if not data.get("favicon") and platform_settings.favicon:
                        if request:
                            data["favicon"] = request.build_absolute_uri(platform_settings.favicon.url)
                        else:
                            data["favicon"] = platform_settings.favicon.url
            except Exception:
                pass
        return data

    def create(self, validated_data):
        domain_input = validated_data.pop("domain_input", None)
        with transaction.atomic():
            tenant = Tenant.objects.create(**validated_data)
            if domain_input:
                Domain.objects.create(
                    domain=domain_input,
                    tenant=tenant,
                    is_primary=True
                )
            return tenant

class TenantRegistrationSerializer(serializers.Serializer):
    # User info
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    
    # Tenant info
    academy_name = serializers.CharField(max_length=200)
    slug = serializers.SlugField()
    plan_id = serializers.IntegerField()

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("User with this email already exists.")
        return value.lower().strip()

    def validate_slug(self, value):
        value = value.lower().strip()
        if Tenant.objects.filter(slug=value).exists():
            raise serializers.ValidationError("This academy slug is already taken.")
        # Avoid reserved words
        reserved = ["admin", "public", "api", "www", "mail", "static", "media"]
        if value in reserved:
            raise serializers.ValidationError("This slug is reserved.")
        return value

    def create(self, validated_data):
        email = validated_data["email"]
        password = validated_data["password"]
        first_name = validated_data["first_name"]
        last_name = validated_data["last_name"]
        academy_name = validated_data["academy_name"]
        slug = validated_data["slug"]
        plan_id = validated_data["plan_id"]

        with transaction.atomic():
            # 1. Create User
            user = User.objects.create_user(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role="tenant_owner"
            )

            # 2. Create Tenant
            # schema_name must be same as slug (sanitized)
            schema_name = slug.replace("-", "_")
            tenant = Tenant.objects.create(
                name=academy_name,
                business_name=academy_name,
                slug=slug,
                schema_name=schema_name,
                email=email,
                plan_id=plan_id,
                is_active=False,
                status=Tenant.SubscriptionStatus.PENDING,
                on_trial=False
            )

            # 3. Create Domain
            # If PLATFORM_DOMAIN is set, use slug.PLATFORM_DOMAIN
            platform_domain = getattr(settings, "PLATFORM_DOMAIN", "localhost")
            domain_name = f"{slug}.{platform_domain}"
            Domain.objects.create(
                domain=domain_name,
                tenant=tenant,
                is_primary=True
            )

            return tenant


class SubscriptionChangeRequestSerializer(serializers.ModelSerializer):
    tenant_name = serializers.ReadOnlyField(source="tenant.name")
    old_plan_name = serializers.ReadOnlyField(source="old_plan.name")
    new_plan_name = serializers.ReadOnlyField(source="new_plan.name")
    requested_by_email = serializers.ReadOnlyField(source="requested_by.email")

    class Meta:
        model = SubscriptionChangeRequest
        fields = [
            "id", "tenant", "tenant_name", "old_plan", "old_plan_name", 
            "new_plan", "new_plan_name", "status", "reason", 
            "admin_notes", "requested_by", "requested_by_email",
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "tenant", "old_plan", "status", "admin_notes", "requested_by", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        if request and request.user:
            # Check if there is already a pending request for this tenant
            tenant = getattr(request, "tenant", None)
            if tenant:
                exists = SubscriptionChangeRequest.objects.filter(
                    tenant=tenant,
                    status=SubscriptionChangeRequest.Status.PENDING
                ).exists()
                if exists:
                    raise serializers.ValidationError(
                        {"non_field_errors": "لديك طلب تغيير باقة معلق بالفعل. يرجى الانتظار لحين مراجعته."}
                    )
        return attrs

