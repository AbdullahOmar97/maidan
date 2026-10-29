"""
MAIDAN — Students App Serializers
"""

from rest_framework import serializers
from .models import Student, StudentNote, StudentDocument, Location, Family


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = [
            "id", "name", "address", "city", "country",
            "phone", "email", "timezone", "capacity", "is_active",
            "manager_id", "photo", "map_lat", "map_lng", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        if request and hasattr(request, "tenant") and request.tenant:
            tenant = request.tenant
            if tenant.schema_name != "public":
                plan = tenant.plan
                if plan:
                    # 1. Enforce max locations limit on creation/activation
                    is_activating = False
                    if not self.instance:
                        is_activating = attrs.get("is_active", True)
                    else:
                        is_activating = attrs.get("is_active", False) and not self.instance.is_active

                    if is_activating:
                        active_locations_count = Location.objects.filter(is_active=True).count()
                        if active_locations_count >= plan.max_locations:
                            raise serializers.ValidationError(
                                {"non_field_errors": f"لقد تجاوزت الحد الأقصى لعدد الفروع النشطة المسموح به في باقتك الحالية ({plan.max_locations} فرع)."}
                            )

                    # 2. Enforce sum of capacities across all active branches does not exceed plan.max_students
                    from django.db.models import Sum
                    capacity_val = attrs.get("capacity")
                    if capacity_val is None:
                        if self.instance:
                            capacity_val = self.instance.capacity
                        else:
                            capacity_val = 50  # default capacity

                    is_active_after_save = attrs.get("is_active")
                    if is_active_after_save is None:
                        is_active_after_save = self.instance.is_active if self.instance else True

                    if is_active_after_save:
                        query = Location.objects.filter(is_active=True)
                        if self.instance and self.instance.pk:
                            query = query.exclude(pk=self.instance.pk)

                        other_branches_capacity = query.aggregate(total=Sum("capacity"))["total"] or 0
                        total_capacity = other_branches_capacity + capacity_val

                        if total_capacity > plan.max_students:
                            raise serializers.ValidationError(
                                {"capacity": f"إجمالي الطاقة الاستيعابية للفروع النشطة يتجاوز الحد الأقصى لعدد الطلاب المسموح به في باقتك الحالية ({plan.max_students} طالب). السعة المتاحة لباقي الفروع النشطة هي {other_branches_capacity} طالب."}
                            )
        return attrs



class FamilySerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Family
        fields = [
            "id", "name", "primary_contact_name", "primary_contact_phone",
            "primary_contact_email", "billing_address", "notes",
            "member_count", "created_at",
        ]
        read_only_fields = ["id", "member_count", "created_at"]

    def get_member_count(self, obj):
        return obj.members.count()


class FamilyMemberSerializer(serializers.ModelSerializer):
    """Compact student snapshot for family member list."""
    full_name = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()
    photo_url = serializers.SerializerMethodField()
    current_belt = serializers.SerializerMethodField()
    active_membership = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            "id", "student_number", "first_name", "last_name", "full_name",
            "photo_url", "age", "gender", "phone", "email",
            "status", "current_belt", "active_membership", "created_at",
        ]

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.photo.url)
        return None

    def get_current_belt(self, obj):
        belt = obj.belt_history.filter(is_current=True).first()
        if belt:
            return {
                "name": belt.belt_rank.name,
                "color": belt.belt_rank.color_hex,
                "promoted_at": belt.promoted_at,
            }
        return None

    def get_active_membership(self, obj):
        membership = obj.memberships.filter(status="active").first()
        if membership:
            return {
                "id": membership.id,
                "plan_name": membership.plan.name,
                "status": membership.status,
                "end_date": membership.end_date,
            }
        return None


