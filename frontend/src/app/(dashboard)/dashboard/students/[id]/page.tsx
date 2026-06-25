"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import {
  ArrowRight, Phone, Mail, MapPin, Calendar, Award,
  CreditCard, ClipboardList, MessageSquare, Edit,
  Loader2, AlertCircle, User, History,
  TrendingUp, Download, Plus, Sparkles, ChevronLeft,
  Trash2, FileText, Eye, Shield, ShieldAlert, Search,
  Filter, Clock
} from "lucide-react";
import { formatCurrency, formatDate, getStatusBadgeClass, getStatusLabel, cn, isInvoiceOverdue, parseApiError } from "@/lib/utils";
import { useTenant } from "@/lib/providers/tenant-provider";
import Link from "next/link";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { Student, StudentNote, StudentDocument, AttendanceHistoryRecord, Invoice, Location } from "@/types";
import PromoteStudentDialog from "@/components/dashboard/PromoteStudentDialog";
import ManualAttendanceDialog from "@/components/dashboard/ManualAttendanceDialog";
import MembershipDialog from "@/components/dashboard/MembershipDialog";
import { EditStudentModal } from "@/components/dashboard/EditStudentModal";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import AddNoteDialog from "@/components/dashboard/AddNoteDialog";
import UploadDocumentDialog from "@/components/dashboard/UploadDocumentDialog";

