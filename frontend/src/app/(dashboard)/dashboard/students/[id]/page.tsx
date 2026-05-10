"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { 
  ArrowRight, Phone, Mail, MapPin, Calendar, Award, 
  CreditCard, ClipboardList, MessageSquare, Edit, 
  Loader2, AlertCircle, User, History,
  TrendingUp, Download, Plus, Sparkles, ChevronLeft
} from "lucide-react";
import { formatDate, getStatusBadgeClass, getStatusLabel, cn, isInvoiceOverdue } from "@/lib/utils";
import Link from "next/link";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { Student, StudentNote, StudentDocument, AttendanceHistoryRecord, Invoice, Location } from "@/types";
import PromoteStudentDialog from "@/components/dashboard/PromoteStudentDialog";
import ManualAttendanceDialog from "@/components/dashboard/ManualAttendanceDialog";
import MembershipDialog from "@/components/dashboard/MembershipDialog";
import { EditStudentModal } from "@/components/dashboard/EditStudentModal";
import { PermissionGuard } from "@/components/dashboard/permission-guard";

export default function StudentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [isManualAttendanceOpen, setIsManualAttendanceOpen] = useState(false);
  const [isMembershipDialogOpen, setIsMembershipDialogOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState<Student | null>(null);
  const [editError, setEditError] = useState("");

  const studentId = Number(id);

  const { data: student, isLoading, error } = useQuery<Student>({
    queryKey: ["student", id],
    queryFn: () => api.students.get(studentId).then((res: { data: Student }) => res.data),
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: () => api.locations.list().then((res: any) => res.data.results || res.data),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Student>) => api.students.update(studentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", id] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("تم تحديث بيانات الطالب بنجاح");
      setIsEditModalOpen(false);
    },
    onError: (err: any) => {
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
      setEditError(message);
    },
  });

  const handleEditClick = () => {
    if (student) {
      setEditData({ ...student });
      setEditError("");
      setIsEditModalOpen(true);
    }
  };

  const handleSaveEdit = () => {
    if (editData) {
      const { full_name, age, student_number, ...dataToUpdate } = editData as any;
      updateMutation.mutate(dataToUpdate);
    }
  };

  const { data: notes } = useQuery<StudentNote[]>({
    queryKey: ["student-notes", id],
    queryFn: () => api.students.notes.list(studentId).then((res: { data: StudentNote[] }) => res.data),
    enabled: !!student,
  });

  const { data: documents } = useQuery<StudentDocument[]>({
    queryKey: ["student-documents", id],
    queryFn: () => api.students.documents.list(studentId).then((res: { data: StudentDocument[] }) => res.data),
    enabled: !!student,
  });

  const { data: attendanceHistory } = useQuery<AttendanceHistoryRecord[]>({
    queryKey: ["student-attendance", id],
    queryFn: () => api.students.attendanceHistory(studentId).then((res: { data: AttendanceHistoryRecord[] }) => res.data),
    enabled: !!student,
  });

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ["student-invoices", id],
    queryFn: () => api.billing.invoices.list({ student_id: studentId }).then((res: any) => res.data.results || res.data),
    enabled: !!student,
  });

  const outstandingBalance = invoices?.reduce((sum: number, inv: Invoice) => sum + (inv.amount_due || 0), 0) ?? 0;
  const overdueCount = invoices?.filter((inv: Invoice) => isInvoiceOverdue(inv.status, inv.due_date)).length ?? 0;
  const lastPaymentInvoice = invoices
    ?.filter((inv: Invoice) => inv.status === "paid" && inv.paid_at)
    .sort((a: Invoice, b: Invoice) => new Date(b.paid_at!).getTime() - new Date(a.paid_at!).getTime())[0];


  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm font-bold text-muted-foreground animate-pulse">جاري تحميل بيانات الطالب...</p>
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-6 text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white">عذراً، لم نجد الطالب</h2>
          <p className="text-muted-foreground max-w-sm">ربما تم حذف الملف أو لا تملك صلاحية الوصول إليه حالياً.</p>
        </div>
        <Link href="/dashboard/students" className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all">
          العودة لقائمة الطلاب
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "نظرة عامة", icon: User },
    { id: "membership", label: "الاشتراكات", icon: CreditCard },
    { id: "attendance", label: "الحضور", icon: Calendar },
    { id: "belts", label: "الأحزمة", icon: Award },
    { id: "notes", label: "الملاحظات", icon: ClipboardList },
  ];

  return (
    <PermissionGuard permission="can_manage_students">
    <div className="space-y-8 pb-12">
      {/* Navigation & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="group flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-white transition-colors"
        >
          <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
            <ArrowRight className="w-4 h-4" />
          </div>
          العودة
        </button>

        <div className="flex items-center gap-2">
          <Link 
            href="/dashboard/messaging"
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-primary hover:border-primary transition-all active:scale-90"
            title="إرسال رسالة"
          >
            <MessageSquare className="w-4 h-4" />
          </Link>
          <button 
            onClick={handleEditClick}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-95"
          >
            <Edit className="w-4 h-4" />
            تعديل الملف
          </button>
        </div>
      </div>

      {/* Profile Header Card */}
      <div className="glass-card p-8 relative overflow-hidden group">
        <div className="absolute top-0 end-0 w-96 h-96 bg-primary/10 blur-[100px] -me-48 -mt-48 pointer-events-none" />
        <div className="absolute bottom-0 start-0 w-64 h-64 bg-blue-500/5 blur-[80px] -ms-32 -mb-32 pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="relative group/avatar">
            <div className="w-32 h-32 rounded-[2rem] overflow-hidden border-4 border-white/10 group-hover/avatar:border-primary/40 transition-colors shadow-2xl relative z-10">
              {student.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={student.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full gradient-brand flex items-center justify-center text-white font-black text-4xl">
                  {student.first_name?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>
            <div className={cn(
              "absolute -bottom-2 -end-2 w-8 h-8 rounded-2xl border-4 border-[#0f172a] shadow-xl z-20 flex items-center justify-center",
              student.status === "active" ? "bg-emerald-500 shadow-emerald-500/30" :
              student.status === "trial" ? "bg-blue-500 shadow-blue-500/30" :
              student.status === "lead" ? "bg-amber-500 shadow-amber-500/30" : "bg-gray-500"
            )}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>

          <div className="flex-1 text-center md:text-right">
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-3 justify-center md:justify-start">
              <h1 className="text-4xl font-black tracking-tight text-white">{student.full_name}</h1>
              <span className={cn("px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border mx-auto md:mx-0", getStatusBadgeClass(student.status))}>
                {getStatusLabel(student.status)}
              </span>
            </div>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm font-bold text-muted-foreground">
              <span className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                {student.student_number}
              </span>
              <span className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-border" />
                {student.gender === "male" ? "ذكر" : "أنثى"}
              </span>
              <span className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-border" />
                {student.age} سنة
              </span>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-3xl p-4 text-center min-w-[120px]">
              <p className="text-2xl font-black text-white">{attendanceHistory?.length ?? 0}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">حصة حضور</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.05] rounded-3xl p-4 text-center min-w-[120px]">
              <p className="text-2xl font-black text-primary">{student.current_belt?.name.split(" ")[0] || "—"}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">الحزام الحالي</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-6 group">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70">معلومات التواصل</h3>
            <div className="space-y-5">
              <ContactItem icon={Phone} label="رقم الهاتف" value={student.phone} dir="ltr" />
              <ContactItem icon={Mail} label="البريد الإلكتروني" value={student.email} />
              <ContactItem icon={MapPin} label="الفرع الملحق" value="الفرع الرئيسي" />
            </div>
          </div>

          <div className="glass-card p-6 space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 end-0 w-24 h-24 bg-primary/5 blur-2xl -me-12 -mt-12 group-hover:bg-primary/10 transition-colors" />
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70">المستوى الحالي</h3>
            {student.current_belt ? (
              <div className="flex items-center gap-5">
                <div 
                  className="w-16 h-16 rounded-2xl border-4 flex items-center justify-center bg-background shadow-xl relative overflow-hidden group-hover:scale-110 transition-transform"
                  style={{ borderColor: student.current_belt.color }}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent" />
                  <Award className="w-8 h-8 z-10" style={{ color: student.current_belt.color }} />
                </div>
                <div>
                  <p className="text-xl font-black text-white">{student.current_belt.name}</p>
                  <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-wider">
                    منذ: {formatDate(student.current_belt.promoted_at)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 border-2 border-dashed border-white/5 rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground mb-4">لم يتم تحديد مستوى</p>
                <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-2 mx-auto">
                  <Plus className="w-3 h-3" />
                  تعيين حزام
                </button>
              </div>
            )}
          </div>

          <div className="glass-card p-6 space-y-6 group">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70">العائلة</h3>
            {student.family ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-black text-white">{student.family.name}</p>
                  <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-primary text-[10px] font-black">
                    {student.family.member_count}
                  </span>
                </div>
                <Link 
                  href={`/dashboard/families/${student.family.id}`} 
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-white/5 hover:text-white transition-all"
                >
                  عرض ملف العائلة
                  <ChevronLeft className="w-3 h-3 rtl-flip" />
                </Link>
              </div>
            ) : (
              <div className="text-center py-4 border-2 border-dashed border-white/5 rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground mb-4">لا توجد عائلة مرتبطة</p>
                <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-2 mx-auto">
                  <Plus className="w-3 h-3" />
                  ربط بملف عائلة
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-8">
          {/* Tabs Container */}
          <div className="p-1.5 bg-white/[0.03] border border-white/[0.05] rounded-2xl flex flex-wrap sm:flex-nowrap gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all relative group",
                    isActive 
                      ? "bg-primary text-white shadow-lg shadow-primary/30" 
                      : "text-muted-foreground hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isActive ? "scale-110" : "opacity-50")} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {isActive && (
                    <div className="absolute -bottom-1 start-1/2 -translate-x-1/2 w-4 h-1 bg-white/40 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content Rendering */}
          <div className="min-h-[500px]">
            {activeTab === "overview" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="glass-card p-8 group">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                          <TrendingUp className="w-6 h-6" />
                        </div>
                        <h4 className="text-lg font-black text-white">إحصائيات الأداء</h4>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <OverviewRow label="إجمالي الحصص" value={`${attendanceHistory?.length ?? 0} حصة`} />
                      <OverviewRow 
                        label="آخر حضور" 
                        value={attendanceHistory?.[0] ? formatDate(attendanceHistory[0].checked_in_at) : "—"} 
                      />
                      <OverviewRow 
                        label="معدل الالتزام" 
                        value={attendanceHistory && attendanceHistory.length > 5 ? "85%" : "—"} 
                        valueClass="text-emerald-400"
                      />
                    </div>
                  </div>

                  <div className="glass-card p-8 group">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                          <CreditCard className="w-6 h-6" />
                        </div>
                        <h4 className="text-lg font-black text-white">الملف المالي</h4>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <OverviewRow 
                        label="الرصيد المستحق" 
                        value={`${outstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س`} 
                        valueClass={outstandingBalance > 0 ? "text-red-400" : "text-emerald-400"} 
                      />
                      <OverviewRow label="فواتير متأخرة" value={overdueCount.toString()} />
                      <OverviewRow 
                        label="آخر عملية دفع" 
                        value={lastPaymentInvoice ? formatDate(lastPaymentInvoice.paid_at!) : "—"} 
                      />
                    </div>
                  </div>
                </div>

                <div className="glass-card p-8 group relative overflow-hidden">
                  <div className="absolute top-0 end-0 w-64 h-64 bg-primary/5 blur-3xl -me-32 -mt-32 pointer-events-none" />
                  <div className="flex items-center justify-between mb-8">
                    <h4 className="text-lg font-black text-white flex items-center gap-3">
                      <History className="w-5 h-5 text-primary" />
                      آخر الأنشطة
                    </h4>
                  </div>
                  <div className="space-y-6 relative z-10">
                    {attendanceHistory && attendanceHistory.length > 0 ? (
                      attendanceHistory.slice(0, 4).map((record, i) => (
                        <div key={i} className="flex gap-6 pb-6 border-b border-white/5 last:border-0 last:pb-0 group/item">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-primary font-black text-sm group-hover/item:bg-primary group-hover/item:text-white transition-all">
                            {i + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-white mb-1 group-hover/item:text-primary transition-colors">
                              تم تسجيل الحضور في حصة "{record.class_name}"
                            </p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-3">
                              {formatDate(record.checked_in_at)} 
                              <span className="w-1 h-1 rounded-full bg-border" />
                              بواسطة: {record.method === "kiosk" ? "الكشك" : "النظام"}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center">
                        <History className="w-12 h-12 mx-auto mb-4 opacity-10" />
                        <p className="text-sm font-bold text-muted-foreground">لا توجد أنشطة مسجلة مؤخراً</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "membership" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {student.active_membership ? (
                  <div className="glass-card overflow-hidden group">
                    <div className="gradient-brand p-8 text-white relative overflow-hidden">
                      <div className="absolute top-0 end-0 w-64 h-64 bg-white/10 blur-3xl -me-32 -mt-32 pointer-events-none" />
                      <div className="flex justify-between items-start relative z-10">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-3">اشتراك نشط</p>
                          <h3 className="text-4xl font-black tracking-tight">{student.active_membership.plan_name}</h3>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md border border-white/30 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                          نشط حالياً
                        </div>
                      </div>
                    </div>
                    <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-8 bg-white/[0.01]">
                      <div className="space-y-6">
                        <MembershipInfo label="تاريخ البدء" value={formatDate(student.active_membership.start_date)} />
                        <MembershipInfo label="تاريخ الانتهاء" value={formatDate(student.active_membership.end_date)} />
                      </div>
                      <div className="space-y-6">

                        <button 
                          onClick={() => setIsMembershipDialogOpen(true)}
                          className="w-full py-4 rounded-2xl gradient-brand text-white text-sm font-black shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform"
                        >
                          تجديد أو تغيير الاشتراك
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card p-20 text-center border-2 border-dashed border-white/5">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                      <CreditCard className="w-10 h-10 text-muted-foreground opacity-20" />
                    </div>
                    <h4 className="text-xl font-black text-white">لا توجد عضوية نشطة</h4>
                    <p className="text-sm font-medium text-muted-foreground mt-2 mb-8">هذا الطالب غير مسجل في أي باقة حالياً.</p>
                    <button 
                      onClick={() => setIsMembershipDialogOpen(true)}
                      className="px-10 py-4 rounded-2xl gradient-brand text-white font-black text-sm shadow-xl shadow-primary/30 hover:scale-[1.05] transition-transform"
                    >
                      إضافة باقة اشتراك
                    </button>
                  </div>
                )}
                
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70 px-2">سجل الفواتير</h4>
                  <div className="glass-card overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-white/[0.03]">
                        <tr>
                          <th className="px-6 py-4 rounded-s-lg text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">رقم الفاتورة</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">الباقة</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">التاريخ</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">المبلغ</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-start">الحالة</th>
                          <th className="px-6 py-4 rounded-e-lg text-end"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {invoices && invoices.length > 0 ? (
                          invoices.map((inv: Invoice) => (
                            <tr key={inv.id} className="group/row hover:bg-white/[0.02] transition-colors">
                              <td className="px-6 py-5 font-bold text-white text-sm text-start">#{inv.invoice_number}</td>
                              <td className="px-6 py-5 text-white text-sm font-bold text-start">
                                {inv.plan_name || "—"}
                              </td>
                              <td className="px-6 py-5 text-muted-foreground text-sm font-medium text-start">{formatDate(inv.created_at)}</td>
                              <td className="px-6 py-5 font-black text-white text-sm text-start">{inv.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {inv.currency}</td>
                              <td className="px-6 py-5 text-start">
                                <span className={cn(
                                  "px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border",
                                  getStatusBadgeClass(isInvoiceOverdue(inv.status, inv.due_date) ? "overdue" : inv.status as any)
                                )}>
                                  {getStatusLabel(isInvoiceOverdue(inv.status, inv.due_date) ? "overdue" : inv.status as any)}
                                </span>
                              </td>
                              <td className="px-6 py-5 text-end">
                                <button className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all">
                                  <Download className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-6 py-10 text-center text-sm font-bold text-muted-foreground">
                              لا توجد فواتير مسجلة لهذا الطالب
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Other tabs follow similar premium patterns... */}
            {activeTab === "attendance" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between px-2">
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70">سجل الحضور والغياب</h4>
                  <button 
                    onClick={() => setIsManualAttendanceOpen(true)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all active:scale-95 shadow-lg shadow-primary/5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    تسجيل حضور يدوي
                  </button>
                </div>

                <div className="glass-card overflow-hidden">
                  <div className="divide-y divide-white/5">
                    {attendanceHistory && attendanceHistory.length > 0 ? (
                      attendanceHistory.map((record, i) => (
                        <div key={i} className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors group/item">
                          <div className="flex items-center gap-6">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-xl shadow-lg shadow-emerald-500/10 group-hover/item:scale-110 transition-transform">
                              ح
                            </div>
                            <div>
                              <p className="font-black text-white group-hover/item:text-primary transition-colors">{record.class_name}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{formatDate(record.checked_in_at)}</p>
                            </div>
                          </div>
                          <div className="text-end">
                            <div className="flex items-center gap-2 mb-1 justify-end">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">حاضر</span>
                            </div>
                            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter italic">
                              بواسطة: {record.method === "kiosk" ? "الكشك الذكي" : "المسؤول"}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-24 text-center">
                        <Calendar className="w-16 h-16 mx-auto mb-4 opacity-5" />
                        <p className="text-sm font-bold text-muted-foreground">لا توجد سجلات حضور متاحة</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "belts" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between px-2">
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70">تاريخ الترقيات</h4>
                  <button 
                    onClick={() => setIsPromoteDialogOpen(true)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    ترقية الطالب
                  </button>
                </div>

                <div className="relative pt-4">
                  <div className="absolute top-0 bottom-0 end-[31px] w-1 bg-gradient-to-b from-primary/40 via-primary/5 to-transparent rounded-full" />
                  <div className="space-y-12 relative">
                    {student.belt_history && student.belt_history.length > 0 ? (
                      student.belt_history.map((history, idx) => (
                        <div key={idx} className="flex items-start gap-8 group/belt">
                          <div 
                            className="w-16 h-16 rounded-[1.25rem] border-4 flex items-center justify-center bg-[#0f172a] z-10 shadow-2xl shrink-0 group-hover/belt:scale-110 transition-transform relative overflow-hidden"
                            style={{ borderColor: history.color }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-tr from-black/40 to-transparent" />
                            <Award className="w-8 h-8 z-10" style={{ color: history.color }} />
                          </div>
                          <div className="flex-1 pt-2">
                            <div className="flex items-center gap-3">
                              <p className="text-2xl font-black text-white">{history.belt_name}</p>
                              {history.is_current && (
                                <span className="px-3 py-1 rounded-xl bg-primary shadow-lg shadow-primary/20 text-white text-[9px] font-black uppercase tracking-widest">
                                  الحالي
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-black text-primary/70 mt-1 uppercase tracking-[0.1em]">تاريخ الترقية: {formatDate(history.promoted_at)}</p>
                            <div className="mt-4 p-5 rounded-2xl bg-white/[0.02] border border-white/5 text-sm font-medium text-muted-foreground leading-relaxed group-hover/belt:bg-white/[0.04] transition-colors">
                              تم اجتياز الاختبار بنجاح مع إشادة خاصة بمهارات الدفاع والهجوم المضاد.
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-3xl">
                        <Award className="w-16 h-16 mx-auto mb-4 opacity-5" />
                        <p className="text-sm font-bold text-muted-foreground">لا يوجد سجل ترقيات متاح حالياً</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notes" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Notes Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70">الملاحظات الإدارية</h4>
                    <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all active:scale-95">
                      <Plus className="w-3.5 h-3.5" />
                      إضافة ملاحظة
                    </button>
                  </div>

                  <div className="space-y-4">
                    {notes && notes.length > 0 ? (
                      notes.map((note) => (
                        <div key={note.id} className="glass-card p-6 space-y-4 group">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xs font-black text-primary">
                                {note.author_name?.[0] || "A"}
                              </div>
                              <div>
                                <p className="text-sm font-black text-white">{note.author_name}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{formatDate(note.created_at)}</p>
                              </div>
                            </div>
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-xl border",
                              note.note_type === "medical" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                              note.note_type === "billing" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                              "bg-white/5 text-muted-foreground border-white/10"
                            )}>
                              {note.note_type === "medical" ? "طبية" : 
                               note.note_type === "billing" ? "مالية" : "عامة"}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-white/90 leading-relaxed bg-white/[0.01] p-4 rounded-xl border border-white/5 group-hover:border-primary/20 transition-colors">
                            {note.content}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                        <p className="text-sm font-bold text-muted-foreground">لا توجد ملاحظات مسجلة</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Documents Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70">الوثائق والمستندات</h4>
                    <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all active:scale-95">
                      <Plus className="w-3.5 h-3.5" />
                      رفع وثيقة جديدة
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {documents && documents.length > 0 ? (
                      documents.map((doc) => (
                        <div key={doc.id} className="glass-card p-5 flex items-center justify-between group hover:border-primary/40 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-lg shadow-primary/5">
                              <Download className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-white truncate max-w-[140px]">{doc.name}</p>
                              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                {doc.document_type} • {formatDate(doc.created_at)}
                              </p>
                            </div>
                          </div>
                          <button className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all active:scale-90">
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="sm:col-span-2 py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                        <p className="text-sm font-bold text-muted-foreground">لا توجد وثائق مرفقة</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {isPromoteDialogOpen && (
        <PromoteStudentDialog
          isOpen={isPromoteDialogOpen}
          onClose={() => setIsPromoteDialogOpen(false)}
          studentId={studentId}
          studentName={student.full_name}
          currentBeltName={student.current_belt?.name}
          currentBeltColor={student.current_belt?.color}
        />
      )}

      {isManualAttendanceOpen && (
        <ManualAttendanceDialog
          isOpen={isManualAttendanceOpen}
          onClose={() => setIsManualAttendanceOpen(false)}
          studentId={studentId}
          studentName={student.full_name}
        />
      )}

      {isMembershipDialogOpen && (
        <MembershipDialog
          isOpen={isMembershipDialogOpen}
          onClose={() => setIsMembershipDialogOpen(false)}
          studentId={studentId}
          studentName={student.full_name}
        />
      )}

      {isEditModalOpen && editData && (
        <EditStudentModal
          student={editData}
          locations={locations}
          isPending={updateMutation.isPending}
          error={editError}
          onClose={() => setIsEditModalOpen(false)}
          onChange={(updated) => setEditData((prev: Student | null) => prev ? { ...prev, ...updated } : null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
    </PermissionGuard>
  );
}

function ContactItem({ icon: Icon, label, value, dir }: { icon: any, label: string, value?: string, dir?: string }) {
  return (
    <div className="flex items-center gap-4 group/item">
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary group-hover/item:bg-primary group-hover/item:text-white transition-all shadow-sm">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-bold text-white truncate" dir={dir}>{value || "—"}</p>
      </div>
    </div>
  );
}

function OverviewRow({ label, value, valueClass }: { label: string, value: string, valueClass?: string }) {
  return (
    <div className="flex justify-between items-center py-1 group/row">
      <span className="text-sm font-bold text-muted-foreground group-hover/row:text-white transition-colors">{label}</span>
      <span className={cn("text-sm font-black", valueClass || "text-white")}>{value}</span>
    </div>
  );
}

function MembershipInfo({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 group hover:border-primary/20 transition-all">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
      <p className="text-lg font-black text-white">{value}</p>
    </div>
  );
}
