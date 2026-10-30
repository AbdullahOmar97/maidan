"""
MAIDAN — Accounts Views
"""

import logging
from datetime import timedelta
from urllib.parse import quote

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from django_tenants.utils import schema_context
from rest_framework import generics, permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.audit.utils import log_action
from apps.tenants.models import Domain, Tenant
from shared.auth import create_tokens_for_user, revoke_all_user_tokens
from shared.permissions import RoleChoices, has_effective_permission
from .models import PasswordResetToken, User
from .serializers import (
    InitialPasswordSetupSerializer,
    LoginSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    TenantDiscoverySerializer,
    UserCreateSerializer,
    UserProfileUpdateSerializer,
    UserSerializer,
)
from .tasks import send_password_reset_email

logger = logging.getLogger("maidan")

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 15 * 60  # 15 minutes


def _get_client_ip(request) -> str:
    ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", ""))
    return ip.split(",")[0].strip() if ip else "0.0.0.0"


def _lockout_cache_key(email: str, ip: str) -> str:
    return f"auth_lockout:{email.lower().strip()}:{ip}"


def _get_failed_attempts(email: str, ip: str) -> int:
    try:
        return int(cache.get(_lockout_cache_key(email, ip), 0) or 0)
    except Exception:
        return 0


def _record_failed_attempt(email: str, ip: str) -> int:
    try:
        key = _lockout_cache_key(email, ip)
        attempts = int(cache.get(key, 0) or 0) + 1
        cache.set(key, attempts, timeout=LOCKOUT_DURATION_SECONDS)
        return attempts
    except Exception:
        return 1


def _clear_failed_attempts(email: str, ip: str) -> None:
    try:
        cache.delete(_lockout_cache_key(email, ip))
    except Exception:
        pass


def _user_belongs_to_tenant(user: User, tenant: Tenant | None) -> bool:
    """
    Verify that `user` is authorized to log into `tenant`.
    - Platform admins can access all tenants.
    - Public schema login is allowed for platform admins.
    - Tenant schema login requires a StaffMember record in that tenant schema,
      or matching owner email on the tenant record.
    """
    if user.role == RoleChoices.PLATFORM_ADMIN:
        return True

    if not tenant or tenant.schema_name == "public":
        return True

    if tenant.email and tenant.email.lower().strip() == user.email.lower().strip():
        return True

    try:
        with schema_context(tenant.schema_name):
            from apps.staff.models import StaffMember

            if StaffMember.objects.filter(user_id=user.id).exists():
                return True
    except Exception as exc:
        logger.warning(
            "Tenant membership check failed for user=%s tenant=%s: %s",
            user.id,
            tenant.schema_name,
            exc,
        )

    return False


