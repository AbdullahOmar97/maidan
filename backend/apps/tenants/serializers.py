"""MAIDAN — Tenants App Serializers"""
from django.db import transaction
from django.conf import settings
from rest_framework import serializers
from .models import Tenant, Domain, Plan, PlatformSettings, SubscriptionChangeRequest
from apps.accounts.models import User
from apps.accounts.tasks import send_tenant_welcome_task

class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

class DomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Domain
        fields = ["id", "domain", "is_primary"]

class TenantSerializer(serializers.ModelSerializer):
    domains = DomainSerializer(many=True, read_only=True)
    domain_input = serializers.CharField(write_only=True, required=False)
    
    active_students_count = serializers.SerializerMethodField()
    active_locations_count = serializers.SerializerMethodField()
    active_staff_count = serializers.SerializerMethodField()
    trial_days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = [
            "id", "name", "business_name", "slug", "schema_name", "email", "phone", 
            "is_active", "status", "plan", "subscription_end_date", "on_trial", "trial_ends_at", "trial_days_remaining",
            "logo", "stamp", "signature", "default_language",
            "default_currency", "timezone", "country", "created_at",
            "domains", "domain_input",
            "active_students_count", "active_locations_count", "active_staff_count"
        ]
        read_only_fields = ["id", "slug", "schema_name", "created_at"]

    def get_trial_days_remaining(self, obj):
        end_date = obj.subscription_end_date or obj.trial_ends_at
        if obj.status == Tenant.SubscriptionStatus.TRIAL and end_date:
            from django.utils import timezone
            delta = end_date - timezone.now()
            return max(0, delta.days)
        return None

    def get_active_students_count(self, obj):
        from django_tenants.utils import schema_context
        from apps.students.models import Student
        try:
            with schema_context(obj.schema_name):
                return Student.objects.filter(status="active", deleted_at__isnull=True).count()
        except Exception:
            return 0

    def get_active_locations_count(self, obj):
        from django_tenants.utils import schema_context
        from apps.students.models import Location
        try:
            with schema_context(obj.schema_name):
                return Location.objects.filter(is_active=True).count()
        except Exception:
            return 0

    def get_active_staff_count(self, obj):
        from django_tenants.utils import schema_context
        from apps.staff.models import StaffMember
        try:
            with schema_context(obj.schema_name):
                return StaffMember.objects.filter(user__is_active=True).count()
        except Exception:
            return 0


    def to_representation(self, instance):
        data = super().to_representation(instance)
        try:
            platform_settings = PlatformSettings.objects.first()
            if platform_settings:
                request = self.context.get("request")
                
                if not data.get("logo") and platform_settings.logo:
                    if request:
                        data["logo"] = request.build_absolute_uri(platform_settings.logo.url)
                    else:
                        data["logo"] = platform_settings.logo.url
                        
                if platform_settings.favicon:
                    if request:
                        data["favicon"] = request.build_absolute_uri(platform_settings.favicon.url)
                    else:
                        data["favicon"] = platform_settings.favicon.url
        except Exception:
            pass
        return data

    def update(self, instance, validated_data):
        for field in ["stamp", "signature"]:
            img_file = validated_data.get(field)
            if img_file and hasattr(img_file, "file"):
                processed = self._ensure_transparent_background(img_file)
                if processed:
                    validated_data[field] = processed
        return super().update(instance, validated_data)

    def _ensure_transparent_background(self, uploaded_file):
        try:
            from PIL import Image
            import io
            from django.core.files.uploadedfile import InMemoryUploadedFile

            image = Image.open(uploaded_file).convert("RGBA")
            width, height = image.size
            total_pixels = width * height
            raw_data = list(image.getdata())

            # Check if image already has transparent areas (> 1.5% pixels transparent)
            transparent_count = sum(1 for item in raw_data if item[3] < 128)
            if transparent_count > total_pixels * 0.015:
                output = io.BytesIO()
                image.save(output, format="PNG")
                output.seek(0)
                name = getattr(uploaded_file, "name", "image.png")
                if not name.lower().endswith(".png"):
                    name = name.rsplit(".", 1)[0] + ".png"
                return InMemoryUploadedFile(
                    output, "ImageField", name, "image/png", output.getbuffer().nbytes, None
                )

            # Build luminance histogram via grayscale conversion
            gray = image.convert("L")
            hist = gray.histogram()
            sum_total_lum = sum(i * count for i, count in enumerate(hist))

            # Otsu thresholding
            sum_b = 0
            w_b = 0
            max_variance = 0
            otsu_t = 128

            for t in range(256):
                w_b += hist[t]
                if w_b == 0:
                    continue
                w_f = total_pixels - w_b
                if w_f == 0:
                    break
                sum_b += t * hist[t]
                m_b = sum_b / w_b
                m_f = (sum_total_lum - sum_b) / w_f
                variance = w_b * w_f * ((m_b - m_f) ** 2)
                if variance > max_variance:
                    max_variance = variance
                    otsu_t = t

            # Compute median paper luminance & ink luminance
            fg_count = sum(hist[:otsu_t])
            bg_count = sum(hist[otsu_t:])

            ink_lum = 35
            acc_fg = 0
            for t in range(otsu_t):
                acc_fg += hist[t]
                if acc_fg >= fg_count // 2:
                    ink_lum = t
                    break

            paper_lum = 220
            acc_bg = 0
            for t in range(otsu_t, 256):
                acc_bg += hist[t]
                if acc_bg >= bg_count // 2:
                    paper_lum = t
                    break

            # Estimate background paper color
            bg_r_sum = bg_g_sum = bg_b_sum = bg_samples = 0
            for r, g, b, a in raw_data:
                lum = 0.299 * r + 0.587 * g + 0.114 * b
                if abs(lum - paper_lum) < 15:
                    bg_r_sum += r
                    bg_g_sum += g
                    bg_b_sum += b
                    bg_samples += 1

            bg_r = bg_r_sum / bg_samples if bg_samples else 255
            bg_g = bg_g_sum / bg_samples if bg_samples else 255
            bg_b = bg_b_sum / bg_samples if bg_samples else 255

            t_high = max(paper_lum - 8, otsu_t + int((paper_lum - otsu_t) * 0.45))
            t_low = min(ink_lum + 12, otsu_t - int((otsu_t - ink_lum) * 0.35))

            new_data = []
            for r, g, b, a in raw_data:
                lum = 0.299 * r + 0.587 * g + 0.114 * b
                dr = r - bg_r
                dg = g - bg_g
                db = b - bg_b
                color_dist = (dr * dr + dg * dg + db * db) ** 0.5
                max_chroma = max(abs(dr), abs(dg), abs(db))

                is_colored_ink = color_dist > 38 and max_chroma > 25
                is_paper_bg = (
                    (lum >= t_high and not is_colored_ink)
                    or (color_dist < 25 and lum > otsu_t - 15)
                    or (lum > 225 and r > 220 and g > 220 and b > 220)
                )

                if is_paper_bg:
                    new_data.append((255, 255, 255, 0))
                elif lum <= t_low or is_colored_ink:
                    if not is_colored_ink and max_chroma < 30:
                        scale = min(1.0, lum / max(paper_lum, 1))
                        new_data.append((int(r * scale), int(g * scale), int(b * scale), a))
                    else:
                        new_data.append((r, g, b, a))
                else:
                    factor = (t_high - lum) / max(1, t_high - t_low)
                    clamped = max(0.0, min(1.0, factor))
                    smooth_factor = clamped * clamped * (3.0 - 2.0 * clamped)
                    new_alpha = int(round(a * smooth_factor))

                    if new_alpha > 0 and not is_colored_ink and max_chroma < 30:
                        scale = min(1.0, lum / max(paper_lum, 1))
                        new_data.append((int(r * scale), int(g * scale), int(b * scale), new_alpha))
                    else:
                        new_data.append((r, g, b, new_alpha))

            image.putdata(new_data)
            output = io.BytesIO()
            image.save(output, format="PNG")
            output.seek(0)

            name = getattr(uploaded_file, "name", "image.png")
            if not name.lower().endswith(".png"):
                name = name.rsplit(".", 1)[0] + ".png"

            return InMemoryUploadedFile(
                output,
                "ImageField",
                name,
                "image/png",
                output.getbuffer().nbytes,
                None,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Failed to auto-process transparent background: %s", e)
            return uploaded_file

    def create(self, validated_data):
        domain_input = validated_data.pop("domain_input", None)
        with transaction.atomic():
            tenant = Tenant.objects.create(**validated_data)
            if domain_input:
                Domain.objects.create(
                    domain=domain_input,
                    tenant=tenant,
                    is_primary=True
                )
            return tenant

class TenantRegistrationSerializer(serializers.Serializer):
    # User info
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    
    # Tenant info
    academy_name = serializers.CharField(max_length=200)
    slug = serializers.SlugField()
    plan_id = serializers.IntegerField()

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("User with this email already exists.")
        return value.lower().strip()

    def validate_slug(self, value):
        value = value.lower().strip()
        if Tenant.objects.filter(slug=value).exists():
            raise serializers.ValidationError("This academy slug is already taken.")
        # Avoid reserved words
        reserved = ["admin", "public", "api", "www", "mail", "static", "media"]
        if value in reserved:
            raise serializers.ValidationError("This slug is reserved.")
        return value

    def create(self, validated_data):
        email = validated_data["email"]
        password = validated_data["password"]
        first_name = validated_data["first_name"]
        last_name = validated_data["last_name"]
        academy_name = validated_data["academy_name"]
        slug = validated_data["slug"]
        plan_id = validated_data["plan_id"]

        with transaction.atomic():
            # 1. Create User
            user = User.objects.create_user(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role="tenant_owner"
            )

            # 2. Create Tenant
            schema_name = slug.replace("-", "_")
            tenant = Tenant.objects.create(
                name=academy_name,
                business_name=academy_name,
                slug=slug,
                schema_name=schema_name,
                email=email,
                plan_id=plan_id,
                is_active=False,
                status=Tenant.SubscriptionStatus.PENDING,
                on_trial=False
            )

            # 3. Create Domain
            platform_domain = getattr(settings, "PLATFORM_DOMAIN", "localhost")
            domain_name = f"{slug}.{platform_domain}"
            Domain.objects.create(
                domain=domain_name,
                tenant=tenant,
                is_primary=True
            )

        # 4. Queue welcome email (outside atomic block — DB must be committed first)
        scheme = "http" if platform_domain == "localhost" else "https"
        login_url = f"{scheme}://{domain_name}/login"
        send_tenant_welcome_task.delay(
            user_email=email,
            user_name=f"{first_name} {last_name}".strip(),
            tenant_name=academy_name,
            login_url=login_url,
        )

        return tenant


class SubscriptionChangeRequestSerializer(serializers.ModelSerializer):
    tenant_name = serializers.ReadOnlyField(source="tenant.name")
    old_plan_name = serializers.ReadOnlyField(source="old_plan.name")
    new_plan_name = serializers.ReadOnlyField(source="new_plan.name")
    requested_by_email = serializers.ReadOnlyField(source="requested_by.email")
    calculated_price = serializers.ReadOnlyField()

    class Meta:
        model = SubscriptionChangeRequest
        fields = [
            "id", "tenant", "tenant_name", "old_plan", "old_plan_name", 
            "new_plan", "new_plan_name", "status", "billing_cycle", 
            "calculated_price", "reason", "admin_notes", "requested_by", 
            "requested_by_email", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "tenant", "old_plan", "status", "calculated_price", "admin_notes", "requested_by", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        if request and request.user:
            # Check if there is already a pending request for this tenant
            tenant = getattr(request, "tenant", None)
            if tenant:
                exists = SubscriptionChangeRequest.objects.filter(
                    tenant=tenant,
                    status=SubscriptionChangeRequest.Status.PENDING
                ).exists()
                if exists:
                    raise serializers.ValidationError(
                        {"non_field_errors": "لديك طلب تغيير باقة معلق بالفعل. يرجى الانتظار لحين مراجعته."}
                    )
        return attrs

