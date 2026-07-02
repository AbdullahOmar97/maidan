"""
MAIDAN — seed_demo Management Command

Creates a complete demo tenant with realistic Sports Club data:
- 1 tenant (Dragon's Sports Club)
- 2 locations
- 5 belt ranks (BJJ)
- 3 class types
- 15 students (mix of statuses)
- Memberships and invoices
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, timedelta
import random


class Command(BaseCommand):
    help = "Seed demo data for MAIDAN development"

    def add_arguments(self, parser):
        parser.add_argument("--tenant", type=str, default="demo", help="Tenant schema name")

    def handle(self, *args, **options):
        schema_name = options["tenant"]
        self.stdout.write(f"Seeding demo data for tenant: {schema_name}")

        # --- Create Tenant & Domain ---
        from apps.tenants.models import Tenant, Domain, Plan

        plan, _ = Plan.objects.get_or_create(
            slug="starter",
            defaults={
                "name": "Starter",
                "max_locations": 2,
                "max_students": 200,
                "max_staff": 10,
                "price_monthly": 299,
                "currency": "SAR",
                "features": {"whatsapp": True, "kiosk": True, "reports": True},
            },
        )

        tenant, created = Tenant.objects.get_or_create(
            schema_name=schema_name,
            defaults={
                "name": "Dragon's Sports Club نادي التنين",
                "slug": schema_name,
                "email": "admin@dragons-Sports Club.sa",
                "plan": plan,
                "default_language": "ar",
                "default_currency": "SAR",
            },
        )

        Domain.objects.get_or_create(
            domain=f"{schema_name}.localhost",
            defaults={"tenant": tenant, "is_primary": True},
        )

        if not created:
            self.stdout.write("Tenant already exists, seeding data within it...")

        # Switch to tenant schema
        from django_tenants.utils import schema_context
        with schema_context(schema_name):
            self._seed_tenant_data()

        self.stdout.write(self.style.SUCCESS(f"✅ Demo data seeded for tenant '{schema_name}'"))
        self.stdout.write(f"   → Tenant URL: http://{schema_name}.localhost/")
        self.stdout.write(f"   → Admin: admin@dragons-Sports Club.sa / admin1234")

    def _seed_tenant_data(self):
        from apps.students.models import Location, Student, Family
        from apps.belts.models import StudentBelt
        from apps.attendance.models import ClassType, ClassSchedule, ClassSession, AttendanceRecord
        from apps.billing.models import MembershipPlan, Membership, Invoice
        from apps.accounts.models import User

        # --- Create Admin User ---
        admin, _ = User.objects.get_or_create(
            email="admin@dragons-Sports Club.sa",
            defaults={
                "first_name": "Ahmed",
                "last_name": "Al-Rashid",
                "first_name_ar": "أحمد",
                "last_name_ar": "الراشد",
                "role": "tenant_owner",
                "is_active": True,
                "is_staff": True,
            },
        )
        if _:
            admin.set_password("admin1234")
            admin.save()

        # --- Locations ---
        loc1, _ = Location.objects.get_or_create(
            name="Riyadh Main Branch",
            defaults={
                "name_ar": "الفرع الرئيسي الرياض",
                "address": "King Fahad Road, Al Olaya",
                "city": "Riyadh",
                "country": "SA",
                "phone": "+966-11-2345678",
                "capacity": 40,
                "timezone": "Asia/Riyadh",
            },
        )

        loc2, _ = Location.objects.get_or_create(
            name="Jeddah Branch",
            defaults={
                "name_ar": "فرع جدة",
                "address": "Tahlia Street, Al Rawdah",
                "city": "Jeddah",
                "country": "SA",
                "phone": "+966-12-3456789",
                "capacity": 30,
                "timezone": "Asia/Riyadh",
            },
        )

        # --- Belt Ranks (BJJ) ---
        from apps.tenants.models import GlobalDefaultBelt
        from apps.belts.models import Belt
        from django_tenants.utils import schema_context

        bjj_belts = [
            ("White", "#FFFFFF", 0, 0, 0),
            ("Blue", "#1E3A8A", 1, 50, 12),
            ("Purple", "#7C3AED", 2, 100, 18),
            ("Brown", "#92400E", 3, 150, 24),
            ("Black", "#111827", 4, 250, 36),
        ]
        
        # 1. Seed global default belts in public schema
        with schema_context("public"):
            for name, color, order, sessions, months in bjj_belts:
                GlobalDefaultBelt.objects.get_or_create(
                    martial_art="BJJ",
                    order_index=order,
                    defaults={
                        "name": name,
                        "color_hex": color,
                        "min_attendance_sessions": sessions,
                        "min_months_since_last": months,
                        "is_active": True,
                    },
                )

        # 2. Seed tenant-scoped belts inside this tenant context
        belt_objs = []
        for name, color, order, sessions, months in bjj_belts:
            belt, _ = Belt.objects.get_or_create(
                martial_art="BJJ",
                order_index=order,
                defaults={
                    "name": name,
                    "color_hex": color,
                    "min_attendance_sessions": sessions,
                    "min_months_since_last": months,
                    "is_active": True,
                },
            )
            belt_objs.append(belt)

        # --- Class Types ---
        bjj_fund, _ = ClassType.objects.get_or_create(
            name="BJJ Fundamentals",
            defaults={"name_ar": "أساسيات البراجيتسو", "martial_art": "BJJ", "color": "#6366f1", "default_duration_minutes": 60},
        )
        kids_bjj, _ = ClassType.objects.get_or_create(
            name="Kids BJJ",
            defaults={"name_ar": "براجيتسو الأطفال", "martial_art": "BJJ", "color": "#f59e0b", "default_duration_minutes": 45},
        )
        nogi, _ = ClassType.objects.get_or_create(
            name="No-Gi Grappling",
            defaults={"name_ar": "جراپلينج بدون كيموناه", "martial_art": "BJJ", "color": "#ef4444", "default_duration_minutes": 60},
        )

        # --- Schedules ---
        today_weekday = date.today().weekday()
        schedule_days = list(set([0, 2, 4, today_weekday])) # Mon, Wed, Fri + Today
        
        for day in schedule_days:
            ClassSchedule.objects.get_or_create(
                class_type=bjj_fund if day != today_weekday else kids_bjj, 
                location=loc1, 
                day_of_week=day,
                defaults={
                    "start_time": "18:00" if day != today_weekday else (timezone.now() - timedelta(minutes=30)).strftime("%H:%M"), 
                    "end_time": "19:00" if day != today_weekday else (timezone.now() + timedelta(minutes=60)).strftime("%H:%M"), 
                    "capacity": 20
                },
            )

        # --- Membership Plans ---
        plan_monthly, _ = MembershipPlan.objects.get_or_create(
            name="Monthly BJJ",
            defaults={
                "name_ar": "شهري براجيتسو",
                "billing_cycle": "monthly",
                "price": 350,
                "currency": "SAR",
                "tax_rate": 15,
                "is_active": True,
                "is_unlimited": True,
            },
        )
        plan_annual, _ = MembershipPlan.objects.get_or_create(
            name="Annual BJJ",
            defaults={
                "name_ar": "سنوي براجيتسو",
                "billing_cycle": "annual",
                "price": 3500,
                "currency": "SAR",
                "tax_rate": 15,
                "is_active": True,
                "is_unlimited": True,
            },
        )

        # --- Students ---
        demo_students = [
            ("Mohammed", "Al-Ghamdi", "محمد", "الغامدي", "active", "+966-501-111001", belt_objs[1]),
            ("Abdullah", "Al-Otaibi", "عبدالله", "العتيبي", "active", "+966-501-111002", belt_objs[0]),
            ("Sara", "Al-Harbi", "سارة", "الحربي", "active", "+966-501-111003", belt_objs[0]),
            ("Khalid", "Al-Dosari", "خالد", "الدوسري", "active", "+966-501-111004", belt_objs[2]),
            ("Fatima", "Al-Zahrani", "فاطمة", "الزهراني", "trial", "+966-501-111005", None),
            ("Omar", "Al-Shehri", "عمر", "الشهري", "active", "+966-501-111006", belt_objs[1]),
            ("Noura", "Al-Qahtani", "نورة", "القحطاني", "active", "+966-501-111007", belt_objs[0]),
            ("Faisal", "Al-Mutairi", "فيصل", "المطيري", "lead", "+966-501-111008", None),
            ("Hessa", "Al-Anazi", "هيصة", "العنزي", "active", "+966-501-111009", belt_objs[3]),
            ("Turki", "Al-Subaie", "تركي", "السبيعي", "inactive", "+966-501-111010", belt_objs[0]),
            ("Rana", "Al-Asmari", "رنا", "الأسمري", "trial", "+966-501-111011", None),
            ("Bader", "Al-Rashidi", "بدر", "الراشدي", "active", "+966-501-111012", belt_objs[1]),
            ("Lama", "Al-Johani", "لمى", "الجهني", "active", "+966-501-111013", belt_objs[0]),
            ("Nawaf", "Al-Maliki", "نواف", "المالكي", "active", "+966-501-111014", belt_objs[2]),
            ("Reem", "Al-Yami", "ريم", "اليامي", "lead", "+966-501-111015", None),
        ]

        today = date.today()
        for i, (fn, ln, fn_ar, ln_ar, stu_status, phone, belt) in enumerate(demo_students):
            student, created_stu = Student.objects.get_or_create(
                email=f"{fn.lower()}.{ln.lower()}@demo.sa",
                defaults={
                    "first_name": fn,
                    "last_name": ln,
                    "first_name_ar": fn_ar,
                    "last_name_ar": ln_ar,
                    "phone": phone,
                    "whatsapp": phone,
                    "status": stu_status,
                    "location": loc1 if i % 2 == 0 else loc2,
                    "date_of_birth": date(1995 + i % 10, (i % 12) + 1, 15),
                    "gender": "male" if i % 3 != 1 else "female",
                    "waiver_signed": stu_status == "active",
                    "trial_start_date": today - timedelta(days=7) if stu_status == "trial" else None,
                    "trial_end_date": today + timedelta(days=7) if stu_status == "trial" else None,
                },
            )

            if created_stu and belt:
                StudentBelt.objects.get_or_create(
                    student=student, belt_rank=belt,
                    defaults={"promoted_at": today - timedelta(days=random.randint(30, 365)), "is_current": True},
                )

            if created_stu and stu_status == "active":
                plan = plan_monthly if i % 3 != 0 else plan_annual
                membership, _ = Membership.objects.get_or_create(
                    student=student, status="active",
                    defaults={
                        "plan": plan,
                        "start_date": today - timedelta(days=random.randint(1, 60)),
                        "end_date": today + timedelta(days=30),
                        "auto_renew": True,
                    },
                )

                # Create invoices
                for month_offset in range(3):
                    invoice_date = today - timedelta(days=30 * month_offset)
                    paid = month_offset > 0
                    Invoice.objects.get_or_create(
                        student=student,
                        due_date=invoice_date,
                        defaults={
                            "subtotal": float(plan.price),
                            "tax_rate": 15,
                            "tax_amount": float(plan.price) * 0.15,
                            "total_amount": float(plan.price) * 1.15,
                            "currency": "SAR",
                            "status": "paid" if paid else "pending",
                            "paid_at": timezone.now() - timedelta(days=30 * month_offset) if paid else None,
                            "membership": membership,
                        },
                    )

        self.stdout.write(f"   Created {len(demo_students)} students, locations, belts, classes")
