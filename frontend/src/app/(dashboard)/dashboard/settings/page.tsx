"use client";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/dashboard/page-header";
import { useState, useEffect } from "react";
import { Settings, User, Building2, CreditCard, Bell, Shield, Globe, Loader2, Save, Palette, Upload, UserCog, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { useTenant } from "@/lib/providers/tenant-provider";
import { useSettingsPermissions } from "@/lib/hooks/use-permission";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/constants";


export default function SettingsPage() {
  const { refreshTenant } = useTenant();
  const perms = useSettingsPermissions();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedNewOwner, setSelectedNewOwner] = useState("");
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  const [academy, setAcademy] = useState({
    name: "",
    business_name: "",
    default_currency: "JOD",
    timezone: "Asia/Amman",
  });

  const [branding, setBranding] = useState({
    logo: null as File | null,
    favicon: null as File | null,
    logoUrl: "",
    faviconUrl: "",
  });
  const profileNamesInvalid = !profile.first_name.trim() || !profile.last_name.trim();
  const canEditAcademy = perms.canManageAcademy;

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [userResult, tenantResult] = await Promise.allSettled([
          api.auth.me(),
          api.tenants.me(),
        ]);

        if (userResult.status === "fulfilled") {
          const userData = userResult.value.data;
          setProfile({
            first_name: userData.first_name || "",
            last_name: userData.last_name || "",
            email: userData.email || "",
            phone: userData.phone || "",
          });
          setUserRole(userData.role || "");
        } else {
          throw userResult.reason;
        }

        if (tenantResult.status === "fulfilled") {
          setAcademy({
            name: tenantResult.value.data.name || "",
            business_name: tenantResult.value.data.business_name || "",
            default_currency: tenantResult.value.data.default_currency || "JOD",
            timezone: tenantResult.value.data.timezone || "Asia/Amman",
          });
          setBranding({
            logo: null,
            favicon: null,
            logoUrl: tenantResult.value.data.logo || "",
            faviconUrl: tenantResult.value.data.favicon || "",
          });
        } else {
          console.error("Error fetching academy settings:", tenantResult.reason);
          toast.error("تعذر تحميل إعدادات الأكاديمية حالياً.");
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
        toast.error("تعذر تحميل البيانات. يرجى المحاولة لاحقاً.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === "security" && userRole === "tenant_owner") {
      api.staff.list().then(res => {
        // Only show staff that are NOT the current owner
        const others = res.data.results.filter((s: any) => s.role !== "tenant_owner");
        setStaff(others);
      });
    }
  }, [activeTab, userRole]);

  useEffect(() => {
    if (activeTab === "security" && userRole === "tenant_owner") {
      api.staff.list().then(res => {
        // Only show staff that are NOT the current owner
        const others = res.data.results.filter((s: any) => s.role !== "tenant_owner");
        setStaff(others);
      });
    }
  }, [activeTab, userRole]);

  const handleProfileSave = async () => {
    if (profileNamesInvalid) {
      toast.error("الاسم الأول والأخير مطلوبان.");
      return;
    }

    try {
      setSaving(true);
      await api.auth.updateProfile({
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
      });
      toast.success("تم تحديث الملف الشخصي بنجاح");
    } catch (error) {
      toast.error("فشل تحديث الملف الشخصي");
    } finally {
      setSaving(false);
    }
  };

  const handleAcademySave = async () => {
    if (!canEditAcademy) {
      toast.error("ليس لديك صلاحية لتعديل إعدادات الأكاديمية.");
      return;
    }

    try {
      setSaving(true);
      await api.tenants.updateMe({
        name: academy.name,
        business_name: academy.business_name,
        default_currency: academy.default_currency,
        timezone: academy.timezone,
      });
      toast.success("تم تحديث إعدادات الأكاديمية بنجاح");
    } catch (error) {
      toast.error("فشل تحديث إعدادات الأكاديمية");
    } finally {
      setSaving(false);
    }
  };

  const handleBrandingSave = async () => {
    if (!perms.canManageBranding) {
      toast.error("ليس لديك صلاحية لتعديل الهوية البصرية.");
      return;
    }

    try {
      setSaving(true);
      const formData = new FormData();
      if (branding.logo instanceof File) {
        formData.append("logo", branding.logo);
      }
      if (branding.favicon instanceof File) {
        formData.append("favicon", branding.favicon);
      }

      const response = await api.tenants.updateMe(formData);
      
      // Update the local state with new URLs after successful save
      if (response.data) {
        setBranding({
          logo: null,
          favicon: null,
          logoUrl: response.data.logo || branding.logoUrl,
          faviconUrl: response.data.favicon || branding.faviconUrl,
        });
      }
      
      await refreshTenant();
      toast.success("تم تحديث الهوية البصرية بنجاح");
    } catch (error) {
      toast.error("فشل تحديث الهوية البصرية");
    } finally {
      setSaving(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedNewOwner) return;

    try {
      setTransferring(true);
      await api.tenants.transferOwnership(selectedNewOwner);
      toast.success("تم نقل ملكية النادي بنجاح. سيتم تحديث صلاحياتك.");
      setShowTransferConfirm(false);
      // Reload page to reflect role changes
      window.location.reload();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "فشل نقل الملكية");
    } finally {
      setTransferring(false);
    }
  };

  const tabs = [
    { id: "profile", label: "الملف الشخصي", icon: User },
    ...(perms.canManageAcademy ? [{ id: "academy", label: "إعدادات الأكاديمية", icon: Building2 }] : []),
    ...(perms.canManageBranding ? [{ id: "branding", label: "الهوية البصرية", icon: Palette }] : []),
    { id: "billing", label: "الفوترة والدفع", icon: CreditCard },
    { id: "notifications", label: "الإشعارات", icon: Bell },
    ...(userRole === "tenant_owner" ? [{ id: "security", label: "الأمان", icon: Shield }] : []),
    { id: "preferences", label: "التفضيلات", icon: Globe },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-12">
      <PageHeader
        title="الإعدادات"
        description="تخصيص حسابك الشخصي، إدارة بيانات الأكاديمية، والتحكم في الهوية البصرية وتفضيلات النظام."
        icon={Settings}
      />

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 shrink-0 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-right",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "text-primary" : "text-muted-foreground")} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 glass-card p-6 min-h-[500px]">
          {activeTab === "profile" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h2 className="text-lg font-semibold">الملف الشخصي</h2>
                <p className="text-sm text-muted-foreground">قم بتحديث معلوماتك الشخصية</p>
              </div>
              <hr className="border-border/50" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                <div className="space-y-2">
                  <label className="text-sm font-medium">الاسم الأول</label>
                  <input
                    type="text"
                    className="w-full p-2.5 rounded-lg border bg-background/50 focus:border-primary/50 outline-none transition-all"
                    value={profile.first_name}
                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">الاسم الأخير</label>
                  <input
                    type="text"
                    className="w-full p-2.5 rounded-lg border bg-background/50 focus:border-primary/50 outline-none transition-all"
                    value={profile.last_name}
                    onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">رقم الهاتف</label>
                  <input
                    type="text"
                    dir="ltr"
                    className="w-full p-2.5 rounded-lg border bg-background/50 focus:border-primary/50 outline-none transition-all"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">البريد الإلكتروني</label>
                  <input
                    type="email"
                    dir="ltr"
                    className="w-full p-2.5 rounded-lg border bg-muted/50 cursor-not-allowed outline-none"
                    value={profile.email}
                    readOnly
                  />
                </div>
              </div>
              <button
                onClick={handleProfileSave}
                disabled={saving || profileNamesInvalid}
                className="px-6 py-2.5 rounded-lg gradient-brand text-white text-sm font-medium shadow-lg hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ التغييرات
              </button>
              {profileNamesInvalid && (
                <p className="text-sm text-destructive">
                  الاسم الأول والأخير مطلوبان قبل الحفظ.
                </p>
              )}
            </div>
          )}

          {activeTab === "academy" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h2 className="text-lg font-semibold">إعدادات الأكاديمية</h2>
                <p className="text-sm text-muted-foreground">تخصيص هوية الأكاديمية ومعلوماتها العامة</p>
              </div>
              <hr className="border-border/50" />
              <div className="max-w-2xl space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">اسم الأكاديمية</label>
                  <input
                    type="text"
                    className="w-full p-2.5 rounded-lg border bg-background/50 focus:border-primary/50 outline-none transition-all"
                    value={academy.name}
                    onChange={(e) => setAcademy({ ...academy, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">الاسم التجاري</label>
                  <input
                    type="text"
                    className="w-full p-2.5 rounded-lg border bg-background/50 focus:border-primary/50 outline-none transition-all"
                    value={academy.business_name}
                    onChange={(e) => setAcademy({ ...academy, business_name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">العملة الافتراضية</label>
                    <Select
                      value={academy.default_currency}
                      onChange={(e) => setAcademy({ ...academy, default_currency: e.target.value })}
                    >
                      <option value="JOD">دينار أردني (JOD)</option>
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="AED">درهم إماراتي (AED)</option>
                      <option value="KWD">دينار كويتي (KWD)</option>
                      <option value="BHD">دينار بحريني (BHD)</option>
                      <option value="OMR">ريال عماني (OMR)</option>
                      <option value="QAR">ريال قطري (QAR)</option>
                      <option value="EGP">جنيه مصري (EGP)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">المنطقة الزمنية</label>
                    <Select
                      value={academy.timezone}
                      onChange={(e) => setAcademy({ ...academy, timezone: e.target.value })}
                    >
                      <option value="Asia/Amman">Asia/Amman (GMT+3)</option>
                      <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                      <option value="Asia/Kuwait">Asia/Kuwait (GMT+3)</option>
                      <option value="Asia/Qatar">Asia/Qatar (GMT+3)</option>
                      <option value="Africa/Cairo">Africa/Cairo (GMT+2)</option>
                    </Select>
                  </div>
                </div>
              </div>
              <button
                onClick={handleAcademySave}
                disabled={saving || !canEditAcademy}
                className="px-6 py-2.5 rounded-lg gradient-brand text-white text-sm font-medium shadow-lg hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ التغييرات
              </button>
              {!canEditAcademy && (
                <p className="text-sm text-muted-foreground">
                  يمكنك عرض بيانات الأكاديمية، لكن التعديل متاح للمالك أو المدير فقط.
                </p>
              )}
            </div>
          )}

          {activeTab === "branding" && perms.canManageBranding && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h2 className="text-lg font-semibold">الهوية البصرية</h2>
                <p className="text-sm text-muted-foreground">تخصيص ألوان وشعارات النادي</p>
              </div>
              <hr className="border-border/50" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">شعار النادي (Logo)</label>
                      <div className="relative group border-2 border-dashed border-border rounded-xl p-6 hover:bg-muted/50 transition-colors flex flex-col items-center justify-center text-center cursor-pointer min-h-[150px]">
                        {branding.logo ? (
                          <div className="flex flex-col items-center">
                            <div className="w-16 h-16 rounded-lg overflow-hidden mb-2 bg-background/50 flex items-center justify-center">
                              <img src={URL.createObjectURL(branding.logo)} alt="New Logo" className="max-w-full max-h-full object-contain" />
                            </div>
                            <p className="text-sm text-muted-foreground">{branding.logo.name}</p>
                          </div>
                        ) : branding.logoUrl ? (
                          <div className="flex flex-col items-center">
                            <div className="w-16 h-16 rounded-lg overflow-hidden mb-2 bg-background/50 flex items-center justify-center group-hover:opacity-50 transition-opacity">
                              <img src={branding.logoUrl} alt="Current Logo" className="max-w-full max-h-full object-contain" />
                            </div>
                            <p className="text-sm text-muted-foreground group-hover:text-primary transition-colors">انقر لتغيير الشعار</p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                            <p className="text-sm text-muted-foreground">اضغط لرفع الشعار</p>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setBranding({ ...branding, logo: e.target.files[0] });
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">أيقونة المتصفح (Favicon)</label>
                      <div className="relative group border-2 border-dashed border-border rounded-xl p-6 hover:bg-muted/50 transition-colors flex flex-col items-center justify-center text-center cursor-pointer min-h-[150px]">
                        {branding.favicon ? (
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 rounded-lg overflow-hidden mb-2 bg-background/50 flex items-center justify-center">
                              <img src={URL.createObjectURL(branding.favicon)} alt="New Favicon" className="max-w-full max-h-full object-contain" />
                            </div>
                            <p className="text-sm text-muted-foreground">{branding.favicon.name}</p>
                          </div>
                        ) : branding.faviconUrl ? (
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 rounded-lg overflow-hidden mb-2 bg-background/50 flex items-center justify-center group-hover:opacity-50 transition-opacity">
                              <img src={branding.faviconUrl} alt="Current Favicon" className="max-w-full max-h-full object-contain" />
                            </div>
                            <p className="text-sm text-muted-foreground group-hover:text-primary transition-colors">انقر لتغيير الأيقونة</p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                            <p className="text-sm text-muted-foreground">اضغط لرفع الأيقونة</p>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setBranding({ ...branding, favicon: e.target.files[0] });
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                <button
                  onClick={handleBrandingSave}
                  disabled={saving}
                  className="px-6 py-2.5 rounded-lg gradient-brand text-white text-sm font-medium shadow-lg hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 mt-6"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ الهوية البصرية
                </button>
              </div>
            )}

          {activeTab === "security" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h2 className="text-lg font-semibold">الأمان</h2>
                <p className="text-sm text-muted-foreground">إدارة صلاحيات الوصول ونقل ملكية النادي</p>
              </div>
              <hr className="border-border/50" />

              {userRole === "tenant_owner" ? (
                <div className="space-y-8">
                  <div className="p-6 border border-destructive/20 bg-destructive/5 rounded-2xl space-y-4">
                    <div className="flex items-center gap-3 text-destructive">
                      <AlertTriangle className="w-6 h-6" />
                      <h3 className="font-bold">نقل ملكية النادي</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      نقل الملكية هو إجراء **حساس ودائم**. عند إتمام هذا الإجراء، ستنتقل كافة صلاحيات المالك (بما في ذلك إدارة الإعدادات المالية والفوترة) إلى الموظف المختار، بينما سيتم تحويل حسابك أنت إلى رتبة "مدير".
                    </p>
                    
                    <div className="space-y-2 pt-2">
                      <label className="text-sm font-bold">اختر الموظف الجديد للملكية</label>
                      <Select
                        value={selectedNewOwner}
                        onChange={(e) => setSelectedNewOwner(e.target.value)}
                      >
                        <option value="">-- اختر موظفاً --</option>
                        {staff.map(s => (
                          <option key={s.id} value={s.id}>{s.full_name} ({ROLE_LABELS[s.role as keyof typeof ROLE_LABELS] || s.role})</option>
                        ))}
                      </Select>
                    </div>

                    <button 
                      disabled={!selectedNewOwner}
                      onClick={() => setShowTransferConfirm(true)}
                      className="px-6 py-2.5 rounded-lg bg-destructive text-white text-sm font-bold shadow-lg hover:bg-destructive/90 transition-all disabled:opacity-50"
                    >
                      بدء إجراء نقل الملكية
                    </button>
                  </div>

                  {showTransferConfirm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                      <div className="w-full max-w-md glass-card p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200 border-destructive/30">
                        <div className="flex items-center gap-3 text-destructive">
                          <AlertTriangle className="w-8 h-8" />
                          <h2 className="text-xl font-bold">تأكيد نقل الملكية</h2>
                        </div>
                        <p className="text-sm leading-relaxed">
                          هل أنت متأكد تماماً من رغبتك في نقل ملكية النادي إلى **{staff.find(s => s.id === selectedNewOwner)?.full_name}**؟ 
                          <br /><br />
                          لا يمكن التراجع عن هذا الإجراء إلا بواسطة المالك الجديد.
                        </p>
                        <div className="flex justify-end gap-3 pt-2">
                          <button 
                            onClick={() => setShowTransferConfirm(false)}
                            className="px-6 py-2 rounded-lg border border-border hover:bg-secondary transition-all"
                          >
                            إلغاء
                          </button>
                          <button 
                            disabled={transferring}
                            onClick={handleTransferOwnership}
                            className="px-6 py-2 rounded-lg bg-destructive text-white font-bold hover:bg-destructive/90 flex items-center gap-2 disabled:opacity-50"
                          >
                            {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : "نعم، انقل الملكية الآن"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Shield className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">إعدادات الأمان المتقدمة متاحة لمالك النادي فقط.</p>
                </div>
              )}
            </div>
          )}

          {activeTab !== "profile" && activeTab !== "academy" && activeTab !== "branding" && activeTab !== "security" && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
              <Settings className="w-16 h-16 mb-4 opacity-10 animate-[spin_10s_linear_infinite]" />
              <h3 className="text-lg font-medium">إعدادات {tabs.find((t) => t.id === activeTab)?.label}</h3>
              <p className="text-sm">قريباً...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
