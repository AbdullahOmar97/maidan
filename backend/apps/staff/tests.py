from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import User
from apps.students.models import Location
from apps.attendance.models import ClassType, ClassSchedule, ClassSession
from apps.staff.models import StaffMember, StaffSalaryConfig, PayrollRun, StaffPayslip, StaffDocument


class StaffPayrollAPITestCase(TenantTestCase):
    """Test suite for the Staff Payroll and Document Management features."""

    def setUp(self):
        super().setUp()
        
        # Switch schema connection
        from django.db import connection
        connection.set_schema_to_public()
        connection.set_tenant(self.tenant)
        
        self.tenant.status = "trial"
        self.tenant.is_active = True
        self.tenant.save()

        self.client = APIClient()
        tenant_domain = self.tenant.domains.first().domain
        self.client.credentials(HTTP_HOST=tenant_domain)

        # Create branch
        self.location = Location.objects.create(
            name="Test Dojo Branch",
            address="123 Test St",
            city="Riyadh",
            country="SA"
        )

        # Create manager/owner user
        self.manager_user = User.objects.create_user(
            email="manager@maidan.app",
            password="securepassword123",
            first_name="Manager",
            last_name="One",
            role=User.Role.MANAGER,
            is_staff=True
        )
        self.manager_staff = StaffMember.objects.create(user=self.manager_user)

        # Create coach user
        self.coach_user = User.objects.create_user(
            email="coach@maidan.app",
            password="securepassword123",
            first_name="Coach",
            last_name="One",
            role=User.Role.INSTRUCTOR,
            is_staff=True
        )
        self.coach_staff = StaffMember.objects.create(user=self.coach_user)

    def tearDown(self):
        StaffDocument.objects.all().delete()
        StaffPayslip.objects.all().delete()
        PayrollRun.objects.all().delete()
        StaffSalaryConfig.objects.all().delete()
        StaffMember.objects.all().delete()
        ClassSession.objects.all().delete()
        ClassSchedule.objects.all().delete()
        ClassType.objects.all().delete()
        Location.objects.all().delete()
        super().tearDown()

    def test_salary_config_auto_create_and_update(self):
        """Listing salary configs should automatically ensure they exist, and staff can edit them."""
        self.client.force_authenticate(user=self.manager_user)
        
        # Initially, no configs exist
        self.assertEqual(StaffSalaryConfig.objects.count(), 0)

        # List configs - should trigger auto-create
        response = self.client.get("/api/v1/staff/salary-configs/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Configs should have been created for both staff members
        self.assertEqual(StaffSalaryConfig.objects.count(), 2)

        # Update the coach's config to be session-based
        coach_config = StaffSalaryConfig.objects.get(staff_member=self.coach_staff)
        update_data = {
            "employment_type": "session_based",
            "session_rate": "25.50",
            "currency": "JOD"
        }
        
        response = self.client.patch(
            f"/api/v1/staff/salary-configs/{coach_config.id}/",
            update_data
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        coach_config.refresh_from_db()
        self.assertEqual(coach_config.employment_type, "session_based")
        self.assertEqual(coach_config.session_rate, Decimal("25.50"))

    def test_payroll_run_generation_and_calculations(self):
        """Creating a payroll run should auto-generate payslips and scan session-based coach activities."""
        self.client.force_authenticate(user=self.manager_user)

        # 1. Setup salary config for Manager (Full-time fixed salary of 800 JOD)
        manager_config, _ = StaffSalaryConfig.objects.get_or_create(staff_member=self.manager_staff)
        manager_config.employment_type = "full_time"
        manager_config.basic_salary = Decimal("800.00")
        manager_config.save()

        # 2. Setup salary config for Coach (Session-based, 20 JOD per session)
        coach_config, _ = StaffSalaryConfig.objects.get_or_create(staff_member=self.coach_staff)
        coach_config.employment_type = "session_based"
        coach_config.session_rate = Decimal("20.00")
        coach_config.save()

        # 3. Create a completed ClassSession taught by the coach in May 2026
        class_type = ClassType.objects.create(name="BJJ Kids")
        schedule = ClassSchedule.objects.create(
            class_type=class_type,
            location=self.location,
            day_of_week=0,
            start_time="17:00:00",
            end_time="18:00:00"
        )
        
        ClassSession.objects.create(
            schedule=schedule,
            date="2026-05-10",
            instructor_id=self.coach_user.id,
            status="completed"
        )
        ClassSession.objects.create(
            schedule=schedule,
            date="2026-05-12",
            instructor_id=self.coach_user.id,
            status="completed"
        )
        # Create a cancelled one, shouldn't be counted
        ClassSession.objects.create(
            schedule=schedule,
            date="2026-05-14",
            instructor_id=self.coach_user.id,
            status="cancelled"
        )

        # 4. Generate payroll run for May 2026
        payroll_data = {
            "year": 2026,
            "month": 5,
            "notes": "رواتب مايو 2026"
        }
        
        response = self.client.post("/api/v1/staff/payroll-runs/", payroll_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payroll_id = response.data["id"]

        # 5. Verify payslips
        self.assertEqual(StaffPayslip.objects.filter(payroll_run_id=payroll_id).count(), 2)

        # Manager payslip
        manager_payslip = StaffPayslip.objects.get(payroll_run_id=payroll_id, staff_member=self.manager_staff)
        self.assertEqual(manager_payslip.employment_type, "full_time")
        self.assertEqual(manager_payslip.basic_salary, Decimal("800.00"))
        self.assertEqual(manager_payslip.net_salary, Decimal("800.00"))

        # Coach payslip (2 completed sessions * 20.00 JOD = 40.00 JOD)
        coach_payslip = StaffPayslip.objects.get(payroll_run_id=payroll_id, staff_member=self.coach_staff)
        self.assertEqual(coach_payslip.employment_type, "session_based")
        self.assertEqual(coach_payslip.calculated_units, Decimal("2.00"))
        self.assertEqual(coach_payslip.unit_rate, Decimal("20.00"))
        self.assertEqual(coach_payslip.net_salary, Decimal("40.00"))

        # 6. Test manual adjustments on payslip (Add allowance & deduction)
        adjust_data = {
            "allowances": "50.00",
            "deductions": "10.00",
            "notes": "إضافة مكافأة وخصم تأخير"
        }
        
        adjust_response = self.client.patch(
            f"/api/v1/staff/payslips/{coach_payslip.id}/",
            adjust_data
        )
        self.assertEqual(adjust_response.status_code, status.HTTP_200_OK)
        
        coach_payslip.refresh_from_db()
        # New net: 40.00 + 50.00 - 10.00 = 80.00
        self.assertEqual(coach_payslip.net_salary, Decimal("80.00"))

    def test_payroll_approval_and_payment(self):
        """Test transitioning payroll run from Draft -> Approved -> Paid."""
        self.client.force_authenticate(user=self.manager_user)

        payroll_run = PayrollRun.objects.create(year=2026, month=6, status="draft")
        payslip = StaffPayslip.objects.create(
            payroll_run=payroll_run,
            staff_member=self.coach_staff,
            employment_type="full_time",
            basic_salary=Decimal("500.00")
        )

        # 1. Approve
        response = self.client.post(f"/api/v1/staff/payroll-runs/{payroll_run.id}/approve/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payroll_run.refresh_from_db()
        self.assertEqual(payroll_run.status, "approved")

        # 2. Pay
        response = self.client.post(f"/api/v1/staff/payroll-runs/{payroll_run.id}/mark_paid/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        payroll_run.refresh_from_db()
        self.assertEqual(payroll_run.status, "paid")
        
        payslip.refresh_from_db()
        self.assertEqual(payslip.status, "paid")
        self.assertIsNotNone(payslip.payment_date)

    def test_staff_document_upload_and_delete(self):
        """Verify that files can be uploaded and managed for staff members."""
        self.client.force_authenticate(user=self.manager_user)

        # Create a mock file
        test_file = SimpleUploadedFile(
            "contract.pdf",
            b"Mock PDF file content",
            content_type="application/pdf"
        )

        doc_data = {
            "staff_member": self.coach_staff.id,
            "name": "عقد العمل لعام 2026",
            "file": test_file,
            "notes": "العقد السنوي المعتمد"
        }

        response = self.client.post(
            "/api/v1/staff/documents/",
            doc_data,
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        doc_id = response.data["id"]

        self.assertEqual(StaffDocument.objects.count(), 1)
        doc = StaffDocument.objects.get(id=doc_id)
        self.assertEqual(doc.name, "عقد العمل لعام 2026")
        self.assertTrue(doc.file.name.endswith("contract.pdf"))

        # Clean up files
        doc.file.delete()
