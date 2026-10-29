from django.test import TestCase
from django.utils import timezone
from django_tenants.utils import schema_context
from datetime import timedelta
from rest_framework import status
from rest_framework.test import APITestCase

from apps.tenants.models import Tenant, Domain
from apps.students.models import Student, Location
from apps.billing.models import Invoice, Membership, MembershipPlan
from apps.billing.tasks import process_dunning_suspensions


class DunningSuspensionTestCase(TestCase):
    def setUp(self):
        # 1. Create a tenant for schema context testing
        with schema_context("public"):
            self.tenant = Tenant.objects.create(
                schema_name="test_billing",
                name="Billing Academy",
                status="active"
            )
            self.domain = Domain.objects.create(
                domain="billing.localhost",
                tenant=self.tenant,
                is_primary=True
            )

        with schema_context(self.tenant.schema_name):
            # 2. Create Location
            self.location = Location.objects.create(
                name="الفرع الرئيسي",
                address="عمان، الأردن",
                city="عمان",
                is_active=True
            )

            # 3. Create Student
            self.student = Student.objects.create(
                first_name="خالد",
                last_name="حسن",
                phone="0799999999",
                location=self.location,
                status="active"
            )

            # 4. Create an invoice overdue by 10 days
            self.overdue_invoice = Invoice.objects.create(
                student=self.student,
                subtotal=50.00,
                discount_amount=0,
                tax_rate=0,
                tax_amount=0,
                total_amount=50.00,
                amount_paid=0,
                status=Invoice.Status.OVERDUE,
                due_date=timezone.now().date() - timedelta(days=10)
            )

    def test_automatic_dunning_suspension_disabled(self):
        # Run dunning suspension task for this tenant schema - feature is disabled
        result = process_dunning_suspensions(self.tenant.schema_name)
        self.assertEqual(result.get("suspended_count"), 0)

        with schema_context(self.tenant.schema_name):
            # Student should NOT be suspended
            student = Student.objects.get(id=self.student.id)
            self.assertEqual(student.status, Student.Status.ACTIVE)

    def test_reactivation_on_payment(self):
        # Suspend student first
        with schema_context(self.tenant.schema_name):
            self.student.status = Student.Status.SUSPENDED
            self.student.save()

        # Mark overdue invoice as PAID
        with schema_context(self.tenant.schema_name):
            self.overdue_invoice.status = Invoice.Status.PAID
            self.overdue_invoice.amount_paid = self.overdue_invoice.total_amount
            self.overdue_invoice.save()

            # Student should automatically be reactivated to ACTIVE by the post_save signal
            student = Student.objects.get(id=self.student.id)
            self.assertEqual(student.status, Student.Status.ACTIVE)

    def test_kiosk_checkin_blocking_for_suspended_student(self):
        # Suspend student
        with schema_context(self.tenant.schema_name):
            self.student.status = Student.Status.SUSPENDED
            self.student.save()

        # Call the kiosk endpoint via API request client
        from rest_framework.test import APIClient
        client = APIClient()
        client.defaults["HTTP_HOST"] = "billing.localhost"

        response = client.post(
            "/api/v1/attendance/records/kiosk/",
            {"student_id": self.student.id},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("عذراً، هذا الحساب معلق بسبب مستحقات مالية غير مدفوعة", response.data["error"])

    def test_mark_paid_full_payment(self):
        from apps.accounts.models import User
        from rest_framework.test import APIClient
        from decimal import Decimal

        with schema_context("public"):
            manager = User.objects.create_user(
                email="manager@billing.app",
                password="testpassword123",
                role=User.Role.MANAGER,
                first_name="Manager",
                last_name="Billing",
            )

        with schema_context(self.tenant.schema_name):
            client = APIClient()
            client.defaults["HTTP_HOST"] = "billing.localhost"
            client.force_authenticate(user=manager)

            # Test invoice with linked membership
            plan = MembershipPlan.objects.create(name="Pro Plan", price=50.00, billing_cycle="monthly")
            membership = Membership.objects.create(student=self.student, plan=plan, start_date=timezone.now().date())
            self.overdue_invoice.membership = membership
            self.overdue_invoice.save()

            response = client.post(
                f"/api/v1/billing/invoices/{self.overdue_invoice.id}/mark_paid/",
                {"payment_method": "cash"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.overdue_invoice.refresh_from_db()
            self.assertEqual(self.overdue_invoice.status, Invoice.Status.PAID)
            self.assertEqual(self.overdue_invoice.amount_paid, Decimal("50.00"))
            self.assertEqual(self.overdue_invoice.paid_by_id, manager.id)

    def test_mark_paid_partial_and_surplus(self):
        from apps.accounts.models import User
        from rest_framework.test import APIClient
        from decimal import Decimal

        with schema_context("public"):
            manager = User.objects.filter(email="manager@billing.app").first()
            if not manager:
                manager = User.objects.create_user(
                    email="manager@billing.app",
                    password="testpassword123",
                    role=User.Role.MANAGER,
                    first_name="Manager",
                    last_name="Billing",
                )

        with schema_context(self.tenant.schema_name):
            client = APIClient()
            client.defaults["HTTP_HOST"] = "billing.localhost"
            client.force_authenticate(user=manager)

            # 1. Partial payment of 20 JOD on 50 JOD invoice
            partial_inv = Invoice.objects.create(
                student=self.student,
                subtotal=50.00,
                total_amount=50.00,
                amount_paid=0,
                status=Invoice.Status.PENDING,
                due_date=timezone.now().date(),
            )
            resp = client.post(
                f"/api/v1/billing/invoices/{partial_inv.id}/mark_paid/",
                {"payment_method": "card", "amount": 20.00},
                format="json",
            )
            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            partial_inv.refresh_from_db()
            self.assertEqual(partial_inv.status, Invoice.Status.PARTIALLY_PAID)
            self.assertEqual(partial_inv.amount_paid, Decimal("20.00"))

            # 2. Surplus payment of 40 JOD (due is 30) with surplus_action="credit"
            resp2 = client.post(
                f"/api/v1/billing/invoices/{partial_inv.id}/mark_paid/",
                {"payment_method": "cash", "amount": 40.00, "surplus_action": "credit"},
                format="json",
            )
            self.assertEqual(resp2.status_code, status.HTTP_200_OK)
            partial_inv.refresh_from_db()
            self.assertEqual(partial_inv.status, Invoice.Status.PAID)
            self.assertEqual(partial_inv.amount_paid, Decimal("50.00"))

            self.student.refresh_from_db()
            self.assertEqual(self.student.account_credit, Decimal("10.00"))

    def test_void_invoice_financial_and_linked_effects(self):
        from apps.accounts.models import User
        from rest_framework.test import APIClient
        from decimal import Decimal

        with schema_context("public"):
            manager = User.objects.filter(email="manager@billing.app").first()
            if not manager:
                manager = User.objects.create_user(
                    email="manager@billing.app",
                    password="testpassword123",
                    role=User.Role.MANAGER,
                    first_name="Manager",
                    last_name="Billing",
                )

        with schema_context(self.tenant.schema_name):
            client = APIClient()
            client.defaults["HTTP_HOST"] = "billing.localhost"
            client.force_authenticate(user=manager)

            # 1. Suspend student due to overdue invoice
            self.student.status = Student.Status.SUSPENDED
            self.student.save()

            # 2. Attach membership to the overdue invoice
            plan = MembershipPlan.objects.create(name="Gold Plan", price=50.00, billing_cycle="monthly")
            membership = Membership.objects.create(
                student=self.student,
                plan=plan,
                start_date=timezone.now().date(),
                status=Membership.Status.PENDING,
                auto_renew=True,
            )
            self.overdue_invoice.membership = membership
            self.overdue_invoice.save()

            self.assertEqual(self.overdue_invoice.amount_due, Decimal("50.00"))

            # 3. Void the invoice
            resp = client.post(
                f"/api/v1/billing/invoices/{self.overdue_invoice.id}/void/",
                {"reason": "data_entry_error", "reason_details": "Billing mistake"},
                format="json",
            )
            self.assertEqual(resp.status_code, status.HTTP_200_OK)

            # Verify invoice status and amount_due
            self.overdue_invoice.refresh_from_db()
            self.assertEqual(self.overdue_invoice.status, Invoice.Status.VOID)
            self.assertEqual(self.overdue_invoice.amount_due, Decimal("0.00"))

            # Verify linked membership is cancelled and auto_renew disabled
            membership.refresh_from_db()
            self.assertEqual(membership.status, Membership.Status.CANCELLED)
            self.assertFalse(membership.auto_renew)

            # Verify student suspension is lifted
            self.student.refresh_from_db()
            self.assertEqual(self.student.status, Student.Status.ACTIVE)

    def test_invoice_archiving_and_deletion_prevention(self):
        """Test suite for invoice archiving, dues enforcement, and deletion prevention."""
        with schema_context(self.tenant.schema_name):
            from rest_framework.test import APIClient
            from apps.accounts.models import User

            user = User.objects.create_user(
                username="billing_admin",
                email="billing@test.com",
                password="password123",
                role="owner",
                is_staff=True,
            )
            client = APIClient()
            client.credentials(HTTP_HOST=self.domain.domain)
            client.force_authenticate(user=user)

            # 1. Invoice deletion must be forbidden
            del_resp = client.delete(f"/api/v1/billing/invoices/{self.overdue_invoice.id}/")
            self.assertEqual(del_resp.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(del_resp.data.get("code"), "invoice_deletion_not_allowed")
            self.assertTrue(Invoice.objects.filter(id=self.overdue_invoice.id).exists())

            # 2. Archive precheck for overdue invoice
            pre_resp = client.get(f"/api/v1/billing/invoices/{self.overdue_invoice.id}/archive_precheck/")
            self.assertEqual(pre_resp.status_code, status.HTTP_200_OK)
            self.assertFalse(pre_resp.data["can_archive_cleanly"])
            self.assertTrue(pre_resp.data["requires_debt_acknowledgment"])

            # 3. Archive without force should be rejected
            rej_resp = client.post(
                f"/api/v1/billing/invoices/{self.overdue_invoice.id}/archive/",
                {"reason": "انقطاع", "force_with_debt": False},
                format="json",
            )
            self.assertEqual(rej_resp.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(rej_resp.data.get("code"), "outstanding_invoice_due")

            # 4. Archive with force succeeds
            arch_resp = client.post(
                f"/api/v1/billing/invoices/{self.overdue_invoice.id}/archive/",
                {"reason": "إعدام دين لتعذر التحصيل", "force_with_debt": True},
                format="json",
            )
            self.assertEqual(arch_resp.status_code, status.HTTP_200_OK)
            self.overdue_invoice.refresh_from_db()
            self.assertTrue(self.overdue_invoice.is_archived)
            self.assertIsNotNone(self.overdue_invoice.archived_at)

            # 5. Default list excludes archived invoice
            list_resp = client.get("/api/v1/billing/invoices/")
            ids = [inv["id"] for inv in list_resp.data.get("results", list_resp.data)]
            self.assertNotIn(self.overdue_invoice.id, ids)

            # List with is_archived=true includes it
            arch_list_resp = client.get("/api/v1/billing/invoices/?is_archived=true")
            arch_ids = [inv["id"] for inv in arch_list_resp.data.get("results", arch_list_resp.data)]
            self.assertIn(self.overdue_invoice.id, arch_ids)

            # 6. Unarchive restores it
            unarch_resp = client.post(f"/api/v1/billing/invoices/{self.overdue_invoice.id}/unarchive/")
            self.assertEqual(unarch_resp.status_code, status.HTTP_200_OK)
            self.overdue_invoice.refresh_from_db()
            self.assertFalse(self.overdue_invoice.is_archived)
            self.assertIsNone(self.overdue_invoice.archived_at)

    def tearDown(self):
        with schema_context("public"):
            self.tenant.delete()
