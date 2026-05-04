"use client";

import { useState, useEffect } from "react";
import { Settings, User, Building2, CreditCard, Bell, Shield, Globe, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState("");

  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  const [academy, setAcademy] = useState({
    name: "",
    business_name: "",
    default_currency: "SAR",
    timezone: "Asia/Riyadh",
  });
  const profileNamesInvalid = !profile.first_name.trim() || !profile.last_name.trim();
  const canEditAcademy = ["platform_admin", "tenant_owner", "manager"].includes(userRole);

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
            default_currency: tenantResult.value.data.default_currency || "SAR",
            timezone: tenantResult.value.data.timezone || "Asia/Riyadh",
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

  const tabs = [
    { id: "profile", label: "الملف الشخصي", icon: User },
    { id: "academy", label: "إعدادات الأكاديمية", icon: Building2 },
    { id: "billing", label: "الفوترة والدفع", icon: CreditCard },
    { id: "notifications", label: "الإشعارات", icon: Bell },
    { id: "security", label: "الأمان", icon: Shield },
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          الإعدادات
        </h1>
        <p className="text-muted-foreground text-sm mt-1">تخصيص حسابك وإعدادات النظام</p>
      </div>

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
                    <select
                      className="w-full p-2.5 rounded-lg border bg-background/50 focus:border-primary/50 outline-none transition-all text-sm"
                      value={academy.default_currency}
                      onChange={(e) => setAcademy({ ...academy, default_currency: e.target.value })}
                    >
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="AED">درهم إماراتي (AED)</option>
                      <option value="KWD">دينار كويتي (KWD)</option>
                      <option value="BHD">دينار بحريني (BHD)</option>
                      <option value="OMR">ريال عماني (OMR)</option>
                      <option value="QAR">ريال قطري (QAR)</option>
                      <option value="EGP">جنيه مصري (EGP)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">المنطقة الزمنية</label>
                    <select
                      className="w-full p-2.5 rounded-lg border bg-background/50 focus:border-primary/50 outline-none transition-all text-sm"
                      value={academy.timezone}
                      onChange={(e) => setAcademy({ ...academy, timezone: e.target.value })}
                    >
                      <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                      <option value="Asia/Kuwait">Asia/Kuwait (GMT+3)</option>
                      <option value="Asia/Qatar">Asia/Qatar (GMT+3)</option>
                      <option value="Africa/Cairo">Africa/Cairo (GMT+2)</option>
                    </select>
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

          {activeTab !== "profile" && activeTab !== "academy" && (
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
