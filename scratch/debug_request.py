import os
import django
from django.conf import settings
from django.test import RequestFactory
from django_tenants.middleware.main import TenantMainMiddleware

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")
django.setup()

def debug_request(hostname):
    rf = RequestFactory()
    # Simulate a request through Nginx (with X-Forwarded headers)
    request = rf.get('/api/v1/academy/me/', HTTP_HOST=hostname, HTTP_X_FORWARDED_HOST=hostname, HTTP_X_FORWARDED_PROTO='https')
    
    middleware = TenantMainMiddleware(lambda r: r)
    middleware.process_request(request)
    
    print(f"--- Debugging Host: {hostname} ---")
    print(f"Request Host: {request.get_host()}")
    print(f"Tenant identified: {getattr(request, 'tenant', 'NONE')}")
    if hasattr(request, 'tenant'):
        print(f"Schema: {request.tenant.schema_name}")
    print(f"URLConf used: {getattr(request, 'urlconf', 'DEFAULT')}")
    
    # Try to resolve URL with the identified tenant
    from django.urls import resolve, set_urlconf
    if hasattr(request, 'urlconf'):
        set_urlconf(request.urlconf)
    try:
        match = resolve('/api/v1/academy/me/')
        print(f"Resolution success: {match.view_name}")
    except Exception as e:
        print(f"Resolution failed: {e}")

if __name__ == "__main__":
    debug_request('nukhbah.maidanjo.duckdns.org')
    print("\n")
    debug_request('maidanjo.duckdns.org')
