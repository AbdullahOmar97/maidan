import os
import django

# Set up Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")
django.setup()

from apps.tenants.models import Tenant, Domain
from django.conf import settings

def fix_tenant_domains():
    platform_domain = getattr(settings, "PLATFORM_DOMAIN", "maidanjo.duckdns.org")
    print(f"Using platform domain: {platform_domain}")
    
    # Get all tenants except the public one
    tenants = Tenant.objects.exclude(schema_name="public")
    
    for tenant in tenants:
        expected_domain = f"{tenant.slug}.{platform_domain}"
        
        # Try to find existing primary domain
        domain_obj = Domain.objects.filter(tenant=tenant, is_primary=True).first()
        
        if domain_obj:
            if domain_obj.domain != expected_domain:
                print(f"Updating domain for {tenant.slug}: {domain_obj.domain} -> {expected_domain}")
                domain_obj.domain = expected_domain
                domain_obj.save()
            else:
                print(f"Tenant {tenant.slug} already has correct domain: {expected_domain}")
        else:
            # Create if missing
            print(f"Creating missing primary domain for {tenant.slug}: {expected_domain}")
            Domain.objects.create(
                tenant=tenant,
                domain=expected_domain,
                is_primary=True
            )

if __name__ == "__main__":
    fix_tenant_domains()