class LoginView(APIView):
    """JWT Login — returns tenant-bound access + refresh tokens with brute-force protection."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth_login"

    def post(self, request):
        # 1. Resolve tenant from request or Host header
        tenant = getattr(request, "tenant", None)
        if not tenant or tenant.schema_name == "public":
            host = request.headers.get("X-Forwarded-Host", request.get_host()).split(":")[0]
            if "." in host:
                subdomain = host.split(".")[0]
                tenant = Tenant.objects.filter(slug__iexact=subdomain).first()

        if tenant and tenant.schema_name != "public":
            if not tenant.is_active or tenant.status not in [
                Tenant.SubscriptionStatus.ACTIVE,
                Tenant.SubscriptionStatus.TRIAL,
            ]:
                message = "هذا النادي غير نشط حالياً. يرجى التواصل مع الإدارة."
                if tenant.status == Tenant.SubscriptionStatus.PENDING:
                    message = "حسابك قيد المراجعة حالياً. سيتم تفعيله قريباً."
                elif tenant.status == Tenant.SubscriptionStatus.EXPIRED:
                    message = "لقد انتهى اشتراكك. يرجى التجديد للمتابعة."
                elif tenant.status == Tenant.SubscriptionStatus.INACTIVE:
                    message = "هذا النادي معطل حالياً. يرجى مراجعة الإدارة."

                return Response(
                    {
                        "error": {
                            "code": "tenant_inactive",
                            "message": message,
                            "status": tenant.status,
                        }
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        raw_email = str(request.data.get("email", "")).lower().strip()
        client_ip = _get_client_ip(request)

        # 2. Check brute-force lockout before authenticating
        if raw_email and _get_failed_attempts(raw_email, client_ip) >= MAX_LOGIN_ATTEMPTS:
            return Response(
                {
                    "error": {
                        "code": "account_locked",
                        "message": "تم إيقاف محاولات الدخول مؤقتاً بسبب محاولات فاشلة متكررة. يرجى الانتظار 15 دقيقة.",
                    }
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # 3. Check if account requires initial password setup before failing credential check
        if raw_email:
            candidate = User.objects.filter(email__iexact=raw_email, is_active=True).first()
            if (
                candidate
                and not candidate.is_initial_password_set
                and _user_belongs_to_tenant(candidate, tenant)
            ):
                return Response(
                    {
                        "code": "setup_required",
                        "email": candidate.email,
                        "message": "يرجى ضبط كلمة المرور لتفعيل حسابك أولاً.",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        # 4. Validate credentials
        serializer = LoginSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            if raw_email:
                attempts = _record_failed_attempt(raw_email, client_ip)
                logger.warning(
                    "Failed login attempt (%d/%d) for email=%s ip=%s",
                    attempts,
                    MAX_LOGIN_ATTEMPTS,
                    raw_email,
                    client_ip,
                )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data["user"]

        # 5. Enforce tenant membership isolation
        if not _user_belongs_to_tenant(user, tenant):
            _record_failed_attempt(raw_email, client_ip)
            logger.warning(
                "Cross-tenant login blocked: user=%s attempted login on tenant=%s",
                user.email,
                getattr(tenant, "schema_name", "public"),
            )
            return Response(
                {
                    "non_field_errors": [
                        "Invalid email or password."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 6. Check if administrator forced a password reset
        if user.force_password_reset:
            reset_token = PasswordResetToken.objects.create(
                user=user,
                expires_at=timezone.now() + timedelta(hours=2),
            )
            return Response(
                {
                    "code": "force_password_reset",
                    "token": str(reset_token.token),
                    "message": "يتطلب حسابك إعادة تعيين كلمة المرور للمتابعة.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # 7. Clear brute-force counter & issue tenant-scoped tokens
        _clear_failed_attempts(raw_email, client_ip)
        refresh = create_tokens_for_user(user, tenant=tenant)

        user.last_login_ip = client_ip if client_ip != "0.0.0.0" else None
        user.last_login = timezone.now()
        user.save(update_fields=["last_login", "last_login_ip"])

        log_action(user, "login", "user", str(user.id), request=request)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class TenantAwareTokenRefreshView(TokenRefreshView):
    """
    Refresh JWT access token while verifying user.is_active and user.token_version,
    and preserving custom claims (`token_version`, `tenant_schema`, `role`).
    """

    def post(self, request, *args, **kwargs):
        raw_refresh = request.data.get("refresh")
        if not raw_refresh:
            return Response(
                {"error": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            incoming = RefreshToken(raw_refresh)
            user_id = incoming.get("user_id")
            token_ver = incoming.get("token_version")
            tenant_schema = incoming.get("tenant_schema", "public")

            user = User.objects.filter(id=user_id, is_active=True).first()
            if not user:
                raise InvalidToken("User account is inactive or no longer exists.")

            if token_ver is not None and int(token_ver) != int(getattr(user, "token_version", 1)):
                raise InvalidToken("Token has been revoked.")

            response = super().post(request, *args, **kwargs)
            if response.status_code == status.HTTP_200_OK and "access" in response.data:
                # Re-sign tokens with preserved custom claims if rotated
                if "refresh" in response.data:
                    new_refresh = RefreshToken(response.data["refresh"])
                    new_refresh["token_version"] = user.token_version
                    new_refresh["tenant_schema"] = tenant_schema
                    new_refresh["role"] = user.role
                    new_refresh.access_token["token_version"] = user.token_version
                    new_refresh.access_token["tenant_schema"] = tenant_schema
                    new_refresh.access_token["role"] = user.role
                    response.data["refresh"] = str(new_refresh)
                    response.data["access"] = str(new_refresh.access_token)
            return response
        except (InvalidToken, TokenError) as exc:
            return Response(
                {"detail": str(exc), "code": "token_not_valid"},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class TenantDiscoveryView(APIView):
    """
    Discover tenant domain by user email from public schema context.
    The resulting URL points to the tenant login page with prefilled email.
    """

    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth_discover"

    def _resolve_tenant_for_user(self, user, include_inactive=False):
        candidates = Tenant.objects.exclude(schema_name="public").order_by("id")
        if not include_inactive:
            candidates = candidates.filter(is_active=True)

        for tenant in candidates:
            try:
                with schema_context(tenant.schema_name):
                    from apps.staff.models import StaffMember

                    if StaffMember.objects.filter(user_id=user.id).exists():
                        return tenant
            except Exception as exc:
                logger.warning(
                    "Tenant discovery membership check failed for tenant=%s user=%s: %s",
                    tenant.schema_name,
                    user.id,
                    exc,
                )

        return candidates.filter(email__iexact=user.email).order_by("id").first()

    def _build_login_host(self, request, domain_value: str) -> str:
        raw = (domain_value or "").strip().lower()
        if not raw:
            return ""

        if "." in raw:
            return raw

        forwarded_host = request.headers.get("X-Forwarded-Host", "") or request.get_host()
        host_without_port = forwarded_host.split(",")[0].strip().split(":")[0].lower()
        host_parts = host_without_port.split(".")
        request_port = ""
        if ":" in forwarded_host:
            request_port = forwarded_host.split(",")[0].strip().split(":")[1]

        if host_without_port.endswith(".localhost") or host_without_port == "localhost":
            return f"{raw}.localhost{f':{request_port}' if request_port else ''}"

        platform_domain = (getattr(settings, "PLATFORM_DOMAIN", "") or "").strip().lower()
        if platform_domain:
            return f"{raw}.{platform_domain}"

        if len(host_parts) >= 2:
            return f"{raw}.{'.'.join(host_parts[-2:])}"

        return raw

    def post(self, request):
        serializer = TenantDiscoverySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        generic_response = {
            "found": False,
            "message": "No tenant login was found for this email.",
        }

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return Response(generic_response, status=status.HTTP_200_OK)

        tenant = self._resolve_tenant_for_user(user, include_inactive=True)
        if not tenant:
            return Response(generic_response, status=status.HTTP_200_OK)

        if tenant.status == Tenant.SubscriptionStatus.PENDING:
            return Response(
                {
                    "found": False,
                    "code": "pending_approval",
                    "message": "حسابك قيد المراجعة حالياً. سيتم تفعيله قريباً.",
                },
                status=status.HTTP_200_OK,
            )

        if tenant.status == Tenant.SubscriptionStatus.EXPIRED:
            return Response(
                {
                    "found": False,
                    "code": "subscription_expired",
                    "message": "لقد انتهى اشتراكك. يرجى التجديد للمتابعة.",
                    "status": "expired",
                },
                status=status.HTTP_200_OK,
            )

        if tenant.status == Tenant.SubscriptionStatus.INACTIVE or not tenant.is_active:
            return Response(
                {
                    "found": False,
                    "code": "tenant_inactive",
                    "message": "هذا النادي معطل حالياً. يرجى مراجعة الإدارة.",
                    "status": "inactive",
                },
                status=status.HTTP_200_OK,
            )

        domain = Domain.objects.filter(tenant=tenant).order_by("-is_primary", "id").first()
        if not domain:
            return Response(generic_response, status=status.HTTP_200_OK)

        forwarded_proto = request.headers.get("X-Forwarded-Proto", "")
        scheme = (forwarded_proto.split(",")[0].strip() or request.scheme or "https").lower()
        if domain.domain.endswith(".localhost"):
            scheme = "http"

        login_host = self._build_login_host(request, domain.domain)
        if not login_host:
            return Response(generic_response, status=status.HTTP_200_OK)

        login_url = f"{scheme}://{login_host}/login?email={quote(email)}"

        return Response(
            {
                "found": True,
                "tenant": {
                    "name": tenant.name,
                    "slug": tenant.slug,
                    "domain": domain.domain,
                },
                "login_url": login_url,
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    """Blacklist refresh token on logout."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            log_action(request.user, "logout", "user", str(request.user.id), request=request)
            return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.warning("Logout error: %s", exc)
            return Response({"error": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)


class LogoutAllView(APIView):
    """
    Revoke all active sessions and tokens for the current user across all devices.
    Optionally issues a fresh token pair if `keep_current=True`.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        keep_current = bool(request.data.get("keep_current", False))

        revoked_count = revoke_all_user_tokens(user)
        log_action(
            user,
            "logout",
            "user",
            str(user.id),
            metadata={"scope": "all_devices", "revoked_tokens": revoked_count},
            request=request,
        )

        payload = {
            "message": "تم تسجيل الخروج من جميع الأجهزة الأخرى بنجاح.",
            "revoked_count": revoked_count,
        }

        if keep_current:
            tenant = getattr(request, "tenant", None)
            fresh_refresh = create_tokens_for_user(user, tenant=tenant)
            payload["access"] = str(fresh_refresh.access_token)
            payload["refresh"] = str(fresh_refresh)

        return Response(payload, status=status.HTTP_200_OK)


class UserSessionsView(APIView):
    """
    List active non-blacklisted refresh token sessions for the authenticated user,
    or revoke all other sessions.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken,
            OutstandingToken,
        )

        now = timezone.now()
        blacklisted_ids = BlacklistedToken.objects.filter(
            token__user=request.user
        ).values_list("token_id", flat=True)

        tokens = (
            OutstandingToken.objects.filter(user=request.user, expires_at__gt=now)
            .exclude(id__in=blacklisted_ids)
            .order_by("-created_at")[:20]
        )

        sessions = []
        for idx, t in enumerate(tokens):
            sessions.append(
                {
                    "jti": t.jti,
                    "created_at": t.created_at,
                    "expires_at": t.expires_at,
                    "is_latest": idx == 0,
                }
            )

        return Response(
            {
                "count": len(sessions),
                "last_login_ip": request.user.last_login_ip,
                "last_login": request.user.last_login,
                "results": sessions,
            }
        )