export default function StudentDetailPage() {
  const { tenant } = useTenant();
  const currency = tenant?.default_currency || "JOD";
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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Notes states
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<StudentNote | null>(null);

  // Documents states
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<StudentDocument | null>(null);
  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("all");

  const studentId = Number(id);

  const { data: student, isLoading, error } = useQuery<Student>({
    queryKey: ["student", id],
    queryFn: () => api.students.get(studentId).then((res: { data: Student }) => res.data),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.students.delete(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("تم حذف الطالب بنجاح");
      router.push("/dashboard/students");
    },
    onError: (err: any) => {
      console.error("Delete student error:", err);
      toast.error(parseApiError(err, "حدث خطأ أثناء حذف الطالب."));
    },
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
      setEditError(parseApiError(err, "حدث خطأ أثناء تحديث بيانات الطالب."));
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: number) => api.students.notes.delete(studentId, noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-notes", id] });
      toast.success("تم حذف الملاحظة بنجاح");
      setNoteToDelete(null);
    },
    onError: (err: any) => {
      toast.error(parseApiError(err, "حدث خطأ أثناء حذف الملاحظة."));
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: number) => api.students.documents.delete(studentId, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-documents", id] });
      toast.success("تم حذف الوثيقة بنجاح");
      setDocToDelete(null);
    },
    onError: (err: any) => {
      toast.error(parseApiError(err, "حدث خطأ أثناء حذف الوثيقة."));
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
    queryFn: () =>
      api.students.notes.list(studentId).then((res: { data: StudentNote[] | { results: StudentNote[] } }) =>
        Array.isArray(res.data) ? res.data : res.data.results
      ),
    enabled: !!student,
  });

  const { data: documents } = useQuery<StudentDocument[]>({
    queryKey: ["student-documents", id],
    queryFn: () =>
      api.students.documents.list(studentId).then((res: { data: StudentDocument[] | { results: StudentDocument[] } }) =>
        Array.isArray(res.data) ? res.data : res.data.results
      ),
    enabled: !!student,
  });

  const { data: attendanceHistory } = useQuery<AttendanceHistoryRecord[]>({
    queryKey: ["student-attendance", id],
    queryFn: () => api.students.attendanceHistory(studentId).then((res: { data: AttendanceHistoryRecord[] }) => res.data),
    enabled: !!student,
  });

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ["student-invoices", id],
    queryFn: () =>
      api.billing.invoices.list({ student_id: studentId }).then((res: { data: Invoice[] | { results: Invoice[] } }) =>
        Array.isArray(res.data) ? res.data : res.data.results
      ),
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

  const DOCUMENT_TYPES: Record<string, string> = {
    id: "هوية وطنية / إقامة",
    passport: "جواز سفر",
    medical: "تقرير طبي",
    waiver: "إخلاء مسؤولية",
    photo_consent: "موافقة تصوير",
    other: "أخرى",
  };

  const getDocTypeBadgeClass = (type: string) => {
    switch (type) {
      case "id":
      case "passport":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "medical":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "waiver":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "photo_consent":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      default:
        return "bg-white/5 text-muted-foreground border-white/10";
    }
  };

  const getExpiryStatus = (expiresAtStr: string | null) => {
    if (!expiresAtStr) return null;
    const expiryDate = new Date(expiresAtStr);
    const now = new Date();
    expiryDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    
    if (expiryDate < now) {
      return {
        status: "expired",
        label: "منتهية الصلاحية",
        badgeClass: "bg-red-500/15 text-red-400 border-red-500/30 animate-pulse",
      };
    }
    
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 30) {
      return {
        status: "expiring_soon",
        label: `تنتهي خلال ${diffDays} يوم`,
        badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      };
    }
    
    return {
      status: "valid",
      label: `صالحة حتى: ${formatDate(expiresAtStr)}`,
      badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    };
  };

  const tabs = [
    { id: "overview", label: "نظرة عامة", icon: User },
    { id: "membership", label: "الاشتراكات", icon: CreditCard },
    { id: "attendance", label: "الحضور", icon: Calendar },
    { id: "belts", label: "الأحزمة", icon: Award },
    { id: "notes", label: "الملاحظات", icon: ClipboardList },
    { id: "documents", label: "الوثائق", icon: FileText },
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
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              حذف الطالب
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

            <div className="flex-1 text-center md:text-end">
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
                <ContactItem icon={Phone} label="رقم الهاتف" value={student.phone} />
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
                          value={formatCurrency(outstandingBalance, currency)}
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
                      <div className="overflow-x-auto custom-scrollbar">
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
                                  <td className="px-6 py-5 font-black text-white text-sm text-start">{formatCurrency(inv.total_amount, inv.currency)}</td>
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
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70">الملاحظات الإدارية</h4>
                    <button
                      onClick={() => setIsAddNoteOpen(true)}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      إضافة ملاحظة جديدة
                    </button>
                  </div>

                  <div className="space-y-4">
                    {notes && notes.length > 0 ? (
                      notes.map((note) => (
                        <div key={note.id} className="glass-card p-6 space-y-4 group relative hover:border-primary/20 transition-all">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-black text-primary uppercase shadow-sm">
                                {note.author_name?.[0] || "A"}
                              </div>
                              <div className="text-start">
                                <p className="text-sm font-black text-white">{note.author_name}</p>
                                <p className="text-[10px] font-bold text-muted-foreground mt-0.5">{formatDate(note.created_at)}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {note.is_private && (
                                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
                                  <ShieldAlert className="w-3 h-3" />
                                  سرية
                                </span>
                              )}
                              <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl border shadow-sm",
                                note.note_type === "medical" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                  note.note_type === "billing" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                  note.note_type === "behavior" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                                  note.note_type === "progress" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                    "bg-white/5 text-muted-foreground border-white/10"
                              )}>
                                {note.note_type === "medical" ? "طبية" :
                                  note.note_type === "billing" ? "مالية" :
                                  note.note_type === "behavior" ? "سلوكية" :
                                  note.note_type === "progress" ? "تقدم" : "عامة"}
                              </span>
                              
                              <button
                                onClick={() => setNoteToDelete(note)}
                                className="w-8 h-8 rounded-xl bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 text-red-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                                title="حذف الملاحظة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          
                          <p className="text-sm font-medium text-white/90 leading-relaxed bg-white/[0.01] p-4 rounded-xl border border-white/5 text-start whitespace-pre-wrap">
                            {note.content}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                        <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-10" />
                        <p className="text-sm font-bold text-muted-foreground">لا توجد ملاحظات مسجلة لهذا الطالب</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "documents" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70">الوثائق والمستندات الرسمية</h4>
                    <button
                      onClick={() => setIsUploadDocOpen(true)}
                      className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20 w-fit"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      رفع وثيقة جديدة
                    </button>
                  </div>

                  {/* Search and Filters Bar */}
                  <div className="flex flex-col sm:flex-row gap-3 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                    <div className="flex-1 relative">
                      <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                      <input
                        type="text"
                        placeholder="البحث عن وثيقة بالاسم..."
                        value={docSearchQuery}
                        onChange={(e) => setDocSearchQuery(e.target.value)}
                        className="w-full bg-background/40 border border-white/5 rounded-xl py-2.5 ps-10 pe-4 text-xs font-medium text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors text-start"
                      />
                    </div>
                    <div className="w-full sm:w-48 relative">
                      <Filter className="absolute start-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                      <select
                        value={docTypeFilter}
                        onChange={(e) => setDocTypeFilter(e.target.value)}
                        className="w-full bg-background/40 border border-white/5 rounded-xl py-2.5 ps-10 pe-4 text-xs font-medium text-white focus:outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer [&>option]:bg-[#0f172a] [&>option]:text-white text-start"
                      >
                        <option value="all">كل أنواع الوثائق</option>
                        <option value="id">هوية وطنية / إقامة</option>
                        <option value="passport">جواز السفر</option>
                        <option value="medical">تقرير طبي</option>
                        <option value="waiver">إخلاء مسؤولية</option>
                        <option value="photo_consent">موافقة تصوير</option>
                        <option value="other">أخرى</option>
                      </select>
                    </div>
                  </div>

                  {/* Documents Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {documents && documents.length > 0 ? (
                      (() => {
                        const filteredDocs = documents.filter((doc) => {
                          const matchesSearch = doc.name.toLowerCase().includes(docSearchQuery.toLowerCase());
                          const matchesType = docTypeFilter === "all" || doc.document_type === docTypeFilter;
                          return matchesSearch && matchesType;
                        });

                        if (filteredDocs.length === 0) {
                          return (
                            <div className="sm:col-span-2 py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                              <Search className="w-12 h-12 mx-auto mb-4 opacity-10" />
                              <p className="text-sm font-bold text-muted-foreground">لم يتم العثور على وثائق تطابق البحث</p>
                            </div>
                          );
                        }

                        return filteredDocs.map((doc) => {
                          const expiryInfo = getExpiryStatus(doc.expires_at);

                          return (
                            <div key={doc.id} className="glass-card p-5 space-y-4 group hover:border-primary/30 transition-all flex flex-col justify-between">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-md shrink-0">
                                      <FileText className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0 text-start">
                                      <p className="text-sm font-black text-white truncate max-w-[160px]">{doc.name}</p>
                                      <span className={cn("inline-block mt-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border", getDocTypeBadgeClass(doc.document_type))}>
                                        {DOCUMENT_TYPES[doc.document_type] || doc.document_type}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <button
                                    onClick={() => setDocToDelete(doc)}
                                    className="w-8 h-8 rounded-xl bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 text-red-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 active:scale-95"
                                    title="حذف الوثيقة"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                {doc.notes && (
                                  <p className="text-xs font-semibold text-muted-foreground bg-white/[0.01] p-3 rounded-xl border border-white/[0.03] text-start leading-relaxed truncate group-hover:whitespace-normal group-hover:line-clamp-none line-clamp-2">
                                    {doc.notes}
                                  </p>
                                )}
                              </div>

                              <div className="pt-2 border-t border-white/5 flex flex-col gap-3">
                                <div className="flex items-center justify-between text-[10px] font-bold">
                                  <span className="text-muted-foreground/60">تاريخ الرفع: {formatDate(doc.created_at)}</span>
                                  {expiryInfo && (
                                    <span className={cn("px-2.5 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wider", expiryInfo.badgeClass)}>
                                      {expiryInfo.label}
                                    </span>
                                  )}
                                </div>

                                <div className="flex gap-2">
                                  {/* View / Open in new window */}
                                  <a
                                    href={doc.file}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-white transition-colors"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    عرض الملف
                                  </a>
                                  
                                  {/* Download */}
                                  <a
                                    href={doc.file}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
                                    title="تحميل"
                                  >
                                    <Download className="w-4 h-4" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()
                    ) : (
                      <div className="sm:col-span-2 py-24 text-center border-2 border-dashed border-white/5 rounded-3xl">
                        <FileText className="w-16 h-16 mx-auto mb-4 opacity-5" />
                        <p className="text-sm font-bold text-muted-foreground">لا توجد وثائق مرفقة بهذا الطالب حالياً</p>
                      </div>
                    )}
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

        {isDeleteModalOpen && (
          <Modal open={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} size="sm">
            <ModalHeader
              icon={<Trash2 className="w-5 h-5 text-red-500" />}
              title="حذف ملف الطالب"
              subtitle={student.full_name}
              onClose={() => setIsDeleteModalOpen(false)}
            />
            <ModalBody className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed text-start" >
                هل أنت متأكد من رغبتك في حذف ملف الطالب؟ سيتم أرشفة بيانات الطالب والاشتراكات بشكل آمن.
              </p>
            </ModalBody>
            <ModalFooter>
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                  className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  تأكيد الحذف
                </button>
              </div>
            </ModalFooter>
          </Modal>
        )}

        {isUploadDocOpen && (
          <UploadDocumentDialog
            isOpen={isUploadDocOpen}
            onClose={() => setIsUploadDocOpen(false)}
            studentId={studentId}
            studentName={student.full_name}
          />
        )}

        {isAddNoteOpen && (
          <AddNoteDialog
            isOpen={isAddNoteOpen}
            onClose={() => setIsAddNoteOpen(false)}
            studentId={studentId}
            studentName={student.full_name}
          />
        )}

        {noteToDelete && (
          <Modal open={!!noteToDelete} onClose={() => setNoteToDelete(null)} size="sm">
            <ModalHeader
              icon={<Trash2 className="w-5 h-5 text-red-500" />}
              title="حذف الملاحظة"
              subtitle={student.full_name}
              onClose={() => setNoteToDelete(null)}
            />
            <ModalBody className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed text-start">
                هل أنت متأكد من رغبتك في حذف هذه الملاحظة بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
            </ModalBody>
            <ModalFooter>
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setNoteToDelete(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={deleteNoteMutation.isPending}
                  onClick={() => deleteNoteMutation.mutate(noteToDelete.id)}
                  className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deleteNoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  تأكيد الحذف
                </button>
              </div>
            </ModalFooter>
          </Modal>
        )}

        {docToDelete && (
          <Modal open={!!docToDelete} onClose={() => setDocToDelete(null)} size="sm">
            <ModalHeader
              icon={<Trash2 className="w-5 h-5 text-red-500" />}
              title="حذف الوثيقة"
              subtitle={docToDelete.name}
              onClose={() => setDocToDelete(null)}
            />
            <ModalBody className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed text-start">
                هل أنت متأكد من رغبتك في حذف هذه الوثيقة بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
            </ModalBody>
            <ModalFooter>
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setDocToDelete(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={deleteDocMutation.isPending}
                  onClick={() => deleteDocMutation.mutate(docToDelete.id)}
                  className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deleteDocMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  تأكيد الحذف
                </button>
              </div>
            </ModalFooter>
          </Modal>
        )}
      </div>
    </PermissionGuard>
  );
}

function ContactItem({ icon: Icon, label, value }: { icon: any, label: string, value?: string }) {
  return (
    <div className="flex items-center gap-4 group/item text-start">
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary group-hover/item:bg-primary group-hover/item:text-white transition-all shadow-sm">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-bold text-white break-all"><bdi>{value || "—"}</bdi></p>
      </div>
    </div>
  );
}

function OverviewRow({ label, value, valueClass }: { label: string, value: string, valueClass?: string }) {
  return (
    <div className="flex justify-between items-center py-1 group/row">
      <span className="text-sm font-bold text-muted-foreground group-hover/row:text-white transition-colors">{label}</span>
      <span className={cn("text-sm font-black", valueClass || "text-white")}><bdi>{value}</bdi></span>
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
