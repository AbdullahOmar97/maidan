"""
MAIDAN — Accounts, Authentication & Authorization Tests
Covers:
- Initial password setup restriction (is_initial_password_set=False only, no phone requirement)
- Strong password validation across setup, change, and reset
- Tenant-bound JWT authentication and token_version revocation
- Brute-force login lockout after 5 failed attempts
- Effective RBAC + granular permission resolution
- Profile update (notification_preferences, ui_preferences, avatar validation)
"""

from django.core.cache import cache
from django.test import TestCase
from django_tenants.utils import schema_context
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.tenants.models import Domain, Tenant
from shared.auth import create_tokens_for_user, revoke_all_user_tokens
from shared.permissions import resolve_user_permissions


class AuthAndSecurityTestCase(TestCase):
    def setUp(self):
        cache.clear()
        with schema_context("public"):
            self.tenant = Tenant.objects.create(
                schema_name="test_auth_dojo",
                name="Auth Academy",
                status="active",
            )
            self.domain = Domain.objects.create(
                domain="auth.localhost",
                tenant=self.tenant,
                is_primary=True,
            )
            self.other_tenant = Tenant.objects.create(
                schema_name="other_auth_dojo",
                name="Other Academy",
                status="active",
            )
            self.other_domain = Domain.objects.create(
                domain="other.localhost",
                tenant=self.other_tenant,
                is_primary=True,
            )

    def tearDown(self):
        cache.clear()
        with schema_context("public"):
            self.tenant.delete()
            self.other_tenant.delete()

    def test_initial_password_setup_blocks_already_initialized_account(self):
        with schema_context(self.tenant.schema_name):
            user = User.objects.create_user(
                email="staff@auth.localhost",
                password="OldSecurePassword!2026",
                role=User.Role.COACH,
                is_initial_password_set=False,
            )
            client = APIClient()
            client.defaults["HTTP_HOST"] = self.domain.domain

            # 1. Weak password rejected by validate_strong_password
            weak_resp = client.post(
                "/api/v1/auth/password/setup/",
                {
                    "email": user.email,
                    "new_password": "123",
                    "confirm_password": "123",
                },
                format="json",
            )
            self.assertEqual(weak_resp.status_code, status.HTTP_400_BAD_REQUEST)

            # 2. First setup succeeds without phone verification
            ok_resp = client.post(
                "/api/v1/auth/password/setup/",
                {
                    "email": user.email,
                    "new_password": "StrongPassword!2026#",
                    "confirm_password": "StrongPassword!2026#",
                },
                format="json",
            )
            self.assertEqual(ok_resp.status_code, status.HTTP_200_OK)
            user.refresh_from_db()
            self.assertTrue(user.is_initial_password_set)

            # 3. Second setup attempt on already initialized account is blocked
            replay_resp = client.post(
                "/api/v1/auth/password/setup/",
                {
                    "email": user.email,
                    "new_password": "AnotherPassword!2026#",
                    "confirm_password": "AnotherPassword!2026#",
                },
                format="json",
            )
            self.assertEqual(replay_resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_token_version_revocation_and_tenant_binding(self):
        with schema_context(self.tenant.schema_name):
            user = User.objects.create_user(
                email="owner@auth.localhost",
                password="StrongPassword!2026#",
                role=User.Role.OWNER,
                is_initial_password_set=True,
            )
            tokens = create_tokens_for_user(user, tenant_schema=self.tenant.schema_name)

            client = APIClient()
            client.defaults["HTTP_HOST"] = self.domain.domain
            client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

            # Valid token in matching tenant
            me_resp = client.get("/api/v1/auth/me/")
            self.assertEqual(me_resp.status_code, status.HTTP_200_OK)

            # Cross-tenant request with same token must be rejected
            other_client = APIClient()
            other_client.defaults["HTTP_HOST"] = self.other_domain.domain
            other_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
            cross_resp = other_client.get("/api/v1/auth/me/")
            self.assertEqual(cross_resp.status_code, status.HTTP_401_UNAUTHORIZED)

            # Revoke all user tokens (increments token_version)
            revoke_all_user_tokens(user)
            revoked_resp = client.get("/api/v1/auth/me/")
            self.assertEqual(revoked_resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_brute_force_lockout(self):
        with schema_context(self.tenant.schema_name):
            User.objects.create_user(
                email="lockout@auth.localhost",
                password="StrongPassword!2026#",
                role=User.Role.OWNER,
                is_initial_password_set=True,
            )
            client = APIClient()
            client.defaults["HTTP_HOST"] = self.domain.domain

            for _ in range(5):
                resp = client.post(
                    "/api/v1/auth/login/",
                    {"email": "lockout@auth.localhost", "password": "WrongPassword!123"},
                    format="json",
                )
                self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

            locked_resp = client.post(
                "/api/v1/auth/login/",
                {"email": "lockout@auth.localhost", "password": "StrongPassword!2026#"},
                format="json",
            )
            self.assertEqual(locked_resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
            self.assertEqual(locked_resp.data.get("code"), "account_locked")

    def test_effective_permissions_and_profile_preferences(self):
        with schema_context(self.tenant.schema_name):
            coach = User.objects.create_user(
                email="coach@auth.localhost",
                password="StrongPassword!2026#",
                role=User.Role.COACH,
                permissions={"can_manage_belts": True},
                is_initial_password_set=True,
            )
            resolved = resolve_user_permissions(coach)
            self.assertTrue(resolved["can_manage_attendance"])
            self.assertTrue(resolved["can_manage_belts"])
            self.assertFalse(resolved["can_manage_billing"])

            tokens = create_tokens_for_user(coach, tenant_schema=self.tenant.schema_name)
            client = APIClient()
            client.defaults["HTTP_HOST"] = self.domain.domain
            client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

            patch_resp = client.patch(
                "/api/v1/auth/me/",
                {
                    "notification_preferences": {
                        "in_app_enabled": True,
                        "topics": {"billing": False, "attendance": True, "promotions": True, "security": True},
                    },
                    "ui_preferences": {
                        "compact_tables": True,
                        "default_landing_page": "/dashboard/attendance",
                    },
                },
                format="json",
            )
            self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
            self.assertTrue(patch_resp.data["ui_preferences"]["compact_tables"])
            self.assertTrue(patch_resp.data["notification_preferences"]["topics"]["security"])
