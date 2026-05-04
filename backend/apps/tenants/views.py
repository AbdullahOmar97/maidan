"""MAIDAN — Tenants App Views"""
from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from shared.permissions import IsPlatformAdmin, IsStaff
from .models import Tenant, Plan
from .serializers import (
    PlanSerializer, 
    TenantSerializer, 
    TenantRegistrationSerializer
)


class PlanViewSet(viewsets.ModelViewSet):
    queryset = Plan.objects.all()
    serializer_class = PlanSerializer
    def get_permissions(self):
        if self.action == "list":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsPlatformAdmin()]


class TenantViewSet(viewsets.ModelViewSet):
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    
    def get_permissions(self):
        if self.action == "register":
            return [permissions.AllowAny()]
        if self.action == "me":
            from shared.permissions import IsTenantOwnerOrManager
            if self.request.method in permissions.SAFE_METHODS:
                return [permissions.IsAuthenticated(), IsStaff()]
            return [permissions.IsAuthenticated(), IsTenantOwnerOrManager()]
        return [permissions.IsAuthenticated(), IsPlatformAdmin()]

    @action(detail=False, methods=["get", "patch"])
    def me(self, request):
        """Get or update current tenant settings."""
        tenant = request.tenant
        if request.method == "PATCH":
            serializer = TenantSerializer(tenant, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        
        serializer = TenantSerializer(tenant)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], permission_classes=[permissions.AllowAny])
    def register(self, request):
        serializer = TenantRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tenant = serializer.save()
        return Response(
            TenantSerializer(tenant).data,
            status=status.HTTP_201_CREATED
        )
