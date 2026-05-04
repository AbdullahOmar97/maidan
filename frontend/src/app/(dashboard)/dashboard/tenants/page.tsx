"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { 
  Shield, 
  Search, 
  Plus, 
  Building2, 
  Globe, 
  Mail, 
  Phone, 
  Calendar,
  CheckCircle2,
  XCircle,
  MoreVertical,
  ExternalLink,
  Loader2,
  Inbox
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

function TenantCard({ tenant }: { tenant: any }) {
  const primaryDomain = tenant.domains?.find((d: any) => d.is_primary)?.domain || `${tenant.slug}.${window.location.hostname}`;
  
  return (
    <div className="glass-card group p-6 hover:border-primary/40 transition-all duration-500 relative overflow-hidden">
      <div className="absolute -right-12 -top-12 w-40 h-40 bg-primary/5 blur-[60px] rounded-full group-hover:bg-primary/10 transition-colors pointer-events-none" />
      
      <div className="flex items-start justify-between mb-6 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center shadow-xl shadow-primary/20 group-hover:rotate-3 transition-transform">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white group-hover:text-primary transition-colors tracking-tight">
              {tenant.name}
            </h3>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mt-1">
              {tenant.schema_name}
            </p>
          </div>
        </div>
        
        <div className={cn(
          "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shrink-0",
          tenant.is_active 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
            : "bg-destructive/10 border-destructive/20 text-destructive"
        )}>
          {tenant.is_active ? "نشط" : "غير نشط"}
        </div>
      </div>

      <div className="space-y-3 relative z-10">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Globe className="w-4 h-4 text-primary/70" />
          <span className="font-mono text-xs">{primaryDomain}</span>
          <a href={`http://${primaryDomain}`} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Mail className="w-4 h-4 text-primary/70" />
          <span>{tenant.email}</span>
        </div>

        {tenant.phone && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Phone className="w-4 h-4 text-primary/70" />
            <span>{tenant.phone}</span>
          </div>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
          <Calendar className="w-3 h-3" />
          <span>مسجل منذ: {new Date(tenant.created_at).toLocaleDateString("ar-SA")}</span>
        </div>
        
        <Link 
          href={`/dashboard/tenants/${tenant.id}`}
          className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-inner"
        >
          <MoreVertical className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

export default function TenantsPage() {
  const [search, setSearch] = useState("");

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => api.platform.tenants.list().then(r => r.data),
  });

  const filteredTenants = tenants?.filter((t: any) => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.slug.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-10 pb-20 page-enter">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white flex items-center gap-4">
            <div className="w-14 h-14 rounded-[1.5rem] gradient-brand flex items-center justify-center shadow-2xl shadow-primary/40 rotate-3">
              <Shield className="w-7 h-7 text-white" />
            </div>
            الأكاديميات المسجلة
          </h1>
          <p className="text-muted-foreground text-sm font-bold mt-3 max-w-xl leading-relaxed">
            إدارة جميع الأكاديميات (Tenants) على المنصة، متابعة الحالات، وإضافة أكاديميات جديدة يدوياً.
          </p>
        </div>
        <Link
          href="/dashboard/tenants/create"
          className="flex items-center justify-center gap-3 px-8 py-4 rounded-[2rem] gradient-brand text-white text-sm font-black shadow-2xl shadow-primary/40 hover:scale-[1.05] active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
          إضافة أكاديمية جديدة
        </Link>
      </div>

      {/* Filters */}
      <div className="relative group max-w-2xl">
        <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-all" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم الأكاديمية، الرابط، أو البريد الإلكتروني..."
          className="w-full pr-14 pl-8 py-5 rounded-3xl bg-white/[0.03] border border-white/5 focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold shadow-inner"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground font-bold italic">جاري تحميل الأكاديميات...</p>
        </div>
      ) : filteredTenants?.length === 0 ? (
        <div className="glass-card py-32 flex flex-col items-center justify-center text-center border-dashed border-white/10 bg-transparent">
          <div className="w-24 h-24 rounded-[2rem] bg-white/5 flex items-center justify-center mb-6">
            <Inbox className="w-10 h-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-xl font-black text-white">لا توجد أكاديميات</h3>
          <p className="text-sm text-muted-foreground mt-2">لم نتمكن من العثور على أي أكاديمية تطابق بحثك.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredTenants?.map((tenant: any) => (
            <TenantCard key={tenant.id} tenant={tenant} />
          ))}
        </div>
      )}
    </div>
  );
}
