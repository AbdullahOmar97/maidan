"""MAIDAN — Tenants App Views"""
from django.db import transaction
from django_tenants.utils import get_public_schema_name, schema_context
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
            from shared.permissions import IsStaff, CanUpdateTenantSettings
            if self.request.method in permissions.SAFE_METHODS:
                return [permissions.IsAuthenticated(), IsStaff()]
            return [permissions.IsAuthenticated(), CanUpdateTenantSettings()]
        return [permissions.IsAuthenticated(), IsPlatformAdmin()]

    @action(detail=False, methods=["get", "patch"])
    def me(self, request):
        """Get or update current tenant settings."""
        # 1. Force resolve the tenant object before switching schema context.
        # This prevents the 'lazy' resolution from hitting the wrong schema
        # (table missing) when we are already inside the with schema_context block.
        tenant_attr = getattr(request, "tenant", None)
        if not tenant_attr:
            return Response(
                {"error": "لم يتم التعرف على النادي."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Accessing .pk forces resolution if it's a SimpleLazyObject
        try:
            tenant_pk = tenant_attr.pk
        except Exception as e:
            import logging
            logger = logging.getLogger("maidan")
            logger.error(f"Failed to resolve tenant PK: {str(e)}")
            return Response(
                {"error": "فشل في التعرف على بيانات النادي."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        ser_ctx = {"request": request}
        try:
            with schema_context(get_public_schema_name()):
                tenant = Tenant.objects.get(pk=tenant_pk)
                
                if request.method == "PATCH":
                    serializer = TenantSerializer(
                        tenant, data=request.data, partial=True, context=ser_ctx
                    )
                    serializer.is_valid(raise_exception=True)
                    serializer.save()
                    # Evaluate .data here while still inside schema_context
                    return Response(serializer.data)

                serializer = TenantSerializer(tenant, context=ser_ctx)
                return Response(serializer.data)
        except Tenant.DoesNotExist:
            return Response(
                {"error": "سجل النادي غير موجود في قاعدة البيانات العامة."},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            import logging
            logger = logging.getLogger("maidan")
            logger.error(f"Error in TenantViewSet.me (schema_context public): {str(e)}", exc_info=True)
            return Response(
                {"error": f"حدث خطأ غير متوقع: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
