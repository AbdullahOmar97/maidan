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

    def test_automatic_dunning_suspension(self):
        # Run dunning suspension task for this tenant schema
        process_dunning_suspensions(self.tenant.schema_name)

        with schema_context(self.tenant.schema_name):
            # Student should now be suspended
            student = Student.objects.get(id=self.student.id)
            self.assertEqual(student.status, Student.Status.SUSPENDED)
            self.assertIn("تم تعليق الحساب تلقائياً لتأخر السداد", student.notes)

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

    def tearDown(self):
        with schema_context("public"):
            self.tenant.delete()
