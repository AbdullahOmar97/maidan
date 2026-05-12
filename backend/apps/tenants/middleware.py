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
        host = request.get_host()
        print(f"DEBUG: django-tenants is seeing host: '{host}'")
        
        if request.path.startswith('/admin/'):
            return self.get_response(request)
            
        tenant = getattr(request, "tenant", None)
        
        # Fallback for development: if in public schema, try to resolve by subdomain
        if not tenant or tenant.schema_name == get_public_schema_name():
            host = request.headers.get("X-Forwarded-Host", request.get_host()).split(":")[0]
            if "." in host:
                subdomain = host.split(".")[0]
                try:
                    tenant = Tenant.objects.get(slug__iexact=subdomain)
                    request.tenant = tenant
                    # Ensure the correct URL configuration is used for the resolved tenant
                    request.urlconf = settings.ROOT_URLCONF
                except Tenant.DoesNotExist:
                    pass

        # Only check if we are in a tenant schema (or resolved one)
        if tenant and tenant.schema_name != get_public_schema_name():
            
            # Check if tenant is active
            if not tenant.is_active or tenant.status != Tenant.SubscriptionStatus.ACTIVE:
                message = "هذا النادي غير نشط حالياً. يرجى التواصل مع الإدارة."
                if tenant.status == Tenant.SubscriptionStatus.PENDING:
                    message = "حسابك قيد المراجعة حالياً. سيتم تفعيله قريباً."
                elif tenant.status == Tenant.SubscriptionStatus.EXPIRED:
                    message = "لقد انتهى اشتراكك. يرجى التجديد للمتابعة."
                elif tenant.status == Tenant.SubscriptionStatus.INACTIVE:
                    message = "هذا النادي معطل حالياً. يرجى مراجعة الإدارة."
                
                return JsonResponse({
                    "error": {
                        "code": "tenant_inactive",
                        "message": message,
                        "status": tenant.status
                    }
                }, status=status.HTTP_403_FORBIDDEN)

            # Check for expiration (both trial and subscription)
            now = timezone.now()
            
            # 1. Check subscription end date
            is_expired = False
            if tenant.subscription_end_date and tenant.subscription_end_date < now:
                is_expired = True
            
            # 2. Check trial end date if on trial
            if tenant.on_trial and tenant.trial_ends_at and tenant.trial_ends_at < now:
                is_expired = True

            if is_expired:
                # Auto-update status to expired if it wasn't already
                if tenant.status != Tenant.SubscriptionStatus.EXPIRED:
                    tenant.status = Tenant.SubscriptionStatus.EXPIRED
                    tenant.is_active = False
                    tenant.save(update_fields=["status", "is_active"])

                return JsonResponse({
                    "error": {
                        "code": "subscription_expired",
                        "message": "لقد انتهى اشتراكك أو الفترة التجريبية. يرجى التجديد للمتابعة.",
                        "status": "expired"
                    }
                }, status=status.HTTP_403_FORBIDDEN)

        return self.get_response(request)
