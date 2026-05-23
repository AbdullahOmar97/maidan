"use client";
import { Select } from "@/components/ui/select";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { ArrowRight, UserPlus, Loader2, AlertCircle, Sparkles, MapPin, Phone, Mail, User, Info, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Location } from "@/types";
import { cn, parseApiError } from "@/lib/utils";
import { InputWrapper } from "@/components/form-elements";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/dashboard/permission-guard";

export default function NewStudentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    gender: "male",
    status: "active",
    location_id: "" as any,
  });

  useEffect(() => {
    api.locations.list()
      .then((res: any) => {
        const locationData = res.data.results || res.data;
        setLocations(Array.isArray(locationData) ? locationData : []);
        if (Array.isArray(locationData) && locationData.length > 0) {
          setFormData(prev => ({ ...prev, location_id: locationData[0].id }));
        }
      })
      .catch((err) => {
        console.error("Failed to fetch locations", err);
        setError("فشل تحميل قائمة الفروع. يرجى التأكد من وجود فرع واحد على الأقل.");
      })
      .finally(() => {
        setLocationsLoading(false);
      });
  }, []);

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.students.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("تم إضافة الطالب بنجاح");
      router.push("/dashboard/students");
    },
    onError: (err: any) => {
      const message = parseApiError(err, "حدث خطأ أثناء إضافة الطالب. يرجى التحقق من البيانات.");
      setError(message);
      toast.error("فشل إضافة الطالب");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.location_id) {
      setError("يرجى اختيار الفرع");
      return;
    }

    setError("");
    createMutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "location_id" ? parseInt(value) : value
    }));
  };

  if (locationsLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <Loader2 className="w-6 h-6 text-primary absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>
    );
  }


  return (
    <PermissionGuard permission="can_manage_students">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-0 space-y-6 md:space-y-8 pb-60">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Link
              href="/dashboard/students"
              className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all active:scale-90"
            >
              <ArrowRight className="w-6 h-6 rtl-flip" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">إضافة طالب جديد</h1>
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20">خطوة 1/1</span>
              </div>
              <p className="text-muted-foreground text-sm font-bold mt-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                أدخل البيانات الأساسية لتعريف الطالب في النظام
              </p>
            </div>
          </div>
        </div>

        {/* Main Form Content */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="p-6 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div className="whitespace-pre-wrap">{error}</div>
            </div>
          )}

          <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 md:gap-8">
            {/* Section 1: Basic Info */}
            <div className="lg:col-span-2 space-y-8">
              <div className="glass-card p-5 md:p-8 space-y-6 md:space-y-8 relative">
                <div className="absolute top-0 end-0 w-32 h-32 bg-primary/5 blur-3xl -me-16 -mt-16 pointer-events-none" />

                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
                    <User className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-black text-white">البيانات الشخصية</h3>
                </div>


                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <InputWrapper label="الاسم الأول" icon={Info}>
                    <input
                      required
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      placeholder="مثال: عبدالله"
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30 text-end"

                    />
                  </InputWrapper>

                  <InputWrapper label="الاسم الأخير" icon={Info}>
                    <input
                      required
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      placeholder="مثال: عمر"
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30 text-end"

                    />
                  </InputWrapper>
                </div>
              </div>

              {/* Section 2: Contact Info */}
              <div className="glass-card p-5 md:p-8 space-y-6 md:space-y-8 relative">
                <div className="absolute top-0 end-0 w-32 h-32 bg-blue-500/5 blur-3xl -me-16 -mt-16 pointer-events-none" />

                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/10">
                    <Phone className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-black text-white">معلومات التواصل</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <InputWrapper label="رقم الهاتف" icon={Phone}>
                    <input
                      required
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+966 5x xxx xxxx"
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30"

                    />
                  </InputWrapper>

                  <InputWrapper label="البريد الإلكتروني" icon={Mail}>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="student@example.com"
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30"

                    />
                  </InputWrapper>
                </div>
              </div>
            </div>

            {/* Section 3: System Details (Sidebar) */}
            <div className="space-y-6 md:space-y-8">
              <div className="glass-card p-5 md:p-8 space-y-6 md:space-y-8 relative">
                <div className="absolute top-0 end-0 w-32 h-32 bg-amber-500/5 blur-3xl -me-16 -mt-16 pointer-events-none" />

                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
                    <Info className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-black text-white">تفاصيل النظام</h3>
                </div>

                <div className="space-y-4 md:space-y-6">
                  <InputWrapper label="الفرع / النادي" icon={MapPin}>
                    <Select
                      required
                      name="location_id"
                      value={formData.location_id}
                      onChange={handleChange}
                    >
                      <option value="" disabled>اختر الفرع...</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name_ar || loc.name}
                        </option>
                      ))}
                    </Select>
                  </InputWrapper>

                  <InputWrapper label="الجنس" icon={User}>
                    <Select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                    >
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </Select>
                  </InputWrapper>

                  <InputWrapper label="الحالة الأولية" icon={CheckCircle2}>
                    <Select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                    >
                      <option value="active">نشط (مشترك)</option>
                      <option value="trial">تجريبي (فترة تجربة)</option>
                      <option value="lead">عميل محتمل</option>
                    </Select>
                  </InputWrapper>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full py-5 rounded-[2rem] gradient-brand text-white text-sm font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group disabled:opacity-50"
                >
                  {createMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                    <>
                      <span>حفظ بيانات الطالب</span>
                      <CheckCircle2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    </>
                  )}
                </button>
                <Link
                  href="/dashboard/students"
                  className="w-full py-5 rounded-[2rem] bg-white/5 border border-white/10 text-white text-sm font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center"
                >
                  إلغاء العملية
                </Link>
              </div>
            </div>
          </div>
          <div className="h-40 md:hidden" aria-hidden="true" />
        </form>
      </div>
    </PermissionGuard>
  );
}
