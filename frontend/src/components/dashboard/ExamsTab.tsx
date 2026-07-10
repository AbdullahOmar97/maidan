"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Award, Calendar, MapPin, Plus, Loader2, BookOpen, ChevronLeft, Trash2 } from "lucide-react";
import type { BeltExam, Location, PaginatedResponse } from "@/types";
import { toast } from "sonner";
import ExamDetailsModal from "./ExamDetailsModal";

export default function ExamsTab() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<BeltExam | null>(null);

  // New Exam Form State
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [sport, setSport] = useState("BJJ");
  const [locationId, setLocationId] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  // Queries
  const { data: examsData, isLoading: examsLoading } = useQuery<PaginatedResponse<BeltExam>>({
    queryKey: ["belts", "exams"],
    queryFn: () => api.belts.exams.list().then((r: any) => r.data),
  });
  const exams = examsData?.results || [];

  const { data: locationsData } = useQuery<PaginatedResponse<Location>>({
    queryKey: ["locations", "list"],
    queryFn: () => api.locations.list().then((r: any) => r.data),
  });
  const locations = locationsData?.results || [];

  // Mutations
  const createExamMutation = useMutation({
    mutationFn: (data: any) => api.belts.exams.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["belts", "exams"] });
      toast.success("تم إنشاء حدث اختبار الترقية بنجاح.");
      setIsCreateOpen(false);
      setName("");
      setDate("");
      setSport("BJJ");
      setLocationId("");
      setNotes("");
    },
    onError: () => toast.error("حدث خطأ أثناء إنشاء الاختبار."),
  });

  const deleteExamMutation = useMutation({
    mutationFn: (id: number) => api.belts.exams.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["belts", "exams"] });
      toast.success("تم حذف اختبار الترقية بنجاح.");
    },
    onError: () => toast.error("حدث خطأ أثناء حذف الاختبار."),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !date || !sport || !locationId) {
      toast.error("يرجى ملء جميع الحقول المطلوبة.");
      return;
    }
    createExamMutation.mutate({
      name,
      date,
      martial_art: sport,
      location: Number(locationId),
      notes,
    });
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg text-white">جدول اختبارات الترقيات</h2>
          <p className="text-xs text-muted-foreground mt-1">جدولة أحداث اختبارات الأحزمة، مراجعة وتجهيز قوائم المرشحين ورصد تقييماتهم.</p>
        </div>
        {!isCreateOpen && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 touch-target"
          >
            <Plus className="w-4 h-4" />
            جدولة اختبار جديد
          </button>
        )}
      </div>

      {/* CREATE EXAM PANEL */}
      {isCreateOpen && (
        <form onSubmit={handleCreate} className="glass-card p-6 border border-white/5 space-y-4 max-w-2xl">
          <h3 className="font-black text-sm text-white mb-2">جدولة اختبار ترقية جديد</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Exam Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">اسم الاختبار *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: اختبار شتاء 2026 للأحزمة"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary focus:outline-none"
              />
            </div>

            {/* Exam Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">تاريخ الاختبار *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary focus:outline-none text-right"
              />
            </div>

            {/* Sport / Martial Art */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">الرياضة / الفن القتالي *</label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary focus:outline-none"
              >
                <option value="BJJ" className="bg-neutral-900 text-white">جوجيتسو (BJJ)</option>
                <option value="Karate" className="bg-neutral-900 text-white">كاراتيه (Karate)</option>
                <option value="Taekwondo" className="bg-neutral-900 text-white">تايكوندو (Taekwondo)</option>
                <option value="Judo" className="bg-neutral-900 text-white">جودو (Judo)</option>
              </select>
            </div>

            {/* Location */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">الفرع / الموقع *</label>
              <select
                value={locationId}
                required
                onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : "")}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary focus:outline-none"
              >
                <option value="" className="bg-neutral-900 text-muted-foreground">اختر فرع الاستضافة...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id} className="bg-neutral-900 text-white">
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">ملاحظات / تعليمات إضافية</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: يرجى ارتداء الزي الرسمي الكامل وحضور أولياء الأمور..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary focus:outline-none resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold touch-target"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={createExamMutation.isPending}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold touch-target flex items-center gap-2"
            >
              {createExamMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              جدولة حدث الاختبار
            </button>
          </div>
        </form>
      )}

      {/* EXAMS LIST */}
      {examsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : exams.length === 0 ? (
        <div className="text-center py-12 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col items-center justify-center text-muted-foreground">
          <Calendar className="w-12 h-12 mb-3 opacity-25" />
          <p>لا توجد اختبارات ترقية مجدولة حالياً.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exams.map((exam) => (
            <div key={exam.id} className="glass-card p-5 border border-white/5 flex flex-col justify-between space-y-4 hover:border-white/10 transition-all">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider">
                    {exam.martial_art}
                  </span>
                  <button
                    onClick={() => {
                      if (confirm("هل أنت متأكد من رغبتك في حذف هذا الاختبار بالكامل؟ سيتم مسح جميع المرشحين المرتبطين به.")) {
                        deleteExamMutation.mutate(exam.id);
                      }
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-white/5 transition-all"
                    title="حذف الاختبار"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-bold text-white text-base leading-tight truncate">{exam.name}</h3>
                {exam.notes && <p className="text-xs text-muted-foreground line-clamp-2">{exam.notes}</p>}
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>{exam.date}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span>{exam.location_name}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-white">
                  المرشحون: <b className="text-primary">{exam.candidates_count}</b>
                </span>
                <button
                  onClick={() => setSelectedExam(exam)}
                  className="inline-flex items-center gap-1 text-xs font-black text-primary hover:text-primary/80 transition-all"
                >
                  إدارة الاختبار والتقييم
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EXAM DETAILS MODAL */}
      {selectedExam && (
        <ExamDetailsModal
          isOpen={selectedExam !== null}
          onClose={() => {
            setSelectedExam(null);
            queryClient.invalidateQueries({ queryKey: ["belts", "exams"] });
          }}
          exam={selectedExam}
        />
      )}
    </div>
  );
}
