"use client";

import React, { useState, useEffect } from "react";
import { 
  Loader2, AlertCircle, Sparkles, MapPin, 
  Phone, Mail, User, Info, CheckCircle2 
} from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import type { Location } from "@/types";

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddStudentModal({ isOpen, onClose, onSuccess }: AddStudentModalProps) {
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    gender: "male" as const,
    status: "active" as const,
    location_id: "" as any,
  });

  useEffect(() => {
    if (isOpen) {
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
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.location_id) {
      setError("يرجى اختيار الفرع");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await api.students.create(formData);
      onSuccess();
      onClose();
    } catch (err: any) {
      let message = "حدث خطأ أثناء إضافة الطالب. يرجى التحقق من البيانات.";
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === "object") {
          const errors = Object.entries(data)
            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`)
            .join("\n");
          if (errors) message = `خطأ في البيانات:\n${errors}`;
        } else if (data.message) {
          message = data.message;
        } else if (data.detail) {
          message = data.detail;
        }
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === "location_id" ? parseInt(value) : value 
    }));
  };

  return (
    <Modal open={isOpen} onClose={onClose} size="md">
      <ModalHeader
        title="إضافة طالب جديد"
        subtitle="أدخل البيانات الأساسية لتعريف الطالب في النظام"
        icon={<Sparkles className="w-5 h-5" />}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <ModalBody className="space-y-4">
          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="whitespace-pre-wrap">{error}</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="الاسم الأول" required>
              <Input
                required
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder="عبدالله"
                dir="rtl"
              />
            </FormField>

            <FormField label="الاسم الأخير" required>
              <Input
                required
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder="عمر"
                dir="rtl"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="رقم الهاتف" required>
              <Input
                required
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="05x xxx xxxx"
                dir="ltr"
              />
            </FormField>

            <FormField label="البريد الإلكتروني">
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="student@example.com"
                dir="ltr"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="الجنس" required>
              <Select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
              >
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </Select>
            </FormField>

            <FormField label="الحالة الأولية" required>
              <Select
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="active">نشط (مشترك)</option>
                <option value="trial">تجريبي (فترة تجربة)</option>
                <option value="lead">عميل محتمل</option>
              </Select>
            </FormField>
          </div>

          <FormField label="الفرع / النادي" required>
            {locationsLoading ? (
              <div className="w-full h-11 bg-white/5 animate-pulse rounded-xl" />
            ) : (
              <Select
                required
                name="location_id"
                value={formData.location_id}
                onChange={handleChange}
              >
                <option value="" disabled>اختر الفرع...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </ModalBody>

        <ModalFooter>
          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || locationsLoading}
              className="flex-1 py-3 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              حفظ البيانات
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
