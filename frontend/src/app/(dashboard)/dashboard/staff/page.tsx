"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { UsersRound, Mail, Phone, ShieldCheck, UserPlus, Shield, X, Save, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  tenant_owner: "المدير العام",
  manager: "مدير",
  branch_manager: "مدير فرع",
  front_desk: "استقبال",
  instructor: "مدرب",
  finance: "مالية",
  parent: "ولي أمر",
  student: "طالب",
  read_only: "قراءة فقط",
};

const STAFF_ROLES = [
  { id: "manager", label: "مدير" },
  { id: "branch_manager", label: "مدير فرع" },
  { id: "front_desk", label: "استقبال" },
  { id: "instructor", label: "مدرب" },
  { id: "finance", label: "مالية" },
];

const PERMISSION_FLAGS = [
  { id: "can_manage_students", label: "إدارة الطلاب", description: "إضافة وتعديل وحذف بيانات الطلاب" },
  { id: "can_view_billing", label: "عرض المالية", description: "الاطلاع على الفواتير والمدفوعات" },
  { id: "can_manage_billing", label: "إدارة المالية", description: "إنشاء فواتير وتسجيل مدفوعات" },
  { id: "can_manage_schedules", label: "إدارة الجداول", description: "تعديل المواعيد والحصص التدريبية" },
  { id: "can_manage_locations", label: "إدارة الفروع", description: "إضافة وتعديل وحذف بيانات الفروع والمواقع" },
  { id: "can_view_reports", label: "عرض التقارير", description: "الاطلاع على تقارير الأداء والنمو" },
  { id: "can_manage_staff", label: "إدارة فريق العمل", description: "تعديل بيانات وصلاحيات الموظفين" },
];

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [editingPermissions, setEditingPermissions] = useState<any | null>(null);
  const [isAddingStaff, setIsAddingStaff] = useState(false);

  const { data: staff, isLoading } = useQuery<{ results: any[] }>({
    queryKey: ["staff", "list"],
    queryFn: () => api.staff.list().then((r: any) => r.data),
  });

  const createStaffMutation = useMutation({
    mutationFn: (data: any) => api.staff.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "list"] });
      setIsAddingStaff(false);
      toast.success("تم إضافة الموظف بنجاح");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.email?.[0] || "تعذر إضافة الموظف");
    }
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: (data: { id: string; permissions: any }) => 
      api.staff.update(data.id, { permissions: data.permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "list"] });
      setEditingPermissions(null);
      toast.success("تم تحديث الصلاحيات بنجاح");
    },
  });

  const togglePermission = (flagId: string) => {
    if (!editingPermissions) return;
    const current = (editingPermissions.permissions as Record<string, boolean>) || {};
    setEditingPermissions({
      ...editingPermissions,
      permissions: {
        ...current,
        [flagId]: !current[flagId],
      }
    });
  };

  const [newStaff, setNewStaff] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role: "instructor",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UsersRound className="w-6 h-6 text-primary" />
            فريق العمل
          </h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة المدربين والموظفين والصلاحيات</p>
        </div>
        <button 
          onClick={() => setIsAddingStaff(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-brand text-white font-medium shadow-lg hover:opacity-90 transition-all text-sm"
        >
          <UserPlus className="w-4 h-4" />
          إضافة موظف
        </button>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-lg">قائمة الموظفين</h2>
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
              <tr>
                <th className="px-4 py-3 rounded-r-lg font-medium">الاسم</th>
                <th className="px-4 py-3 font-medium">الدور</th>
                <th className="px-4 py-3 font-medium">التواصل</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 rounded-l-lg font-medium">الصلاحيات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-4"><div className="shimmer h-5 w-32 rounded" /></td>
                    <td className="px-4 py-4"><div className="shimmer h-5 w-20 rounded" /></td>
                    <td className="px-4 py-4"><div className="shimmer h-5 w-40 rounded" /></td>
                    <td className="px-4 py-4"><div className="shimmer h-5 w-16 rounded" /></td>
                    <td className="px-4 py-4"><div className="shimmer h-5 w-8 rounded" /></td>
                  </tr>
                ))
              ) : staff?.results?.length === 0 ? (
                 <tr>
                   <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      لا يوجد موظفين مسجلين
                   </td>
                 </tr>
              ) : (
                staff?.results?.map((user: any) => (
                  <tr key={user.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-muted-foreground shrink-0 border border-border">
                           {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full rounded-full object-cover" alt={user.full_name} /> : user.first_name?.charAt(0) || "U"}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Shield className="w-3 h-3" />
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                       <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-primary/10 border-primary/20 text-primary">
                          {ROLE_LABELS[user.role] || user.role}
                       </span>
                    </td>
                    <td className="px-4 py-4">
                       <div className="space-y-1">
                          {user.phone && (
                             <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                               <Phone className="w-3.5 h-3.5" />
                               <span dir="ltr">{user.phone}</span>
                             </div>
                          )}
                       </div>
                    </td>
                    <td className="px-4 py-4">
                       <span className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium border",
                          user.is_active ? "badge-active" : "badge-inactive"
                       )}>
                         {user.is_active ? "نشط" : "غير نشط"}
                       </span>
                    </td>
                    <td className="px-4 py-4 text-left">
                       <button 
                         onClick={() => setEditingPermissions(user)}
                         className="flex items-center gap-1.5 text-xs text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all font-bold border border-primary/20"
                       >
                         <Lock className="w-3 h-3" />
                         إدارة الصلاحيات
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {isAddingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl glass-card p-0 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border/50 flex items-center justify-between bg-secondary/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold">إضافة موظف جديد</h2>
              </div>
              <button onClick={() => setIsAddingStaff(false)} className="p-2 rounded-full hover:bg-secondary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              createStaffMutation.mutate(newStaff);
            }} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground mr-1">الاسم الأول</label>
                  <input
                    required
                    type="text"
                    value={newStaff.first_name}
                    onChange={(e) => setNewStaff({ ...newStaff, first_name: e.target.value })}
                    className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="أحمد"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground mr-1">الاسم الأخير</label>
                  <input
                    required
                    type="text"
                    value={newStaff.last_name}
                    onChange={(e) => setNewStaff({ ...newStaff, last_name: e.target.value })}
                    className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="محمد"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground mr-1">البريد الإلكتروني</label>
                  <input
                    required
                    type="email"
                    dir="ltr"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-left"
                    placeholder="example@maidan.app"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground mr-1">رقم الهاتف</label>
                  <input
                    required
                    type="tel"
                    dir="ltr"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all text-left"
                    placeholder="05xxxxxxx"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground mr-1">الدور الوظيفي</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="w-full bg-secondary/30 border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                >
                  {STAFF_ROLES.map(role => (
                    <option key={role.id} value={role.id}>{role.label}</option>
                  ))}
                </select>
              </div>

              <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-3 mt-4">
                <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  سيتم إضافة الموظف بدون كلمة مرور حالياً. عند محاولة تسجيل الدخول لأول مرة، سيُطلب منه ضبط كلمة المرور الخاصة به وتأكيد هويته عبر رقم هاتفه.
                </p>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsAddingStaff(false)} className="px-6 py-2.5 rounded-xl border border-border hover:bg-secondary transition-all font-medium">
                  إلغاء
                </button>
                <button 
                  disabled={createStaffMutation.isPending}
                  className="px-8 py-2.5 rounded-xl gradient-brand text-white font-bold hover:opacity-90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  {createStaffMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  إضافة الموظف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {editingPermissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl glass-card p-0 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border/50 flex items-center justify-between bg-secondary/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">صلاحيات الموظف</h2>
                  <p className="text-xs text-muted-foreground">{editingPermissions.full_name} • {ROLE_LABELS[editingPermissions.role]}</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingPermissions(null)}
                className="p-2 rounded-full hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {editingPermissions.role === "tenant_owner" || editingPermissions.role === "platform_admin" ? (
                <div className="py-8 text-center space-y-3">
                   <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 mb-2">
                     <ShieldCheck className="w-6 h-6" />
                   </div>
                   <p className="font-bold text-amber-500">هذا المستخدم لديه كامل الصلاحيات</p>
                   <p className="text-sm text-muted-foreground px-8">بصفته مالكاً للأكاديمية أو مديراً للمنصة، لا يمكن تقييد صلاحياته من هذا القسم.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-4 px-1">حدد المميزات والأقسام التي يمكن للموظف الوصول إليها والتحكم بها:</p>
                  <div className="grid grid-cols-1 gap-3">
                    {PERMISSION_FLAGS.map((flag) => {
                      const isActive = editingPermissions.permissions?.[flag.id];
                      return (
                        <button
                          key={flag.id}
                          onClick={() => togglePermission(flag.id)}
                          className={cn(
                            "flex items-start gap-4 p-4 rounded-xl border text-right transition-all group",
                            isActive 
                              ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20" 
                              : "bg-secondary/20 border-border hover:border-primary/30"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                            isActive ? "bg-primary border-primary text-white" : "border-muted-foreground/30 bg-background"
                          )}>
                            {isActive && <ShieldCheck className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <p className={cn("font-bold text-sm", isActive ? "text-primary" : "text-foreground")}>{flag.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-secondary/10 border-t border-border/50 flex justify-end gap-3">
               <button 
                 onClick={() => setEditingPermissions(null)}
                 className="px-6 py-2.5 rounded-xl border border-border hover:bg-secondary transition-all font-medium"
               >
                 إلغاء
               </button>
               {!(editingPermissions.role === "tenant_owner" || editingPermissions.role === "platform_admin") && (
                 <button 
                   onClick={() => updatePermissionsMutation.mutate({ 
                     id: editingPermissions.id, 
                     permissions: editingPermissions.permissions 
                   })}
                   disabled={updatePermissionsMutation.isPending}
                   className="px-8 py-2.5 rounded-xl gradient-brand text-white font-bold hover:opacity-90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-60"
                 >
                   {updatePermissionsMutation.isPending ? (
                     <Loader2 className="w-5 h-5 animate-spin" />
                   ) : (
                     <Save className="w-5 h-5" />
                   )}
                   حفظ التغييرات
                 </button>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
