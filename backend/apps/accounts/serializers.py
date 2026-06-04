"""
MAIDAN — Accounts Serializers
"""

from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .tasks import send_staff_invitation_task


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    branch_names = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "phone", "first_name", "last_name", "full_name",
            "role", "is_active", "avatar", "avatar_url",
            "language_pref", "assigned_location_ids", "branch_names", "permissions",
            "gdpr_consent", "created_at", "last_login",
        ]
        read_only_fields = ["id", "created_at", "last_login", "full_name", "branch_names"]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        
        # Enforce active staff limits when activating a user
        request = self.context.get("request")
        if request and hasattr(request, "tenant") and request.tenant:
            tenant = request.tenant
            if tenant.schema_name != "public":
                plan = tenant.plan
                if plan:
                    new_active = attrs.get("is_active")
                    is_activating = False
                    if self.instance:
                        is_activating = new_active is True and not self.instance.is_active
                    else:
                        is_activating = new_active is True

                    if is_activating:
                        from apps.staff.models import StaffMember
                        active_staff_count = StaffMember.objects.filter(user__is_active=True).count()
                        if active_staff_count >= plan.max_staff:
                            raise serializers.ValidationError(
                                {"is_active": f"لقد تجاوزت الحد الأقصى لعدد الموظفين النشطين المسموح به في باقتك الحالية ({plan.max_staff} موظف)."}
                            )
        return attrs


    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.avatar.url)
        return None

    def get_branch_names(self, obj):
        ids = obj.assigned_location_ids
        if not ids:
            return []
        try:
            from apps.students.models import Location
            return list(Location.objects.filter(id__in=ids).values_list("name", flat=True))
        except Exception:
            pass
        return []


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, required=False, allow_blank=True)
    password_confirm = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "email", "password", "password_confirm",
            "first_name", "last_name",
            "phone", "role", "language_pref", "assigned_location_ids",
        ]

    def validate(self, attrs):
        password = attrs.get("password")
        password_confirm = attrs.get("password_confirm")

        if password or password_confirm:
            if password != password_confirm:
                raise serializers.ValidationError({"password_confirm": "Passwords do not match."})

        # Plan staff capacity check
        request = self.context.get("request")
        if request and hasattr(request, "tenant") and request.tenant:
            tenant = request.tenant
            if tenant.schema_name != "public":
                plan = tenant.plan
                if plan:
                    from apps.staff.models import StaffMember
                    active_staff_count = StaffMember.objects.filter(user__is_active=True).count()
                    if active_staff_count >= plan.max_staff:
                        raise serializers.ValidationError(
                            {"non_field_errors": f"لقد تجاوزت الحد الأقصى لعدد الموظفين النشطين المسموح به في باقتك الحالية ({plan.max_staff} موظف)."}
                        )
        return attrs


    def create(self, validated_data):
        password = validated_data.pop("password", None)
        validated_data.pop("password_confirm", None)

        user = User(**validated_data)
        needs_setup = not password

        if password:
            user.set_password(password)
            user.is_initial_password_set = True
        else:
            # Assign a random unusable password; user must complete setup flow
            from django.utils.crypto import get_random_string
            user.set_password(get_random_string(32))
            user.is_initial_password_set = False

        user.save()

        if needs_setup:
            self._queue_invitation_email(user)

        return user

    def _queue_invitation_email(self, user: User) -> None:
        """Build the setup URL from the request context and queue the invitation task."""
        request = self.context.get("request")
        if not request:
            return

        forwarded_host = (
            request.headers.get("X-Forwarded-Host", "") or request.get_host()
        )
        forwarded_proto = request.headers.get("X-Forwarded-Proto", "")
        scheme = (
            forwarded_proto.split(",")[0].strip() or request.scheme or "https"
        ).lower()
        if forwarded_host.split(":")[0].endswith(".localhost"):
            scheme = "http"

        from urllib.parse import quote
        setup_url = (
            f"{scheme}://{forwarded_host}"
            f"/password/setup?email={quote(user.email)}"
        )

        send_staff_invitation_task.delay(
            user_email=user.email,
            user_name=user.get_full_name(),
            setup_url=setup_url,
        )


class InitialPasswordSetupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    phone = serializers.CharField()

    def validate_email(self, value):
        return value.lower().strip()
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        phone = attrs.get("phone")
        
        try:
            user = User.objects.get(email__iexact=email, is_active=True)
            # We allow setup even if is_initial_password_set is True, 
            # to accommodate users who were created with the old default.
            # The phone check below provides the necessary verification.
            
            # Simple phone verification: check if it matches the registered phone
            # We strip any non-digit characters for comparison
            def clean_phone(p):
                if not p:
                    return ""
                digits = "".join(filter(str.isdigit, str(p)))
                return digits[-9:] if len(digits) >= 9 else digits
            
            cleaned_user_phone = clean_phone(user.phone)
            cleaned_input_phone = clean_phone(phone)
            
            if cleaned_user_phone != cleaned_input_phone:
                from .views import logger
                logger.warning(f"Phone mismatch for {email}: expected {cleaned_user_phone}, got {cleaned_input_phone}")
                raise serializers.ValidationError({"phone": "رقم الهاتف غير مطابق للبيانات المسجلة لدينا."})
            
            attrs["user"] = user
        except User.DoesNotExist:
            from .views import logger
            logger.warning(f"Setup attempt for non-existent user: {email}")
            raise serializers.ValidationError({"email": "المستخدم غير موجود."})
        except serializers.ValidationError:
            raise
        except Exception as e:
            from .views import logger
            logger.error(f"Unexpected error in InitialPasswordSetupSerializer: {e}")
            raise serializers.ValidationError({"non_field_errors": "حدث خطأ غير متوقع."})

        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "كلمات المرور غير متطابقة."})
            
        return attrs


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs["email"].lower().strip()
        password = attrs["password"]

        user = authenticate(request=self.context.get("request"), email=email, password=password)

        if not user:
            from .views import logger
            logger.warning(f"Login failed for email: {email}")
            # Check if user exists but password failed
            try:
                check_user = User.objects.get(email__iexact=email)
                logger.info(f"User exists: {email}, Active: {check_user.is_active}, Initial Setup: {check_user.is_initial_password_set}, Has usable pass: {check_user.has_usable_password()}")
            except User.DoesNotExist:
                logger.info(f"User does not exist: {email}")
            
            raise serializers.ValidationError(
                {"non_field_errors": "Invalid email or password."}
            )

        if not user.is_active:
            raise serializers.ValidationError(
                {"non_field_errors": "Account is disabled."}
            )

        attrs["user"] = user
        return attrs


class TenantDiscoverySerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.lower().strip()


class TokenResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "Passwords do not match."})
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "Passwords do not match."})
        return attrs


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "first_name", "last_name",
            "phone", "language_pref", "avatar",
        ]
