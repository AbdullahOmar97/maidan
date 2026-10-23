"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Loader2, AlertCircle, Sparkles, MapPin,
  Phone, Mail, User, Info, CheckCircle2,
  Camera, X
} from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, ErrorBanner } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import type { Location } from "@/types";
import { parseApiError } from "@/lib/utils";


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
  const topRef = useRef<HTMLDivElement>(null);

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    gender: "male" as const,
    status: "active" as const,
    location_id: "" as any,
  });

  useEffect(() => {
    if (isOpen) {
      setPhoto(null);
      setPhotoPreview(null);
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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("حجم الصورة يجب ألا يتجاوز 5 ميجابايت");
        return;
      }
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.location_id) {
      setError("يرجى اختيار الفرع");
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      if (photo) {
        const data = new FormData();
        Object.entries(formData).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            data.append(k, String(v));
          }
        });
        data.append("photo", photo);
        await api.students.create(data);
      } else {
        await api.students.create(formData);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(parseApiError(err, "حدث خطأ أثناء إضافة الطالب. يرجى التحقق من البيانات."));
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
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
          <div ref={topRef} />
          <ErrorBanner message={error} />

          {/* Photo Picker */}
          <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="relative group">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                {photoPreview ? (
                  <img src={photoPreview} alt="معاينة الصورة" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-muted-foreground/60" />
                )}
              </div>
              {photoPreview && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white mb-1">صورة الطالب (اختياري)</p>
              <p className="text-[10px] text-muted-foreground mb-2">PNG أو JPG، بحد أقصى 5 ميجابايت</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-bold transition-all"
              >
                {photoPreview ? "تغيير الصورة" : "اختر صورة"}
              </button>
            </div>
          </div>

          <FormField label="اسم الطالب (الاسم الكامل)" required>
            <Input
              required
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              placeholder="مثال: عبدالله عمر سالم"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="رقم الهاتف" required>
              <Input
                required
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="05x xxx xxxx"

              />
            </FormField>

            <FormField label="البريد الإلكتروني">
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="student@example.com"

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
