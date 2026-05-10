"use client";
import { PageHeader } from "@/components/dashboard/page-header";
import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api/client";
import { UsersRound, Phone, ShieldCheck, UserPlus, Shield, Lock, Pencil, MapPin, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/constants";
import { UserRole, StaffMember, StaffPermissions, Location, PaginatedResponse } from "@/types";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import { StaffPermissionsModal } from "@/components/dashboard/StaffPermissionsModal";
import { EditStaffModal } from "@/components/dashboard/EditStaffModal";
import { AddStaffModal, NewStaffFormData, INITIAL_STAFF_FORM } from "@/components/dashboard/AddStaffModal";
import { cn } from "@/lib/utils";

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

        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-lg">قائمة الموظفين</h2>
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                <tr>
                  <th className="px-4 py-3 rounded-s-lg font-medium text-start">الاسم</th>
                  <th className="px-4 py-3 font-medium text-start">الدور</th>
                  <th className="px-4 py-3 font-medium text-start">الفرع</th>
                  <th className="px-4 py-3 font-medium text-start">التواصل</th>
                  <th className="px-4 py-3 font-medium text-start">الحالة</th>
                  <th className="px-4 py-3 rounded-e-lg font-medium text-end">الإجراءات</th>
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
                ) : staffData?.results?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      لا يوجد موظفين مسجلين
                    </td>
                  </tr>
                ) : (
                  staffData?.results?.map((member) => (
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
        </div>

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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-muted-foreground shrink-0 border border-border">
            {member.avatar_url
              ? <img src={member.avatar_url} className="w-full h-full rounded-full object-cover" alt={member.full_name} />
              : member.first_name?.charAt(0) ?? "U"}
          </div>
          <div>
            <p className="font-semibold text-foreground">{member.full_name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Shield className="w-3 h-3" />
              {member.email}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-start">
        <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-primary/10 border-primary/20 text-primary">
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
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </td>
      <td className="px-4 py-4 text-start">
        {member.phone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="w-3.5 h-3.5" />
            <span dir="ltr">{member.phone}</span>
          </div>
        )}
      </td>
      <td className="px-4 py-4 text-start">
        <StatusBadge status={member.is_active ? "active" : "inactive"} />
      </td>
      <td className="px-4 py-4 text-end">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 px-3 py-1.5 rounded-lg transition-all font-bold border border-border"
          >
            <Pencil className="w-3 h-3" />
            تعديل
          </button>
          <button
            onClick={onManagePermissions}
            className="flex items-center gap-1.5 text-xs text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all font-bold border border-primary/20"
          >
            <Lock className="w-3 h-3" />
            إدارة الصلاحيات
          </button>
        </div>
      </td>
    </tr>
  );
}
