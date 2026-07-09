"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import {
  ArrowRight, Phone, Mail, MapPin, Calendar, Award,
  CreditCard, ClipboardList, Edit, Loader2, AlertCircle,
  User, History, Download, Plus, Sparkles, ChevronLeft,
  Trash2, FileText, Search, UserMinus, UserPlus, Receipt,
  Users
} from "lucide-react";
import { formatCurrency, formatDate, getStatusBadgeClass, getStatusLabel, cn, isInvoiceOverdue, parseApiError } from "@/lib/utils";
import { useTenant } from "@/lib/providers/tenant-provider";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { FamilyDetail, FamilyMember, Invoice } from "@/types";
import FamilyFormDialog from "@/components/dashboard/FamilyFormDialog";
import AddMemberDialog from "@/components/dashboard/AddMemberDialog";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";

export default function FamilyDetailPage() {
  const { tenant } = useTenant();
  const currency = tenant?.default_currency || "JOD";
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<FamilyMember | null>(null);

  const familyId = Number(id);

  // Fetch Family details
  const { data: family, isLoading, error } = useQuery<FamilyDetail>({
    queryKey: ["family", id],
    queryFn: () => api.families.get(familyId).then((res: { data: FamilyDetail }) => res.data),
  });

  const memberIds = family?.members?.map((m) => m.id) || [];

  // Fetch Invoices for all family members in parallel
  const { data: invoices = [], isLoading: isLoadingInvoices } = useQuery<Invoice[]>({
    queryKey: ["family-invoices", id, memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return [];
      const requests = memberIds.map((mId) =>
        api.billing.invoices.list({ student_id: mId }).then((res: any) =>
          Array.isArray(res.data) ? res.data : res.data.results || []
        )
      );
      const results = await Promise.all(requests);
      return results.flat().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    enabled: memberIds.length > 0,
  });

  // Delete family mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.families.delete(familyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["families"] });
      toast.success("تم حذف العائلة بنجاح");
      router.push("/dashboard/families");
    },
    onError: (err: any) => {
      toast.error(parseApiError(err, "حدث خطأ أثناء حذف العائلة."));
    },
  });

  // Remove member from family mutation
  const removeMemberMutation = useMutation({
    mutationFn: (studentId: number) => api.families.removeMember(familyId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family", id] });
      queryClient.invalidateQueries({ queryKey: ["families"] });
      toast.success("تم فصل العضو عن العائلة بنجاح");
      setMemberToRemove(null);
    },
    onError: (err: any) => {
      toast.error(parseApiError(err, "حدث خطأ أثناء فصل العضو عن العائلة."));
    },
  });

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm font-bold text-muted-foreground animate-pulse">جاري تحميل بيانات العائلة...</p>
        </div>
      </div>
    );
  }

  if (error || !family) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="glass-card p-8 max-w-md text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-black text-white">خطأ في تحميل العائلة</h2>
          <p className="text-sm text-muted-foreground">قد تكون العائلة غير موجودة أو لا تملك الصلاحيات الكافية لعرضها.</p>
          <button
            onClick={() => router.push("/dashboard/families")}
            className="px-6 py-2.5 rounded-xl gradient-brand text-white font-bold text-xs uppercase tracking-widest active:scale-95 transition-all"
          >
            العودة للعائلات
          </button>
        </div>
      </div>
    );
  }

  const stats = family.stats;

  const tabs = [
    { id: "overview", label: "نظرة عامة والأعضاء", icon: User },
    { id: "invoices", label: "الفواتير المجمعة", icon: Receipt },
  ];

  return (
    <PermissionGuard permission="can_manage_students">
      <div className="space-y-8 pb-12">
        {/* Navigation & Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard/families")}
            className="group flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-white transition-colors"
          >
            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
              <ArrowRight className="w-4 h-4" />
            </div>
            <span>العودة لقائمة العائلات</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all active:scale-95"
            >
              <Edit className="w-4 h-4" />
              تعديل العائلة
            </button>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              حذف العائلة
            </button>
          </div>
        </div>

        {/* Profile Header Card */}
        <div className="glass-card p-8 relative overflow-hidden group">
          <div className="absolute top-0 end-0 w-96 h-96 bg-primary/10 blur-[100px] -me-48 -mt-48 pointer-events-none" />
          <div className="absolute bottom-0 start-0 w-64 h-64 bg-emerald-500/5 blur-[80px] -ms-32 -mb-32 pointer-events-none" />

          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div className="relative shrink-0">
              <div className="w-32 h-32 rounded-[2rem] overflow-hidden border-4 border-white/10 bg-white/5 flex items-center justify-center text-primary shadow-2xl relative z-10">
                <Users className="w-16 h-16" />
              </div>
            </div>

            <div className="flex-1 text-center md:text-end">
              <h1 className="text-4xl font-black tracking-tight text-white mb-2">{family.name}</h1>
              <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm font-bold text-muted-foreground">
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  المسؤول الرئيسي: {family.primary_contact_name}
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  عدد الأعضاء: {family.member_count} طلاب
                </span>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-3xl p-4 text-center min-w-[120px]">
                <p className="text-2xl font-black text-white">{formatCurrency(stats?.total_billed || 0, currency)}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">إجمالي الفواتير</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-3xl p-4 text-center min-w-[120px]">
                <p className={cn("text-2xl font-black", (stats?.outstanding_balance || 0) > 0 ? "text-red-400 animate-pulse" : "text-emerald-400")}>
                  {formatCurrency(stats?.outstanding_balance || 0, currency)}
                </p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">الرصيد المستحق</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Contact Info */}
          <div className="space-y-6">
            <div className="glass-card p-6 space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70">معلومات الاتصال</h3>
              <div className="space-y-5">
                <div className="flex items-center gap-4 group/item text-start">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary group-hover/item:bg-primary group-hover/item:text-white transition-all shadow-sm">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">رقم الهاتف</p>
                    <p className="text-sm font-bold text-white"><bdi>{family.primary_contact_phone || "—"}</bdi></p>
                  </div>
                </div>

                <div className="flex items-center gap-4 group/item text-start">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary group-hover/item:bg-primary group-hover/item:text-white transition-all shadow-sm">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">البريد الإلكتروني</p>
                    <p className="text-sm font-bold text-white truncate"><bdi>{family.primary_contact_email || "—"}</bdi></p>
                  </div>
                </div>

                <div className="flex items-center gap-4 group/item text-start">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary group-hover/item:bg-primary group-hover/item:text-white transition-all shadow-sm">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">عنوان الفواتير</p>
                    <p className="text-sm font-bold text-white break-words">{family.billing_address || "—"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Attendance & Notes */}
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70">ملاحظات العائلة</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {family.notes || "لا توجد ملاحظات مسجلة لهذه العائلة."}
              </p>
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
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab content 1: Overview & Members */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-white">أعضاء العائلة</h2>
                  <button
                    onClick={() => setIsAddMemberOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all active:scale-95"
                  >
                    <UserPlus className="w-4 h-4" />
                    ربط عضو موجود
                  </button>
                </div>

                {family.members.length === 0 ? (
                  <div className="glass-card py-20 text-center flex flex-col items-center justify-center border-dashed border-white/10">
                    <User className="w-12 h-12 text-muted-foreground/30 mb-4" />
                    <p className="text-sm font-bold text-muted-foreground">لا يوجد أعضاء مرتبطين بهذه العائلة بعد.</p>
                  </div>
                ) : (
                  <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-start border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.01]">
                            <th className="px-6 py-4 text-start text-xs font-black uppercase tracking-widest text-muted-foreground">اسم الطالب</th>
                            <th className="px-6 py-4 text-start text-xs font-black uppercase tracking-widest text-muted-foreground">رقم الطالب</th>
                            <th className="px-6 py-4 text-start text-xs font-black uppercase tracking-widest text-muted-foreground">الحالة</th>
                            <th className="px-6 py-4 text-start text-xs font-black uppercase tracking-widest text-muted-foreground">الحزام</th>
                            <th className="px-6 py-4 text-start text-xs font-black uppercase tracking-widest text-muted-foreground">الاشتراك</th>
                            <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-widest text-muted-foreground">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {family.members.map((member) => (
                            <tr key={member.id} className="group/row hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center shrink-0">
                                    {member.photo_url ? (
                                      <img src={member.photo_url} alt={member.full_name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-white font-black text-sm">{member.first_name?.[0]?.toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div>
                                    <Link href={`/dashboard/students/${member.id}`} className="font-black text-white hover:text-primary transition-colors block text-sm">
                                      {member.full_name}
                                    </Link>
                                    <span className="text-[10px] font-bold text-muted-foreground"><bdi>{member.phone || "بدون رقم هاتف"}</bdi></span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-xs font-mono font-bold text-muted-foreground">{member.student_number}</td>
                              <td className="px-6 py-4">
                                <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black border", getStatusBadgeClass(member.status))}>
                                  {getStatusLabel(member.status)}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {member.current_belt ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 rounded-lg border border-white/20" style={{ backgroundColor: member.current_belt.color }} />
                                    <span className="text-xs font-bold text-white">{member.current_belt.name}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                {member.active_membership ? (
                                  <span className="text-xs font-black text-primary bg-primary/5 border border-primary/10 px-2 py-1 rounded-xl">
                                    {member.active_membership.plan_name}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">لا يوجد</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <Link
                                    href={`/dashboard/students/${member.id}`}
                                    className="p-2 rounded-xl bg-white/5 border border-white/10 hover:border-primary/30 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                                    title="عرض الملف"
                                  >
                                    <ChevronLeft className="w-4 h-4 rtl-flip" />
                                  </Link>
                                  <button
                                    onClick={() => setMemberToRemove(member)}
                                    className="p-2 rounded-xl bg-white/5 border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all"
                                    title="فصل عن العائلة"
                                  >
                                    <UserMinus className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab content 2: Aggregated Invoices */}
            {activeTab === "invoices" && (
              <div className="space-y-6">
                <h2 className="text-xl font-black text-white">فواتير أفراد العائلة</h2>

                {isLoadingInvoices ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="glass-card py-20 text-center flex flex-col items-center justify-center border-dashed border-white/10">
                    <Receipt className="w-12 h-12 text-muted-foreground/30 mb-4" />
                    <p className="text-sm font-bold text-muted-foreground">لا توجد فواتير مسجلة لأي من أفراد العائلة.</p>
                  </div>
                ) : (
                  <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-start border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.01]">
                            <th className="px-6 py-4 text-start text-xs font-black uppercase tracking-widest text-muted-foreground">رقم الفاتورة</th>
                            <th className="px-6 py-4 text-start text-xs font-black uppercase tracking-widest text-muted-foreground">العضو</th>
                            <th className="px-6 py-4 text-start text-xs font-black uppercase tracking-widest text-muted-foreground">التاريخ</th>
                            <th className="px-6 py-4 text-start text-xs font-black uppercase tracking-widest text-muted-foreground">المبلغ الإجمالي</th>
                            <th className="px-6 py-4 text-start text-xs font-black uppercase tracking-widest text-muted-foreground">حالة الفاتورة</th>
                            <th className="px-6 py-4 text-center text-xs font-black uppercase tracking-widest text-muted-foreground">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {invoices.map((invoice) => {
                            const isOverdue = isInvoiceOverdue(invoice.status, invoice.due_date);
                            return (
                              <tr key={invoice.id} className="hover:bg-white/[0.01] transition-colors">
                                <td className="px-6 py-4 font-mono font-bold text-white text-xs">{invoice.invoice_number}</td>
                                <td className="px-6 py-4">
                                  <Link href={`/dashboard/students/${invoice.student_id}`} className="font-black text-white hover:text-primary transition-colors text-sm">
                                    {invoice.student_name}
                                  </Link>
                                </td>
                                <td className="px-6 py-4 text-xs font-bold text-muted-foreground">{formatDate(invoice.created_at)}</td>
                                <td className="px-6 py-4 font-black text-white text-sm">{formatCurrency(invoice.total_amount, invoice.currency)}</td>
                                <td className="px-6 py-4">
                                  <span className={cn(
                                    "px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider",
                                    invoice.status === "paid" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                    invoice.status === "void" ? "bg-white/5 text-muted-foreground border-white/10" :
                                    isOverdue ? "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse" :
                                    "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                  )}>
                                    {invoice.status === "paid" ? "مدفوعة" :
                                     invoice.status === "void" ? "ملغاة" :
                                     isOverdue ? "متأخرة" : "معلقة"}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <Link
                                    href={`/dashboard/billing/invoices/${invoice.id}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-white/10 hover:border-white/20 transition-all"
                                  >
                                    <Receipt className="w-3.5 h-3.5" />
                                    عرض الفاتورة
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <FamilyFormDialog
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        existing={family}
      />

      {/* Add Member Dialog */}
      <AddMemberDialog
        family={family}
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
      />

      {/* Delete Family Confirmation */}
      {isDeleteModalOpen && (
        <Modal open={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)}>
          <ModalHeader
            title="حذف العائلة"
            subtitle={family.name}
            onClose={() => setIsDeleteModalOpen(false)}
          />
          <ModalBody>
            <p className="text-sm text-muted-foreground leading-relaxed text-start">
              هل أنت متأكد من رغبتك في حذف ملف هذه العائلة بشكل نهائي؟ 
              <br />
              <strong className="text-white">ملاحظة:</strong> لن يتم حذف الطلاب المرتبطين بالعائلة، بل سيتم فصلهم عنها فقط. لا يمكن التراجع عن هذا الإجراء.
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

      {/* Remove Member Confirmation */}
      {memberToRemove && (
        <Modal open={!!memberToRemove} onClose={() => setMemberToRemove(null)}>
          <ModalHeader
            title="فصل العضو عن العائلة"
            subtitle={memberToRemove.full_name}
            onClose={() => setMemberToRemove(null)}
          />
          <ModalBody>
            <p className="text-sm text-muted-foreground leading-relaxed text-start">
              هل أنت متأكد من رغبتك في فصل الطالب <span className="text-white font-bold">{memberToRemove.full_name}</span> عن عائلة <span className="text-white font-bold">{family.name}</span>؟
            </p>
          </ModalBody>
          <ModalFooter>
            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={removeMemberMutation.isPending}
                onClick={() => removeMemberMutation.mutate(memberToRemove.id)}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {removeMemberMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                تأكيد الفصل
              </button>
            </div>
          </ModalFooter>
        </Modal>
      )}
    </PermissionGuard>
  );
}
