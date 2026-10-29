from decimal import Decimal
from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.billing.models import Invoice, Membership, MembershipPlan
from apps.students.models import Location, Student, StudentNote


class StudentArchivingSystemTestCase(TenantTestCase):
    """Test suite for Student Archiving, Dues Protocol, and Permanent Deletion Prevention."""

    def setUp(self):
        super().setUp()

        from django.db import connection
        connection.set_schema_to_public()
        connection.set_tenant(self.tenant)

        self.tenant.status = "trial"
        self.tenant.is_active = True
        self.tenant.save()

        self.client = APIClient()
        tenant_domain = self.tenant.domains.first().domain
        self.client.credentials(HTTP_HOST=tenant_domain)

        # 1. Staff Admin User
        self.user = User.objects.create_user(
            username="admin_user",
            email="admin@test.com",
            password="password123",
            role="owner",
            is_staff=True,
        )
        self.client.force_authenticate(user=self.user)

        # 2. Location
        self.location = Location.objects.create(
            name="الفرع الرئيسي",
            address="عمان، الأردن",
            city="عمان",
            country="JO",
            is_active=True,
        )

        # 3. Clean Student
        self.clean_student = Student.objects.create(
            first_name="زيد",
            last_name="علي",
            full_name="زيد علي",
            phone="0791111111",
            location=self.location,
            status=Student.Status.ACTIVE,
        )

        # 4. Student with Dues and Memberships
        self.student_with_dues = Student.objects.create(
            first_name="عمر",
            last_name="فاروق",
            full_name="عمر فاروق",
            phone="0792222222",
            location=self.location,
            status=Student.Status.ACTIVE,
        )

        # Membership plan & active membership
        self.plan = MembershipPlan.objects.create(
            name="خطة شهرية",
            price=Decimal("50.00"),
            billing_cycle="monthly",
        )
        self.membership = Membership.objects.create(
            student=self.student_with_dues,
            plan=self.plan,
            start_date=timezone.now().date(),
            status=Membership.Status.ACTIVE,
        )

        # Unpaid invoice for student_with_dues
        self.invoice = Invoice.objects.create(
            student=self.student_with_dues,
            membership=self.membership,
            subtotal=Decimal("50.00"),
            tax_rate=Decimal("0.00"),
            total_amount=Decimal("50.00"),
            amount_paid=Decimal("0.00"),
            status=Invoice.Status.PENDING,
            due_date=timezone.now().date(),
        )

    def test_student_deletion_is_forbidden(self):
        """Verify that DELETE /api/v1/students/{id}/ returns 400 with deletion_not_allowed."""
        response = self.client.delete(f"/api/v1/students/{self.clean_student.id}/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get("code"), "deletion_not_allowed")
        # Ensure student still exists in DB
        self.assertTrue(Student.objects.filter(id=self.clean_student.id).exists())

    def test_archive_precheck_reports_dues_and_memberships(self):
        """Verify archive_precheck flags outstanding invoices and active memberships."""
        response = self.client.get(f"/api/v1/students/{self.student_with_dues.id}/archive_precheck/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["can_archive_cleanly"])
        self.assertEqual(response.data["total_due"], 50.00)
        self.assertEqual(len(response.data["outstanding_invoices"]), 1)
        self.assertEqual(len(response.data["active_memberships"]), 1)

    def test_archive_clean_student_precheck(self):
        """Verify clean student has zero dues in precheck."""
        response = self.client.get(f"/api/v1/students/{self.clean_student.id}/archive_precheck/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["can_archive_cleanly"])
        self.assertEqual(response.data["total_due"], 0.00)

    def test_archive_blocked_when_dues_exist_without_force(self):
        """Verify archive is rejected when dues exist and force_with_debt is False."""
        payload = {"reason": "انقطاع عن التدريب", "force_with_debt": False}
        response = self.client.post(f"/api/v1/students/{self.student_with_dues.id}/archive/", payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get("code"), "outstanding_dues_required")

        # Student should remain not archived
        self.student_with_dues.refresh_from_db()
        self.assertFalse(self.student_with_dues.is_archived)

    def test_archive_with_force_with_debt_succeeds(self):
        """Verify manager can archive with debt override for collection tracking."""
        payload = {"reason": "تعذر السداد وتم تحويل المديونية للتحصيل", "force_with_debt": True}
        response = self.client.post(f"/api/v1/students/{self.student_with_dues.id}/archive/", payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.student_with_dues.refresh_from_db()
        self.assertTrue(self.student_with_dues.is_archived)
        self.assertIsNotNone(self.student_with_dues.archived_at)
        self.assertEqual(self.student_with_dues.status, Student.Status.INACTIVE)

        # Membership should be cancelled
        self.membership.refresh_from_db()
        self.assertEqual(self.membership.status, Membership.Status.CANCELLED)

        # Invoice remains unpaid
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, Invoice.Status.PENDING)

        # Audit note created
        note = StudentNote.objects.filter(student=self.student_with_dues).first()
        self.assertIsNotNone(note)
        self.assertIn("50.00", note.content)

    def test_clean_student_archive_and_unarchive(self):
        """Verify archiving clean student and subsequent unarchiving."""
        # Archive
        payload = {"reason": "سفر للخارج"}
        response = self.client.post(f"/api/v1/students/{self.clean_student.id}/archive/", payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.clean_student.refresh_from_db()
        self.assertTrue(self.clean_student.is_archived)

        # Checkin should be blocked
        checkin_res = self.client.post(f"/api/v1/students/{self.clean_student.id}/quick_checkin/")
        self.assertEqual(checkin_res.status_code, status.HTTP_400_BAD_REQUEST)

        # Default list excludes archived
        list_res = self.client.get("/api/v1/students/")
        student_ids = [s["id"] for s in list_res.data.get("results", list_res.data)]
        self.assertNotIn(self.clean_student.id, student_ids)

        # Archive filter includes archived
        archived_list_res = self.client.get("/api/v1/students/?is_archived=true")
        archived_ids = [s["id"] for s in archived_list_res.data.get("results", archived_list_res.data)]
        self.assertIn(self.clean_student.id, archived_ids)

        # Unarchive
        unarchive_res = self.client.post(f"/api/v1/students/{self.clean_student.id}/unarchive/")
        self.assertEqual(unarchive_res.status_code, status.HTTP_200_OK)

        self.clean_student.refresh_from_db()
        self.assertFalse(self.clean_student.is_archived)
        self.assertIsNone(self.clean_student.archived_at)
