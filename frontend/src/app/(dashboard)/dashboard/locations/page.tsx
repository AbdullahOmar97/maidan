"use client";

import React, { FormEvent, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Building2, MapPin, Phone, Mail, Globe, Clock, Users, Plus, AlertCircle, Loader2, X, Edit, Trash2, Save, UserCheck, CheckCircle2, CircleOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { AxiosError } from "axios";
import { PermissionGuard } from "@/components/dashboard/permission-guard";

type Location = {
  id: number;
  name: string;
  name_ar: string;
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
  name_ar: "",
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
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            الفروع والمواقع
          </h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة فروع الأكاديمية والصالات الرياضية</p>
        </div>
        {canManage && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-brand text-white font-medium shadow-lg hover:opacity-90 transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            إضافة فرع
          </button>
        )}
      </div>

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
                           <h2 className="text-xl font-bold group-hover:text-primary transition-colors">{location.name_ar || location.name}</h2>
                           <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5" />
                              {location.city}, {location.country}
                           </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={cn(
                             "px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                             location.is_active ? "badge-active" : "badge-inactive"
                          )}>
                             {location.is_active ? "نشط" : "مغلق"}
                          </span>
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
      {(isCreateOpen || editingLocation) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl glass-card p-0 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-border/50 flex items-center justify-between bg-secondary/20">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {isCreateOpen ? <Plus className="w-5 h-5 text-primary" /> : <Edit className="w-5 h-5 text-primary" />}
                {isCreateOpen ? "إضافة فرع جديد" : "تعديل بيانات الفرع"}
              </h2>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingLocation(null);
                  setFormError("");
                }}
                className="p-2 rounded-full hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={isCreateOpen ? handleCreateSubmit : handleUpdateSubmit} className="p-6 space-y-6">
              {formError && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex gap-3 animate-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="font-medium">{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground px-1">اسم الفرع (EN)</label>
                  <input
                    required
                    placeholder="Branch Name (English)"
                    value={isCreateOpen ? createForm.name : editingLocation?.name ?? ""}
                    onChange={(e) => {
                      if (isCreateOpen) setCreateForm(prev => ({ ...prev, name: e.target.value }));
                      else if (editingLocation) setEditingLocation({ ...editingLocation, name: e.target.value });
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground px-1">اسم الفرع (عربي)</label>
                  <input
                    placeholder="اسم الفرع"
                    value={isCreateOpen ? createForm.name_ar : editingLocation?.name_ar ?? ""}
                    onChange={(e) => {
                      if (isCreateOpen) setCreateForm(prev => ({ ...prev, name_ar: e.target.value }));
                      else if (editingLocation) setEditingLocation({ ...editingLocation, name_ar: e.target.value });
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground px-1">المدينة</label>
                  <input
                    required
                    placeholder="المدينة"
                    value={isCreateOpen ? createForm.city : editingLocation?.city ?? ""}
                    onChange={(e) => {
                      if (isCreateOpen) setCreateForm(prev => ({ ...prev, city: e.target.value }));
                      else if (editingLocation) setEditingLocation({ ...editingLocation, city: e.target.value });
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground px-1">السعة الاستيعابية</label>
                  <input
                    required
                    type="number"
                    placeholder="السعة"
                    value={isCreateOpen ? createForm.capacity : editingLocation?.capacity ?? ""}
                    onChange={(e) => {
                      if (isCreateOpen) setCreateForm(prev => ({ ...prev, capacity: e.target.value }));
                      else if (editingLocation) setEditingLocation({ ...editingLocation, capacity: Number(e.target.value) });
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground px-1">رقم الهاتف</label>
                  <input
                    placeholder="05xxxxxxx"
                    value={isCreateOpen ? createForm.phone : editingLocation?.phone ?? ""}
                    onChange={(e) => {
                      if (isCreateOpen) setCreateForm(prev => ({ ...prev, phone: e.target.value }));
                      else if (editingLocation) setEditingLocation({ ...editingLocation, phone: e.target.value });
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground px-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    placeholder="branch@example.com"
                    value={isCreateOpen ? createForm.email : editingLocation?.email ?? ""}
                    onChange={(e) => {
                      if (isCreateOpen) setCreateForm(prev => ({ ...prev, email: e.target.value }));
                      else if (editingLocation) setEditingLocation({ ...editingLocation, email: e.target.value });
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground px-1">الدولة</label>
                  <select
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
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground px-1">المنطقة الزمنية</label>
                  <select
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
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground px-1">المدير المسئول</label>
                  <select
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
                  </select>
                </div>
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

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground px-1">العنوان بالتفصيل</label>
                <textarea
                  required
                  rows={3}
                  placeholder="مثال: حي الياسمين، طريق الملك عبدالعزيز..."
                  value={isCreateOpen ? createForm.address : editingLocation?.address ?? ""}
                  onChange={(e) => {
                    if (isCreateOpen) setCreateForm(prev => ({ ...prev, address: e.target.value }));
                    else if (editingLocation) setEditingLocation({ ...editingLocation, address: e.target.value });
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-secondary/40 border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all resize-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingLocation(null);
                    setFormError("");
                  }}
                  className="px-6 py-2.5 rounded-xl border border-border hover:bg-secondary/50 transition-all font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createLocationMutation.isPending || updateLocationMutation.isPending}
                  className="px-8 py-2.5 rounded-xl gradient-brand text-white font-bold hover:opacity-90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  {(createLocationMutation.isPending || updateLocationMutation.isPending) ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      حفظ البيانات
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                هل أنت متأكد من حذف فرع <span className="text-foreground font-bold font-mono">"{deletingLocation.name_ar || deletingLocation.name}"</span>؟
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

