"use client";
import React from "react";
import { ShieldCheck, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";
import { StaffMember, StaffPermissions, UserRole } from "@/types";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";

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
    group: "عرض المالية",
    flags: [
      { id: "can_view_billing",   label: "عرض الفواتير والمدفوعات", description: "الاطلاع على الفواتير وسجل المدفوعات دون أي صلاحية تعديل" },
      { id: "can_manage_billing", label: "الوصول لإدارة الباقات",   description: "عرض وإدارة باقات الاشتراك المتاحة في المنصة (لا تشمل تعديل الفواتير الفردية)" },
    ],
  },
  {
    group: "إجراءات الفواتير",
    flags: [
      { id: "can_create_invoice",    label: "إنشاء فاتورة يدوية",       description: "إصدار فاتورة جديدة يدوياً (مثل رسوم إضافية أو معدات)" },
      { id: "can_mark_invoice_paid", label: "تأكيد استلام الدفع",        description: "تغيير حالة فاتورة قائمة إلى «مدفوعة» عند استلام الدفع نقداً أو تحويلاً" },
      { id: "can_apply_discount",    label: "تطبيق خصم على فاتورة",      description: "إضافة خصم بنسبة أو مبلغ ثابت قبل إصدار أو إرسال الفاتورة" },
      { id: "can_void_invoice",      label: "إلغاء فاتورة (Void)",        description: "إلغاء فاتورة غير مدفوعة نهائياً — لا يمكن التراجع عن هذا الإجراء" },
    ],
  },
  {
    group: "إدارة الاشتراكات",
    flags: [
      { id: "can_renew_subscription",  label: "تجديد أو إنشاء اشتراك",     description: "ربط طالب بباقة جديدة أو تجديد اشتراكه الحالي" },
      { id: "can_change_subscription", label: "تغيير باقة الطالب",           description: "تحويل الطالب من باقة نشطة إلى باقة مختلفة" },
      { id: "can_approve_subscription",label: "الموافقة على طلبات التجديد", description: "قبول طلبات الاشتراك أو التجديد المعلقة التي تحتاج موافقة مسؤول" },
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
  {
    group: "إعدادات الأكاديمية",
    flags: [
      { id: "can_manage_academy",  label: "إعدادات الأكاديمية", description: "تعديل المعلومات العامة والمنطقة الزمنية والعملة" },
      { id: "can_manage_branding", label: "الهوية البصرية",     description: "تعديل شعار وأيقونة النادي" },
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
    <Modal open onClose={onClose} size="md">
      <ModalHeader
        icon={<ShieldCheck className="w-5 h-5" />}
        title="صلاحيات الموظف"
        subtitle={`${staff.full_name} · ${ROLE_LABELS[staff.role] ?? staff.role}`}
        onClose={onClose}
      />

      <ModalBody>
        {isPrivileged ? (
          <div className="py-10 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <p className="font-bold text-amber-500">هذا المستخدم لديه كامل الصلاحيات</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              بصفته مالكاً للأكاديمية أو مديراً للمنصة، لا يمكن تقييد صلاحياته من هنا.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              حدد المميزات والأقسام التي يمكن للموظف الوصول إليها:
            </p>

            {PERMISSION_GROUPS.map((group) => (
              <div key={group.group} className="space-y-2.5">
                {/* Section label */}
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border/40" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                    {group.group}
                  </span>
                  <div className="h-px flex-1 bg-border/40" />
                </div>

                {group.flags.map((flag) => {
                  const isActive = staff.permissions?.[flag.id] === true;
                  return (
                    <button
                      key={flag.id}
                      type="button"
                      onClick={() => onToggle(flag.id)}
                      className={cn(
                        "w-full flex items-start gap-3.5 px-4 py-3.5 rounded-xl border text-end transition-all duration-150 group relative overflow-hidden",
                        isActive
                          ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                          : "bg-secondary/10 border-border/40 hover:border-primary/20 hover:bg-secondary/20"
                      )}
                    >
                      {/* Active accent stripe */}
                      {isActive && <div className="absolute top-0 end-0 w-1 h-full bg-primary rounded-e-xl" />}

                      {/* Checkbox */}
                      <div
                        className={cn(
                          "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
                          isActive
                            ? "bg-primary border-primary text-white"
                            : "border-muted-foreground/30 group-hover:border-primary/40"
                        )}
                      >
                        {isActive && <ShieldCheck className="w-3 h-3" />}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-semibold transition-colors",
                          isActive ? "text-primary" : "text-foreground"
                        )}>
                          {flag.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {flag.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
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
          {!isPrivileged && (
            <button
              type="button"
              onClick={() => onSave(staff.id, staff.permissions)}
              disabled={isPending}
              className="flex-1 py-3 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ التغييرات
            </button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
}
