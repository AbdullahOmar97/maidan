"""
MAIDAN — Accounts Serializers
"""

from urllib.parse import quote
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.utils import timezone
from rest_framework import serializers

from shared.permissions import resolve_user_permissions
from shared.validators import validate_secure_image_upload
from .models import (
    User,
    default_notification_preferences,
    default_ui_preferences,
)
from .tasks import send_staff_invitation_task


def validate_strong_password(password: str, user=None) -> str:
    """
    Validate password against NIST SP 800-63B & Django AUTH_PASSWORD_VALIDATORS:
    - Minimum 8 characters, maximum 128 characters
    - All printable / special / Unicode characters allowed
    - Checked against UserAttributeSimilarity, CommonPassword, NumericPassword
    """
    if len(password) < 8:
        raise serializers.ValidationError("كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.")
    if len(password) > 128:
        raise serializers.ValidationError("كلمة المرور يجب ألا تتجاوز 128 حرفاً.")

    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(list(exc.messages))

    # TODO(security): Add HaveIBeenPwned k-anonymity range check for leaked password detection.
    return password


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    branch_names = serializers.SerializerMethodField()
    staff_member_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "phone",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "is_active",
            "avatar",
            "avatar_url",
            "language_pref",
            "notification_preferences",
            "ui_preferences",
            "assigned_location_ids",
            "branch_names",
            "permissions",
            "gdpr_consent",
            "created_at",
            "last_login",
            "last_login_ip",
            "password_changed_at",
            "is_initial_password_set",
            "force_password_reset",
            "staff_member_id",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "last_login",
            "last_login_ip",
            "password_changed_at",
            "full_name",
            "branch_names",
            "staff_member_id",
            "is_initial_password_set",
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Always return effective permissions (role defaults + explicit overrides)
        data["permissions"] = resolve_user_permissions(instance)
        if not data.get("notification_preferences"):
            data["notification_preferences"] = default_notification_preferences()
        if not data.get("ui_preferences"):
            data["ui_preferences"] = default_ui_preferences()
        return data

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
                    if self.instance:
                        is_activating = new_active is True and not self.instance.is_active
                    else:
                        is_activating = new_active is True

                    if is_activating:
                        from apps.staff.models import StaffMember

                        active_staff_count = StaffMember.objects.filter(
                            user__is_active=True
                        ).count()
                        if active_staff_count >= plan.max_staff:
                            raise serializers.ValidationError(
                                {
                                    "is_active": (
                                        f"لقد تجاوزت الحد الأقصى لعدد الموظفين النشطين المسموح به في باقتك الحالية ({plan.max_staff} موظف)."
                                    )
                                }
                            )
        return attrs

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
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

    def get_staff_member_id(self, obj):
        try:
            from apps.staff.models import StaffMember

            membership = StaffMember.objects.filter(user_id=obj.id).first()
            return membership.id if membership else None
        except Exception:
            return None


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, min_length=8, max_length=128, required=False, allow_blank=True
    )
    password_confirm = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )

    class Meta:
        model = User
        fields = [
            "email",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
            "phone",
            "role",
            "language_pref",
            "assigned_location_ids",
        ]

    def validate_email(self, value):
        return value.lower().strip()

    def validate(self, attrs):
        password = attrs.get("password")
        password_confirm = attrs.get("password_confirm")

        if password or password_confirm:
            if password != password_confirm:
                raise serializers.ValidationError(
                    {"password_confirm": "كلمات المرور غير متطابقة."}
                )
            validate_strong_password(password)

        # Plan staff capacity check
        request = self.context.get("request")
        if request and hasattr(request, "tenant") and request.tenant:
            tenant = request.tenant
            if tenant.schema_name != "public":
                plan = tenant.plan
                if plan:
                    from apps.staff.models import StaffMember

                    active_staff_count = StaffMember.objects.filter(
                        user__is_active=True
                    ).count()
                    if active_staff_count >= plan.max_staff:
                        raise serializers.ValidationError(
                            {
                                "non_field_errors": (
                                    f"لقد تجاوزت الحد الأقصى لعدد الموظفين النشطين المسموح به في باقتك الحالية ({plan.max_staff} موظف)."
                                )
                            }
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
            user.password_changed_at = timezone.now()
        else:
            from django.utils.crypto import get_random_string

            user.set_password(get_random_string(32))
            user.is_initial_password_set = False

        user.save()

        if needs_setup:
            self._queue_invitation_email(user)

        return user

    def _queue_invitation_email(self, user: User) -> None:
        """Build the setup URL with a signed invitation token and queue the email task."""
        request = self.context.get("request")
        if not request:
            return

        forwarded_host = request.headers.get("X-Forwarded-Host", "") or request.get_host()
        forwarded_proto = request.headers.get("X-Forwarded-Proto", "")
        scheme = (
            forwarded_proto.split(",")[0].strip() or request.scheme or "https"
        ).lower()
        if forwarded_host.split(":")[0].endswith(".localhost"):
            scheme = "http"

        signer = TimestampSigner(salt="maidan.initial_password_setup")
        signed_token = signer.sign(str(user.id))

        setup_url = (
            f"{scheme}://{forwarded_host}"
            f"/setup-password?email={quote(user.email)}&token={quote(signed_token)}"
        )

        send_staff_invitation_task.delay(
            user_email=user.email,
            user_name=user.get_full_name(),
            setup_url=setup_url,
        )


class InitialPasswordSetupSerializer(serializers.Serializer):
    """
    One-time initial password setup for newly invited staff accounts.
    Strictly restricted to accounts where `is_initial_password_set=False`.
    Does not require phone verification.
    """

    email = serializers.EmailField()
    token = serializers.CharField(required=False, allow_blank=True)
    new_password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate_email(self, value):
        return value.lower().strip()

    def validate(self, attrs):
        email = attrs.get("email")
        token = (attrs.get("token") or "").strip()

        try:
            user = User.objects.get(email__iexact=email, is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError(
                {"email": "لم يتم العثور على حساب نشط مرتبط بهذا البريد الإلكتروني."}
            )

        # Security guard: prevent account takeover on already-activated accounts
        if user.is_initial_password_set:
            raise serializers.ValidationError(
                {
                    "non_field_errors": (
                        "تم تفعيل هذا الحساب وضبط كلمة المرور مسبقاً. يرجى استخدام خيار «نسيت كلمة المرور» لإعادة التعيين."
                    )
                }
            )

        # If a signed invitation token was supplied, verify its signature and 7-day TTL
        if token:
            signer = TimestampSigner(salt="maidan.initial_password_setup")
            try:
                unsigned_user_id = signer.unsign(token, max_age=7 * 24 * 3600)
                if str(unsigned_user_id) != str(user.id):
                    raise serializers.ValidationError(
                        {"token": "رمز الدعوة غير صالح لهذا الحساب."}
                    )
            except SignatureExpired:
                raise serializers.ValidationError(
                    {"token": "انتهت صلاحية رابط التفعيل. يرجى طلب رابط جديد من الإدارة."}
                )
            except BadSignature:
                raise serializers.ValidationError(
                    {"token": "رابط التفعيل غير صالح."}
                )

        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "كلمات المرور غير متطابقة."}
            )

        validate_strong_password(attrs["new_password"], user=user)
        attrs["user"] = user
        return attrs


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs["email"].lower().strip()
        password = attrs["password"]

        user = authenticate(
            request=self.context.get("request"), email=email, password=password
        )

        if not user:
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
    new_password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    new_password_confirm = serializers.CharField(write_only=True)
    logout_other_devices = serializers.BooleanField(default=True, required=False)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("كلمة المرور الحالية غير صحيحة.")
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "كلمات المرور الجديدة غير متطابقة."}
            )
        if attrs.get("current_password") == attrs["new_password"]:
            raise serializers.ValidationError(
                {"new_password": "كلمة المرور الجديدة يجب أن تختلف عن كلمة المرور الحالية."}
            )
        validate_strong_password(attrs["new_password"], user=user)
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.lower().strip()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    new_password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "كلمات المرور غير متطابقة."}
            )
        validate_strong_password(attrs["new_password"])
        return attrs


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    remove_avatar = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "phone",
            "language_pref",
            "avatar",
            "remove_avatar",
            "notification_preferences",
            "ui_preferences",
        ]

    def validate_first_name(self, value):
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("الاسم الأول مطلوب.")
        return cleaned

    def validate_last_name(self, value):
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("الاسم الأخير مطلوب.")
        return cleaned

    def validate_avatar(self, value):
        if value:
            validate_secure_image_upload(value, max_size_mb=5)
        return value

    def validate_notification_preferences(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("تفضيلات الإشعارات يجب أن تكون كائناً صالحاً.")

        defaults = default_notification_preferences()
        in_app_in = value.get("in_app", value)
        if not isinstance(in_app_in, dict):
            in_app_in = {}

        sanitized_in_app = {}
        for key, default_val in defaults["in_app"].items():
            if key in in_app_in:
                sanitized_in_app[key] = bool(in_app_in[key])
            else:
                sanitized_in_app[key] = default_val

        # Security notifications are always kept active
        sanitized_in_app["security"] = True
        return {"in_app": sanitized_in_app}

    def validate_ui_preferences(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("تفضيلات الواجهة يجب أن تكون كائناً صالحاً.")

        defaults = default_ui_preferences()
        theme = value.get("theme", defaults["theme"])
        if theme not in ("dark", "light", "system"):
            theme = "dark"

        compact_tables = bool(value.get("compact_tables", defaults["compact_tables"]))
        default_period = str(
            value.get("default_dashboard_period", defaults["default_dashboard_period"])
        )
        if default_period not in ("today", "week", "month", "year"):
            default_period = "month"

        return {
            "theme": theme,
            "compact_tables": compact_tables,
            "default_dashboard_period": default_period,
        }

    def update(self, instance, validated_data):
        remove_avatar = validated_data.pop("remove_avatar", False)
        if remove_avatar and instance.avatar:
            instance.avatar.delete(save=False)
            instance.avatar = None
        return super().update(instance, validated_data)
