"""MAIDAN — Audit App URLs"""
from django.urls import path
from rest_framework import generics, permissions, serializers
from .models import AuditLog
from shared.permissions import IsTenantOwnerOrManager


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = "__all__"


class AuditLogListView(generics.ListAPIView):
    queryset = AuditLog.objects.all().order_by("-created_at")
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantOwnerOrManager]

    def get_queryset(self):
        qs = super().get_queryset()
        user_id = self.request.query_params.get("user_id")
        action = self.request.query_params.get("action")
        resource = self.request.query_params.get("resource_type")
        if user_id:
            qs = qs.filter(user_id=user_id)
        if action:
            qs = qs.filter(action=action)
        if resource:
            qs = qs.filter(resource_type=resource)
        return qs


urlpatterns = [
    path("", AuditLogListView.as_view(), name="audit-log-list"),
]
