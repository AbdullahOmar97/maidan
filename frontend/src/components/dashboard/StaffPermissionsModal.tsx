"use client";
import React from "react";
import { ShieldCheck, X, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";
import { StaffMember, StaffPermissions, UserRole } from "@/types";

type PermissionFlag = { id: string; label: string; description: string };
type PermissionGroup = { group: string; flags: PermissionFlag[] };

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: "الطلاب",
    flags: [
      { id: "can_manage_students", label: "إدارة الطلاب", description: "إضافة وتعديل وحذف بيانات الطلاب" },
    ],
  },
  {
    // Access tier — what the user can see
    group: "عرض المالية",
    flags: [
      {
        id: "can_view_billing",
        label: "عرض الفواتير والمدفوعات",
        description: "الاطلاع على الفواتير وسجل المدفوعات دون أي صلاحية تعديل",
      },
      {
        id: "can_manage_billing",
        label: "الوصول لإدارة الباقات",
        description: "عرض وإدارة باقات الاشتراك المتاحة في المنصة (لا تشمل تعديل الفواتير الفردية)",
      },
    ],
  },
  {
    // Invoice actions — what the user can do with invoices
    group: "إجراءات الفواتير",
    flags: [
      {
        id: "can_create_invoice",
        label: "إنشاء فاتورة يدوية",
        description: "إصدار فاتورة جديدة يدوياً (مثل رسوم إضافية أو معدات)",
      },
      {
        id: "can_mark_invoice_paid",
        label: "تأكيد استلام الدفع",
        description: "تغيير حالة فاتورة قائمة إلى «مدفوعة» عند استلام الدفع نقداً أو تحويلاً",
      },
      {
        id: "can_apply_discount",
        label: "تطبيق خصم على فاتورة",
        description: "إضافة خصم بنسبة أو مبلغ ثابت قبل إصدار أو إرسال الفاتورة",
      },
      {
        id: "can_void_invoice",
        label: "إلغاء فاتورة (Void)",
        description: "إلغاء فاتورة غير مدفوعة نهائياً — لا يمكن التراجع عن هذا الإجراء",
      },
    ],
  },
  {
    // Subscription management — membership lifecycle actions
    group: "إدارة الاشتراكات",
    flags: [
      {
        id: "can_renew_subscription",
        label: "تجديد أو إنشاء اشتراك",
        description: "ربط طالب بباقة جديدة أو تجديد اشتراكه الحالي",
      },
      {
        id: "can_change_subscription",
        label: "تغيير باقة الطالب",
        description: "تحويل الطالب من باقة نشطة إلى باقة مختلفة",
      },
      {
        id: "can_approve_subscription",
        label: "الموافقة على طلبات التجديد",
        description: "قبول طلبات الاشتراك أو التجديد المعلقة التي تحتاج موافقة مسؤول",
      },
    ],
  },
  {
    group: "التشغيل والإدارة",
    flags: [
      { id: "can_manage_schedules", label: "إدارة الجداول",    description: "تعديل المواعيد والحصص التدريبية" },
      { id: "can_manage_locations", label: "إدارة الفروع",      description: "إضافة وتعديل وحذف بيانات الفروع" },
      { id: "can_view_reports",     label: "عرض التقارير",      description: "الاطلاع على تقارير الأداء والنمو" },
      { id: "can_manage_staff",     label: "إدارة فريق العمل", description: "تعديل بيانات وصلاحيات الموظفين" },
    ],
  },
];

const PRIVILEGED_ROLES: UserRole[] = ["tenant_owner", "platform_admin"];

interface StaffPermissionsModalProps {
  staff: StaffMember;
  isPending: boolean;
  onClose: () => void;
  onToggle: (flagId: string) => void;
  onSave: (id: string, permissions: StaffPermissions) => void;
}

export function StaffPermissionsModal({
  staff,
  isPending,
  onClose,
  onToggle,
  onSave,
}: StaffPermissionsModalProps) {
  const isPrivileged = PRIVILEGED_ROLES.includes(staff.role);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl glass-card p-0 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-border/50 flex items-center justify-between bg-secondary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">صلاحيات الموظف</h2>
              <p className="text-xs text-muted-foreground">
                {staff.full_name} • {ROLE_LABELS[staff.role] ?? staff.role}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6 custom-scrollbar">
          {isPrivileged ? (
            <div className="py-8 text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 mb-2">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <p className="font-bold text-amber-500">هذا المستخدم لديه كامل الصلاحيات</p>
              <p className="text-sm text-muted-foreground px-8">
                بصفته مالكاً للأكاديمية أو مديراً للمنصة، لا يمكن تقييد صلاحياته من هنا.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground px-1 leading-relaxed">
                حدد المميزات والأقسام التي يمكن للموظف الوصول إليها:
              </p>
              <div className="space-y-8">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.group} className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <div className="h-px flex-1 bg-border/50" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                        {group.group}
                      </p>
                      <div className="h-px flex-1 bg-border/50" />
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {group.flags.map((flag) => {
                        const isActive = staff.permissions?.[flag.id] === true;
                        return (
                          <button
                            key={flag.id}
                            onClick={() => onToggle(flag.id)}
                            className={cn(
                              "flex items-start gap-4 p-4 rounded-2xl border text-right transition-all duration-200 group relative overflow-hidden",
                              isActive
                                ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20 shadow-sm shadow-primary/5"
                                : "bg-secondary/10 border-border/50 hover:border-primary/30 hover:bg-secondary/20"
                            )}
                          >
                            {isActive && <div className="absolute top-0 right-0 w-1 h-full bg-primary" />}
                            <div className={cn(
                              "w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200",
                              isActive
                                ? "bg-primary border-primary text-white scale-110"
                                : "border-muted-foreground/20 bg-background group-hover:border-primary/40"
                            )}>
                              {isActive && <ShieldCheck className="w-4 h-4" />}
                            </div>
                            <div className="flex-1">
                              <p className={cn("font-bold text-[13px] transition-colors", isActive ? "text-primary" : "text-foreground")}>
                                {flag.label}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{flag.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-secondary/20 border-t border-border/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-border hover:bg-secondary transition-all font-medium">
            إلغاء
          </button>
          {!isPrivileged && (
            <button
              onClick={() => onSave(staff.id, staff.permissions)}
              disabled={isPending}
              className="px-8 py-2.5 rounded-xl gradient-brand text-white font-bold hover:opacity-90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              حفظ التغييرات
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
