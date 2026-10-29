"use client";
import { PageHeader } from "@/components/dashboard/page-header";
import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api/client";
import Link from "next/link";
import { UsersRound, Phone, ShieldCheck, UserPlus, Shield, Lock, Pencil, MapPin, ArrowLeft, ArrowRight, Eye, Search, Receipt, Coins, Filter } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/constants";
import { UserRole, StaffMember, StaffPermissions, Location, PaginatedResponse } from "@/types";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import { StaffPermissionsModal } from "@/components/dashboard/StaffPermissionsModal";
import { EditStaffModal } from "@/components/dashboard/EditStaffModal";
import { AddStaffModal, NewStaffFormData, INITIAL_STAFF_FORM } from "@/components/dashboard/AddStaffModal";
import { cn } from "@/lib/utils";
import { SalaryConfigTab } from "@/components/dashboard/staff/SalaryConfigTab";
import { PayrollTab } from "@/components/dashboard/staff/PayrollTab";
import { DocumentsTab } from "@/components/dashboard/staff/DocumentsTab";
import { AdvancesTab } from "@/components/dashboard/staff/AdvancesTab";


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SessionUser = {
  role?: UserRole;
  permissions?: Record<string, boolean>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function canUserAssignBranch(user: SessionUser | undefined): boolean {
  return (
    user?.role === "tenant_owner" ||
    user?.role === "platform_admin" ||
    user?.permissions?.can_manage_locations === true
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function StaffPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const sessionUser = session?.user as SessionUser | undefined;
  const canAssignBranch = canUserAssignBranch(sessionUser);

  // Modal state
  const [permissionsTarget, setPermissionsTarget] = useState<StaffMember | null>(null);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [newStaffForm, setNewStaffForm] = useState<NewStaffFormData | null>(null);
  const [activeTab, setActiveTab] = useState<"list" | "payroll" | "advances">("list");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------
  const { data: staffData, isLoading } = useQuery<PaginatedResponse<StaffMember>>({
    queryKey: ["staff", "list"],
    queryFn: () => api.staff.list().then((r: { data: PaginatedResponse<StaffMember> }) => r.data),
  });

  const { data: locationsData } = useQuery<PaginatedResponse<Location>>({
    queryKey: ["locations", "list"],
    queryFn: () => api.locations.list().then((r: { data: PaginatedResponse<Location> }) => r.data),
    enabled: canAssignBranch,
  });
  const locations: Location[] = locationsData?.results ?? [];

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: (data: NewStaffFormData) => api.staff.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "list"] });
      queryClient.invalidateQueries({ queryKey: ["locations", "list"] });
      setNewStaffForm(null);
      toast.success("تم إضافة الموظف بنجاح");
    },
    onError: (err: { response?: { data?: { email?: string[] } } }) => {
      toast.error(err.response?.data?.email?.[0] ?? "تعذر إضافة الموظف");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...rest }: StaffMember) => api.staff.update(id, rest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "list"] });
      queryClient.invalidateQueries({ queryKey: ["locations", "list"] });
      setEditTarget(null);
      toast.success("تم تحديث بيانات الموظف بنجاح");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? "تعذر تحديث بيانات الموظف");
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: StaffPermissions }) =>
      api.staff.update(id, { permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "list"] });
      setPermissionsTarget(null);
      toast.success("تم تحديث الصلاحيات بنجاح");
    },
  });

  // ---------------------------------------------------------------------------
  // Permission toggle (immutable update)
  // ---------------------------------------------------------------------------
  const handleTogglePermission = (flagId: string) => {
    if (!permissionsTarget) return;
    setPermissionsTarget({
      ...permissionsTarget,
      permissions: {
        ...permissionsTarget.permissions,
        [flagId]: !permissionsTarget.permissions?.[flagId],
      },
    });
  };

  const staffList = staffData?.results || [];
  const filteredStaff = React.useMemo(() => {
    return staffList.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (branchFilter !== "all") {
        const branchId = Number(branchFilter);
        if (!m.assigned_location_ids?.includes(branchId)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = m.full_name?.toLowerCase().includes(q);
        const matchEmail = m.email?.toLowerCase().includes(q);
        const matchPhone = m.phone?.includes(q);
        if (!matchName && !matchEmail && !matchPhone) return false;
      }
      return true;
    });
  }, [staffList, roleFilter, branchFilter, searchQuery]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <PermissionGuard permission="can_manage_staff">
      <div className="space-y-6 pb-12">
        <PageHeader
          title="فريق العمل"
          description="إدارة المدربين والموظفين، تحديد الصلاحيات، ومتابعة الوصول لجميع أقسام المنصة."
          icon={UsersRound}
        >
          <button
            onClick={() => setNewStaffForm(INITIAL_STAFF_FORM)}
            className="flex items-center gap-3 px-6 py-3 rounded-xl gradient-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.05] transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            إضافة موظف
          </button>
        </PageHeader>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border/40 gap-1 pb-px overflow-x-auto custom-scrollbar">
          {[
            { id: "list", label: "فريق العمل", icon: UsersRound, count: staffData?.results?.length },
            { id: "payroll", label: "مسيرات الرواتب", icon: Receipt },
            { id: "advances", label: "سلف الموظفين", icon: Coins },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-5 py-3 text-xs font-black uppercase tracking-wider relative transition-all whitespace-nowrap border-b-2 flex items-center gap-2",
                  isActive
                    ? "text-primary border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground border-transparent hover:border-border"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ms-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-white">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === "list" && (
          <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6 relative">
                <Search className="w-4 h-4 absolute end-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="البحث باسم الموظف، البريد الإلكتروني، أو رقم الهاتف..."
                  className="w-full pe-11 ps-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-bold text-white placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-bold text-white focus:border-primary focus:outline-none"
                >
                  <option value="all">جميع الأدوار الوظيفية</option>
                  <option value="manager">مدير</option>
                  <option value="branch_manager">مدير فرع</option>
                  <option value="instructor">مدرب / كابتن</option>
                  <option value="front_desk">استقبال</option>
                  <option value="finance">محاسب / مالي</option>
                  <option value="staff">موظف عام</option>
                </select>
              </div>

              {locations.length > 0 && (
                <div className="sm:col-span-3">
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-bold text-white focus:border-primary focus:outline-none"
                  >
                    <option value="all">جميع الفروع</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-semibold text-lg">قائمة الموظفين</h2>
                  <p className="text-xs text-muted-foreground">
                    انقر على أي موظف لفتح ملفه الشامل (360°) لإدارة راتبه، سلفه، عقوده، وصلاحياته.
                  </p>
                </div>
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                    <tr>
                      <th className="px-4 py-3 rounded-s-lg font-medium text-start whitespace-nowrap">الاسم</th>
                      <th className="px-4 py-3 font-medium text-start whitespace-nowrap">الدور</th>
                      <th className="px-4 py-3 font-medium text-start whitespace-nowrap">الفرع</th>
                      <th className="px-4 py-3 font-medium text-start whitespace-nowrap">التواصل</th>
                      <th className="px-4 py-3 font-medium text-start whitespace-nowrap">الحالة</th>
                      <th className="px-4 py-3 rounded-e-lg font-medium text-end whitespace-nowrap">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      [...Array(4)].map((_, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          {[32, 20, 24, 40, 16, 8].map((w, j) => (
                            <td key={j} className={cn("px-4 py-4", j === 5 ? "text-end" : "text-start")}>
                              <div className={cn("shimmer h-5 rounded", `w-${w}`, j === 5 && "ms-auto")} />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : filteredStaff.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                          {searchQuery || roleFilter !== "all" || branchFilter !== "all"
                            ? "لا توجد نتائج مطابقة لمعايير البحث المحددة."
                            : "لا يوجد موظفين مسجلين"}
                        </td>
                      </tr>
                    ) : (
                      filteredStaff.map((member) => (
                        <StaffRow
                          key={member.id}
                          member={member}
                          onEdit={() => setEditTarget(member)}
                          onManagePermissions={() => setPermissionsTarget(member)}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden">
                {isLoading ? (
                  <div className="grid grid-cols-1 gap-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="bg-secondary/10 border border-border/40 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="shimmer w-12 h-12 rounded-xl shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="shimmer h-4 rounded w-1/2" />
                            <div className="shimmer h-3 rounded w-3/4" />
                          </div>
                        </div>
                        <div className="shimmer h-8 rounded-xl w-full" />
                        <div className="flex gap-2">
                          <div className="shimmer h-9 rounded-xl flex-1" />
                          <div className="shimmer h-9 rounded-xl flex-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    {searchQuery || roleFilter !== "all" || branchFilter !== "all"
                      ? "لا توجد نتائج مطابقة لمعايير البحث المحددة."
                      : "لا يوجد موظفين مسجلين"}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredStaff.map((member) => (
                      <StaffCard
                        key={member.id}
                        member={member}
                        onEdit={() => setEditTarget(member)}
                        onManagePermissions={() => setPermissionsTarget(member)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "payroll" && <PayrollTab />}
        {activeTab === "advances" && <AdvancesTab />}

        {/* Modals */}
        {newStaffForm && (
          <AddStaffModal
            form={newStaffForm}
            locations={locations}
            canAssignBranch={canAssignBranch}
            isPending={createMutation.isPending}
            onClose={() => setNewStaffForm(null)}
            onChange={setNewStaffForm}
            onSubmit={() => createMutation.mutate(newStaffForm)}
          />
        )}

        {editTarget && (
          <EditStaffModal
            staff={editTarget}
            locations={locations}
            canAssignBranch={canAssignBranch}
            isPending={updateMutation.isPending}
            onClose={() => setEditTarget(null)}
            onChange={setEditTarget}
            onSave={() => updateMutation.mutate(editTarget)}
          />
        )}

        {permissionsTarget && (
          <StaffPermissionsModal
            staff={permissionsTarget}
            isPending={updatePermissionsMutation.isPending}
            onClose={() => setPermissionsTarget(null)}
            onToggle={handleTogglePermission}
            onSave={(id, permissions) => updatePermissionsMutation.mutate({ id, permissions })}
          />
        )}
      </div>
    </PermissionGuard>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: StaffRow
// ---------------------------------------------------------------------------
interface StaffRowProps {
  member: StaffMember;
  onEdit: () => void;
  onManagePermissions: () => void;
}

function StaffRow({ member, onEdit, onManagePermissions }: StaffRowProps) {
  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors">
      <td className="px-4 py-4 text-start">
        <Link href={`/dashboard/staff/${member.id}`} className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-muted-foreground shrink-0 border border-border group-hover:border-primary/50 transition-colors overflow-hidden">
            {member.avatar_url
              ? <img src={member.avatar_url} className="w-full h-full rounded-full object-cover" alt={member.full_name} />
              : member.first_name?.charAt(0) ?? "U"}
          </div>
          <div>
            <p className="font-semibold text-foreground group-hover:text-primary transition-colors whitespace-nowrap flex items-center gap-1.5">
              <span>{member.full_name}</span>
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 whitespace-nowrap">
              <Shield className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[180px]">{member.email}</span>
            </p>
          </div>
        </Link>
      </td>
      <td className="px-4 py-4 text-start">
        <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-primary/10 border-primary/20 text-primary whitespace-nowrap">
          {ROLE_LABELS[member.role] ?? member.role}
        </span>
      </td>
      <td className="px-4 py-4 text-start">
        {member.branch_names && member.branch_names.length > 0 ? (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {member.branch_names.map((name, idx) => (
              <div key={idx} className="flex items-center gap-1 text-[10px] bg-secondary/30 border border-border px-1.5 py-0.5 rounded shadow-sm">
                <MapPin className="w-2.5 h-2.5 text-primary shrink-0" />
                <span className="whitespace-nowrap">{name}</span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/50 whitespace-nowrap">—</span>
        )}
      </td>
      <td className="px-4 py-4 text-start">
        {member.phone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span><bdi>{member.phone}</bdi></span>
          </div>
        )}
      </td>
      <td className="px-4 py-4 text-start">
        <StatusBadge status={member.is_active ? "active" : "inactive"} />
      </td>
      <td className="px-4 py-4 text-end">
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          <Link
            href={`/dashboard/staff/${member.id}`}
            className="flex items-center gap-1.5 text-xs text-white hover:text-primary bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 rounded-lg transition-all font-bold border border-white/[0.08] whitespace-nowrap"
          >
            <Eye className="w-3 h-3 text-primary" />
            <span>عرض الملف</span>
          </Link>
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 px-3 py-1.5 rounded-lg transition-all font-bold border border-border whitespace-nowrap"
          >
            <Pencil className="w-3 h-3" />
            تعديل
          </button>
          <button
            onClick={onManagePermissions}
            className="flex items-center gap-1.5 text-xs text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all font-bold border border-primary/20 whitespace-nowrap"
          >
            <Lock className="w-3 h-3" />
            إدارة الصلاحيات
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: StaffCard (Mobile View)
// ---------------------------------------------------------------------------
function StaffCard({ member, onEdit, onManagePermissions }: StaffRowProps) {
  return (
    <div className="bg-secondary/10 hover:bg-secondary/15 border border-border/40 hover:border-primary/20 p-5 rounded-2xl transition-all duration-200 space-y-4">
      {/* Header Info */}
      <Link href={`/dashboard/staff/${member.id}`} className="flex items-center gap-3 group">
        <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center font-bold text-muted-foreground shrink-0 border border-border group-hover:border-primary/40 transition-colors overflow-hidden">
          {member.avatar_url ? (
            <img src={member.avatar_url} className="w-full h-full rounded-xl object-cover" alt={member.full_name} />
          ) : (
            member.first_name?.charAt(0) ?? "U"
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-bold text-foreground group-hover:text-primary transition-colors truncate whitespace-nowrap">{member.full_name}</p>
            <StatusBadge status={member.is_active ? "active" : "inactive"} />
          </div>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5 whitespace-nowrap">
            <Shield className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            <span className="truncate">{member.email}</span>
          </p>
        </div>
      </Link>

      {/* Details Row: Role & Contact */}
      <div className="py-3 border-y border-border/40 space-y-2.5">
        <div className="flex items-center justify-between text-start gap-4">
          <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">الدور</span>
          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border bg-primary/10 border-primary/20 text-primary text-start whitespace-nowrap">
            {ROLE_LABELS[member.role] ?? member.role}
          </span>
        </div>
        <div className="flex items-center justify-between text-start gap-4">
          <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">التواصل</span>
          {member.phone ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground text-start whitespace-nowrap">
              <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
              <span><bdi>{member.phone}</bdi></span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/50 text-start whitespace-nowrap">—</span>
          )}
        </div>
      </div>

      {/* Branch Allocation */}
      <div className="space-y-1.5 text-start">
        <span className="text-[10px] font-bold text-muted-foreground block text-start whitespace-nowrap">الفروع</span>
        {member.branch_names && member.branch_names.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 justify-start">
            {member.branch_names.map((name, idx) => (
              <div key={idx} className="flex items-center gap-1 text-[10px] bg-secondary/30 border border-border px-2 py-0.5 rounded-lg shadow-sm">
                <MapPin className="w-3 h-3 text-primary shrink-0" />
                <span className="whitespace-nowrap">{name}</span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/50 text-start whitespace-nowrap">—</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-1">
        <Link
          href={`/dashboard/staff/${member.id}`}
          className="w-full flex items-center justify-center gap-2 text-xs text-white bg-primary/20 hover:bg-primary/30 py-2.5 rounded-xl transition-all font-bold border border-primary/30 active:scale-95 whitespace-nowrap"
        >
          <Eye className="w-3.5 h-3.5 text-primary" />
          <span>عرض الملف الشامل (360°)</span>
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onEdit}
            className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 py-2 rounded-xl transition-all font-bold border border-border active:scale-95 whitespace-nowrap"
          >
            <Pencil className="w-3.5 h-3.5" />
            تعديل
          </button>
          <button
            onClick={onManagePermissions}
            className="flex items-center justify-center gap-2 text-xs text-primary hover:bg-primary/10 py-2 rounded-xl transition-all font-bold border border-primary/20 active:scale-95 whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5" />
            الصلاحيات
          </button>
        </div>
      </div>
    </div>
  );
}