class FamilyDetailSerializer(FamilySerializer):
    """Full family detail with member list and aggregated stats."""
    members = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    class Meta(FamilySerializer.Meta):
        fields = FamilySerializer.Meta.fields + ["members", "stats"]

    def get_members(self, obj):
        qs = obj.members.prefetch_related(
            "belt_history__belt_rank", "memberships__plan"
        ).all()
        return FamilyMemberSerializer(qs, many=True, context=self.context).data

    def get_stats(self, obj):
        from django.db.models import Sum, Q, F
        members = obj.members.all()
        member_ids = list(members.values_list("id", flat=True))

        active_count = members.filter(status="active").count()
        active_memberships = members.filter(memberships__status="active").distinct().count()

        # Total invoices and outstanding balance
        from apps.billing.models import Invoice
        invoices = Invoice.objects.filter(student_id__in=member_ids).exclude(status__in=["void", "refunded"])
        total_billed = invoices.aggregate(t=Sum("total_amount"))["t"] or 0
        outstanding = invoices.filter(
            status__in=["pending", "overdue"]
        ).aggregate(t=Sum(F("total_amount") - F("amount_paid")))["t"] or 0

        # Attendance count (last 90 days)
        from apps.attendance.models import AttendanceRecord
        from django.utils import timezone
        import datetime
        since = timezone.now() - datetime.timedelta(days=90)
        attendance_count = AttendanceRecord.objects.filter(
            student_id__in=member_ids,
            checked_in_at__gte=since,
        ).count()

        return {
            "member_count": len(member_ids),
            "active_count": active_count,
            "active_memberships": active_memberships,
            "total_billed": float(total_billed),
            "outstanding_balance": float(outstanding),
            "attendance_last_90_days": attendance_count,
        }


class KioskStudentSerializer(serializers.ModelSerializer):
    """Minimal student data for kiosk search."""
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = Student
        fields = ["id", "full_name", "first_name", "last_name", "phone"]
        read_only_fields = ["id", "full_name"]


class StudentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    full_name = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()
    current_belt = serializers.SerializerMethodField()
    active_membership = serializers.SerializerMethodField()
    outstanding_balance = serializers.SerializerMethodField()
    has_due_membership = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            "id", "student_number", "first_name", "last_name", "full_name",
            "photo", "photo_url", "age", "gender",
            "phone", "email", "whatsapp",
            "status", "source", "location", "location_id",
            "current_belt", "active_membership", "outstanding_balance",
            "has_due_membership", "is_archived", "archived_at", "archive_reason", "created_at",
        ]
        read_only_fields = [
            "id", "student_number", "full_name", "age", "current_belt",
            "active_membership", "outstanding_balance", "has_due_membership",
            "is_archived", "archived_at", "archive_reason", "created_at"
        ]

    def get_current_belt(self, obj):
        belt = obj.belt_history.filter(is_current=True).first()
        if belt:
            return {
                "name": belt.belt_rank.name,
                "color": belt.belt_rank.color_hex,
                "promoted_at": belt.promoted_at,
            }
        return None

    def get_active_membership(self, obj):
        membership = obj.memberships.filter(status="active").first()
        if membership:
            return {
                "id": membership.id,
                "plan_name": membership.plan.name,
                "start_date": membership.start_date,
                "end_date": membership.end_date,
                "status": membership.status,
            }
        return None

    def get_outstanding_balance(self, obj):
        from django.db.models import Sum, F
        invoices = obj.invoices.filter(status__in=["pending", "overdue"])
        agg = invoices.aggregate(total=Sum(F("total_amount") - F("amount_paid")))
        return float(agg["total"] or 0)

    def get_has_due_membership(self, obj):
        from django.utils import timezone
        import datetime
        today = timezone.now().date()
        cutoff = today + datetime.timedelta(days=7)

        # 1. Overdue or past-due unpaid invoices
        has_overdue_invoice = obj.invoices.filter(
            status__in=["overdue", "pending", "partially_paid"],
            due_date__lte=today
        ).exists() or obj.invoices.filter(status="overdue").exists()
        if has_overdue_invoice:
            return True

        # 2. Pending memberships
        if obj.memberships.filter(status__in=["pending", "pending_approval"]).exists():
            return True

        # 3. If student has a future active membership beyond cutoff, they are not due
        has_future_active = obj.memberships.filter(status="active", end_date__gt=cutoff).exists()
        if has_future_active:
            return False

        # 4. Active membership expiring soon (حديث)
        if obj.memberships.filter(status="active", end_date__lte=cutoff).exists():
            return True

        # 5. Expired membership in the past (القديم)
        if obj.memberships.filter(status="expired").exists() or obj.memberships.filter(end_date__lt=today).exists():
            return True

        return False

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.photo.url)
        return None


