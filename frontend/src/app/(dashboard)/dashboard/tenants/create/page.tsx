"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { 
  Shield, 
  ArrowRight, 
  Building2, 
  Globe, 
  Mail, 
  Phone, 
  Save, 
  Loader2,
  AlertCircle,
  Database
} from "lucide-react";
import { cn, translateErrorMessage } from "@/lib/utils";
import { ErrorAlert } from "@/components/ErrorAlert";
import Link from "next/link";

export default function CreateTenantPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);


  const [formData, setFormData] = useState({
    name: "",
    business_name: "",
    slug: "",
    schema_name: "",
    email: "",
    phone: "",
    domain_input: "",
  });

  // Auto-fill schema name and domain from slug
  useEffect(() => {
    const slug = formData.slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setFormData(prev => ({
      ...prev,
      schema_name: slug.replace(/-/g, "_"),
      domain_input: slug && mounted ? `${slug}.${window.location.hostname}` : slug ? `${slug}.${process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "localhost"}` : "",
    }));
  }, [formData.slug, mounted]);



  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await api.platform.tenants.create(formData);
      router.push("/dashboard/tenants");
      router.refresh();
    } catch (err: any) {
      const errorData = err.response?.data;
      setError(translateErrorMessage(errorData?.message || errorData?.detail || "حدث خطأ أثناء إضافة الأكاديمية."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 page-enter">
      {/* Header */}
      <div className="mb-12">
        <Link 
          href="/dashboard/tenants"
          className="inline-flex items-center gap-2 text-xs font-black text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest mb-6"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للأكاديميات
        </Link>
        <h1 className="text-4xl font-black tracking-tight text-white flex items-center gap-4">
          <div className="w-14 h-14 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl">
            <Plus className="w-7 h-7 text-primary" />
          </div>
          إضافة أكاديمية جديدة
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Academy Basic Info */}
          <section className="glass-card p-8 space-y-6">
            <h2 className="text-sm font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              بيانات الأكاديمية
            </h2>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">اسم الأكاديمية</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="أكاديمية النخبة"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-primary/50 transition-all font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">الاسم التجاري (اختياري)</label>
              <input
                type="text"
                name="business_name"
                value={formData.business_name}
                onChange={handleChange}
                placeholder="Elite Academy LLC"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-primary/50 transition-all font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">البريد الإلكتروني الأساسي</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="admin@academy.com"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-primary/50 transition-all font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">رقم الهاتف</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+966 50 000 0000"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-primary/50 transition-all font-bold"
              />
            </div>
          </section>

          {/* Technical Info */}
          <section className="glass-card p-8 space-y-6">
            <h2 className="text-sm font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Database className="w-4 h-4" />
              البيانات التقنية
            </h2>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Academy Slug</label>
              <input
                type="text"
                name="slug"
                required
                value={formData.slug}
                onChange={handleChange}
                placeholder="elite-academy"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-primary/50 transition-all font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Schema Name (Generated)</label>
              <input
                type="text"
                name="schema_name"
                readOnly
                value={formData.schema_name}
                className="w-full bg-white/[0.01] border border-white/5 rounded-2xl py-4 px-5 text-muted-foreground outline-none font-mono cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Primary Domain</label>
              <div className="relative">
                <Globe className="absolute end-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  name="domain_input"
                  required
                  value={formData.domain_input}
                  onChange={handleChange}
                  placeholder={`elite.${mounted ? window.location.hostname : (process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "localhost")}`}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pe-12 ps-5 text-white focus:outline-none focus:border-primary/50 transition-all font-mono"
                />


              </div>
            </div>
          </section>
        </div>

        <ErrorAlert 
          error={error} 
          title="خطأ في الإضافة" 
          subtitle="تحقق من البيانات" 
          className="mt-4"
        />

        <div className="flex items-center justify-end gap-4">
          <Link
            href="/dashboard/tenants"
            className="px-8 py-4 rounded-2xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all"
          >
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="px-10 py-4 rounded-2xl gradient-brand text-white font-black shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-3 transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                حفظ الأكاديمية
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );
}
