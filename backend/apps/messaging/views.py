"""MAIDAN — Messaging App Views"""
from rest_framework import filters, permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from shared.permissions import IsStaff, IsTenantOwnerOrManager
from .models import BroadcastCampaign, MessageTemplate, NotificationLog


class MessageTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageTemplate
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class NotificationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationLog
        fields = "__all__"
        read_only_fields = ["id", "created_at"]


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
    permission_classes = [permissions.IsAuthenticated, IsTenantOwnerOrManager]

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
