"""MAIDAN — Tenants App Views"""
from django.db import transaction
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from shared.permissions import IsPlatformAdmin, IsStaff, RoleChoices, IsTenantOwnerOrManager
from .models import Tenant, Plan, SubscriptionChangeRequest
from .serializers import (
    PlanSerializer, 
    TenantSerializer, 
    TenantRegistrationSerializer,
    SubscriptionChangeRequestSerializer
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

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def public_info(self, request):
        """Get public details of the current resolved tenant."""
        tenant_attr = getattr(request, "tenant", None)
        if not tenant_attr or tenant_attr.schema_name == get_public_schema_name():
            return Response(
                {"error": "لم يتم التعرف على النادي."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            with schema_context(get_public_schema_name()):
                tenant = Tenant.objects.get(pk=tenant_attr.pk)
                serializer = TenantSerializer(tenant, context={"request": request})
                # Build custom representation with only public fields
                data = {
                    "name": tenant.name,
                    "business_name": tenant.business_name,
                    "slug": tenant.slug,
                    "status": tenant.status,
                    "on_trial": tenant.on_trial,
                    "trial_ends_at": tenant.trial_ends_at,
                    "trial_days_remaining": serializer.data.get("trial_days_remaining"),
                    "logo": serializer.data.get("logo"),
                    "favicon": serializer.data.get("favicon"),
                }
                return Response(data)
        except Tenant.DoesNotExist:
            return Response(
                {"error": "سجل النادي غير موجود."},
                status=status.HTTP_404_NOT_FOUND
            )

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


class SubscriptionChangeRequestViewSet(viewsets.ModelViewSet):
    queryset = SubscriptionChangeRequest.objects.all()
    serializer_class = SubscriptionChangeRequestSerializer

    def get_permissions(self):
        # Platform level list/approve/reject is restricted to Platform Admins
        if self.action in ["list", "approve", "reject", "retrieve"]:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsTenantOwnerOrManager()]

    def get_queryset(self):
        user = self.request.user
        from shared.permissions import RoleChoices
        if user.role == RoleChoices.PLATFORM_ADMIN:
            return SubscriptionChangeRequest.objects.all()
        # Otherwise, scope to user's tenant only!
        tenant = getattr(self.request, "tenant", None)
        if tenant:
            return SubscriptionChangeRequest.objects.filter(tenant=tenant)
        return SubscriptionChangeRequest.objects.none()

    def perform_create(self, serializer):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            raise serializers.ValidationError({"non_field_errors": "لم يتم التعرف على النادي."})
        
        # Save request with current tenant and user
        serializer.save(
            tenant=tenant,
            old_plan=tenant.plan,
            requested_by=self.request.user,
            status=SubscriptionChangeRequest.Status.PENDING
        )

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsPlatformAdmin])
    def approve(self, request, pk=None):
        sub_request = self.get_object()
        if sub_request.status != SubscriptionChangeRequest.Status.PENDING:
            return Response(
                {"error": "هذا الطلب تم التعامل معه بالفعل ولا يمكن تعديله."},
                status=status.HTTP_400_BAD_REQUEST
            )

        admin_notes = request.data.get("admin_notes", "")
        
        with transaction.atomic():
            sub_request.status = SubscriptionChangeRequest.Status.APPROVED
            sub_request.admin_notes = admin_notes
            sub_request.save()

            # 1. Update the tenant plan
            tenant = sub_request.tenant
            tenant.plan = sub_request.new_plan
            tenant.save()

            # 2. Trigger auto-deactivation logic under tenant schema context
            from django_tenants.utils import schema_context
            from .utils import enforce_plan_downgrade_limits
            
            with schema_context(tenant.schema_name):
                enforce_plan_downgrade_limits(tenant, sub_request.new_plan)

        from apps.audit.utils import log_action
        log_action(
            request.user,
            "approve_subscription_request",
            "subscription_request",
            str(sub_request.id),
            changes={"tenant": tenant.name, "new_plan": sub_request.new_plan.name},
            request=request
        )

        return Response({"message": "تمت الموافقة على طلب تغيير الباقة وتطبيق الحدود الجديدة بنجاح."})

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsPlatformAdmin])
    def reject(self, request, pk=None):
        sub_request = self.get_object()
        if sub_request.status != SubscriptionChangeRequest.Status.PENDING:
            return Response(
                {"error": "هذا الطلب تم التعامل معه بالفعل ولا يمكن تعديله."},
                status=status.HTTP_400_BAD_REQUEST
            )

        admin_notes = request.data.get("admin_notes", "")
        if not admin_notes:
            return Response(
                {"error": "يجب تحديد سبب الرفض في ملاحظات المسؤول."},
                status=status.HTTP_400_BAD_REQUEST
            )

        sub_request.status = SubscriptionChangeRequest.Status.REJECTED
        sub_request.admin_notes = admin_notes
        sub_request.save()

        from apps.audit.utils import log_action
        log_action(
            request.user,
            "reject_subscription_request",
            "subscription_request",
            str(sub_request.id),
            changes={"tenant": sub_request.tenant.name, "new_plan": sub_request.new_plan.name, "notes": admin_notes},
            request=request
        )

        return Response({"message": "تم رفض طلب تغيير الباقة."})

