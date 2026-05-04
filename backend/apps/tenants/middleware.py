from django.http import JsonResponse
from django.utils import timezone
from django.conf import settings
from django_tenants.utils import get_public_schema_name
from rest_framework import status
from .models import Tenant

class TenantStatusMiddleware:
    """
    Middleware to check if the current tenant is active and has a valid subscription.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        tenant = getattr(request, "tenant", None)
        
        # Only check if we are in a tenant schema (not public)
        if tenant and tenant.schema_name != get_public_schema_name():
            
            # Check if tenant is active
            if not tenant.is_active or tenant.status != Tenant.SubscriptionStatus.ACTIVE:
                # Special case: allow platform admins even if tenant is inactive? 
                # Usually better to block all and let admin fix it from public schema.
                
                message = "هذا النادي غير نشط حالياً. يرجى التواصل مع الإدارة."
                if tenant.status == Tenant.SubscriptionStatus.PENDING:
                    message = "حسابك قيد المراجعة حالياً. سيتم تفعيله قريباً."
                elif tenant.status == Tenant.SubscriptionStatus.EXPIRED:
                    message = "لقد انتهى اشتراكك. يرجى التجديد للمتابعة."
                
                return JsonResponse({
                    "error": {
                        "code": "tenant_inactive",
                        "message": message,
                        "status": tenant.status
                    }
                }, status=status.HTTP_403_FORBIDDEN)

            # Check for expiration
            if tenant.subscription_end_date and tenant.subscription_end_date < timezone.now():
                # Auto-update status to expired if it wasn't already
                if tenant.status != Tenant.SubscriptionStatus.EXPIRED:
                    tenant.status = Tenant.SubscriptionStatus.EXPIRED
                    tenant.is_active = False
                    tenant.save()

                return JsonResponse({
                    "error": {
                        "code": "subscription_expired",
                        "message": "لقد انتهى اشتراكك. يرجى التجديد للمتابعة.",
                        "status": "expired"
                    }
                }, status=status.HTTP_403_FORBIDDEN)

        return self.get_response(request)
