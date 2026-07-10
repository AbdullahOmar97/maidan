"use client";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/dashboard/page-header";
import React, { useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Calendar, Clock, MapPin, Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import type { ClassSession } from "@/types";
import { PermissionGuard } from "@/components/dashboard/permission-guard";

const DAYS_OF_WEEK = [
  { value: 0, label: "الإثنين" },
  { value: 1, label: "الثلاثاء" },
  { value: 2, label: "الأربعاء" },
  { value: 3, label: "الخميس" },
  { value: 4, label: "الجمعة" },
  { value: 5, label: "السبت" },
  { value: 6, label: "الأحد" },
];


export default function SchedulingPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const canManage = user?.role === "platform_admin" || user?.role === "tenant_owner" || user?.permissions?.can_manage_schedules === true;

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"schedules" | "sessions">("sessions");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    class_type_id: "",
    location_id: "",
    instructor_id: "",
    day_of_week: "0",
    start_time: "18:00",
    end_time: "19:00",
    capacity: 20,
  });

  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ["attendance", "schedules"],
    queryFn: () => api.attendance.schedules.list().then((r) => r.data.results || r.data),
    enabled: activeTab === "schedules",
  });

  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery<{ results: ClassSession[] }>({
    queryKey: ["attendance", "sessions", "list"],
    queryFn: () => api.attendance.sessions.list().then((r) => r.data),
    enabled: activeTab === "sessions",
  });

  const { data: classTypes } = useQuery({
    queryKey: ["attendance", "classTypes"],
    queryFn: () => api.attendance.classTypes().then((r) => r.data.results || r.data),
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.locations.list().then((r) => r.data.results || r.data),
  });

  const { data: staff } = useQuery({
    queryKey: ["staff"],
    queryFn: () => api.staff.list({ role: "instructor" }).then((r) => r.data.results || r.data),
  });

  const handleEditClick = (schedule: any) => {
    setEditingScheduleId(schedule.id);
    setFormData({
      class_type_id: schedule.class_type_id.toString(),
      location_id: schedule.location_id.toString(),
      instructor_id: schedule.instructor_id ? schedule.instructor_id.toString() : "",
      day_of_week: schedule.day_of_week.toString(),
      start_time: schedule.start_time.substring(0, 5),
      end_time: schedule.end_time.substring(0, 5),
      capacity: schedule.capacity,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingScheduleId(null);
  };

  const handleDelete = async () => {
    if (editingScheduleId === null) return;
    if (!confirm("هل أنت متأكد من حذف قالب الحصة هذا؟")) return;
    try {
      await api.attendance.schedules.delete(editingScheduleId);
      setIsModalOpen(false);
      setEditingScheduleId(null);
      queryClient.invalidateQueries({ queryKey: ["attendance", "schedules"] });
      queryClient.invalidateQueries({ queryKey: ["attendance", "sessions"] });
    } catch (error) {
      console.error("Error deleting schedule", error);
      alert("حدث خطأ أثناء حذف الحصة");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        class_type_id: parseInt(formData.class_type_id),
        location_id: parseInt(formData.location_id),
        instructor_id: formData.instructor_id || null,
        day_of_week: parseInt(formData.day_of_week),
        capacity: parseInt(formData.capacity.toString()),
      };

      if (editingScheduleId !== null) {
        await api.attendance.schedules.update(editingScheduleId, payload);
      } else {
        await api.attendance.schedules.create(payload);
      }
      setIsModalOpen(false);
      setEditingScheduleId(null);
      setActiveTab("schedules");
      queryClient.invalidateQueries({ queryKey: ["attendance", "schedules"] });
      queryClient.invalidateQueries({ queryKey: ["attendance", "sessions"] });
    } catch (error) {
      console.error("Error saving schedule", error);
      alert(editingScheduleId !== null ? "حدث خطأ أثناء تعديل الحصة" : "حدث خطأ أثناء إضافة الحصة");
    }
  };

  return (
    <PermissionGuard permission="can_manage_schedules">
      <div className="space-y-6 sm:space-y-8 pb-6 page-enter">
        <PageHeader
          title="الجدول الزمني"
          description="تنظيم حصص التدريب، إدارة المواعيد المتكررة، وتخصيص المدربين والفروع لكل جلسة تدريبية."
          icon={Calendar}
        >
          {canManage && (
            <button
              onClick={() => {
                setEditingScheduleId(null);
                setFormData({
                  class_type_id: "",
                  location_id: "",
                  instructor_id: "",
                  day_of_week: "0",
                  start_time: "18:00",
                  end_time: "19:00",
                  capacity: 20,
                });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-3 px-6 py-3 rounded-xl gradient-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.05] transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              إضافة حصة
            </button>
          )}
        </PageHeader>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab("sessions")}
          className={cn("tab-pill", activeTab === "sessions" && "tab-pill-active")}
        >
          الحصص المجدولة
        </button>
        <button
          onClick={() => setActiveTab("schedules")}
          className={cn("tab-pill", activeTab === "schedules" && "tab-pill-active")}
        >
          القوالب الأسبوعية
        </button>
      </div>

      {/* Content */}
      <div className="glass-card p-4 sm:p-6 min-h-[400px]">
        {activeTab === "sessions" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">الحصص القادمة والسابقة</h2>
            </div>

            {sessionsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="shimmer h-28 rounded-xl" />
                ))}
              </div>
            ) : sessions?.results?.length === 0 ? (
              <div className="empty-state">
                <Calendar className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-muted-foreground text-sm">لا توجد حصص مجدولة</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {sessions?.results.map((session) => (
                  <div key={session.id} className="glass-card glass-card-hover p-4 group cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-white group-hover:text-primary transition-colors truncate">{session.class_name}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{session.location_name}</span>
                        </div>
                      </div>
                      <StatusBadge status={session.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-white/[0.06]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(session.date).toLocaleDateString('ar-SA')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span className="font-bold">{session.attendance_count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="section-title mb-4">القوالب الأسبوعية المتكررة</h2>

            {schedulesLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="shimmer h-16 rounded-xl" />
                ))}
              </div>
            ) : schedules?.length === 0 ? (
              <div className="empty-state">
                <Calendar className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-muted-foreground text-sm">لا توجد قوالب أسبوعية</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {schedules?.map((schedule: any) => (
                  <div key={schedule.id} className="glass-card glass-card-hover p-4 flex items-center justify-between group">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-white text-sm group-hover:text-primary transition-colors">{schedule.class_type_name}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1.5">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{schedule.start_time.substring(0,5)} – {schedule.end_time.substring(0,5)}</span>
                        </div>
                        <span>{DAYS_OF_WEEK.find(d => d.value === schedule.day_of_week)?.label ?? `يوم ${schedule.day_of_week}`}</span>
                      </div>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => handleEditClick(schedule)}
                        className="shrink-0 ms-3 px-3 py-1.5 rounded-xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary hover:text-white transition-all"
                      >
                        تعديل
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Schedule Modal */}
      <Modal open={isModalOpen} onClose={handleCloseModal} size="md">
        <ModalHeader
          title={editingScheduleId !== null ? "تعديل قالب الحصة" : "إضافة قالب حصة جديد"}
          onClose={handleCloseModal}
        />
        
        <ModalBody>
          <form id="add-schedule-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">نوع الحصة *</label>
                    <Select 
                      required
                      value={formData.class_type_id}
                      onChange={(e) => setFormData({ ...formData, class_type_id: e.target.value })}
                    >
                      <option value="">اختر نوع الحصة</option>
                      {classTypes?.map((ct: any) => (
                        <option key={ct.id} value={ct.id}>{ct.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">الفرع *</label>
                    <Select 
                      required
                      value={formData.location_id}
                      onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                    >
                      <option value="">اختر الفرع</option>
                      {locations?.map((loc: any) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">المدرب</label>
                  <Select
                    value={formData.instructor_id}
                    onChange={(e) => setFormData({ ...formData, instructor_id: e.target.value })}
                  >
                    <option value="">اختر المدرب (اختياري)</option>
                    {staff?.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.full_name || s.user?.first_name}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">اليوم *</label>
                  <Select 
                    required
                    value={formData.day_of_week}
                    onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                  >
                    {DAYS_OF_WEEK.map(day => (
                      <option key={day.value} value={day.value}>{day.label}</option>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">وقت البدء *</label>
                    <input 
                      type="time" 
                      required
                      className="w-full p-2.5 rounded-lg border bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">وقت الانتهاء *</label>
                    <input 
                      type="time" 
                      required
                      className="w-full p-2.5 rounded-lg border bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">السعة القصوى *</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    className="w-full p-2.5 rounded-lg border bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 20 })}
                  />
                </div>
          </form>
        </ModalBody>
        
        <ModalFooter>
          {editingScheduleId !== null ? (
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 rounded-lg font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              حذف
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 rounded-lg font-medium hover:bg-secondary transition-colors"
            >
              إلغاء
            </button>
            <button 
              type="submit"
              form="add-schedule-form"
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              {editingScheduleId !== null ? "حفظ التعديلات" : "حفظ الحصة"}
            </button>
          </div>
        </ModalFooter>
      </Modal>
      </div>
    </PermissionGuard>
  );
}