class UserSessionRevokeView(APIView):
    """Revoke a specific active refresh token session by its JTI."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, jti: str):
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken,
            OutstandingToken,
        )

        token = OutstandingToken.objects.filter(user=request.user, jti=jti).first()
        if not token:
            return Response(
                {"error": "الجلسة غير موجودة أو منتهية مسبقاً."},
                status=status.HTTP_404_NOT_FOUND,
            )

        BlacklistedToken.objects.get_or_create(token=token)
        log_action(
            request.user,
            "logout",
            "session",
            jti,
            request=request,
        )
        return Response({"message": "تم إنهاء الجلسة بنجاح."}, status=status.HTTP_200_OK)


class UserSecurityActivityView(APIView):
    """Return recent security-related audit events for the current authenticated user."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.audit.models import AuditLog

        security_actions = [
            AuditLog.Action.LOGIN,
            AuditLog.Action.LOGOUT,
            AuditLog.Action.PASSWORD_CHANGE,
            "initial_password_setup",
            "update_permissions",
            "transfer_ownership",
        ]

        try:
            logs = AuditLog.objects.filter(
                user_id=str(request.user.id),
                action__in=security_actions,
            ).order_by("-created_at")[:15]

            results = [
                {
                    "id": entry.id,
                    "action": entry.action,
                    "resource_type": entry.resource_type,
                    "ip_address": entry.ip_address,
                    "user_agent": entry.user_agent,
                    "metadata": entry.metadata,
                    "created_at": entry.created_at,
                }
                for entry in logs
            ]
        except Exception:
            results = []

        return Response({"results": results})


