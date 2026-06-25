"use client";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/dashboard/page-header";
import { useState, useEffect } from "react";
import { Settings, User, Building2, CreditCard, Bell, Shield, Globe, Loader2, Save, Palette, Upload, UserCog, AlertTriangle, CheckCircle2, XCircle, Plus, Users, Clock, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { useTenant } from "@/lib/providers/tenant-provider";
import { useSettingsPermissions } from "@/lib/hooks/use-permission";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/constants";
import { useSession } from "next-auth/react";


export default function SettingsPage() {
  const { update: updateSession } = useSession();
  const { refreshTenant } = useTenant();
  const perms = useSettingsPermissions();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedNewOwner, setSelectedNewOwner] = useState("");
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);

  const [saveStatus, setSaveStatus] = useState<Record<string, "idle" | "saving" | "success" | "error">>({
    profile: "idle",
    academy: "idle",
    branding: "idle",
  });

  const [plans, setPlans] = useState<any[]>([]);
  const [subRequests, setSubRequests] = useState<any[]>([]);
  const [tenantFullData, setTenantFullData] = useState<any>(null);

  const [submittingPlanRequest, setSubmittingPlanRequest] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [selectedNewPlan, setSelectedNewPlan] = useState<any>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly" | "biennial">("monthly");

  const refreshRequests = async () => {
    try {
      const res = await api.tenants.subscriptionRequests.list();
      setSubRequests(res.data.results || res.data);
      
      const tRes = await api.tenants.me();
      setTenantFullData(tRes.data);
    } catch (e) {
      console.error(e);
    }
  };


  const [initialProfile, setInitialProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });
  const [profile, setProfile] = useState({ ...initialProfile });

  const [initialAcademy, setInitialAcademy] = useState({
    name: "",
    business_name: "",
    default_currency: "JOD",
    timezone: "Asia/Amman",
  });
  const [academy, setAcademy] = useState({ ...initialAcademy });

  const [initialBranding, setInitialBranding] = useState({
    logoUrl: "",
  });
  const [branding, setBranding] = useState({
    logo: null as File | null,
    logoUrl: "",
  });
  const profileNamesInvalid = !profile.first_name.trim() || !profile.last_name.trim();
  const canEditAcademy = perms.canManageAcademy;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab) {
        setActiveTab(tab);
      }
    }
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [userResult, tenantResult, plansResult, requestsResult] = await Promise.allSettled([
          api.auth.me(),
          api.tenants.me(),
          api.platform.plans.list(),
          api.tenants.subscriptionRequests.list(),
        ]);


        if (userResult.status === "fulfilled") {
          const userData = userResult.value.data;
          const data = {
            first_name: userData.first_name || "",
            last_name: userData.last_name || "",
            email: userData.email || "",
            phone: userData.phone || "",
          };
          setProfile(data);
          setInitialProfile(data);
          setUserRole(userData.role || "");
        } else {
          throw userResult.reason;
        }

        if (tenantResult.status === "fulfilled") {
          const tenantData = tenantResult.value.data;
          setTenantFullData(tenantData);
          const academyData = {

            name: tenantData.name || "",
            business_name: tenantData.business_name || "",
            default_currency: tenantData.default_currency || "JOD",
            timezone: tenantData.timezone || "Asia/Amman",
          };
          setAcademy(academyData);
          setInitialAcademy(academyData);

          const brandingData = {
            logoUrl: tenantData.logo || "",
          };
          setBranding({
            logo: null,
            ...brandingData,
          });
          setInitialBranding(brandingData);
        } else {
          console.error("Error fetching academy settings:", tenantResult.reason);
          toast.error("تعذر تحميل إعدادات الأكاديمية حالياً.");
        }

        if (plansResult.status === "fulfilled") {
          setPlans(plansResult.value.data.results || plansResult.value.data);
        }
        if (requestsResult.status === "fulfilled") {
          setSubRequests(requestsResult.value.data.results || requestsResult.value.data);
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

  const profileHasChanges = JSON.stringify(profile) !== JSON.stringify(initialProfile);
  const academyHasChanges = JSON.stringify(academy) !== JSON.stringify(initialAcademy);
  const brandingHasChanges = !!branding.logo;

  const handleProfileSave = async () => {
    if (profileNamesInvalid) {
      toast.error("الاسم الأول والأخير مطلوبان.");
      return;
    }

    try {
      setSaveStatus(prev => ({ ...prev, profile: "saving" }));
      await api.auth.updateProfile({
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
      });
      await updateSession({
        first_name: profile.first_name,
        last_name: profile.last_name,
      });
      setInitialProfile({ ...profile });
      setSaveStatus(prev => ({ ...prev, profile: "success" }));
      toast.success("تم تحديث الملف الشخصي بنجاح");
      setTimeout(() => setSaveStatus(prev => ({ ...prev, profile: "idle" })), 3000);
    } catch (error) {
      setSaveStatus(prev => ({ ...prev, profile: "error" }));
      toast.error("فشل تحديث الملف الشخصي");
    }
  };

  const handleAcademySave = async () => {
    if (!canEditAcademy) {
      toast.error("ليس لديك صلاحية لتعديل إعدادات الأكاديمية.");
      return;
    }

    try {
      setSaveStatus(prev => ({ ...prev, academy: "saving" }));
      await api.tenants.updateMe({
        name: academy.name,
        business_name: academy.business_name,
        default_currency: academy.default_currency,
        timezone: academy.timezone,
      });
      setInitialAcademy({ ...academy });
      setSaveStatus(prev => ({ ...prev, academy: "success" }));
      toast.success("تم تحديث إعدادات الأكاديمية بنجاح");
      setTimeout(() => setSaveStatus(prev => ({ ...prev, academy: "idle" })), 3000);
    } catch (error) {
      setSaveStatus(prev => ({ ...prev, academy: "error" }));
      toast.error("فشل تحديث إعدادات الأكاديمية");
    }
  };

  const handleBrandingSave = async () => {
    if (!perms.canManageBranding) {
      toast.error("ليس لديك صلاحية لتعديل الهوية البصرية.");
      return;
    }

    try {
      setSaveStatus(prev => ({ ...prev, branding: "saving" }));
      const formData = new FormData();
      if (branding.logo instanceof File) {
        formData.append("logo", branding.logo);
      }

      const response = await api.tenants.updateMe(formData);

      if (response.data) {
        const newData = {
          logoUrl: response.data.logo || branding.logoUrl,
        };
        setBranding({
          logo: null,
          ...newData,
        });
        setInitialBranding(newData);
      }

      await refreshTenant();
      setSaveStatus(prev => ({ ...prev, branding: "success" }));
      toast.success("تم تحديث الهوية البصرية بنجاح");
      setTimeout(() => setSaveStatus(prev => ({ ...prev, branding: "idle" })), 3000);
    } catch (error) {
      setSaveStatus(prev => ({ ...prev, branding: "error" }));
      toast.error("فشل تحديث الهوية البصرية");
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
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-end",
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

                    className="w-full p-2.5 rounded-lg border bg-background/50 focus:border-primary/50 outline-none transition-all"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">البريد الإلكتروني</label>
                  <input
                    type="email"

                    className="w-full p-2.5 rounded-lg border bg-muted/50 cursor-not-allowed outline-none"
                    value={profile.email}
                    readOnly
                  />
                </div>
              </div>
              <button
                onClick={handleProfileSave}
                disabled={saveStatus.profile === "saving" || profileNamesInvalid || !profileHasChanges}
                className={cn(
                  "px-6 py-2.5 rounded-lg text-white text-sm font-medium shadow-lg transition-all flex items-center gap-2 disabled:opacity-50",
                  saveStatus.profile === "success" ? "bg-green-600" : "gradient-brand hover:opacity-90"
                )}
              >
                {saveStatus.profile === "saving" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saveStatus.profile === "success" ? (
                  <Shield className="w-4 h-4" /> // Using Shield as a checkmark-like icon or just use Save
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saveStatus.profile === "saving" ? "جاري الحفظ..." :
                  saveStatus.profile === "success" ? "تم الحفظ بنجاح" : "حفظ التغييرات"}
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
                disabled={saveStatus.academy === "saving" || !canEditAcademy || !academyHasChanges}
                className={cn(
                  "px-6 py-2.5 rounded-lg text-white text-sm font-medium shadow-lg transition-all flex items-center gap-2 disabled:opacity-50",
                  saveStatus.academy === "success" ? "bg-green-600" : "gradient-brand hover:opacity-90"
                )}
              >
                {saveStatus.academy === "saving" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saveStatus.academy === "success" ? (
                  <Shield className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saveStatus.academy === "saving" ? "جاري الحفظ..." :
                  saveStatus.academy === "success" ? "تم الحفظ بنجاح" : "حفظ التغييرات"}
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

              <div className="grid grid-cols-1 gap-6 max-w-md">
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
              </div>
              <button
                onClick={handleBrandingSave}
                disabled={saveStatus.branding === "saving" || !brandingHasChanges}
                className={cn(
                  "px-6 py-2.5 rounded-lg text-white text-sm font-medium shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 mt-6",
                  saveStatus.branding === "success" ? "bg-green-600" : "gradient-brand hover:opacity-90"
                )}
              >
                {saveStatus.branding === "saving" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saveStatus.branding === "success" ? (
                  <Shield className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saveStatus.branding === "saving" ? "جاري الحفظ..." :
                  saveStatus.branding === "success" ? "تم الحفظ بنجاح" : "حفظ الهوية البصرية"}
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

          {activeTab === "billing" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h2 className="text-xl font-black text-white">إدارة اشتراك الأكاديمية</h2>
                <p className="text-sm text-muted-foreground mt-1">تتبع حدود باقتك الحالية واطلب الترقية أو تغيير الباقة بسهولة.</p>
              </div>
              <hr className="border-white/5" />

              {/* Active Plan Stats */}
              {tenantFullData && (
                <div className="space-y-6">
                  {/* Current Active Plan Overview */}
                  {(() => {
                    const currentPlan = plans.find(p => p.id === tenantFullData.plan);
                    const limitsExceeded = 
                      (tenantFullData.active_students_count > (currentPlan?.max_students ?? 0)) ||
                      (tenantFullData.active_locations_count > (currentPlan?.max_locations ?? 0)) ||
                      (tenantFullData.active_staff_count > (currentPlan?.max_staff ?? 0));

                    return (
                      <div className={cn(
                        "p-6 rounded-3xl border relative overflow-hidden transition-all duration-300",
                        limitsExceeded 
                          ? "bg-destructive/10 border-destructive/20 text-white" 
                          : "bg-white/[0.02] border-white/5 text-white"
                      )}>
                        <div className="absolute top-0 end-0 w-64 h-64 bg-primary/5 blur-[80px] -me-32 -mt-32 pointer-events-none" />
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                          <div className="space-y-2">
                            {tenantFullData.status === "trial" ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border bg-amber-500/10 border-amber-500/20 text-amber-400">
                                  فترة تجريبية مجانية (14 يوماً)
                                </span>
                                <span className="px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border bg-primary/10 border-primary/20 text-primary">
                                  تفعيل تلقائي بعد التجربة
                                </span>
                              </div>
                            ) : (
                              <span className="px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border bg-primary/10 border-primary/20 text-primary">
                                الباقة الحالية النشطة
                              </span>
                            )}
                            <h3 className="text-2xl font-black mt-2 text-white">{currentPlan?.name || "الباقة الافتراضية"}</h3>
                            <p className="text-sm text-muted-foreground max-w-xl">
                              {tenantFullData.status === "trial"
                                ? `أنت حالياً في الفترة التجريبية المجانية. سيتم تفعيل باقة "${currentPlan?.name || "الباقة المختارة"}" والفوترة تلقائياً بمجرد انتهاء فترة التجربة.`
                                : (currentPlan?.description || "باقة مخصصة لإدارة الأندية والأكاديميات بكفاءة.")}
                            </p>
                          </div>

                          <div className="text-start md:text-end shrink-0">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-1">قيمة الاشتراك</span>
                            {currentPlan?.price_yearly && parseFloat(currentPlan.price_yearly) > 0 ? (
                              <>
                                <span className="text-3xl font-black text-primary"><bdi>{currentPlan.price_yearly} {currentPlan.currency}</bdi></span>
                                <span className="text-xs font-bold text-muted-foreground block mt-1">سنوياً</span>
                              </>
                            ) : (
                              <>
                                <span className="text-3xl font-black text-primary"><bdi>{currentPlan?.price_monthly ?? 0} {currentPlan?.currency ?? "JOD"}</bdi></span>
                                <span className="text-xs font-bold text-muted-foreground block mt-1">شهرياً</span>
                              </>
                            )}
                          </div>
                        </div>

                        {tenantFullData.status === "trial" && (
                          <div className="mt-6 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm font-bold">
                            <div className="flex items-center gap-3">
                              <Clock className="w-5 h-5 shrink-0 animate-pulse text-amber-500" />
                              <div className="text-start">
                                <p className="text-white font-black">الحساب في الفترة التجريبية</p>
                                <p className="text-xs text-muted-foreground mt-0.5">سيتم بدء اشتراكك الفعلي في باقة {currentPlan?.name || "الباقة المختارة"} فور انتهاء التجربة.</p>
                              </div>
                            </div>
                            <div className="bg-amber-500/10 px-4 py-2 rounded-xl text-center border border-amber-500/25 min-w-[120px] shrink-0">
                              <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">المتبقي بالتجربة</p>
                              <p className="text-lg font-black text-white">
                                {tenantFullData.trial_days_remaining !== null && tenantFullData.trial_days_remaining !== undefined ? (
                                  tenantFullData.trial_days_remaining === 0 ? "ينتهي اليوم" :
                                  tenantFullData.trial_days_remaining === 1 ? "يوم واحد" :
                                  tenantFullData.trial_days_remaining === 2 ? "يومان" :
                                  `${tenantFullData.trial_days_remaining} يوم`
                                ) : "بضعة أيام"}
                              </p>
                            </div>
                          </div>
                        )}

                        {limitsExceeded && (
                          <div className="mt-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3 text-sm font-bold animate-pulse">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            <span>تنبيه: لقد تجاوزت بعض حدود باقتك الحالية. يرجى الترقية أو تقليل أعداد السجلات النشطة للعودة للحد الطبيعي.</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Limits Progress Grid */}
                  {(() => {
                    const currentPlan = plans.find(p => p.id === tenantFullData.plan);
                    const getProgressPct = (curr: number, max: number) => Math.min(100, Math.round((curr / (max || 1)) * 100));

                    const stats = [
                      {
                        label: "الفروع النشطة",
                        curr: tenantFullData.active_locations_count ?? 0,
                        max: currentPlan?.max_locations ?? 1,
                        icon: Building2,
                        color: "primary"
                      },
                      {
                        label: "الطلاب النشطون",
                        curr: tenantFullData.active_students_count ?? 0,
                        max: currentPlan?.max_students ?? 100,
                        icon: Users,
                        color: "emerald"
                      },
                      {
                        label: "الموظفون النشطون",
                        curr: tenantFullData.active_staff_count ?? 0,
                        max: currentPlan?.max_staff ?? 10,
                        icon: UserCog,
                        color: "amber"
                      }
                    ];

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {stats.map(s => {
                          const pct = getProgressPct(s.curr, s.max);
                          const exceeded = s.curr > s.max;
                          return (
                            <div key={s.label} className={cn(
                              "glass-card p-5 space-y-4 border transition-all",
                              exceeded ? "border-destructive/30 bg-destructive/5" : "border-white/5"
                            )}>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-muted-foreground">{s.label}</span>
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center bg-white/5",
                                  exceeded ? "text-destructive" : "text-primary"
                                )}>
                                  <s.icon className="w-4 h-4" />
                                </div>
                              </div>

                              <div className="flex items-baseline justify-between gap-2">
                                <span className={cn("text-2xl font-black", exceeded ? "text-destructive" : "text-white")}>
                                  {s.curr}
                                </span>
                                <span className="text-xs font-bold text-muted-foreground">من أصل {s.max}</span>
                              </div>

                              <div className="space-y-1">
                                <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                                  <div 
                                    className={cn(
                                      "h-full rounded-full transition-all duration-500",
                                      exceeded ? "bg-destructive shadow-md shadow-destructive/20" : "bg-primary shadow-md shadow-primary/20"
                                    )} 
                                    style={{ width: `${pct}%` }} 
                                  />
                                </div>
                                <div className="flex justify-between text-[10px] font-bold text-muted-foreground/60">
                                  <span>{pct}%</span>
                                  {exceeded && <span className="text-destructive font-black">تجاوزت الحد!</span>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Plans Catalog Grid */}
              <div className="space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-white">استعراض الباقات المتاحة</h3>
                    <p className="text-sm text-muted-foreground mt-1">اختر الباقة المناسبة لاحتياجاتك واطلب الترقية فوراً.</p>
                  </div>

                  {/* Selector Toggle */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-1 flex gap-1 items-center self-start lg:self-auto shrink-0 shadow-lg">
                    <button
                      type="button"
                      onClick={() => setBillingCycle("monthly")}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-black transition-all",
                        billingCycle === "monthly"
                          ? "bg-primary text-white shadow-md shadow-primary/20"
                          : "text-muted-foreground hover:text-white"
                      )}
                    >
                      شهري
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle("yearly")}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 relative overflow-hidden",
                        billingCycle === "yearly"
                          ? "bg-primary text-white shadow-md shadow-primary/20"
                          : "text-muted-foreground hover:text-white"
                      )}
                    >
                      <span>سنوي</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        وفر شهر (8.3%-)
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle("biennial")}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5",
                        billingCycle === "biennial"
                          ? "bg-primary text-white shadow-md shadow-primary/20"
                          : "text-muted-foreground hover:text-white"
                      )}
                    >
                      <span>سنتين</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                        وفر 3 أشهر (12.5%-)
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plans.map(p => {
                    const isCurrent = tenantFullData && p.id === tenantFullData.plan;
                    const monthly = parseFloat(p.price_monthly) || 0;
                    const currency = p.currency || "SAR";
                    
                    let priceVal = monthly;
                    let savingsVal = 0;
                    let originalVal = 0;
                    let monthlyEquivalent = monthly;

                    if (billingCycle === "yearly") {
                      originalVal = monthly * 12;
                      priceVal = monthly * 11;
                      savingsVal = monthly;
                      monthlyEquivalent = priceVal / 12;
                    } else if (billingCycle === "biennial") {
                      originalVal = monthly * 24;
                      priceVal = monthly * 21;
                      savingsVal = monthly * 3;
                      monthlyEquivalent = priceVal / 24;
                    }

                    return (
                      <div key={p.id} className={cn(
                        "glass-card p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:scale-[1.02]",
                        isCurrent 
                          ? "border-primary bg-primary/[0.04] shadow-xl shadow-primary/10" 
                          : "border-white/5 hover:border-white/10 hover:bg-white/[0.01]"
                      )}>
                        {isCurrent && (
                          <span className="absolute top-4 end-4 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-[9px] font-black uppercase tracking-widest z-10">
                            الباقة النشطة
                          </span>
                        )}

                        {/* Subtle decorative glow */}
                        <div className="absolute top-0 end-0 w-24 h-24 bg-primary/5 blur-2xl rounded-full pointer-events-none" />

                        <div className="space-y-5 pt-4 text-start">
                          <div>
                            <h4 className={cn(
                              "text-lg font-black transition-colors",
                              isCurrent ? "text-primary" : "text-white"
                            )}>{p.name}</h4>
                            <p className="text-xs text-muted-foreground mt-1.5 min-h-[2.5rem] leading-relaxed">
                              {p.description || "باقة مرنة وسريعة للأندية الناشئة."}
                            </p>
                          </div>

                          <div className="py-4 px-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-2 text-start">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                {billingCycle === "monthly" ? "الاشتراك الشهري" : billingCycle === "yearly" ? "الاشتراك السنوي" : "الاشتراك لسنتين"}
                              </span>
                              <div className="flex flex-col items-end">
                                {billingCycle !== "monthly" && originalVal > 0 && (
                                  <span className="text-xs text-muted-foreground/60 line-through font-bold mb-0.5">
                                    <bdi>{originalVal.toFixed(2)} {currency}</bdi>
                                  </span>
                                )}
                                <div className="flex items-baseline gap-1">
                                  <span className="text-2xl font-black text-primary"><bdi>{priceVal.toFixed(2)}</bdi></span>
                                  <span className="text-[10px] text-muted-foreground font-black uppercase">{currency}</span>
                                </div>
                              </div>
                            </div>

                            {billingCycle !== "monthly" && (
                              <div className="pt-2 border-t border-white/5 flex flex-col gap-1 text-emerald-400 text-[10px] font-bold">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1 text-[10px]">
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span>ما يعادل {monthlyEquivalent.toFixed(2)} {currency}/شهر</span>
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black animate-pulse">
                                    وفرت {savingsVal.toFixed(2)} {currency}!
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-2 py-1">
                            <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl py-2 px-1 text-center">
                              <p className="text-[9px] font-black text-muted-foreground mb-0.5">الطلاب</p>
                              <p className="text-xs font-black text-white">{p.max_students}</p>
                            </div>
                            <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl py-2 px-1 text-center">
                              <p className="text-[9px] font-black text-muted-foreground mb-0.5">الفروع</p>
                              <p className="text-xs font-black text-white">{p.max_locations}</p>
                            </div>
                            <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl py-2 px-1 text-center">
                              <p className="text-[9px] font-black text-muted-foreground mb-0.5">الموظفين</p>
                              <p className="text-xs font-black text-white">{p.max_staff}</p>
                            </div>
                          </div>
                        </div>

                        <div className="pt-6 mt-6 border-t border-white/5">
                          {isCurrent ? (
                            <button disabled className="w-full py-3 rounded-xl bg-white/5 border border-white/5 text-muted-foreground text-xs font-black cursor-not-allowed">
                              {tenantFullData?.status === "trial" ? "سيتم التفعيل تلقائياً بعد التجربة" : "أنت مشترك في هذه الباقة"}
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedNewPlan(p);
                                setShowPlanModal(true);
                              }}
                              className="w-full py-3 rounded-xl bg-primary text-white text-xs font-black hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                              اطلب الانتقال لهذه الباقة
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* History Table */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-black text-white">سجل طلبات تغيير الباقات</h3>
                  <p className="text-sm text-muted-foreground mt-1">متابعة حالة طلبات الترقية أو التعديل المقدمة لمدير النظام.</p>
                </div>

                {subRequests.length === 0 ? (
                  <div className="glass-card py-12 text-center border-dashed border-white/10 bg-transparent flex flex-col items-center justify-center">
                    <CreditCard className="w-10 h-10 text-muted-foreground/30 mb-4" />
                    <p className="text-sm text-muted-foreground">لا يوجد أي طلبات سابقة لتغيير الباقة.</p>
                  </div>
                ) : (
                  <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-start">
                        <thead>
                          <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            <th className="py-4 px-5 text-start">الباقة المطلوبة</th>
                            <th className="py-4 px-5 text-start">السبب</th>
                            <th className="py-4 px-5 text-start">تاريخ الطلب</th>
                            <th className="py-4 px-5 text-start">الحالة</th>
                            <th className="py-4 px-5 text-start">ملاحظات الإدارة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm text-white font-medium">
                          {subRequests.map(req => (
                            <tr key={req.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="py-4 px-5 text-start">
                                <span className="font-bold">{req.new_plan_name}</span>
                                {req.old_plan_name && <span className="text-[10px] text-muted-foreground block mt-0.5">بدلاً من {req.old_plan_name}</span>}
                              </td>
                              <td className="py-4 px-5 text-start max-w-xs truncate" title={req.reason}>
                                {req.reason || "—"}
                              </td>
                              <td className="py-4 px-5 text-start text-xs text-muted-foreground">
                                <bdi>{new Date(req.created_at).toLocaleDateString("ar-SA")}</bdi>
                              </td>
                              <td className="py-4 px-5 text-start">
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                  req.status === "pending" && "bg-amber-500/10 border-amber-500/20 text-amber-400",
                                  req.status === "approved" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                                  req.status === "rejected" && "bg-red-500/10 border-red-500/20 text-red-400"
                                )}>
                                  {req.status === "pending" && "معلق"}
                                  {req.status === "approved" && "مقبول ✓"}
                                  {req.status === "rejected" && "مرفوض ✗"}
                                </span>
                              </td>
                              <td className="py-4 px-5 text-start max-w-xs text-xs text-muted-foreground" title={req.admin_notes}>
                                {req.admin_notes || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Upgrade Request Modal */}
              {showPlanModal && selectedNewPlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="w-full max-w-md glass-card p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200 border-white/10">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-6 h-6 text-primary" />
                      <h2 className="text-xl font-black text-white">طلب تغيير باقة الاشتراك</h2>
                    </div>

                    {(() => {
                      const monthly = parseFloat(selectedNewPlan.price_monthly) || 0;
                      const currency = selectedNewPlan.currency || "SAR";
                      let priceVal = monthly;
                      let cycleTextText = "شهرياً";
                      let savingsText = "";

                      if (billingCycle === "yearly") {
                        priceVal = monthly * 11;
                        cycleTextText = "سنوياً (خصم 8.3% - وفرت شهر!)";
                        savingsText = `توفير: وفرت ${monthly.toFixed(2)} ${currency} سنوياً!`;
                      } else if (billingCycle === "biennial") {
                        priceVal = monthly * 21;
                        cycleTextText = "كل سنتين (خصم 12.5% - وفرت 3 أشهر!)";
                        savingsText = `توفير: وفرت ${(monthly * 3).toFixed(2)} ${currency} كل سنتين!`;
                      }

                      return (
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2 text-start text-xs">
                          <p className="text-muted-foreground">الباقة المستهدفة: <strong className="text-white font-bold">{selectedNewPlan.name}</strong></p>
                          <p className="text-muted-foreground">دورة الدفع المطلوبة: <strong className="text-white font-bold">{billingCycle === "monthly" ? "شهري" : billingCycle === "yearly" ? "سنوي" : "سنتين"}</strong></p>
                          <p className="text-muted-foreground">
                            قيمة الاشتراك المقدرة:{" "}
                            <strong className="text-white font-bold">{priceVal.toFixed(2)} {currency} {cycleTextText}</strong>
                          </p>
                          {savingsText && (
                            <p className="text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>{savingsText}</span>
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    <div className="space-y-2 text-start">
                      <label className="text-sm font-bold text-white">سبب طلب تغيير الباقة (اختياري)</label>
                      <textarea
                        rows={4}
                        placeholder="اكتب هنا التفاصيل الإضافية أو المتطلبات الخاصة بك لمدير المنصة..."
                        className="w-full p-3 rounded-xl border bg-background/50 border-white/5 focus:border-primary/50 outline-none text-sm text-white transition-all placeholder:text-muted-foreground/40"
                        value={requestReason}
                        onChange={(e) => setRequestReason(e.target.value)}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        onClick={() => {
                          setShowPlanModal(false);
                          setRequestReason("");
                        }}
                        className="px-6 py-2.5 rounded-xl border border-white/10 text-white text-xs font-black hover:bg-white/5 active:scale-95 transition-all"
                      >
                        إلغاء
                      </button>
                      <button
                        disabled={submittingPlanRequest}
                        onClick={async () => {
                          try {
                            setSubmittingPlanRequest(true);
                            const cycleText = billingCycle === "monthly" ? "شهري" : billingCycle === "yearly" ? "سنوي (1 سنة)" : "سنتين (2 سنة)";
                            const reasonPayload = `[دورة الدفع المطلوبة: ${cycleText}]\n${requestReason}`;
                            await api.tenants.subscriptionRequests.create({
                              new_plan: selectedNewPlan.id,
                              billing_cycle: billingCycle,
                              reason: reasonPayload
                            });
                            toast.success("تم إرسال طلب تغيير الباقة بنجاح ✓");
                            setShowPlanModal(false);
                            setRequestReason("");
                            await refreshRequests();
                          } catch (e: any) {
                            toast.error(e.response?.data?.non_field_errors?.[0] || e.response?.data?.error || "فشل إرسال الطلب. قد يكون لديك طلب معلق بالفعل.");
                          } finally {
                            setSubmittingPlanRequest(false);
                          }
                        }}
                        className="px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-black hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
                      >
                        {submittingPlanRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : "إرسال الطلب الآن"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab !== "profile" && activeTab !== "academy" && activeTab !== "branding" && activeTab !== "security" && activeTab !== "billing" && (
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
