"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api/client";
import {
  UsersRound, ArrowRight, Phone, Mail, MapPin, Shield, ShieldCheck,
  Lock, Pencil, DollarSign, Coins, FileText, Receipt, Calendar, Loader2,
  CheckCircle2, Clock, Plus, Download, Trash2, ExternalLink, Save,
  AlertCircle, AlertTriangle, Check, UserCheck, UserX, Landmark
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";
import { useTenant } from "@/lib/providers/tenant-provider";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import { EditStaffModal } from "@/components/dashboard/EditStaffModal";
import {
  StaffPermissionsModal,
  PERMISSION_GROUPS,
  type PermissionGroup
} from "@/components/dashboard/StaffPermissionsModal";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, ErrorBanner } from "@/components/ui/form-field";
import type {
  StaffMember, Location, PaginatedResponse, UserRole,
  StaffPermissions, StaffAdvance, StaffDocument
} from "@/types";

interface SalaryConfig {
  id: number;
  staff_member: number;
  staff_name: string;
  staff_email: string;
  staff_role: string;
  employment_type: "full_time" | "part_time" | "session_based";
  basic_salary: string;
  hourly_rate: string;
  session_rate: string;
  currency: string;
}

interface StaffPayslip {
  id: number;
  payroll_run: number;
  payroll_year?: number;
  payroll_month?: number;
  staff_member: number;
  staff_name: string;
  employment_type: string;
  basic_salary: string;
  calculated_units: string;
  unit_rate: string;
  allowances: string;
  deductions: string;
  advance_deductions?: string;
  net_salary: string;
  status: "pending" | "paid";
  payment_date?: string;
  payment_method: string;
  notes: string;
  created_at: string;
}

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const tenantCurrency = tenant?.default_currency || "JOD";
  const { data: session } = useSession();

  const staffId = String(params.id);

  // Tab State
  const [activeTab, setActiveTab] = useState<"overview" | "compensation" | "advances" | "documents" | "payslips">("overview");

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [isNewAdvanceOpen, setIsNewAdvanceOpen] = useState(false);

  // Form states
  const [docForm, setDocForm] = useState({ name: "", notes: "", file: null as File | null });
  const [advanceForm, setAdvanceForm] = useState({
    amount: "",
    reason: "",
    repayment_type: "single" as "single" | "installment",
    installments_count: "2",
  });

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------
  const { data: staff, isLoading: isStaffLoading, error: staffError } = useQuery<StaffMember>({
    queryKey: ["staff", "detail", staffId],
    queryFn: () => api.staff.get(staffId).then((r: any) => r.data),
  });

  const { data: locationsData } = useQuery<PaginatedResponse<Location>>({
    queryKey: ["locations", "list"],
    queryFn: () => api.locations.list().then((r: any) => r.data),
  });
  const locations: Location[] = locationsData?.results ?? [];

  // Salary Configuration for this employee
  const { data: salaryConfigs, isLoading: isConfigLoading } = useQuery<SalaryConfig[]>({
    queryKey: ["staff", "salary-config", staffId],
    queryFn: () => api.staff.salaryConfigs.list({ user_id: staffId }).then((r: any) => r.data.results || r.data),
  });
  const salaryConfig = salaryConfigs?.[0] || null;

  // Local state for editing salary config
  const [configForm, setConfigForm] = useState<Partial<SalaryConfig> | null>(null);

  // Sync configForm when salaryConfig loads
  React.useEffect(() => {
    if (salaryConfig) {
      setConfigForm({
        employment_type: salaryConfig.employment_type,
        basic_salary: salaryConfig.basic_salary,
        hourly_rate: salaryConfig.hourly_rate,
        session_rate: salaryConfig.session_rate,
        currency: salaryConfig.currency || tenantCurrency,
      });
    }
  }, [salaryConfig, tenantCurrency]);

  // Advances for this employee
  const { data: advancesData, isLoading: isAdvancesLoading } = useQuery<PaginatedResponse<StaffAdvance> | StaffAdvance[]>({
    queryKey: ["staff", "advances", staffId],
    queryFn: () => api.staff.advances.list({ user_id: staffId }).then((r: any) => r.data),
  });
  const advancesList: StaffAdvance[] = Array.isArray(advancesData)
    ? advancesData
    : advancesData?.results || [];

  // Documents for this employee
  const { data: documentsData, isLoading: isDocsLoading } = useQuery<StaffDocument[]>({
    queryKey: ["staff", "documents", staffId],
    queryFn: () => api.staff.documents.list({ user_id: staffId }).then((r: any) => r.data.results || r.data),
  });
  const documentsList: StaffDocument[] = documentsData || [];

  // Payslips for this employee
  const { data: payslipsData, isLoading: isPayslipsLoading } = useQuery<PaginatedResponse<StaffPayslip> | StaffPayslip[]>({
    queryKey: ["staff", "payslips", staffId],
    queryFn: () => api.staff.payslips.list({ user_id: staffId }).then((r: any) => r.data),
  });
  const payslipsList: StaffPayslip[] = Array.isArray(payslipsData)
    ? payslipsData
    : payslipsData?.results || [];

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------
  const updateStaffMutation = useMutation({
    mutationFn: (updated: StaffMember) => api.staff.update(updated.id, updated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "detail", staffId] });
      queryClient.invalidateQueries({ queryKey: ["staff", "list"] });
      setIsEditModalOpen(false);
      toast.success("تم تحديث بيانات الموظف بنجاح ✓");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "تعذر تحديث بيانات الموظف");
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: (permissions: StaffPermissions) => api.staff.update(staffId, { permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "detail", staffId] });
      queryClient.invalidateQueries({ queryKey: ["staff", "list"] });
      setIsPermissionsModalOpen(false);
      toast.success("تم حفظ الصلاحيات بنجاح ✓");
    },
    onError: () => {
      toast.error("تعذر تحديث الصلاحيات");
    },
  });

  const saveSalaryConfigMutation = useMutation({
    mutationFn: (data: Partial<SalaryConfig>) => {
      if (!salaryConfig) throw new Error("No salary config found");
      return api.staff.salaryConfigs.update(salaryConfig.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "salary-config", staffId] });
      toast.success("تم حفظ إعدادات وسُلم الراتب بنجاح ✓");
    },
    onError: () => {
      toast.error("فشل حفظ إعدادات الراتب");
    },
  });

  const uploadDocMutation = useMutation({
    mutationFn: (formData: FormData) => api.staff.documents.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "documents", staffId] });
      setIsUploadDocOpen(false);
      setDocForm({ name: "", notes: "", file: null });
      toast.success("تم رفع المستند بنجاح ✓");
    },
    onError: () => toast.error("تعذر رفع المستند. يرجى التحقق من حجم وصيغة الملف."),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: number) => api.staff.documents.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "documents", staffId] });
      toast.success("تم حذف المستند بنجاح");
    },
    onError: () => toast.error("تعذر حذف المستند"),
  });

  const createAdvanceMutation = useMutation({
    mutationFn: (data: any) => api.staff.advances.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "advances", staffId] });
      setIsNewAdvanceOpen(false);
      setAdvanceForm({ amount: "", reason: "", repayment_type: "single", installments_count: "2" });
      toast.success("تم تسجيل طلب السلفة بنجاح ✓");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "فشل تسجيل طلب السلفة");
    },
  });

  // Calculate advance metrics
  const advanceStats = useMemo(() => {
    let totalDisbursed = 0;
    let totalRepaid = 0;
    let totalRemaining = 0;
    for (const adv of advancesList) {
      if (adv.status === "disbursed" || adv.status === "approved" || adv.status === "repaid") {
        totalDisbursed += Number(adv.amount || 0);
        totalRepaid += Number(adv.total_repaid || 0);
        totalRemaining += Number(adv.remaining_amount || 0);
      }
    }
    return { totalDisbursed, totalRepaid, totalRemaining };
  }, [advancesList]);

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.file || !docForm.name.trim()) {
      toast.error("يرجى كتابة اسم المستند وتحديد الملف");
      return;
    }
    const formData = new FormData();
    formData.append("name", docForm.name.trim());
    formData.append("file", docForm.file);
    formData.append("notes", docForm.notes.trim());
    formData.append("staff_member", staff?.staff_member_id ? String(staff.staff_member_id) : staffId);

    uploadDocMutation.mutate(formData);
  };

  const handleAdvanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(advanceForm.amount);
    if (!amountNum || amountNum <= 0) {
      toast.error("يرجى إدخال مبلغ صالح للسلفة");
      return;
    }
    createAdvanceMutation.mutate({
      staff_member: staff?.staff_member_id ? staff.staff_member_id : staffId,
      amount: amountNum,
      currency: salaryConfig?.currency || tenantCurrency,
      reason: advanceForm.reason.trim(),
      repayment_type: advanceForm.repayment_type,
      installments_count: advanceForm.repayment_type === "installment" ? parseInt(advanceForm.installments_count) || 2 : 1,
    });
  };

  if (isStaffLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground">جارٍ تحميل ملف الموظف...</p>
      </div>
    );
  }

  if (staffError || !staff) {
    return (
      <div className="p-8 text-center glass-card max-w-md mx-auto my-12 space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-black text-white">لم يتم العثور على الموظف</h2>
        <p className="text-xs text-muted-foreground">قد يكون تم حذفه أو أن المعرّف المدخل غير صحيح.</p>
        <Link
          href="/dashboard/staff"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-black"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لفريق العمل</span>
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "نظرة عامة والصلاحيات", icon: ShieldCheck },
    { id: "compensation", label: "الراتب والتعويضات", icon: DollarSign },
    { id: "advances", label: "السلف والخصومات", icon: Coins, count: advancesList.length },
    { id: "documents", label: "الملفات والعقود", icon: FileText, count: documentsList.length },
    { id: "payslips", label: "قسائم الرواتب", icon: Receipt, count: payslipsList.length },
  ];

  return (
    <PermissionGuard permission="can_manage_staff">
      <div className="space-y-6 md:space-y-8 pb-16">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/staff"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-black text-muted-foreground hover:text-white hover:bg-white/[0.08] transition-all group"
          >
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            <span>العودة لدليل فريق العمل</span>
          </Link>
          <div className="flex items-center gap-2">
            <StatusBadge status={staff.is_active ? "active" : "inactive"} />
          </div>
        </div>

        {/* ── Main Profile Header ── */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.08] backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-secondary/80 border border-white/10 flex items-center justify-center font-black text-2xl text-white shadow-xl overflow-hidden shrink-0">
                {staff.avatar_url ? (
                  <img src={staff.avatar_url} className="w-full h-full object-cover" alt={staff.full_name} />
                ) : (
                  <span>{staff.first_name?.charAt(0) || "U"}</span>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{staff.full_name}</h1>
                  <span className="px-3 py-1 rounded-full text-xs font-black border bg-primary/15 border-primary/30 text-primary">
                    {ROLE_LABELS[staff.role] ?? staff.role}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-bold">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                    <span>{staff.email}</span>
                  </div>
                  {staff.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                      <span dir="ltr">{staff.phone}</span>
                    </div>
                  )}
                  {staff.branch_names && staff.branch_names.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                      <span>{staff.branch_names.join("، ")}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-black text-white transition-all active:scale-95"
              >
                <Pencil className="w-3.5 h-3.5 text-primary" />
                <span>تعديل البيانات</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPermissionsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/30 text-xs font-black text-primary transition-all active:scale-95"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>إدارة الصلاحيات</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Tabs Navigation ── */}
        <div className="p-1.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex flex-wrap sm:flex-nowrap gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all relative group",
                  isActive
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "scale-110" : "opacity-60")} />
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={cn(
                    "ms-1 px-2 py-0.5 rounded-full text-[10px] font-black font-mono",
                    isActive ? "bg-white/20 text-white" : "bg-white/10 text-muted-foreground"
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content Areas ── */}
        <div className="min-h-[400px]">
          {/* 1. OVERVIEW & PERMISSIONS */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Profile Card */}
                <div className="glass-card p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <UsersRound className="w-4 h-4 text-primary" />
                      <span>بيانات الموظف الأساسية</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px] mb-1">الاسم الكامل</span>
                      <p className="font-bold text-white">{staff.full_name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px] mb-1">الدور الوظيفي</span>
                      <p className="font-bold text-primary">{ROLE_LABELS[staff.role] ?? staff.role}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px] mb-1">البريد الإلكتروني</span>
                      <p className="font-bold text-white break-all">{staff.email}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px] mb-1">رقم الهاتف</span>
                      <p className="font-bold text-white" dir="ltr">{staff.phone || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px] mb-1">لغة الواجهة</span>
                      <p className="font-bold text-white">{staff.language_pref === "en" ? "الإنجليزية" : "العربية"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px] mb-1">الفروع المعينة</span>
                      <p className="font-bold text-white">{staff.branch_names?.length ? staff.branch_names.join(", ") : "جميع الفروع"}</p>
                    </div>
                  </div>
                </div>

                {/* Account & Security Summary */}
                <div className="glass-card p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <span>حالة الحساب والأمان</span>
                    </h3>
                    <StatusBadge status={staff.is_active ? "active" : "inactive"} />
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                      <span className="text-muted-foreground">حالة الحساب</span>
                      <span className="font-bold text-white">{staff.is_active ? "نشط ومتاح لتسجيل الدخول" : "معطل (لا يمكنه الدخول)"}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                      <span className="text-muted-foreground">تاريخ الانضمام</span>
                      <span className="font-mono text-white">{staff.created_at ? formatDate(staff.created_at) : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-muted-foreground">آخر تسجيل دخول</span>
                      <span className="font-mono text-white">{staff.last_login ? formatDate(staff.last_login) : "لم يسجل الدخول بعد"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active System Permissions List */}
              <div className="glass-card p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      <span>صلاحيات النظام الممنوحة للموظف</span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      الصلاحيات المحددة تحدد الأقسام التي يمكن للموظف إدارتها أو الاطلاع عليها.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPermissionsModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-black text-primary border border-primary/20"
                  >
                    تعديل الصلاحيات
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {PERMISSION_GROUPS.map((grp) => (
                    <div key={grp.group} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-2">
                      <h4 className="text-xs font-black text-primary/90">{grp.group}</h4>
                      <div className="space-y-1.5">
                        {grp.flags.map((flag) => {
                          const isEnabled = staff.permissions?.[flag.id] === true;
                          return (
                            <div key={flag.id} className="flex items-start gap-2 text-xs">
                              {isEnabled ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-white/20 mt-0.5 shrink-0" />
                              )}
                              <div>
                                <p className={cn("font-bold", isEnabled ? "text-white" : "text-muted-foreground/50")}>
                                  {flag.label}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. COMPENSATION & PAY RATES */}
          {activeTab === "compensation" && (
            <div className="glass-card p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    <span>سُلم الرواتب والأجور للموظف</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    حدد نوع التوظيف (شهري، بالساعة، بالحصة) وقيم الأجور المعتمدة لاحتساب المسيرات الشهرية تلقائياً.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => configForm && saveSalaryConfigMutation.mutate(configForm)}
                  disabled={saveSalaryConfigMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition-all active:scale-95 disabled:opacity-50"
                >
                  {saveSalaryConfigMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>حفظ إعدادات الراتب</span>
                </button>
              </div>

              {isConfigLoading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : !configForm ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  لم يتم ضبط إعدادات الراتب بعد لهذا الموظف.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white block">نوع التوظيف وطريقة الاحتساب</label>
                    <select
                      value={configForm.employment_type || "full_time"}
                      onChange={(e) => setConfigForm({ ...configForm, employment_type: e.target.value as any })}
                      className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border/80 text-white text-sm font-bold focus:border-primary focus:outline-none"
                    >
                      <option value="full_time">دوام كامل (راتب شهري ثابت)</option>
                      <option value="part_time">دوام جزئي (أجر بالساعة)</option>
                      <option value="session_based">مدرب بنظام الحصة / الكلاس (Session-Based)</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      في مسير الرواتب، يُصرف الراتب الأساسي للدوام الكامل، بينما يُضرب أجر الحصة/الساعة بعدد الساعات أو الحصص المحضورة.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white block">عملة الراتب</label>
                    <select
                      value={configForm.currency || tenantCurrency}
                      onChange={(e) => setConfigForm({ ...configForm, currency: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border/80 text-white text-sm font-bold focus:border-primary focus:outline-none"
                    >
                      <option value="JOD">JOD</option>
                      <option value="SAR">SAR</option>
                      <option value="AED">AED</option>
                      <option value="KWD">KWD</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white block">الراتب الأساسي الشهري (Fixed Base Salary)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={configForm.basic_salary ?? ""}
                        onChange={(e) => setConfigForm({ ...configForm, basic_salary: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-4 py-3 pe-14 rounded-xl bg-background/50 border border-border/80 text-white text-sm font-mono font-bold focus:border-primary focus:outline-none"
                      />
                      <span className="absolute end-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                        {configForm.currency || tenantCurrency}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white block">سعر الحصة / الكلاس (للمدربين)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={configForm.session_rate ?? ""}
                        onChange={(e) => setConfigForm({ ...configForm, session_rate: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-4 py-3 pe-14 rounded-xl bg-background/50 border border-border/80 text-white text-sm font-mono font-bold focus:border-primary focus:outline-none"
                      />
                      <span className="absolute end-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                        {configForm.currency || tenantCurrency}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-white block">سعر ساعة العمل الإضافي / الدوام الجزئي (Hourly Rate)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={configForm.hourly_rate ?? ""}
                        onChange={(e) => setConfigForm({ ...configForm, hourly_rate: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-4 py-3 pe-14 rounded-xl bg-background/50 border border-border/80 text-white text-sm font-mono font-bold focus:border-primary focus:outline-none"
                      />
                      <span className="absolute end-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                        {configForm.currency || tenantCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. ADVANCES & REPAYMENTS */}
          {activeTab === "advances" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Advances Summary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-card p-5 space-y-1 border-primary/20">
                  <span className="text-xs font-bold text-muted-foreground">إجمالي السلف المصروفة</span>
                  <p className="text-xl font-black text-white font-mono">
                    {formatCurrency(advanceStats.totalDisbursed, salaryConfig?.currency || tenantCurrency)}
                  </p>
                </div>
                <div className="glass-card p-5 space-y-1 border-emerald-500/20">
                  <span className="text-xs font-bold text-muted-foreground">إجمالي المسدد</span>
                  <p className="text-xl font-black text-emerald-400 font-mono">
                    {formatCurrency(advanceStats.totalRepaid, salaryConfig?.currency || tenantCurrency)}
                  </p>
                </div>
                <div className="glass-card p-5 space-y-1 border-amber-500/20">
                  <span className="text-xs font-bold text-muted-foreground">المتبقي على الموظف (الرصيد القائم)</span>
                  <p className="text-xl font-black text-amber-400 font-mono">
                    {formatCurrency(advanceStats.totalRemaining, salaryConfig?.currency || tenantCurrency)}
                  </p>
                </div>
              </div>

              {/* Advances Table Card */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span>سجل سلف الموظف ({advancesList.length})</span>
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNewAdvanceOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-black transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>طلب سلفة جديدة للموظف</span>
                  </button>
                </div>

                {isAdvancesLoading ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : advancesList.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    لا توجد سلف مسجلة لهذا الموظف حتى الآن.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-white/[0.03] text-muted-foreground font-bold">
                        <tr>
                          <th className="px-4 py-3 text-start">رقم السلفة</th>
                          <th className="px-4 py-3 text-start">المبلغ</th>
                          <th className="px-4 py-3 text-start">المتبقي</th>
                          <th className="px-4 py-3 text-start">تاريخ الطلب</th>
                          <th className="px-4 py-3 text-start">نوع السداد</th>
                          <th className="px-4 py-3 text-start">الحالة</th>
                          <th className="px-4 py-3 text-start">السبب</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {advancesList.map((adv) => (
                          <tr key={adv.id} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3 font-mono font-bold text-white">#{adv.id}</td>
                            <td className="px-4 py-3 font-mono font-black text-white">
                              {formatCurrency(Number(adv.amount), adv.currency || tenantCurrency)}
                            </td>
                            <td className="px-4 py-3 font-mono font-black text-amber-400">
                              {formatCurrency(Number(adv.remaining_amount), adv.currency || tenantCurrency)}
                            </td>
                            <td className="px-4 py-3 font-mono text-muted-foreground">
                              {adv.request_date ? formatDate(adv.request_date) : "—"}
                            </td>
                            <td className="px-4 py-3 font-bold text-white">
                              {adv.repayment_type_display || (adv.repayment_type === "single" ? "خصم كامل من الراتب" : `أقساط (${adv.installments_count})`)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-white/5 border-white/10 text-white">
                                {adv.status_display || adv.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">
                              {adv.reason || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. DOCUMENTS & CONTRACTS */}
          {activeTab === "documents" && (
            <div className="glass-card p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <span>ملفات وعقود الموظف ({documentsList.length})</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    عقد العمل، الهوية الوطنية، السيرة الذاتية، الشهادات والدورات التدريبية.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUploadDocOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-brand text-white text-xs font-black transition-all active:scale-95 shadow-md shadow-primary/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>رفع مستند جديد</span>
                </button>
              </div>

              {isDocsLoading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : documentsList.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  لا توجد مستندات أو عقود مرفوعة لهذا الموظف بعد.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documentsList.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-white truncate">{doc.name}</h4>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            {formatDate(doc.uploaded_at)}
                            {doc.file_size ? ` • ${(doc.file_size / 1024).toFixed(0)} KB` : ""}
                          </p>
                          {doc.notes && <p className="text-[11px] text-muted-foreground/80 mt-1 truncate">{doc.notes}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={doc.file}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-primary transition-all"
                          title="فتح / تحميل الملف"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف المستند "${doc.name}"؟`)) {
                              deleteDocMutation.mutate(doc.id);
                            }
                          }}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all"
                          title="حذف المستند"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. PAYSLIPS HISTORY */}
          {activeTab === "payslips" && (
            <div className="glass-card p-6 sm:p-8 space-y-4 animate-in fade-in duration-200">
              <div className="border-b border-white/[0.08] pb-4">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  <span>سجل قسائم الرواتب الشهرية ({payslipsList.length})</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  جميع قسائم الرواتب الصادرة لهذا الموظف ضمن مسيرات الرواتب المعتمدة في النادي.
                </p>
              </div>

              {isPayslipsLoading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : payslipsList.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  لا توجد قسائم رواتب مسجلة لهذا الموظف حتى الآن.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-white/[0.03] text-muted-foreground font-bold">
                      <tr>
                        <th className="px-4 py-3 text-start">مسير الراتب</th>
                        <th className="px-4 py-3 text-start">الراتب الأساسي</th>
                        <th className="px-4 py-3 text-start">الحصص/الساعات</th>
                        <th className="px-4 py-3 text-start">البدلات</th>
                        <th className="px-4 py-3 text-start">الخصومات والسلف</th>
                        <th className="px-4 py-3 text-start">الصافي</th>
                        <th className="px-4 py-3 text-start">الحالة</th>
                        <th className="px-4 py-3 text-start">تاريخ الصرف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {payslipsList.map((slip) => (
                        <tr key={slip.id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-bold text-white">مسير #{slip.payroll_run}</td>
                          <td className="px-4 py-3 font-mono font-bold text-white">
                            {formatCurrency(Number(slip.basic_salary), salaryConfig?.currency || tenantCurrency)}
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">
                            {Number(slip.calculated_units) > 0 ? `${slip.calculated_units} وحدة` : "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-emerald-400 font-bold">
                            +{formatCurrency(Number(slip.allowances), salaryConfig?.currency || tenantCurrency)}
                          </td>
                          <td className="px-4 py-3 font-mono text-rose-400 font-bold">
                            -{formatCurrency(Number(slip.deductions) + Number(slip.advance_deductions || 0), salaryConfig?.currency || tenantCurrency)}
                          </td>
                          <td className="px-4 py-3 font-mono font-black text-white">
                            {formatCurrency(Number(slip.net_salary), salaryConfig?.currency || tenantCurrency)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-black border",
                              slip.status === "paid"
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                            )}>
                              {slip.status === "paid" ? "مدفوعة ✓" : "معلقة"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">
                            {slip.payment_date ? formatDate(slip.payment_date) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Modals ── */}
        {/* Edit Staff Modal */}
        {isEditModalOpen && (
          <EditStaffModal
            staff={staff}
            locations={locations}
            canAssignBranch={true}
            isPending={updateStaffMutation.isPending}
            onClose={() => setIsEditModalOpen(false)}
            onChange={() => {}}
            onSave={() => updateStaffMutation.mutate(staff)}
          />
        )}

        {/* Staff Permissions Modal */}
        {isPermissionsModalOpen && (
          <StaffPermissionsModal
            staff={staff}
            isPending={updatePermissionsMutation.isPending}
            onClose={() => setIsPermissionsModalOpen(false)}
            onToggle={(flagId) => {
              const current = staff.permissions || {};
              const next = { ...current, [flagId]: !current[flagId] };
              queryClient.setQueryData(["staff", "detail", staffId], { ...staff, permissions: next });
            }}
            onSave={(id, permissions) => updatePermissionsMutation.mutate(permissions)}
          />
        )}

        {/* Upload Document Modal */}
        {isUploadDocOpen && (
          <Modal open={isUploadDocOpen} onClose={() => setIsUploadDocOpen(false)}>
            <ModalHeader title={`رفع مستند للموظف: ${staff.full_name}`} onClose={() => setIsUploadDocOpen(false)} />
            <form onSubmit={handleUploadSubmit}>
              <ModalBody className="space-y-4">
                <FormField label="اسم أو نوع المستند" required>
                  <Input
                    value={docForm.name}
                    onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                    placeholder="مثال: عقد العمل 2026، الهوية الوطنية، شهادة الحزام الأسود"
                    required
                  />
                </FormField>

                <FormField label="الملف" required>
                  <input
                    type="file"
                    onChange={(e) => setDocForm({ ...docForm, file: e.target.files?.[0] || null })}
                    className="w-full text-xs text-muted-foreground file:ms-0 file:me-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-primary file:text-white hover:file:brightness-110"
                    required
                  />
                </FormField>

                <FormField label="ملاحظات إضافية">
                  <Input
                    value={docForm.notes}
                    onChange={(e) => setDocForm({ ...docForm, notes: e.target.value })}
                    placeholder="ملاحظات حول صلاحية المستند أو تفاصيله..."
                  />
                </FormField>
              </ModalBody>
              <ModalFooter>
                <button
                  type="button"
                  onClick={() => setIsUploadDocOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-white/5"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={uploadDocMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-black transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {uploadDocMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>رفع المستند</span>
                </button>
              </ModalFooter>
            </form>
          </Modal>
        )}

        {/* Create Advance Modal */}
        {isNewAdvanceOpen && (
          <Modal open={isNewAdvanceOpen} onClose={() => setIsNewAdvanceOpen(false)}>
            <ModalHeader title={`طلب سلفة جديدة للموظف: ${staff.full_name}`} onClose={() => setIsNewAdvanceOpen(false)} />
            <form onSubmit={handleAdvanceSubmit}>
              <ModalBody className="space-y-4">
                <FormField label="مبلغ السلفة المطلوب" required>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      value={advanceForm.amount}
                      onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                    <span className="absolute end-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      {salaryConfig?.currency || tenantCurrency}
                    </span>
                  </div>
                </FormField>

                <FormField label="طريقة السداد واستقطاع السلفة" required>
                  <select
                    value={advanceForm.repayment_type}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, repayment_type: e.target.value as any })}
                    className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border/80 text-white text-sm font-bold focus:border-primary focus:outline-none"
                  >
                    <option value="single">خصم كامل المبلغ من مسير الراتب القادم</option>
                    <option value="installment">سداد على أقساط شهرية متساوية</option>
                  </select>
                </FormField>

                {advanceForm.repayment_type === "installment" && (
                  <FormField label="عدد الأقساط الشهرية" required>
                    <Input
                      type="number"
                      min="2"
                      max="24"
                      value={advanceForm.installments_count}
                      onChange={(e) => setAdvanceForm({ ...advanceForm, installments_count: e.target.value })}
                    />
                  </FormField>
                )}

                <FormField label="سبب السلفة">
                  <Input
                    value={advanceForm.reason}
                    onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                    placeholder="ظرف طارئ، مصاريف علاجية، إلخ..."
                  />
                </FormField>
              </ModalBody>
              <ModalFooter>
                <button
                  type="button"
                  onClick={() => setIsNewAdvanceOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-white/5"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createAdvanceMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {createAdvanceMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>تسجيل السلفة</span>
                </button>
              </ModalFooter>
            </form>
          </Modal>
        )}
      </div>
    </PermissionGuard>
  );
}