class CurrentUserView(generics.RetrieveUpdateAPIView):
    """Get or update current authenticated user profile, avatar, and preferences."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return UserProfileUpdateSerializer
        return UserSerializer

    def get_object(self):
        return self.request.user

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        log_action(instance, "update", "user_profile", str(instance.id), request=request)
        # Return full UserSerializer representation
        return Response(UserSerializer(instance, context=self.get_serializer_context()).data)


class RegisterView(generics.CreateAPIView):
    """Register a new user (tenant invitation flow)."""

    permission_classes = [permissions.AllowAny]
    serializer_class = UserCreateSerializer
    throttle_scope = "auth_password"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        tenant = getattr(request, "tenant", None)
        refresh = create_tokens_for_user(user, tenant=tenant)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class PasswordChangeView(APIView):
    """Change password for authenticated users and revoke prior sessions."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "auth_password"

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.password_changed_at = timezone.now()
        user.force_password_reset = False
        user.is_initial_password_set = True
        user.save(
            update_fields=[
                "password",
                "password_changed_at",
                "force_password_reset",
                "is_initial_password_set",
            ]
        )

        logout_others = serializer.validated_data.get("logout_other_devices", True)
        if logout_others:
            revoke_all_user_tokens(user)

        tenant = getattr(request, "tenant", None)
        fresh_refresh = create_tokens_for_user(user, tenant=tenant)

        log_action(user, "password_change", "user", str(user.id), request=request)

        return Response(
            {
                "message": "تم تغيير كلمة المرور بنجاح.",
                "password_changed_at": user.password_changed_at,
                "access": str(fresh_refresh.access_token),
                "refresh": str(fresh_refresh),
            }
        )


