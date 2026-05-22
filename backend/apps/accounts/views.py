"""
MAIDAN — Accounts Views
"""

import logging
from datetime import timedelta
from urllib.parse import quote

from django.conf import settings
from django.utils import timezone
from django_tenants.utils import schema_context
from rest_framework import generics, permissions, status, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.audit.utils import log_action
from apps.tenants.models import Domain, Tenant
from .models import PasswordResetToken, User
from .tasks import send_password_reset_email
from .serializers import (
    LoginSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    TenantDiscoverySerializer,
    UserCreateSerializer,
    UserProfileUpdateSerializer,
    UserSerializer,
    InitialPasswordSetupSerializer,
)

logger = logging.getLogger("maidan")


class LoginView(APIView):
    """JWT Login — returns access + refresh tokens."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # 1. Check tenant status before allowing any login attempt on this subdomain
        tenant = getattr(request, "tenant", None)
        
        # If we are in public schema, try to resolve tenant from Host header (for dev/localhost subdomains)
        if not tenant or tenant.schema_name == "public":
            host = request.headers.get("X-Forwarded-Host", request.get_host()).split(":")[0]
            # Check if it's a subdomain (e.g., awdah.localhost)
            if "." in host:
                subdomain = host.split(".")[0]
                # Try to find tenant by slug/schema_name
                tenant = Tenant.objects.filter(slug__iexact=subdomain).first()

        if tenant and tenant.schema_name != "public":
            if not tenant.is_active or tenant.status != Tenant.SubscriptionStatus.ACTIVE:
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
                            "status": tenant.status
                        }
                    }, 
                    status=status.HTTP_403_FORBIDDEN
                )

        serializer = LoginSerializer(data=request.data, context={"request": request})
        try:
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError as e:
            # Check if this is a "setup required" case
            email = request.data.get("email")
            if email:
                user = User.objects.filter(email__iexact=email, is_active=True).first()
                if user and not user.is_initial_password_set:
                    return Response(
                        {
                            "code": "setup_required",
                            "message": "First-time setup required.",
                            "email": user.email
                        },
                        status=status.HTTP_403_FORBIDDEN
                    )
            raise e

        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)

        # Update last login IP
        ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", ""))
        user.last_login_ip = ip.split(",")[0].strip() if ip else None
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


class TenantDiscoveryView(APIView):
    """
    Discover tenant domain by user email from public schema context.
    The resulting URL points to the tenant login page with prefilled email.
    """

    permission_classes = [permissions.AllowAny]

    def _resolve_tenant_for_user(self, user, include_inactive=False):
        """
        Resolve the most likely tenant for a public-schema user record.
        Staff membership is stored per tenant schema, so we probe tenants.
        """
        candidates = (
            Tenant.objects.exclude(schema_name="public")
            .order_by("id")
        )
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

        # Fallback: tenant owner email often matches tenant contact email.
        return (
            candidates.filter(email__iexact=user.email).order_by("id").first()
        )

    def _build_login_host(self, request, domain_value: str) -> str:
        """
        Build a valid tenant login host from a stored domain value.
        Supports values like:
        - full domain: demo.localhost / club-a.app.com
        - bare subdomain label: demo
        """
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

        # Keep response generic to reduce account enumeration signal.
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
            token = RefreshToken(refresh_token)
            token.blacklist()
            log_action(request.user, "logout", "user", str(request.user.id), request=request)
            return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.warning(f"Logout error: {e}")
            return Response({"error": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)


class CurrentUserView(generics.RetrieveUpdateAPIView):
    """Get or update current authenticated user profile."""

    permission_classes = [permissions.IsAuthenticated]

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


class RegisterView(generics.CreateAPIView):
    """Register a new user (tenant invitation flow)."""

    permission_classes = [permissions.AllowAny]
    serializer_class = UserCreateSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class PasswordChangeView(APIView):
    """Change password for authenticated users."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()

        log_action(request.user, "password_change", "user", str(request.user.id), request=request)

        return Response({"message": "Password changed successfully."})


