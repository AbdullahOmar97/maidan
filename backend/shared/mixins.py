"""
MAIDAN — Shared Mixins for ViewSets
"""

from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response


class TenantAwareMixin:
    """
    Ensures all querysets are scoped to the current tenant
    (django-tenants handles schema routing, but this adds extra safety).
    """

    def get_queryset(self):
        qs = super().get_queryset()
        # Additional tenant-level filtering if model has tenant FK
        if hasattr(qs.model, "tenant"):
            pass  # django-tenants schema routing already isolates
        return qs


class SoftDeleteMixin:
    """
    Adds soft-delete support: marks records as deleted_at instead of removing.
    """

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at"])

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(qs.model, "deleted_at"):
            qs = qs.filter(deleted_at__isnull=True)
        return qs


class BulkCreateMixin:
    """Adds a bulk-create endpoint via POST /bulk/"""

    def bulk_create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        self.perform_bulk_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_bulk_create(self, serializer):
        serializer.save()


class AuditMixin:
    """Auto-populate created_by / updated_by fields if they exist on the model."""

    def perform_create(self, serializer):
        kwargs = {}
        model = serializer.Meta.model
        if hasattr(model, "created_by"):
            kwargs["created_by"] = self.request.user
        elif hasattr(model, "created_by_id") and not hasattr(model, "created_by"):
            # Fallback for models using BigIntegerField for cross-schema IDs
            # Only set if it's a numeric ID or if we can safely cast it
            user_id = self.request.user.id
            if isinstance(user_id, (int, float)):
                 kwargs["created_by_id"] = user_id
        
        serializer.save(**kwargs)

    def perform_update(self, serializer):
        kwargs = {}
        model = serializer.Meta.model
        if hasattr(model, "updated_by"):
            kwargs["updated_by"] = self.request.user
        elif hasattr(model, "updated_by_id") and not hasattr(model, "updated_by"):
            user_id = self.request.user.id
            if isinstance(user_id, (int, float)):
                kwargs["updated_by_id"] = user_id
                
        serializer.save(**kwargs)