class PasswordResetRequestView(APIView):
    """Request password reset email."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth_password"

    @staticmethod
    def _build_base_url(request) -> str:
        forwarded_host = request.headers.get("X-Forwarded-Host", "") or request.get_host()
        forwarded_proto = request.headers.get("X-Forwarded-Proto", "")
        scheme = (
            forwarded_proto.split(",")[0].strip() or request.scheme or "https"
        ).lower()
        if forwarded_host.split(":")[0].endswith(".localhost"):
            scheme = "http"
        return f"{scheme}://{forwarded_host}"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"].lower()
        try:
            user = User.objects.get(email__iexact=email, is_active=True)
            token_obj = PasswordResetToken.objects.create(
                user=user,
                expires_at=timezone.now() + timedelta(hours=2),
            )
            send_password_reset_email.delay(
                user_email=user.email,
                user_name=user.get_full_name(),
                token=str(token_obj.token),
                base_url=self._build_base_url(request),
            )
            logger.info("Password reset requested for %s, token queued.", email)
        except User.DoesNotExist:
            logger.info("Password reset requested for non-existent email.")

        return Response(
            {"message": "إذا كان هذا البريد مسجلاً لدينا، فستصلك رسالة لإعادة تعيين كلمة المرور."}
        )


class PasswordResetConfirmView(APIView):
    """Confirm password reset with token and revoke all existing sessions."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth_password"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            token = PasswordResetToken.objects.get(
                token=serializer.validated_data["token"],
                is_used=False,
                expires_at__gt=timezone.now(),
            )
        except PasswordResetToken.DoesNotExist:
            return Response(
                {"error": {"code": "invalid_token", "message": "رابط إعادة التعيين غير صالح أو منتهي الصلاحية."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = token.user
        user.set_password(serializer.validated_data["new_password"])
        user.force_password_reset = False
        user.is_initial_password_set = True
        user.password_changed_at = timezone.now()
        user.save(
            update_fields=[
                "password",
                "force_password_reset",
                "is_initial_password_set",
                "password_changed_at",
            ]
        )
        token.is_used = True
        token.save(update_fields=["is_used"])

        revoke_all_user_tokens(user)
        log_action(user, "password_change", "user", str(user.id), request=request)

        return Response({"message": "تمت إعادة تعيين كلمة المرور بنجاح."})


class InitialPasswordSetupView(APIView):
    """Set initial password for newly invited staff members (`is_initial_password_set=False`)."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth_password"

    def post(self, request):
        serializer = InitialPasswordSetupSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data["user"]
        user.set_password(serializer.validated_data["new_password"])
        user.is_initial_password_set = True
        user.force_password_reset = False
        user.password_changed_at = timezone.now()
        user.save(
            update_fields=[
                "password",
                "is_initial_password_set",
                "force_password_reset",
                "password_changed_at",
            ]
        )

        revoke_all_user_tokens(user)
        log_action(user, "initial_password_setup", "user", str(user.id), request=request)

        return Response({"message": "تم ضبط كلمة المرور وتفعيل الحساب بنجاح. يمكنك الآن تسجيل الدخول."})


class StaffViewSet(viewsets.ModelViewSet):
    """
    CRUD for staff users — management only.
    Tenant owners and managers can manage permissions.
    """

    serializer_class = UserSerializer
    lookup_field = "id"

    def _can_manage_staff(self, user):
        if not user or not user.is_authenticated:
            return False

        if user.role in [
            RoleChoices.PLATFORM_ADMIN,
            RoleChoices.TENANT_OWNER,
            RoleChoices.MANAGER,
            RoleChoices.BRANCH_MANAGER,
        ]:
            return True

        return has_effective_permission(user, "can_manage_staff")

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self._can_manage_staff(self.request.user):
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        from apps.staff.models import StaffMember

        current_user = self.request.user

        staff_user_ids = StaffMember.objects.values_list("user_id", flat=True)
        qs = User.objects.filter(id__in=staff_user_ids, role__in=RoleChoices.STAFF_ROLES)

        qs = qs.exclude(role=RoleChoices.PLATFORM_ADMIN)

        if current_user.role == RoleChoices.BRANCH_MANAGER:
            qs = qs.exclude(role__in=[RoleChoices.MANAGER, RoleChoices.TENANT_OWNER])

        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)
        return qs.order_by("first_name")

    def _can_assign_branch(self, user):
        if not user or not user.is_authenticated:
            return False
        if user.role in [RoleChoices.PLATFORM_ADMIN, RoleChoices.TENANT_OWNER]:
            return True
        return has_effective_permission(user, "can_manage_locations")

    def perform_create(self, serializer):
        from apps.staff.models import StaffMember

        data = self.request.data
        if "assigned_location_ids" in data and not self._can_assign_branch(self.request.user):
            user = serializer.save(assigned_location_ids=[])
        else:
            user = serializer.save()

        StaffMember.objects.get_or_create(user=user)
        self._sync_location_managers(user)

    def perform_update(self, serializer):
        target_user = self.get_object()
        current_user = self.request.user
        was_active = target_user.is_active
        old_role = target_user.role

        if current_user.role == RoleChoices.BRANCH_MANAGER:
            if target_user.role in [RoleChoices.MANAGER, RoleChoices.TENANT_OWNER]:
                raise PermissionDenied("لا يمكن لمدير الفرع تعديل بيانات الإدارة العليا.")

            new_role = self.request.data.get("role")
            if new_role in [
                RoleChoices.MANAGER,
                RoleChoices.TENANT_OWNER,
                RoleChoices.PLATFORM_ADMIN,
            ]:
                raise PermissionDenied("لا يمكنك تعيين أدوار إدارية عليا.")

        if "assigned_location_ids" in self.request.data and not self._can_assign_branch(
            current_user
        ):
            raise PermissionDenied("ليس لديك صلاحية تغيير الفروع المخصصة للموظف.")

        new_permissions = self.request.data.get("permissions")
        if new_permissions is not None:
            if not self._can_manage_staff(current_user):
                raise PermissionDenied("ليس لديك صلاحية تعديل صلاحيات الموظفين.")

            log_action(
                current_user,
                "update_permissions",
                "user",
                str(target_user.id),
                changes={"old": target_user.permissions, "new": new_permissions},
                request=self.request,
            )

        user = serializer.save()
        self._sync_location_managers(user)

        # Invalidate all active sessions if account was deactivated or role was downgraded
        if (was_active and not user.is_active) or (old_role != user.role):
            revoke_all_user_tokens(user)

    def _sync_location_managers(self, user):
        from apps.students.models import Location

        currently_managed = Location.objects.filter(manager_id=user.id)

        if user.role == RoleChoices.BRANCH_MANAGER:
            assigned_ids = []
            if isinstance(user.assigned_location_ids, list):
                for lid in user.assigned_location_ids:
                    try:
                        assigned_ids.append(int(lid))
                    except (ValueError, TypeError):
                        pass

            if assigned_ids:
                Location.objects.filter(id__in=assigned_ids).update(manager_id=user.id)

            currently_managed.exclude(id__in=assigned_ids).update(manager_id=None)
        else:
            currently_managed.update(manager_id=None)
