"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { ArrowRight, UserCog, Loader2, AlertCircle, Save } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Location, Student } from "@/types";

export default function EditStudentPage() {
  const router = useRouter();
  const { id } = useParams();
  const studentId = Number(id);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
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
    const fetchData = async () => {
      try {
        const [locsRes, studentRes] = await Promise.all([
          api.locations.list(),
          api.students.get(studentId)
        ]);

        const locationData = locsRes.data.results || locsRes.data;
        setLocations(Array.isArray(locationData) ? locationData : []);

        const student: Student = studentRes.data;
        setFormData({
          first_name: student.first_name || "",
          last_name: student.last_name || "",
          phone: student.phone || "",
          email: student.email || "",
          gender: student.gender || "male",
          status: student.status || "active",
          location_id: student.location_id || (locationData[0]?.id ?? ""),
        });
      } catch (err) {
        console.error("Failed to fetch data", err);
        setError("فشل تحميل بيانات الطالب. يرجى المحاولة مرة أخرى.");
      } finally {
        setInitialLoading(false);
      }
    };

    fetchData();
  }, [studentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api.students.update(studentId, formData);
      toast.success("تم تحديث بيانات الطالب بنجاح");
      router.push(`/dashboard/students/${studentId}`);
    } catch (err: any) {
      console.error("Update student error:", err);
      let message = "حدث خطأ أثناء تحديث بيانات الطالب.";
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === "object") {
          message = Object.entries(data)
            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`)
            .join("\n");
        }
      }
      setError(message);
      toast.error("فشل التحديث");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "location_id" ? parseInt(value) : value
    }));
  };

  if (initialLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
        >
          <ArrowRight className="w-5 h-5 rtl-flip" />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="w-6 h-6 text-primary" />
            تعديل بيانات الطالب
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            تحديث المعلومات الأساسية للطالب
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-6">
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="whitespace-pre-wrap">{error}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div className="space-y-2">
            <label className="text-sm font-medium">الاسم الأول</label>
            <input
              required
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg bg-secondary/50 border border-border focus:border-primary/50 focus:outline-none transition-all"
              dir="rtl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">الاسم الأخير</label>
            <input
              required
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg bg-secondary/50 border border-border focus:border-primary/50 focus:outline-none transition-all"
              dir="rtl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">الفرع / الموقع</label>
            <select
              required
              name="location_id"
              value={formData.location_id}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg bg-secondary/50 border border-border focus:border-primary/50 focus:outline-none transition-all"
            >
              <option value="" disabled>اختر الفرع...</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name_ar || loc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">رقم الهاتف</label>
            <input
              required
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg bg-secondary/50 border border-border focus:border-primary/50 focus:outline-none transition-all"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">البريد الإلكتروني</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg bg-secondary/50 border border-border focus:border-primary/50 focus:outline-none transition-all"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">الجنس</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg bg-secondary/50 border border-border focus:border-primary/50 focus:outline-none transition-all"
            >
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">الحالة</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg bg-secondary/50 border border-border focus:border-primary/50 focus:outline-none transition-all"
            >
              <option value="active">نشط</option>
              <option value="trial">تجريبي</option>
              <option value="lead">عميل محتمل</option>
            </select>
          </div>
        </div>

        <div className="pt-6 flex justify-end gap-3 border-t border-border">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 rounded-lg border border-border hover:bg-secondary/50 transition-all font-medium"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-lg gradient-brand text-white font-medium hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            حفظ التعديلات
          </button>
        </div>
      </form>
    </div>
  );
}
