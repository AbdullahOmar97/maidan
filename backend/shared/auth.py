"""
MAIDAN — Shared Authentication Backend & JWT Security

Implements:
- Case-insensitive email authentication with timing-attack mitigation
- Tenant-bound JWT authentication with token versioning & instant revocation
- Token generation & global session revocation helpers
"""

import logging
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger("maidan.auth")
User = get_user_model()


class CaseInsensitiveModelBackend(ModelBackend):
    """
    Authenticate against User.email case-insensitively while mitigating
    user-enumeration timing attacks.
    """

    def authenticate(self, request, email=None, password=None, **kwargs):
        if email is None:
            email = kwargs.get(User.USERNAME_FIELD)
        if not email or not password:
            return None

        try:
            user = User.objects.get(**{f"{User.USERNAME_FIELD}__iexact": email.strip()})
        except User.DoesNotExist:
            # Run default password hasher once to equalize timing
            User().set_password(password)
            return None
        else:
            if user.check_password(password) and self.user_can_authenticate(user):
                return user
        return None


def create_tokens_for_user(user, tenant=None) -> RefreshToken:
    """
    Issue a RefreshToken (and nested AccessToken) bound to the user's current
    token_version and active tenant schema.
    """
    refresh = RefreshToken.for_user(user)
    token_version = getattr(user, "token_version", 1)
    tenant_schema = getattr(tenant, "schema_name", None) or "public"

    refresh["token_version"] = token_version
    refresh["tenant_schema"] = tenant_schema
    refresh["role"] = user.role

    # Propagate custom claims to the access token as well
    refresh.access_token["token_version"] = token_version
    refresh.access_token["tenant_schema"] = tenant_schema
    refresh.access_token["role"] = user.role

    return refresh


def revoke_all_user_tokens(user, exclude_jti: str | None = None) -> int:
    """
    Increment user.token_version to immediately invalidate all issued access tokens
    and blacklist all OutstandingTokens in SimpleJWT's token_blacklist.
    Returns the number of refresh tokens blacklisted.
    """
    user.token_version = (getattr(user, "token_version", 1) or 1) + 1
    user.save(update_fields=["token_version"])

    blacklisted_count = 0
    try:
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken,
            OutstandingToken,
        )

        qs = OutstandingToken.objects.filter(user=user, expires_at__gt=timezone.now())
        if exclude_jti:
            qs = qs.exclude(jti=exclude_jti)

        for outstanding in qs:
            _, created = BlacklistedToken.objects.get_or_create(token=outstanding)
            if created:
                blacklisted_count += 1
    except Exception as exc:
        logger.warning("Failed to blacklist outstanding tokens for user %s: %s", user.id, exc)

    return blacklisted_count


class TenantAwareJWTAuthentication(JWTAuthentication):
    """
    Hardened JWT Authentication:
    1. Rejects tokens whose token_version does not match user.token_version.
    2. Enforces tenant isolation: tokens issued for Tenant A cannot be used on Tenant B.
    """

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not user.is_active:
            raise AuthenticationFailed("User account is disabled.", code="user_inactive")

        token_ver = validated_token.get("token_version")
        user_ver = getattr(user, "token_version", 1)
        if token_ver is not None and int(token_ver) != int(user_ver):
            raise InvalidToken("Session expired due to security update. Please sign in again.")

        return user

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, validated_token = result
        tenant = getattr(request, "tenant", None)
        tenant_schema = getattr(tenant, "schema_name", None)

        # Platform admins can operate across schemas; tenant users must match schema
        if tenant_schema and tenant_schema != "public" and user.role != "platform_admin":
            token_tenant = validated_token.get("tenant_schema")
            if token_tenant and token_tenant != "public" and token_tenant != tenant_schema:
                logger.warning(
                    "Blocked cross-tenant JWT use: user=%s token_tenant=%s request_tenant=%s",
                    user.email,
                    token_tenant,
                    tenant_schema,
                )
                raise AuthenticationFailed(
                    "Cross-tenant authentication token is not permitted.",
                    code="cross_tenant_forbidden",
                )

        return user, validated_token