class PasswordResetRequestView(APIView):
    """Request password reset email."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"].lower()
        try:
            user = User.objects.get(email=email, is_active=True)
            token_obj = PasswordResetToken.objects.create(
                user=user,
                expires_at=timezone.now() + timedelta(hours=2),
            )
            
            # Build base URL for the reset link
            forwarded_host = request.headers.get("X-Forwarded-Host", "") or request.get_host()
            forwarded_proto = request.headers.get("X-Forwarded-Proto", "")
            scheme = (forwarded_proto.split(",")[0].strip() or request.scheme or "https").lower()
            
            # If it's a .localhost domain, force http
            if forwarded_host.split(":")[0].endswith(".localhost"):
                scheme = "http"
            
            base_url = f"{scheme}://{forwarded_host}"
            
            # Send reset email via Celery task
            send_password_reset_email.delay(
                user_email=user.email,
                user_name=user.get_full_name(),
                token=str(token_obj.token),
                base_url=base_url
            )
            
            logger.info(f"Password reset requested for {email}, token queued.")
        except User.DoesNotExist:
            logger.info(f"Password reset requested for non-existent email: {email}")
            pass  # Don't reveal if email exists (security)

        return Response(
            {"message": "إذا كان هذا البريد مسجلاً لدينا، فستصلك رسالة لإعادة تعيين كلمة المرور."}
        )


class PasswordResetConfirmView(APIView):
    """Confirm password reset with token."""

    permission_classes = [permissions.AllowAny]

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
                {"error": {"code": "invalid_token", "message": "Invalid or expired reset token."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token.user.set_password(serializer.validated_data["new_password"])
        token.user.save()
        token.is_used = True
        token.save()

        return Response({"message": "Password reset successfully."})


class InitialPasswordSetupView(APIView):
    """Set initial password for new staff members."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = InitialPasswordSetupSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(f"Initial password setup validation failed: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data["user"]
        logger.info(f"Setting initial password for user: {user.email}")
        user.set_password(serializer.validated_data["new_password"])
        user.is_initial_password_set = True
        user.save()
        logger.info(f"Password saved for user: {user.email}, Has usable pass: {user.has_usable_password()}")

        log_action(user, "initial_password_setup", "user", str(user.id), request=request)

        return Response({"message": "تم ضبط كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول."})


from rest_framework import viewsets

class StaffViewSet(viewsets.ModelViewSet):
    """
    CRUD for staff users — management only.
    Tenant owners and managers can manage permissions.
    """
    serializer_class = UserSerializer
    lookup_field = "id"

    def _can_manage_staff(self, user):
        from shared.permissions import RoleChoices

        if not user or not user.is_authenticated:
            return False

        if user.role in [
            RoleChoices.PLATFORM_ADMIN,
            RoleChoices.TENANT_OWNER,
            RoleChoices.MANAGER,
            RoleChoices.BRANCH_MANAGER,
        ]:
            return True

        user_permissions = getattr(user, "permissions", {}) or {}
        return user_permissions.get("can_manage_staff", False) is True

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        # Allow management roles or any user with granular staff permission.
        if self._can_manage_staff(self.request.user):
            return [permissions.IsAuthenticated()]
        return [permissions.IsDenied()]

    def get_queryset(self):
        from shared.permissions import RoleChoices
        from apps.staff.models import StaffMember
        
        current_user = self.request.user
        
        # Filter users who belong to this tenant's staff memberships
        staff_user_ids = StaffMember.objects.values_list('user_id', flat=True)
        qs = User.objects.filter(id__in=staff_user_ids, role__in=RoleChoices.STAFF_ROLES)
        
        # Restriction: Platform Admin is hidden from everyone (only managed in Django Admin)
        qs = qs.exclude(role=RoleChoices.PLATFORM_ADMIN)

        # Restriction: Branch Manager cannot see General Manager (MANAGER or OWNER)
        if current_user.role == RoleChoices.BRANCH_MANAGER:
            qs = qs.exclude(role__in=[RoleChoices.MANAGER, RoleChoices.TENANT_OWNER])

        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)
        return qs.order_by("first_name")

    def _can_assign_branch(self, user):
        """Returns True if the user can assign/change a staff member's branch."""
        from shared.permissions import RoleChoices
        if not user or not user.is_authenticated:
            return False
        if user.role in [RoleChoices.PLATFORM_ADMIN, RoleChoices.TENANT_OWNER]:
            return True
        user_permissions = getattr(user, "permissions", {}) or {}
        return user_permissions.get("can_manage_locations", False) is True

    def perform_create(self, serializer):
        data = self.request.data
        # Strip branch assignment if caller lacks permission
        if "assigned_location_ids" in data and not self._can_assign_branch(self.request.user):
            serializer.save(assigned_location_ids=[])
            from apps.staff.models import StaffMember
            StaffMember.objects.get_or_create(user=serializer.instance)
            return
        user = serializer.save()
        from apps.staff.models import StaffMember
        StaffMember.objects.get_or_create(user=user)

    def perform_update(self, serializer):
        from shared.permissions import RoleChoices
        from rest_framework.exceptions import PermissionDenied
        
        target_user = self.get_object()
        current_user = self.request.user
        
        # Restriction: Branch Manager cannot edit General Manager (MANAGER)
        if current_user.role == RoleChoices.BRANCH_MANAGER:
            if target_user.role == RoleChoices.MANAGER:
                raise PermissionDenied("لا يمكن لمدير الفرع تعديل بيانات المدير العام.")
            
            # Prevent branch manager from assigning higher roles
            new_role = self.request.data.get("role")
            if new_role in [RoleChoices.MANAGER, RoleChoices.TENANT_OWNER, RoleChoices.PLATFORM_ADMIN]:
                 raise PermissionDenied("لا يمكنك تعيين أدوار إدارية عليا.")

        # Guard: only owner / can_manage_locations can change branch assignment
        if "assigned_location_ids" in self.request.data and not self._can_assign_branch(current_user):
            raise PermissionDenied("ليس لديك صلاحية تغيير الفروع المخصصة للموظف.")

        # Permission editing logic
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
                 request=self.request
             )
        serializer.save()