class StudentDetailSerializer(serializers.ModelSerializer):
    """Full student detail serializer."""
    full_name = serializers.CharField(required=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True, default="")
    age = serializers.ReadOnlyField()
    family = FamilySerializer(read_only=True)
    family_id = serializers.PrimaryKeyRelatedField(
        queryset=Family.objects.all(), source="family", write_only=True, required=False, allow_null=True
    )
    location = LocationSerializer(read_only=True)
    location_id = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.all(), source="location", write_only=True
    )
    photo_url = serializers.SerializerMethodField()
    active_membership = serializers.SerializerMethodField()
    current_belt = serializers.SerializerMethodField()
    belt_history = serializers.SerializerMethodField()
    initial_belt_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    initial_membership_plan_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    membership_start_date = serializers.DateField(write_only=True, required=False, allow_null=True)
    initial_products = serializers.ListField(child=serializers.DictField(), write_only=True, required=False, allow_empty=True)
    internal_notes = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Student
        fields = [
            "id", "student_number",
            "full_name", "first_name", "last_name",
            "date_of_birth", "age", "gender", "nationality",
            "phone", "email", "whatsapp",
            "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation",
            "medical_notes", "blood_type", "allergies",
            "photo", "photo_url",
            "family", "family_id", "location", "location_id",
            "status", "source", "referred_by_id",
            "trial_start_date", "trial_end_date", "trial_sessions_used",
            "waiver_signed", "waiver_signed_at", "photo_consent",
            "notes", "internal_notes",
            "initial_belt_id", "initial_membership_plan_id", "membership_start_date", "initial_products",
            "active_membership", "current_belt", "belt_history",
            "is_archived", "archived_at", "archive_reason", "archived_by_id",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "student_number", "age",
            "active_membership", "current_belt", "belt_history",
            "is_archived", "archived_at", "archive_reason", "archived_by_id",
            "created_at", "updated_at",
        ]

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            data = data.copy()
        elif isinstance(data, dict):
            data = dict(data)

        # Discard photo if it is a string URL/path rather than a file upload
        photo = data.get("photo")
        if photo is not None and not hasattr(photo, "read"):
            data.pop("photo", None)

        nullable_fields = [
            "family_id", "date_of_birth", "initial_belt_id",
            "initial_membership_plan_id", "membership_start_date",
            "referred_by_id", "trial_start_date", "trial_end_date",
            "waiver_signed_at",
        ]
        for field in nullable_fields:
            if field in data and (data[field] == "" or data[field] == "null" or data[field] == "undefined"):
                data.pop(field, None)

        for bool_field in ["waiver_signed", "photo_consent"]:
            if bool_field in data:
                val = data[bool_field]
                if isinstance(val, str):
                    if val.lower() in ["true", "1"]:
                        data[bool_field] = True
                    elif val.lower() in ["false", "0", ""]:
                        data[bool_field] = False

        if "initial_products" in data:
            val = data["initial_products"]
            if isinstance(val, str):
                import json
                try:
                    data["initial_products"] = json.loads(val)
                except Exception:
                    data["initial_products"] = []

        return super().to_internal_value(data)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        
        # Plan student capacity check
        request = self.context.get("request")
        if request and hasattr(request, "tenant") and request.tenant:
            tenant = request.tenant
            if tenant.schema_name != "public":
                plan = tenant.plan
                if plan:
                    is_activating = False
                    new_status = attrs.get("status")
                    if not self.instance:
                        is_activating = (new_status == "active")
                    else:
                        is_activating = (new_status == "active") and (self.instance.status != "active")

                    if is_activating:
                        active_students = Student.objects.filter(status="active", deleted_at__isnull=True).count()
                        if active_students >= plan.max_students:
                            raise serializers.ValidationError(
                                {"non_field_errors": f"لقد تجاوزت الحد الأقصى لعدد الطلاب النشطين المسموح به في باقتك الحالية ({plan.max_students} طالب)."}
                            )


        # Branch capacity validation
        location = attrs.get("location")
        status_val = attrs.get("status")
        
        # If updating, get values from self.instance if not provided in attrs
        if self.instance:
            if location is None:
                location = self.instance.location
            if status_val is None:
                status_val = self.instance.status
        else:
            if status_val is None:
                status_val = "lead"

        # Unique student per branch check (only if phone is provided)
        full_name = attrs.get("full_name") or (self.instance.full_name if self.instance else "")
        phone = attrs.get("phone")
        if phone is None and self.instance:
            phone = self.instance.phone
        phone = (phone or "").strip()

        if full_name and phone and location:
            duplicate_qs = Student.objects.filter(
                full_name=full_name,
                phone=phone,
                location=location,
                deleted_at__isnull=True,
            )
            if self.instance and self.instance.pk:
                duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)
            if duplicate_qs.exists():
                raise serializers.ValidationError({
                    "phone": "هذا الطالب موجود بالفعل في هذا الفرع بنفس البيانات (الاسم ورقم الهاتف)."
                })
                
        # Only check capacity if the student's status is 'active' or 'trial'
        if status_val in ["active", "trial"] and location:
            # Count other active/trial students in this location
            query = Student.objects.filter(
                location=location,
                status__in=["active", "trial"],
                deleted_at__isnull=True
            )
            if self.instance and self.instance.pk:
                query = query.exclude(pk=self.instance.pk)
                
            current_active_count = query.count()
            if current_active_count >= location.capacity:
                raise serializers.ValidationError({
                    "location_id": f"لقد تجاوز عدد الطلاب في هذا الفرع السعة الاستيعابية المتاحة ({location.capacity} طلاب)."
                })
                
        return attrs

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.photo.url)
        return None

    def get_active_membership(self, obj):
        membership = obj.memberships.filter(status="active").first()
        if membership:
            return {
                "id": membership.id,
                "plan_name": membership.plan.name,
                "start_date": membership.start_date,
                "end_date": membership.end_date,
                "status": membership.status,
            }
        return None

    def get_current_belt(self, obj):
        belt = obj.belt_history.filter(is_current=True).first()
        if belt:
            return {
                "name": belt.belt_rank.name,
                "color": belt.belt_rank.color_hex,
                "promoted_at": belt.promoted_at,
            }
        return None

    def get_belt_history(self, obj):
        return [
            {
                "belt_name": h.belt_rank.name,
                "color": h.belt_rank.color_hex,
                "promoted_at": h.promoted_at,
                "is_current": h.is_current,
                "martial_art": h.belt_rank.martial_art,
                "notes": h.notes,
            }
            for h in obj.belt_history.all()[:10]
        ]

    def create(self, validated_data):
        initial_belt_id = validated_data.pop("initial_belt_id", None)
        initial_plan_id = validated_data.pop("initial_membership_plan_id", None)
        membership_start_date = validated_data.pop("membership_start_date", None)
        initial_products = validated_data.pop("initial_products", None)

        from django.db import transaction
        with transaction.atomic():
            student = super().create(validated_data)
            request = self.context.get("request")
            user_id = request.user.id if request and hasattr(request, "user") and request.user and request.user.is_authenticated else None

            if initial_belt_id:
                try:
                    from apps.belts.models import Belt, StudentBelt
                    from django.utils import timezone
                    belt = Belt.objects.filter(id=initial_belt_id, is_active=True).first()
                    if belt:
                        StudentBelt.objects.create(
                            student=student,
                            belt_rank=belt,
                            promoted_at=timezone.now().date(),
                            promoted_by_id=user_id,
                            is_current=True,
                            notes="الحزام الأولي عند التسجيل",
                        )
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning("Failed to assign initial belt: %s", e)

            if initial_plan_id:
                try:
                    from apps.billing.models import MembershipPlan, Membership
                    from django.utils import timezone
                    plan = MembershipPlan.objects.filter(id=initial_plan_id, is_active=True).first()
                    if plan:
                        start_d = membership_start_date or timezone.now().date()
                        end_d = Membership.compute_end_date(start_d, plan.billing_cycle)
                        Membership.objects.create(
                            student=student,
                            plan=plan,
                            start_date=start_d,
                            end_date=end_d,
                            status="active",
                            created_by_id=user_id,
                        )
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning("Failed to create initial membership: %s", e)

            if initial_products and isinstance(initial_products, list):
                try:
                    from apps.store.models import Product, ProductOption, Order, OrderItem
                    from apps.billing.models import Invoice
                    from django.utils import timezone
                    from decimal import Decimal

                    order_items = []
                    total_amount = Decimal("0.00")
                    order_currency = "JOD"

                    for item_data in initial_products:
                        prod_id = item_data.get("product_id") or item_data.get("product")
                        if not prod_id:
                            continue
                        opt_id = item_data.get("option_id") or item_data.get("option")
                        qty = max(1, int(item_data.get("quantity", 1)))

                        prod = Product.objects.filter(id=prod_id, is_active=True).first()
                        if not prod:
                            continue

                        order_currency = prod.currency
                        unit_price = Decimal(str(prod.price))

                        option = None
                        if opt_id:
                            option = ProductOption.objects.filter(id=opt_id, product=prod).first()
                            if option:
                                if option.stock > 0:
                                    qty = min(qty, option.stock)
                                    option.stock = max(0, option.stock - qty)
                                    option.save(update_fields=["stock"])
                                unit_price += Decimal(str(option.additional_price))

                        item_total = unit_price * Decimal(str(qty))
                        total_amount += item_total
                        order_items.append({
                            "product": prod,
                            "option": option,
                            "quantity": qty,
                            "unit_price": unit_price,
                            "total_price": item_total,
                        })

                    if order_items and total_amount > Decimal("0.00"):
                        order = Order.objects.create(
                            student=student,
                            buyer_name=student.full_name,
                            buyer_phone=student.phone or "",
                            buyer_email=student.email or "",
                            total_amount=total_amount,
                            payment_method=Order.PaymentMethod.CASH,
                            payment_status=Order.PaymentStatus.PENDING,
                            status=Order.Status.READY,
                            notes="طلب تجهيزات ومعدات التسجيل الأولي",
                        )

                        item_instances = [
                            OrderItem(
                                order=order,
                                product=oi["product"],
                                option=oi["option"],
                                quantity=oi["quantity"],
                                unit_price=oi["unit_price"],
                                total_price=oi["total_price"]
                            )
                            for oi in order_items
                        ]
                        OrderItem.objects.bulk_create(item_instances)

                        due_date = timezone.now().date()
                        tax_rate = Decimal("15.0")
                        subtotal = total_amount / (Decimal("1.0") + (tax_rate / Decimal("100.0")))
                        tax_amount = total_amount - subtotal

                        invoice = Invoice.objects.create(
                            student=student,
                            subtotal=round(subtotal, 2),
                            discount_amount=Decimal("0.00"),
                            tax_rate=tax_rate,
                            tax_amount=round(tax_amount, 2),
                            total_amount=total_amount,
                            amount_paid=Decimal("0.00"),
                            currency=order_currency,
                            status=Invoice.Status.PENDING,
                            due_date=due_date,
                            is_recurring=False,
                            notes=f"فاتورة طلب تجهيزات ومعدات التسجيل #{order.id}"
                        )
                        order.invoice = invoice
                        order.save(update_fields=["invoice"])

                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning("Failed to create initial store products order: %s", e)

            return student


class StudentNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = StudentNote
        fields = ["id", "student_id", "author_id", "author_name", "note_type", "content", "is_private", "created_at"]
        read_only_fields = ["id", "author_id", "created_at"]

    def get_author_name(self, obj):
        if not obj.author_id:
            return None
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.only("first_name", "last_name").get(id=obj.author_id)
            return user.get_full_name() or str(obj.author_id)
        except User.DoesNotExist:
            return str(obj.author_id)


class StudentDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentDocument
        fields = [
            "id", "student_id", "document_type", "name", "file",
            "uploaded_by_id", "notes", "expires_at", "created_at",
        ]
        read_only_fields = ["id", "uploaded_by_id", "created_at"]
