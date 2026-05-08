"""MAIDAN — Tenants App Views"""
from django.db import transaction
from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from shared.permissions import IsPlatformAdmin, IsStaff, RoleChoices
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

    @action(detail=False, methods=["post"], url_path="transfer-ownership")
    def transfer_ownership(self, request):
        """Transfer ownership of the tenant to another staff member."""
        current_user = request.user
        
        # 1. Only current owner can transfer ownership
        if current_user.role != RoleChoices.TENANT_OWNER:
            return Response(
                {"error": "فقط مالك النادي يمكنه القيام بهذا الإجراء."},
                status=status.HTTP_403_FORBIDDEN
            )

        new_owner_id = request.data.get("user_id")
        if not new_owner_id:
            return Response(
                {"error": "يجب تحديد الموظف الجديد الذي ستنتقل إليه الملكية."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from apps.accounts.models import User
            from apps.staff.models import StaffMember
            
            # 2. Get target user
            new_owner = User.objects.get(id=new_owner_id)
            
            # 3. Ensure target user is a member of this tenant
            if not StaffMember.objects.filter(user=new_owner).exists():
                return Response(
                    {"error": "المستخدم المختار ليس موظفاً في هذا النادي."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 4. Perform transfer in a transaction
            with transaction.atomic():
                # Current owner becomes a manager
                current_user.role = RoleChoices.MANAGER
                current_user.save(update_fields=["role"])
                
                # New user becomes owner
                new_owner.role = RoleChoices.TENANT_OWNER
                new_owner.save(update_fields=["role"])

            from apps.audit.utils import log_action
            log_action(
                current_user, 
                "transfer_ownership", 
                "tenant", 
                str(request.tenant.id),
                changes={"from": str(current_user.id), "to": str(new_owner.id)},
                request=request
            )

            return Response({"message": "تم نقل الملكية بنجاح. سيتم تطبيق التغييرات فوراً."})

        except User.DoesNotExist:
            return Response(
                {"error": "المستخدم المختار غير موجود."},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": f"حدث خطأ أثناء نقل الملكية: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
