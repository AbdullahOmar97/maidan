from django.test import TestCase
from django.utils import timezone
from django_tenants.utils import schema_context
from decimal import Decimal

from apps.tenants.models import Tenant, Domain
from apps.students.models import Student, Location
from apps.belts.models import Belt, StudentBelt, BeltExam, ExamCandidate


class BeltExamTestCase(TestCase):
    def setUp(self):
        # 1. Create a tenant for schema context testing
        self.tenant = Tenant.objects.create(
            schema_name="test_belts",
            name="Test Academy",
            status="active"
        )
        self.domain = Domain.objects.create(
            domain="belts.localhost",
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

            # 3. Create Ranks
            self.white_belt = Belt.objects.create(
                martial_art="BJJ",
                name="White Belt",
                name_ar="حزام أبيض",
                color_hex="#FFFFFF",
                order_index=0,
                is_active=True
            )

            self.blue_belt = Belt.objects.create(
                martial_art="BJJ",
                name="Blue Belt",
                name_ar="حزام أزرق",
                color_hex="#0000FF",
                order_index=1,
                is_active=True
            )

            # 4. Create Student
            self.student = Student.objects.create(
                first_name="أحمد",
                last_name="علي",
                phone="0791234567",
                location=self.location,
                status="active"
            )

            # 5. Set current belt as White Belt
            self.student_belt = StudentBelt.objects.create(
                student=self.student,
                belt_rank=self.white_belt,
                promoted_at=timezone.now().date() - timezone.timedelta(days=30),
                is_current=True
            )

            # 6. Create Exam Event
            self.exam = BeltExam.objects.create(
                name="اختبار الترقية لشتاء 2026",
                date=timezone.now().date(),
                martial_art="BJJ",
                location=self.location
            )

    def test_exam_candidate_registration(self):
        with schema_context(self.tenant.schema_name):
            # Register student as exam candidate targeting Blue Belt
            candidate = ExamCandidate.objects.create(
                exam=self.exam,
                student=self.student,
                target_belt=self.blue_belt,
                status=ExamCandidate.Result.PENDING
            )

            self.assertEqual(candidate.status, ExamCandidate.Result.PENDING)
            self.assertEqual(candidate.student, self.student)
            self.assertEqual(candidate.target_belt, self.blue_belt)
            
            # Check candidate unique constraint
            with self.assertRaises(Exception):
                ExamCandidate.objects.create(
                    exam=self.exam,
                    student=self.student,
                    target_belt=self.blue_belt
                )

    def test_auto_promotion_on_grading_passed(self):
        with schema_context(self.tenant.schema_name):
            # Create candidate
            candidate = ExamCandidate.objects.create(
                exam=self.exam,
                student=self.student,
                target_belt=self.blue_belt,
                status=ExamCandidate.Result.PENDING
            )

            # Check that student is still white belt
            current_belt = self.student.belt_history.filter(is_current=True).first()
            self.assertEqual(current_belt.belt_rank, self.white_belt)

            # Grade candidate to passed
            candidate.status = ExamCandidate.Result.PASSED
            candidate.technical_grade = "A+"
            candidate.instructor_notes = "أداء ممتاز وتطبيق دقيق للحركات."
            candidate.save()

            # Verify StudentBelt promotion was created automatically
            promotions = StudentBelt.objects.filter(student=self.student).order_by("-promoted_at")
            self.assertEqual(promotions.count(), 2)
            
            new_current = promotions.filter(is_current=True).first()
            self.assertEqual(new_current.belt_rank, self.blue_belt)
            self.assertEqual(new_current.notes, "تمت الترقية بنجاح عبر اختبار: اختبار الترقية لشتاء 2026. أداء ممتاز وتطبيق دقيق للحركات.")

            # Verify White Belt is no longer is_current
            old_belt = StudentBelt.objects.get(id=self.student_belt.id)
            self.assertFalse(old_belt.is_current)

    def tearDown(self):
        self.tenant.delete()
