"use client";
import { Select } from "@/components/ui/select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, Textarea, ErrorBanner } from "@/components/ui/form-field";
import { PageHeader } from "@/components/dashboard/page-header";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Building2, MapPin, Phone, Mail, Globe, Clock, Users, Plus, AlertCircle, Loader2, X, Edit, Trash2, Save, UserCheck, CheckCircle2, CircleOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { AxiosError } from "axios";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import React, { FormEvent, useMemo, useState } from "react";
import { ROLE_LABELS } from "@/lib/constants";

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

type LocationsResponse = {
  results?: Location[];
};

const initialFormState = {
  name: "",
  address: "",
  city: "",
  country: "SA",
  phone: "",
  email: "",
  timezone: "Asia/Riyadh",
  manager_id: "",
  capacity: "50",
  is_active: true,
};


export default function LocationsPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const canManage = user?.role === "platform_admin" || user?.role === "tenant_owner" || user?.permissions?.can_manage_locations === true;

  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<Location | null>(null);
  const [formError, setFormError] = useState("");
  const [createForm, setCreateForm] = useState(initialFormState);

  const { data: locationsResponse, isLoading, isError, refetch } = useQuery<LocationsResponse | Location[]>({
    queryKey: ["locations", "list"],
    queryFn: () => api.locations.list().then((r: any) => r.data),
  });
  
  const { data: staffResponse } = useQuery({
    queryKey: ["staff", "list"],
    queryFn: () => api.staff.list().then((r: any) => r.data),
  });

  const staff = useMemo(() => {
    if (Array.isArray(staffResponse)) return staffResponse;
    return staffResponse?.results ?? [];
  }, [staffResponse]);

  const locations = useMemo(() => {
    if (Array.isArray(locationsResponse)) return locationsResponse;
    return locationsResponse?.results ?? [];
  }, [locationsResponse]);

  const createLocationMutation = useMutation({
    mutationFn: async (data: typeof initialFormState) => {
      setFormError("");
      const payload = {
        ...data,
        capacity: Number(data.capacity || 0),
        manager_id: data.manager_id || null,
      };
      return api.locations.create(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["locations", "list"] });
      setCreateForm(initialFormState);
      setIsCreateOpen(false);
    },
    onError: (error: AxiosError<any>) => {
      const data = error.response?.data;
      if (data && typeof data === "object") {
        if (data.detail) setFormError(data.detail);
        else {
          const firstError = Object.values(data)[0];
          setFormError(Array.isArray(firstError) ? firstError[0] : "تعذر إنشاء الفرع.");
        }
      } else {
        setFormError("تعذر إنشاء الفرع.");
      }
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async (location: Location) => {
      setFormError("");
      const { id, ...data } = location;
      const payload = {
        ...data,
        manager_id: data.manager_id || null,
      };
      return api.locations.update(id, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["locations", "list"] });
      setEditingLocation(null);
    },
    onError: (error: AxiosError<any>) => {
      const data = error.response?.data;
      if (data && typeof data === "object") {
        if (data.detail) setFormError(data.detail);
        else {
          const firstError = Object.values(data)[0];
          setFormError(Array.isArray(firstError) ? firstError[0] : "تعذر تحديث الفرع.");
        }
      } else {
        setFormError("تعذر تحديث الفرع.");
      }
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.locations.delete(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["locations", "list"] });
      setDeletingLocation(null);
    },
  });

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createLocationMutation.mutateAsync(createForm);
  };

  const handleUpdateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingLocation) {
      await updateLocationMutation.mutateAsync(editingLocation);
    }
  };

  return (
    <PermissionGuard permission="can_manage_locations">
      <div className="space-y-10 pb-12">
        <PageHeader
          title="الفروع والمواقع"
          description="إدارة فروع الأكاديمية، توزيع الطواقم التدريبية، ومراقبة السعة الاستيعابية لكل صالة رياضية بشكل مستقل."
          icon={Building2}
        >
          {canManage && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              إضافة فرع
            </button>
          )}
        </PageHeader>

      {isLoading ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {[...Array(3)].map((_, i) => (
             <div key={i} className="glass-card p-6 space-y-4">
               <div className="shimmer h-6 w-3/4 rounded" />
               <div className="shimmer h-4 w-1/2 rounded" />
               <div className="shimmer h-20 w-full rounded-xl" />
             </div>
           ))}
         </div>
      ) : isError ? (
         <div className="py-16 glass-card border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-10 h-10 text-destructive mb-3" />
            <p className="font-medium text-destructive">تعذر تحميل الفروع</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 rounded-lg border border-border hover:bg-secondary/50 transition-all text-sm"
            >
              إعادة المحاولة
            </button>
         </div>
      ) : locations.length === 0 ? (
         <div className="py-24 flex flex-col items-center justify-center text-muted-foreground glass-card border-dashed">
            <Building2 className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">لا توجد فروع مسجلة</p>
            <p className="text-sm mt-1">قم بإضافة فرعك الأول للبدء</p>
         </div>
      ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map((location: Location) => (
               <div key={location.id} className={cn(
                 "glass-card p-0 overflow-hidden flex flex-col hover:border-primary/50 transition-all group",
                 !location.is_active && "opacity-75 grayscale-[0.5]"
               )}>
                  <div className={cn(
                    "h-1.5 w-full",
                    location.is_active ? "bg-gradient-to-r from-primary to-emerald-500" : "bg-muted"
                  )} />
                  <div className="p-6 flex-1 flex flex-col">
                     <div className="flex items-start justify-between mb-4">
                        <div>
                           <h2 className="text-xl font-bold group-hover:text-primary transition-colors">{location.name}</h2>
                           <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5" />
                              {location.city}, {location.country}
                           </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                           <StatusBadge status={location.is_active ? "active" : "inactive"} />
                        </div>
                     </div>

                     <div className="mt-auto space-y-3 pt-4 border-t border-border/50">
                        <div className="flex items-center justify-between text-sm">
                           <span className="text-muted-foreground flex items-center gap-2">
                              <Users className="w-4 h-4" /> السعة الاستيعابية
                           </span>
                           <span className="font-medium">{location.capacity || "غير محدد"}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                           <span className="text-muted-foreground flex items-center gap-2">
                              <Phone className="w-4 h-4" /> الهاتف
                           </span>
                           <span className="font-medium" dir="ltr">{location.phone || "---"}</span>
                        </div>
                        {location.email && (
                          <div className="flex items-center justify-between text-sm">
                             <span className="text-muted-foreground flex items-center gap-2">
                                <Mail className="w-4 h-4" /> البريد الإلكتروني
                             </span>
                             <span className="font-medium truncate max-w-[150px]" title={location.email}>{location.email}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                           <span className="text-muted-foreground flex items-center gap-2">
                              <Clock className="w-4 h-4" /> المنطقة الزمنية
                           </span>
                           <span className="font-medium text-[10px]">{location.timezone}</span>
                        </div>
                        {location.manager_id && (
                          <div className="flex items-center justify-between text-sm">
                             <span className="text-muted-foreground flex items-center gap-2">
                                <UserCheck className="w-4 h-4" /> المدير المسئول
                             </span>
                             <span className="font-medium text-xs">
                               {staff.find((s: any) => s.id === location.manager_id)?.full_name || "---"}
                             </span>
                          </div>
                        )}
                        {(() => {
                           const branchStaff = staff.filter((s: any) => 
                             s.id !== location.manager_id &&
                             Array.isArray(s.assigned_location_ids) && 
                             s.assigned_location_ids.includes(location.id)
                           );
                           if (branchStaff.length === 0) return null;
                           return (
                             <div className="pt-3 mt-3 border-t border-border/30 space-y-2 animate-in fade-in duration-300">
                               <div className="flex items-center justify-between">
                                 <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                   <Users className="w-3.5 h-3.5 text-primary" /> طاقم عمل الفرع
                                 </span>
                                 <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                   {branchStaff.length} موظفين
                                 </span>
                               </div>
                               <div className="grid grid-cols-1 gap-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
                                 {branchStaff.map((member: any) => (
                                   <div key={member.id} className="flex items-center justify-between bg-secondary/20 hover:bg-secondary/40 border border-border/40 rounded-lg px-2.5 py-1.5 text-xs transition-colors">
                                     <div className="flex items-center gap-2 truncate">
                                       <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-[9px] text-primary shrink-0">
                                         {member.avatar_url ? (
                                           <img src={member.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                                         ) : (
                                           member.first_name?.charAt(0) ?? "U"
                                         )}
                                       </div>
                                       <span className="font-medium text-foreground truncate max-w-[120px]" title={member.full_name}>
                                         {member.full_name}
                                       </span>
                                     </div>
                                     <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-primary/5 border border-primary/10 text-primary shrink-0">
                                       {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] ?? member.role}
                                     </span>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           );
                         })()}
                     </div>

                     {canManage && (
                       <div className="mt-6 flex items-center gap-2 pt-4 border-t border-border/30">
                          <button
                            onClick={() => setEditingLocation(location)}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-secondary/50 hover:bg-primary/10 hover:text-primary transition-all text-xs font-medium"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            تعديل
                          </button>
                          <button
                            onClick={() => setDeletingLocation(location)}
                            className="px-3 py-2 rounded-lg bg-secondary/50 hover:bg-destructive/10 hover:text-destructive transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                       </div>
                     )}
                  </div>
               </div>
            ))}
         </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={isCreateOpen || !!editingLocation}
        onClose={() => { setIsCreateOpen(false); setEditingLocation(null); setFormError(""); }}
        size="lg"
      >
        <ModalHeader
          icon={isCreateOpen ? <Plus className="w-5 h-5" /> : <Edit className="w-5 h-5" />}
          title={isCreateOpen ? "إضافة فرع جديد" : "تعديل بيانات الفرع"}
          onClose={() => { setIsCreateOpen(false); setEditingLocation(null); setFormError(""); }}
        />

        <form onSubmit={isCreateOpen ? handleCreateSubmit : handleUpdateSubmit} className="flex flex-col flex-1 min-h-0">
          <ModalBody className="space-y-4">
            <ErrorBanner message={formError} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="اسم الفرع" required>
                <Input
                  required
                  placeholder="اسم الفرع"
                  value={isCreateOpen ? createForm.name : editingLocation?.name ?? ""}
                  onChange={(e) => {
                    if (isCreateOpen) setCreateForm(prev => ({ ...prev, name: e.target.value }));
                    else if (editingLocation) setEditingLocation({ ...editingLocation, name: e.target.value });
                  }}
                  dir="rtl"
                />
              </FormField>
              <FormField label="المدينة" required>
                <Input
                  required
                  placeholder="المدينة"
                  value={isCreateOpen ? createForm.city : editingLocation?.city ?? ""}
                  onChange={(e) => {
                    if (isCreateOpen) setCreateForm(prev => ({ ...prev, city: e.target.value }));
                    else if (editingLocation) setEditingLocation({ ...editingLocation, city: e.target.value });
                  }}
                />
              </FormField>
              <FormField label="السعة الاستيعابية" required>
                <Input
                  required
                  type="number"
                  placeholder="السعة"
                  value={isCreateOpen ? createForm.capacity : editingLocation?.capacity ?? ""}
                  onChange={(e) => {
                    if (isCreateOpen) setCreateForm(prev => ({ ...prev, capacity: e.target.value }));
                    else if (editingLocation) setEditingLocation({ ...editingLocation, capacity: Number(e.target.value) });
                  }}
                />
              </FormField>
              <FormField label="رقم الهاتف">
                <Input
                  placeholder="05xxxxxxx"
                  value={isCreateOpen ? createForm.phone : editingLocation?.phone ?? ""}
                  onChange={(e) => {
                    if (isCreateOpen) setCreateForm(prev => ({ ...prev, phone: e.target.value }));
                    else if (editingLocation) setEditingLocation({ ...editingLocation, phone: e.target.value });
                  }}
                  dir="ltr"
                />
              </FormField>
              <FormField label="البريد الإلكتروني">
                <Input
                  type="email"
                  placeholder="branch@example.com"
                  value={isCreateOpen ? createForm.email : editingLocation?.email ?? ""}
                  onChange={(e) => {
                    if (isCreateOpen) setCreateForm(prev => ({ ...prev, email: e.target.value }));
                    else if (editingLocation) setEditingLocation({ ...editingLocation, email: e.target.value });
                  }}
                  dir="ltr"
                />
              </FormField>
              <FormField label="الدولة">
                  <Select
                    value={isCreateOpen ? createForm.country : editingLocation?.country || "SA"}
                    onChange={(e) => {
                      if (isCreateOpen) setCreateForm(prev => ({ ...prev, country: e.target.value }));
                      else if (editingLocation) setEditingLocation({ ...editingLocation, country: e.target.value });
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all appearance-none"
                  >
                    <option value="SA">المملكة العربية السعودية</option>
                    <option value="AE">الإمارات العربية المتحدة</option>
                    <option value="KW">الكويت</option>
                    <option value="QA">قطر</option>
                    <option value="BH">البحرين</option>
                    <option value="OM">عمان</option>
                    <option value="JO">الأردن</option>
                    <option value="EG">مصر</option>
                  </Select>
              </FormField>
              <FormField label="المنطقة الزمنية">
                  <Select
                    value={isCreateOpen ? createForm.timezone : editingLocation?.timezone || "Asia/Riyadh"}
                    onChange={(e) => {
                      if (isCreateOpen) setCreateForm(prev => ({ ...prev, timezone: e.target.value }));
                      else if (editingLocation) setEditingLocation({ ...editingLocation, timezone: e.target.value });
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all appearance-none"
                  >
                    <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                    <option value="Asia/Kuwait">Asia/Kuwait (GMT+3)</option>
                    <option value="Asia/Qatar">Asia/Qatar (GMT+3)</option>
                    <option value="Asia/Amman">Asia/Amman (GMT+3)</option>
                    <option value="Africa/Cairo">Africa/Cairo (GMT+2)</option>
                  </Select>
              </FormField>
              <FormField label="المدير المسئول">
                  <Select
                    value={isCreateOpen ? createForm.manager_id : editingLocation?.manager_id ?? ""}
                    onChange={(e) => {
                      if (isCreateOpen) setCreateForm(prev => ({ ...prev, manager_id: e.target.value }));
                      else if (editingLocation) setEditingLocation({ ...editingLocation, manager_id: e.target.value });
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all appearance-none"
                  >
                    <option value="">-- اختر مديراً --</option>
                    {staff.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.full_name} ({s.email})</option>
                    ))}
                  </Select>
              </FormField>
              <div className="flex items-end pb-2">
                  <label className="flex items-center gap-3 cursor-pointer group select-none">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isCreateOpen ? createForm.is_active : editingLocation?.is_active}
                      onChange={(e) => {
                        if (isCreateOpen) setCreateForm(prev => ({ ...prev, is_active: e.target.checked }));
                        else if (editingLocation) setEditingLocation({ ...editingLocation, is_active: e.target.checked });
                      }}
                    />
                    <div
                      className={cn(
                        "h-8 min-w-[110px] px-3 rounded-xl border flex items-center justify-center gap-2 transition-all duration-300",
                        (isCreateOpen ? createForm.is_active : editingLocation?.is_active)
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.2)]"
                          : "bg-secondary/60 border-border text-muted-foreground group-hover:bg-secondary"
                      )}
                    >
                      {(isCreateOpen ? createForm.is_active : editingLocation?.is_active) ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <CircleOff className="w-4 h-4" />
                      )}
                      <span className="text-xs font-bold">
                        {(isCreateOpen ? createForm.is_active : editingLocation?.is_active) ? "نشط" : "مغلق"}
                      </span>
                    </div>
                    <span className="text-sm font-medium group-hover:text-primary transition-colors">الفرع نشط حالياً</span>
                  </label>
                </div>
              </div>

            <FormField label="العنوان بالتفصيل" required>
              <Textarea
                required
                rows={3}
                placeholder="مثال: حي الياسمين، طريق الملك عبدالعزيز..."
                value={isCreateOpen ? createForm.address : editingLocation?.address ?? ""}
                onChange={(e) => {
                  if (isCreateOpen) setCreateForm(prev => ({ ...prev, address: e.target.value }));
                  else if (editingLocation) setEditingLocation({ ...editingLocation, address: e.target.value });
                }}
              />
            </FormField>
          </ModalBody>

          <ModalFooter>
            <button
              type="button"
              onClick={() => {
                setIsCreateOpen(false);
                setEditingLocation(null);
                setFormError("");
              }}
              className="px-5 py-2.5 rounded-xl border border-border hover:bg-secondary/60 transition-colors text-sm font-medium"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={createLocationMutation.isPending || updateLocationMutation.isPending}
              className="px-6 py-2.5 rounded-xl gradient-brand text-white text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {(createLocationMutation.isPending || updateLocationMutation.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {createLocationMutation.isPending || updateLocationMutation.isPending ? "جاري الحفظ..." : "حفظ البيانات"}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deletingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-card p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
                <Trash2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold">حذف الفرع؟</h2>
              <p className="text-muted-foreground mt-2">
                هل أنت متأكد من حذف فرع <span className="text-foreground font-bold font-mono">"{deletingLocation.name}"</span>؟
                <br />
                هذا الإجراء قد يؤثر على بيانات الطلاب المسجلين في هذا الفرع.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeletingLocation(null)}
                className="flex-1 px-4 py-3 rounded-xl border border-border hover:bg-secondary transition-all font-medium"
              >
                تراجع
              </button>
              <button
                onClick={() => deleteLocationMutation.mutate(deletingLocation.id)}
                disabled={deleteLocationMutation.isPending}
                className="flex-1 px-4 py-3 rounded-xl bg-destructive text-white font-bold hover:bg-destructive/90 transition-all flex items-center justify-center gap-2"
              >
                {deleteLocationMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "تأكيد الحذف"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PermissionGuard>
  );
}

