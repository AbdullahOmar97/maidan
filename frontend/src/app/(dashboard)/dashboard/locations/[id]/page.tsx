"use client";

import React, { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  ArrowRight, Building2, MapPin, Phone, Mail, Clock,
  Users, UserCheck, Shield, CheckCircle2, CircleOff, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";

type Location = {
  id: number;
  name: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  timezone: string;
  manager_id?: string;
  capacity: number;
  is_active: boolean;
};

type StaffMember = {
  id: string;
  email: string;
  phone?: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  is_active: boolean;
  avatar_url?: string;
  assigned_location_ids?: number[];
  permissions?: Record<string, boolean>;
};

const PERMISSION_LABELS: Record<string, string> = {
  can_manage_students: "إدارة الطلاب",
  can_view_billing: "عرض الفواتير",
  can_manage_billing: "إدارة الباقات",
  can_create_invoice: "إنشاء فاتورة",
  can_mark_invoice_paid: "تأكيد الدفع",
  can_apply_discount: "تطبيق خصم",
  can_void_invoice: "إلغاء فاتورة",
  can_renew_subscription: "تجديد اشتراك",
  can_change_subscription: "تغيير باقة",
  can_approve_subscription: "قبول تجديد",
  can_manage_schedules: "إدارة الجداول",
  can_manage_locations: "إدارة الفروع",
  can_view_reports: "عرض التقارير",
  can_manage_staff: "إدارة الموظفين",
  can_manage_academy: "إعدادات النادي",
  can_manage_branding: "الهوية البصرية",
};

export default function LocationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const locationId = Number(id);

  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  // Queries
  const { data: locationsResponse, isLoading: isLocationLoading, error: locationError } = useQuery<any>({
    queryKey: ["locations", "list"],
    queryFn: () => api.locations.list().then((r: any) => r.data),
  });

  const { data: staffResponse, isLoading: isStaffLoading } = useQuery<any>({
    queryKey: ["staff", "list"],
    queryFn: () => api.staff.list().then((r: any) => r.data),
  });

  // Extract location
  const location = useMemo<Location | null>(() => {
    const list = Array.isArray(locationsResponse)
      ? locationsResponse
      : locationsResponse?.results ?? [];
    return list.find((loc: any) => loc.id === locationId) || null;
  }, [locationsResponse, locationId]);

  // Extract staff list assigned to this location
  const assignedStaff = useMemo<StaffMember[]>(() => {
    if (!location) return [];
    const list = Array.isArray(staffResponse)
      ? staffResponse
      : staffResponse?.results ?? [];
    return list.filter((member: any) =>
      Array.isArray(member.assigned_location_ids) &&
      member.assigned_location_ids.includes(location.id)
    );
  }, [staffResponse, location]);

  const manager = useMemo<StaffMember | null>(() => {
    if (!location || !location.manager_id) return null;
    const list = Array.isArray(staffResponse)
      ? staffResponse
      : staffResponse?.results ?? [];
    return list.find((member: any) => member.id === location.manager_id) || null;
  }, [staffResponse, location]);

  const isLoading = isLocationLoading || isStaffLoading;

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm font-bold text-muted-foreground animate-pulse">جاري تحميل بيانات الفرع...</p>
        </div>
      </div>
    );
  }

  if (locationError || !location) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-6 text-center">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
          <CircleOff className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white">عذراً، لم نجد الفرع المطلوب</h2>
          <p className="text-muted-foreground max-w-sm">ربما تم حذف هذا الموقع أو لا تملك صلاحية الوصول إليه حالياً.</p>
        </div>
        <button
          onClick={() => router.push("/dashboard/locations")}
          className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
        >
          العودة لقائمة الفروع
        </button>
      </div>
    );
  }

  return (
    <PermissionGuard permission="can_manage_locations">
      <div className="space-y-8 pb-12">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard/locations")}
            className="group flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-white transition-colors"
          >
            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
              <ArrowRight className="w-4 h-4" />
            </div>
            العودة لقائمة الفروع
          </button>
        </div>

        {/* Profile Header Card */}
        <div className="glass-card p-8 relative overflow-hidden group">
          <div className="absolute top-0 end-0 w-96 h-96 bg-primary/10 blur-[100px] -me-48 -mt-48 pointer-events-none" />
          <div className="absolute bottom-0 start-0 w-64 h-64 bg-emerald-500/5 blur-[80px] -ms-32 -mb-32 pointer-events-none" />

          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div className="relative group/avatar">
              <div className="w-28 h-28 rounded-[2rem] overflow-hidden border-4 border-white/10 group-hover/avatar:border-primary/40 transition-colors shadow-2xl relative z-10 flex items-center justify-center bg-gradient-to-tr from-primary/20 to-primary/40 text-primary">
                <Building2 className="w-14 h-14" />
              </div>
              <div className={cn(
                "absolute -bottom-2 -end-2 w-8 h-8 rounded-2xl border-4 border-[#0f172a] shadow-xl z-20 flex items-center justify-center",
                location.is_active ? "bg-emerald-500 shadow-emerald-500/30" : "bg-gray-500"
              )}>
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="flex-1 text-center md:text-end">
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-3 justify-center md:justify-start">
                <h1 className="text-4xl font-black tracking-tight text-white">{location.name}</h1>
                <StatusBadge status={location.is_active ? "active" : "inactive"} />
              </div>

              <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm font-bold text-muted-foreground">
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  {location.city}, {location.country}
                </span>
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  {assignedStaff.length} موظفين في هذا الفرع
                </span>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-3xl p-4 text-center min-w-[120px]">
                <p className="text-2xl font-black text-white">{location.capacity ? `${location.capacity} طالب` : "—"}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">السعة الاستيعابية</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-3xl p-4 text-center min-w-[120px]">
                <p className="text-sm font-black text-primary truncate max-w-[120px]">{manager ? manager.first_name : "—"}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">المدير المسؤول</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Right Column: General Information */}
          <div className="space-y-6 lg:col-span-1">
            <div className="glass-card p-6 space-y-6 group">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70">بيانات الفرع والموقع</h3>
              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">العنوان بالتفصيل</p>
                    <p className="text-sm font-semibold text-white mt-1 leading-relaxed">{location.address}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">رقم الهاتف</p>
                    <p className="text-sm font-semibold text-white mt-1"><bdi>{location.phone || "---"}</bdi></p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">البريد الإلكتروني</p>
                    <p className="text-sm font-semibold text-white mt-1 break-all">{location.email || "---"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">المنطقة الزمنية</p>
                    <p className="text-sm font-semibold text-white mt-1">{location.timezone}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Responsible Manager Details */}
            <div className="glass-card p-6 space-y-4 group">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70">المدير المسؤول</h3>
              {manager ? (
                <div
                  onClick={() => setSelectedStaff(manager)}
                  className="flex items-center gap-4 bg-secondary/10 hover:bg-secondary/20 border border-border/50 p-4 rounded-2xl cursor-pointer transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                    {manager.avatar_url ? (
                      <img src={manager.avatar_url} className="w-full h-full rounded-xl object-cover" alt="" />
                    ) : (
                      manager.first_name?.charAt(0) ?? "M"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white truncate">{manager.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{manager.email}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-border rounded-2xl">
                  <p className="text-xs font-bold text-muted-foreground">لم يتم تعيين مدير مسؤول</p>
                </div>
              )}
            </div>
          </div>

          {/* Left Column: Staff Directory */}
          <div className="space-y-6 lg:col-span-2">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  طاقم العمل والمدربين ({assignedStaff.length})
                </h2>
              </div>

              {assignedStaff.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground flex flex-col items-center">
                  <Users className="w-12 h-12 opacity-20 mb-3" />
                  <p className="font-semibold">لا يوجد موظفون مخصصون لهذا الفرع</p>
                  <p className="text-xs mt-1">قم بتعديل بيانات الموظفين لتعيينهم إلى هذا الفرع.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assignedStaff.map((member) => (
                    <div
                      key={member.id}
                      onClick={() => setSelectedStaff(member)}
                      className="flex items-center gap-4 bg-secondary/15 hover:bg-secondary/35 border border-border/40 hover:border-primary/30 p-4 rounded-2xl cursor-pointer transition-all duration-200 group/member"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/5 flex items-center justify-center font-bold text-primary shrink-0 relative overflow-hidden">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} className="w-full h-full rounded-2xl object-cover" alt="" />
                        ) : (
                          member.first_name?.charAt(0) ?? "U"
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white group-hover/member:text-primary transition-colors truncate">{member.full_name}</p>
                          {member.id === location.manager_id && (
                            <span className="bg-primary/10 text-primary border border-primary/20 text-[8px] font-black px-1.5 py-0.5 rounded shrink-0">
                              مدير مسؤول
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] ?? member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Staff Detail Modal */}
      {selectedStaff && (
        <Modal open onClose={() => setSelectedStaff(null)} size="md">
          <ModalHeader
            icon={<Shield className="w-5 h-5" />}
            title="تفاصيل الموظف"
            subtitle={ROLE_LABELS[selectedStaff.role as keyof typeof ROLE_LABELS] ?? selectedStaff.role}
            onClose={() => setSelectedStaff(null)}
          />

          <ModalBody className="space-y-6">
            <div className="flex items-center gap-4 bg-secondary/20 p-5 rounded-2xl border border-border/30">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-2xl text-primary shrink-0">
                {selectedStaff.avatar_url ? (
                  <img src={selectedStaff.avatar_url} className="w-full h-full rounded-2xl object-cover" alt="" />
                ) : (
                  selectedStaff.first_name?.charAt(0) ?? "U"
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-black text-white">{selectedStaff.full_name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{selectedStaff.email}</p>
              </div>
              <StatusBadge status={selectedStaff.is_active ? "active" : "inactive"} />
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70">معلومات الاتصال</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-secondary/10 p-4 rounded-xl border border-border/30 text-sm text-start">
                <div className="text-start">
                  <span className="text-muted-foreground block text-xs text-start">رقم الهاتف</span>
                  <span className="font-semibold text-white mt-1 block text-start"><bdi>{selectedStaff.phone || "---"}</bdi></span>
                </div>
                <div className="text-start">
                  <span className="text-muted-foreground block text-xs text-start">البريد الإلكتروني</span>
                  <span className="font-semibold text-white mt-1 block break-all text-start">{selectedStaff.email}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70">صلاحيات الموظف</h4>
              {selectedStaff.role === "tenant_owner" || selectedStaff.role === "platform_admin" ? (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-xl text-xs font-bold leading-relaxed">
                  هذا المستخدم يملك كامل الصلاحيات الإدارية المطلقة على المنصة بصفته مالكاً للأكاديمية.
                </div>
              ) : (
                <div className="bg-secondary/10 p-4 rounded-xl border border-border/30">
                  {selectedStaff.permissions && Object.keys(selectedStaff.permissions).some(k => selectedStaff.permissions?.[k] === true) ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(selectedStaff.permissions)
                        .filter(k => selectedStaff.permissions?.[k] === true)
                        .map(k => (
                          <span
                            key={k}
                            className="bg-primary/10 border border-primary/20 text-primary text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {PERMISSION_LABELS[k] ?? k}
                          </span>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic text-center py-2">لا توجد صلاحيات خاصة مفعلة لهذا الموظف</p>
                  )}
                </div>
              )}
            </div>
          </ModalBody>

          <ModalFooter>
            <button
              onClick={() => setSelectedStaff(null)}
              className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all text-center"
            >
              إغلاق النافذة
            </button>
          </ModalFooter>
        </Modal>
      )}
    </PermissionGuard>
  );
}
