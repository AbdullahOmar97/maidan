"""MAIDAN — Messaging App Views"""
from django.db.models import Q
from rest_framework import filters, permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from shared.permissions import CanManageMessaging, IsStaff
from .models import BroadcastCampaign, MessageTemplate, NotificationLog


def _infer_notification_topic(log: NotificationLog) -> str:
    """Infer topic for a NotificationLog from provider_response or Arabic subject/content."""
    if isinstance(log.provider_response, dict):
        explicit = log.provider_response.get("topic")
        if explicit in ("billing", "attendance", "promotions", "security"):
            return explicit

    text = f"{log.subject or ''} {log.content or ''}"
    if any(k in text for k in ("أمان", "كلمة المرور", "صلاحيات", "ملكية", "جلسة")):
        return "security"
    if any(k in text for k in ("حزام", "ترقية", "اختبار")):
        return "promotions"
    if any(k in text for k in ("حضور", "حصة", "دخول", "كشك")):
        return "attendance"
    if any(k in text for k in ("فاتورة", "دفع", "اشتراك", "مستحقات")):
        return "billing"
    return "general"


class MessageTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageTemplate
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class NotificationLogSerializer(serializers.ModelSerializer):
    topic = serializers.SerializerMethodField()
    student_name = serializers.ReadOnlyField(source="student.full_name")

    class Meta:
        model = NotificationLog
        fields = "__all__"
        read_only_fields = ["id", "created_at"]

    def get_topic(self, obj):
        return _infer_notification_topic(obj)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None

        content = ret.get("content", "")
        subject = ret.get("subject", "")
        student = instance.student

        # Check if the notification is a belt promotion notification
        is_promotion = (
            ret.get("topic") == "promotions"
            or "ترقية" in subject
            or "حزام" in subject
            or "ترقيتك" in content
        )

        if is_promotion:
            # Extract belt name if present
            belt_name = ""
            if "إلى حزام " in content:
                belt_name = content.split("إلى حزام ", 1)[-1].rstrip(".").strip()
            elif "حزام " in content:
                belt_name = content.split("حزام ", 1)[-1].rstrip(".").strip()

            user_role = getattr(user, "role", "") if user else ""
            is_staff_viewer = (
                not user
                or getattr(user, "is_staff", False)
                or user_role not in ("student", "parent")
            )

            if is_staff_viewer:
                # Management/staff view: address management about the student
                if "ترقيتك" in content or not content.startswith("تمت ترقية"):
                    if student and student.full_name:
                        ret["content"] = f"تمت ترقية الطالب {student.full_name} بنجاح إلى حزام {belt_name}." if belt_name else f"تمت ترقية الطالب {student.full_name} بنجاح."
                    elif belt_name:
                        ret["content"] = f"تم تسجيل ترقية حزام جديدة إلى حزام {belt_name}."
                    else:
                        ret["content"] = "تم تسجيل ترقية حزام جديدة بنجاح."
            elif user_role == "parent":
                # Parent view: address the parent regarding their child
                child_name = student.full_name if student else "ابنكم/ابنتكم"
                ret["content"] = f"تهانينا! تمت ترقية {child_name} إلى حزام {belt_name}." if belt_name else f"تهانينا! تمت ترقية {child_name}."
            elif user_role == "student":
                # Student view: direct address
                ret["content"] = f"تهانينا! تمت ترقيتك إلى حزام {belt_name}." if belt_name else "تهانينا! تمت ترقيتك بنجاح."

        return ret


class BroadcastCampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = BroadcastCampaign
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "sent_count", "failed_count", "actual_recipients"]


class MessageTemplateViewSet(viewsets.ModelViewSet):
    queryset = MessageTemplate.objects.filter(is_active=True).order_by("-created_at", "-id")
    serializer_class = MessageTemplateSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]


class NotificationLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = NotificationLog.objects.select_related("student").order_by("-created_at")
    serializer_class = NotificationLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaff]
    from django_filters.rest_framework import DjangoFilterBackend
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["status", "channel", "student_id"]

    def get_queryset(self):
        qs = super().get_queryset()
        channel = self.request.query_params.get("channel")
        if channel != "in_app":
            return qs

        user = self.request.user
        raw_prefs = getattr(user, "notification_preferences", None) or {}
        in_app_prefs = raw_prefs.get("in_app", raw_prefs) if isinstance(raw_prefs, dict) else {}

        master_enabled = bool(in_app_prefs.get("enabled", True))
        allow_billing = master_enabled and bool(in_app_prefs.get("billing", True))
        allow_attendance = master_enabled and bool(in_app_prefs.get("attendance", True))
        allow_promotions = master_enabled and bool(in_app_prefs.get("promotions", True))

        # Fast path: all topics enabled
        if master_enabled and allow_billing and allow_attendance and allow_promotions:
            return qs

        # If master is disabled, only security notifications (mandatory) are shown
        if not master_enabled:
            return qs.filter(
                Q(provider_response__topic="security")
                | Q(subject__icontains="أمان")
                | Q(subject__icontains="كلمة المرور")
                | Q(subject__icontains="صلاحيات")
                | Q(subject__icontains="ملكية")
            )

        # Exclude disabled topics
        if not allow_billing:
            qs = qs.exclude(
                Q(provider_response__topic="billing")
                | Q(subject__icontains="فاتورة")
                | Q(subject__icontains="دفع")
                | Q(subject__icontains="اشتراك")
                | Q(content__icontains="مستحقات")
            )
        if not allow_attendance:
            qs = qs.exclude(
                Q(provider_response__topic="attendance")
                | Q(subject__icontains="دخول")
                | Q(subject__icontains="حضور")
                | Q(content__icontains="تسجيل الحضور")
            )
        if not allow_promotions:
            qs = qs.exclude(
                Q(provider_response__topic="promotions")
                | Q(subject__icontains="حزام")
                | Q(subject__icontains="ترقية")
            )

        return qs

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        """Mark a single notification as read."""
        from django.utils import timezone
        notification = self.get_object()
        notification.status = NotificationLog.Status.READ
        notification.read_at = timezone.now()
        notification.save(update_fields=["status", "read_at"])
        return Response({"status": "success"})

    @action(detail=False, methods=["post"])
    def read_all(self, request):
        """Mark all in_app notifications as read."""
        from django.utils import timezone
        self.get_queryset().filter(channel="in_app", status="sent").update(
            status=NotificationLog.Status.READ,
            read_at=timezone.now()
        )
        return Response({"status": "success"})


class BroadcastCampaignViewSet(viewsets.ModelViewSet):
    queryset = BroadcastCampaign.objects.all()
    serializer_class = BroadcastCampaignSerializer
    permission_classes = [permissions.IsAuthenticated, CanManageMessaging]

    def perform_create(self, serializer):
        serializer.save(created_by_id=self.request.user.id)

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        """Trigger broadcast campaign via Celery."""
        from apps.messaging.tasks import send_broadcast_campaign
        from django.db import connection
        campaign = self.get_object()
        schema_name = getattr(connection, "schema_name", "public")
        send_broadcast_campaign.delay(campaign.id, schema_name=schema_name)
        return Response({"message": f"Campaign '{campaign.name}' queued for sending."})
