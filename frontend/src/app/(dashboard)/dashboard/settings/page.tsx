"use client";

import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/dashboard/page-header";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import {
  Settings,
  User,
  Building2,
  CreditCard,
  Bell,
  Shield,
  Globe,
  Loader2,
  Save,
  Palette,
  Upload,
  UserCog,
  AlertTriangle,
  CheckCircle2,
  Users,
  Clock,
  Sparkles,
  Stamp,
  PenTool,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Laptop,
  LogOut,
  History,
  Moon,
  Sun,
  Monitor,
  MapPin,
  Camera,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

import { cn, formatDate, formatCurrency } from "@/lib/utils";
import { api, clearCachedSession } from "@/lib/api/client";
import { useTenant } from "@/lib/providers/tenant-provider";
import { useSettingsPermissions } from "@/lib/hooks/use-permission";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/constants";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { removeImageBackground } from "@/lib/image-processing";
import type {
  NotificationPreferences,
  UIPreferences,
  UserSessionItem,
  SecurityActivityItem,
} from "@/types";

function maskEmailAddress(email: string): string {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0] ?? "*"}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

function evaluatePasswordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score += 1;

  const labels = ["ضعيفة جداً", "ضعيفة", "متوسطة", "قوية", "قوية جداً"];
  const colors = [
    "bg-destructive",
    "bg-destructive",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-emerald-400",
  ];
  return {
    score,
    label: labels[score] || labels[0],
    color: colors[score] || colors[0],
  };
}

function summarizeUserAgent(ua: string): string {
  if (!ua) return "جهاز غير معروف";
  const browser = ua.includes("Edg/")
    ? "Edge"
    : ua.includes("Chrome/")
      ? "Chrome"
      : ua.includes("Firefox/")
        ? "Firefox"
        : ua.includes("Safari/")
          ? "Safari"
          : "متصفح ويب";
  const os = ua.includes("Windows")
    ? "Windows"
    : ua.includes("Mac OS")
      ? "macOS"
      : ua.includes("Android")
        ? "Android"
        : ua.includes("iPhone") || ua.includes("iPad")
          ? "iOS"
          : ua.includes("Linux")
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

const SECURITY_ACTION_LABELS: Record<string, string> = {
  login: "تسجيل دخول ناجح",
  logout: "تسجيل خروج / إنهاء جلسة",
  password_change: "تغيير كلمة المرور",
  initial_password_setup: "تفعيل الحساب وضبط كلمة المرور",
  update_permissions: "تحديث صلاحيات موظف",
  transfer_ownership: "نقل ملكية النادي",
};

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  in_app: {
    enabled: true,
    billing: true,
    attendance: true,
    promotions: true,
    security: true,
  },
};

const DEFAULT_UI_PREFS: UIPreferences = {
  theme: "dark",
  compact_tables: false,
  default_dashboard_period: "month",
};

export default function SettingsPage() {
  const { update: updateSession } = useSession();
  const { theme: currentTheme, setTheme } = useTheme();
  const { refreshTenant } = useTenant();
  const queryClient = useQueryClient();
  const perms = useSettingsPermissions();

  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedNewOwner, setSelectedNewOwner] = useState("");
  const [transferPassword, setTransferPassword] = useState("");
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);

  const [saveStatus, setSaveStatus] = useState<
    Record<string, "idle" | "saving" | "success" | "error">
  >({
    profile: "idle",
    academy: "idle",
    branding: "idle",
    password: "idle",
    notifications: "idle",
    preferences: "idle",
  });

  const [plans, setPlans] = useState<any[]>([]);
  const [subRequests, setSubRequests] = useState<any[]>([]);
  const [tenantFullData, setTenantFullData] = useState<any>(null);

  const [submittingPlanRequest, setSubmittingPlanRequest] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [selectedNewPlan, setSelectedNewPlan] = useState<any>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly" | "biennial">("monthly");

  // Profile state
  const [showFullEmail, setShowFullEmail] = useState(false);
  const [userMeta, setUserMeta] = useState<{
    branch_names: string[];
    created_at: string | null;
    last_login: string | null;
    last_login_ip: string | null;
    password_changed_at: string | null;
  }>({
    branch_names: [],
    created_at: null,
    last_login: null,
    last_login_ip: null,
    password_changed_at: null,
  });

  const [initialProfile, setInitialProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    avatarUrl: "",
  });
  const [profile, setProfile] = useState({ ...initialProfile });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  // Security tab state
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    new_password_confirm: "",
    logout_other_devices: true,
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [sessions, setSessions] = useState<UserSessionItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<SecurityActivityItem[]>([]);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [revokingJti, setRevokingJti] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  // Notifications & Preferences state
  const [initialNotifications, setInitialNotifications] =
    useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS);
  const [notifications, setNotifications] =
    useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS);

  const [initialPreferences, setInitialPreferences] = useState<{
    language_pref: "ar" | "en";
    ui_preferences: UIPreferences;
  }>({
    language_pref: "ar",
    ui_preferences: DEFAULT_UI_PREFS,
  });
  const [preferences, setPreferences] = useState({ ...initialPreferences });

  // Academy & Branding state
  const [initialAcademy, setInitialAcademy] = useState({
    name: "",
    business_name: "",
    tax_number: "",
    show_tax_number: true,
    default_currency: "JOD",
    timezone: "Asia/Amman",
  });
  const [academy, setAcademy] = useState({ ...initialAcademy });

  const [initialBranding, setInitialBranding] = useState({
    logoUrl: "",
    stampUrl: "",
    signatureUrl: "",
  });
  const [branding, setBranding] = useState({
    logo: null as File | null,
    logoUrl: "",
    stamp: null as File | null,
    stampUrl: "",
    signature: null as File | null,
    signatureUrl: "",
  });
  const [isProcessingStamp, setIsProcessingStamp] = useState(false);
  const [isProcessingSig, setIsProcessingSig] = useState(false);

  const profileNamesInvalid = !profile.first_name.trim() || !profile.last_name.trim();
  const canEditAcademy = perms.canManageAcademy;
  const canViewSubscriptionBilling =
    perms.canManageAcademy ||
    userRole === "tenant_owner" ||
    userRole === "manager" ||
    userRole === "platform_admin";

  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(passwordForm.new_password),
    [passwordForm.new_password]
  );

  const refreshRequests = async () => {
    try {
      const res = await api.tenants.subscriptionRequests.list();
      setSubRequests(res.data.results || res.data);

      const tRes = await api.tenants.me();
      setTenantFullData(tRes.data);
    } catch {
      // ignore
    }
  };

  const fetchSecurityData = useCallback(async () => {
    try {
      setLoadingSecurity(true);
      const [sessionsRes, activityRes] = await Promise.allSettled([
        api.auth.sessions(),
        api.auth.securityActivity(),
      ]);
      if (sessionsRes.status === "fulfilled") {
        setSessions(sessionsRes.value.data.results || []);
      }
      if (activityRes.status === "fulfilled") {
        setActivityLogs(activityRes.value.data.results || []);
      }
    } finally {
      setLoadingSecurity(false);
    }
  }, []);

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
        const [userResult, tenantResult, plansResult, requestsResult] =
          await Promise.allSettled([
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
            avatarUrl: userData.avatar_url || "",
          };
          setProfile(data);
          setInitialProfile(data);
          setUserRole(userData.role || "");
          setUserMeta({
            branch_names: userData.branch_names || [],
            created_at: userData.created_at || null,
            last_login: userData.last_login || null,
            last_login_ip: userData.last_login_ip || null,
            password_changed_at: userData.password_changed_at || null,
          });

          const notifPrefs: NotificationPreferences = {
            in_app: {
              ...DEFAULT_NOTIFICATIONS.in_app,
              ...(userData.notification_preferences?.in_app || {}),
              security: true,
            },
          };
          setNotifications(notifPrefs);
          setInitialNotifications(notifPrefs);

          const uiPrefs: UIPreferences = {
            ...DEFAULT_UI_PREFS,
            ...(userData.ui_preferences || {}),
          };
          const prefState = {
            language_pref: (userData.language_pref === "en" ? "en" : "ar") as "ar" | "en",
            ui_preferences: uiPrefs,
          };
          setPreferences(prefState);
          setInitialPreferences(prefState);
        } else {
          throw userResult.reason;
        }

        if (tenantResult.status === "fulfilled") {
          const tenantData = tenantResult.value.data;
          setTenantFullData(tenantData);
          const academyData = {
            name: tenantData.name || "",
            business_name: tenantData.business_name || "",
            tax_number: tenantData.tax_number || "",
            show_tax_number:
              tenantData.show_tax_number !== undefined
                ? Boolean(tenantData.show_tax_number)
                : true,
            default_currency: tenantData.default_currency || "JOD",
            timezone: tenantData.timezone || "Asia/Amman",
          };
          setAcademy(academyData);
          setInitialAcademy(academyData);

          const brandingData = {
            logoUrl: tenantData.logo || "",
            stampUrl: tenantData.stamp || "",
            signatureUrl: tenantData.signature || "",
          };
          setBranding({
            logo: null,
            stamp: null,
            signature: null,
            ...brandingData,
          });
          setInitialBranding(brandingData);
        }

        if (plansResult.status === "fulfilled") {
          setPlans(plansResult.value.data.results || plansResult.value.data);
        }
        if (requestsResult.status === "fulfilled") {
          setSubRequests(requestsResult.value.data.results || requestsResult.value.data);
        }
      } catch {
        toast.error("تعذر تحميل البيانات. يرجى المحاولة لاحقاً.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === "security") {
      fetchSecurityData();
      if (userRole === "tenant_owner") {
        api.staff
          .list()
          .then((res) => {
            const others = (res.data.results || []).filter(
              (s: any) => s.role !== "tenant_owner"
            );
            setStaff(others);
          })
          .catch(() => {});
      }
    }
  }, [activeTab, userRole, fetchSecurityData]);

  const profileHasChanges =
    profile.first_name !== initialProfile.first_name ||
    profile.last_name !== initialProfile.last_name ||
    profile.phone !== initialProfile.phone ||
    Boolean(avatarFile) ||
    removeAvatar;

  const academyHasChanges = JSON.stringify(academy) !== JSON.stringify(initialAcademy);
  const notificationsHasChanges =
    JSON.stringify(notifications) !== JSON.stringify(initialNotifications);
  const preferencesHasChanges =
    JSON.stringify(preferences) !== JSON.stringify(initialPreferences);

  const brandingHasChanges =
    Boolean(branding.logo) ||
    Boolean(branding.stamp) ||
    Boolean(branding.signature) ||
    branding.logoUrl !== initialBranding.logoUrl ||
    branding.stampUrl !== initialBranding.stampUrl ||
    branding.signatureUrl !== initialBranding.signatureUrl;

  const handleAvatarFileSelect = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("يرجى اختيار صورة بصيغة PNG أو JPG أو WEBP.");
      return;
    }
    setAvatarFile(file);
    setRemoveAvatar(false);
    setProfile((prev) => ({
      ...prev,
      avatarUrl: URL.createObjectURL(file),
    }));
  };

  const handleProfileSave = async () => {
    if (profileNamesInvalid) {
      toast.error("الاسم الأول والأخير مطلوبان.");
      return;
    }

    try {
      setSaveStatus((prev) => ({ ...prev, profile: "saving" }));
      let response;
      if (avatarFile || removeAvatar) {
        const formData = new FormData();
        formData.append("first_name", profile.first_name.trim());
        formData.append("last_name", profile.last_name.trim());
        formData.append("phone", profile.phone.trim());
        if (avatarFile) {
          formData.append("avatar", avatarFile);
        }
        if (removeAvatar) {
          formData.append("remove_avatar", "true");
        }
        response = await api.auth.updateProfile(formData);
      } else {
        response = await api.auth.updateProfile({
          first_name: profile.first_name.trim(),
          last_name: profile.last_name.trim(),
          phone: profile.phone.trim(),
        });
      }

      const updatedUser = response.data;
      const newAvatarUrl = updatedUser.avatar_url || "";

      await updateSession({
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        image: newAvatarUrl || null,
      });
      clearCachedSession();
      queryClient.invalidateQueries({ queryKey: ["staff"] });

      const syncedProfile = {
        first_name: updatedUser.first_name || profile.first_name.trim(),
        last_name: updatedUser.last_name || profile.last_name.trim(),
        email: updatedUser.email || profile.email,
        phone: updatedUser.phone || "",
        avatarUrl: newAvatarUrl,
      };
      setProfile(syncedProfile);
      setInitialProfile(syncedProfile);
      setAvatarFile(null);
      setRemoveAvatar(false);

      setSaveStatus((prev) => ({ ...prev, profile: "success" }));
      toast.success("تم تحديث الملف الشخصي بنجاح ✓");
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, profile: "idle" })), 3000);
    } catch (err: any) {
      setSaveStatus((prev) => ({ ...prev, profile: "error" }));
      const msg =
        err.response?.data?.avatar?.[0] ||
        err.response?.data?.first_name?.[0] ||
        "فشل تحديث الملف الشخصي";
      toast.error(msg);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.current_password) {
      toast.error("يرجى إدخال كلمة المرور الحالية.");
      return;
    }
    if (passwordForm.new_password.length < 8) {
      toast.error("كلمة المرور الجديدة يجب أن تتكون من 8 أحرف على الأقل.");
      return;
    }
    if (passwordForm.new_password !== passwordForm.new_password_confirm) {
      toast.error("كلمات المرور الجديدة غير متطابقة.");
      return;
    }

    try {
      setSaveStatus((prev) => ({ ...prev, password: "saving" }));
      const res = await api.auth.changePassword(passwordForm);
      if (res.data?.access && res.data?.refresh) {
        await updateSession({
          accessToken: res.data.access,
          refreshToken: res.data.refresh,
        });
        clearCachedSession();
      }
      if (res.data?.password_changed_at) {
        setUserMeta((prev) => ({
          ...prev,
          password_changed_at: res.data.password_changed_at,
        }));
      }
      setPasswordForm({
        current_password: "",
        new_password: "",
        new_password_confirm: "",
        logout_other_devices: true,
      });
      setSaveStatus((prev) => ({ ...prev, password: "success" }));
      toast.success("تم تغيير كلمة المرور وتأمين الحساب بنجاح ✓");
      fetchSecurityData();
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, password: "idle" })), 3000);
    } catch (err: any) {
      setSaveStatus((prev) => ({ ...prev, password: "error" }));
      const data = err.response?.data;
      const msg =
        data?.current_password?.[0] ||
        data?.new_password?.[0] ||
        data?.new_password_confirm?.[0] ||
        data?.error?.message ||
        "فشل تغيير كلمة المرور. تأكد من صحة كلمة المرور الحالية وقوة الجديدة.";
      toast.error(msg);
    }
  };

  const handleRevokeSession = async (jti: string) => {
    try {
      setRevokingJti(jti);
      await api.auth.revokeSession(jti);
      toast.success("تم إنهاء الجلسة بنجاح");
      fetchSecurityData();
    } catch {
      toast.error("تعذر إنهاء الجلسة");
    } finally {
      setRevokingJti(null);
    }
  };

  const handleLogoutAllDevices = async () => {
    try {
      setRevokingAll(true);
      const res = await api.auth.logoutAll(true);
      if (res.data?.access && res.data?.refresh) {
        await updateSession({
          accessToken: res.data.access,
          refreshToken: res.data.refresh,
        });
        clearCachedSession();
      }
      toast.success("تم تسجيل الخروج من جميع الأجهزة الأخرى بنجاح ✓");
      fetchSecurityData();
    } catch {
      toast.error("تعذر إنهاء الجلسات الأخرى");
    } finally {
      setRevokingAll(false);
    }
  };

  const handleNotificationsSave = async () => {
    try {
      setSaveStatus((prev) => ({ ...prev, notifications: "saving" }));
      const res = await api.auth.updateProfile({
        notification_preferences: notifications,
      });
      const updated = res.data?.notification_preferences || notifications;
      setNotifications(updated);
      setInitialNotifications(updated);
      await updateSession({
        notification_preferences: updated,
      });
      clearCachedSession();
      queryClient.invalidateQueries({ queryKey: ["notifications", "in_app"] });
      setSaveStatus((prev) => ({ ...prev, notifications: "success" }));
      toast.success("تم حفظ تفضيلات الإشعارات بنجاح ✓");
      setTimeout(
        () => setSaveStatus((prev) => ({ ...prev, notifications: "idle" })),
        3000
      );
    } catch {
      setSaveStatus((prev) => ({ ...prev, notifications: "error" }));
      toast.error("فشل حفظ تفضيلات الإشعارات");
    }
  };

  const handlePreferencesSave = async () => {
    try {
      setSaveStatus((prev) => ({ ...prev, preferences: "saving" }));
      const res = await api.auth.updateProfile({
        language_pref: preferences.language_pref,
        ui_preferences: preferences.ui_preferences,
      });
      const synced = {
        language_pref: (res.data?.language_pref || preferences.language_pref) as "ar" | "en",
        ui_preferences: res.data?.ui_preferences || preferences.ui_preferences,
      };
      setTheme(synced.ui_preferences.theme);
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle(
          "compact-tables",
          Boolean(synced.ui_preferences.compact_tables)
        );
        document.documentElement.lang = synced.language_pref;
      }
      setPreferences(synced);
      setInitialPreferences(synced);
      await updateSession({
        language_pref: synced.language_pref,
        ui_preferences: synced.ui_preferences,
      });
      clearCachedSession();
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reporting"] });
      setSaveStatus((prev) => ({ ...prev, preferences: "success" }));
      toast.success("تم حفظ التفضيلات بنجاح ✓");
      setTimeout(
        () => setSaveStatus((prev) => ({ ...prev, preferences: "idle" })),
        3000
      );
    } catch {
      setSaveStatus((prev) => ({ ...prev, preferences: "error" }));
      toast.error("فشل حفظ التفضيلات");
    }
  };

  const handleAcademySave = async () => {
    if (!canEditAcademy) {
      toast.error("ليس لديك صلاحية لتعديل إعدادات الأكاديمية.");
      return;
    }

    try {
      setSaveStatus((prev) => ({ ...prev, academy: "saving" }));
      await api.tenants.updateMe({
        name: academy.name,
        business_name: academy.business_name,
        tax_number: academy.tax_number,
        show_tax_number: academy.show_tax_number,
        default_currency: academy.default_currency,
        timezone: academy.timezone,
      });
      setInitialAcademy({ ...academy });
      await refreshTenant();
      queryClient.invalidateQueries({ queryKey: ["academy"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reporting"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setSaveStatus((prev) => ({ ...prev, academy: "success" }));
      toast.success("تم تحديث إعدادات الأكاديمية بنجاح");
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, academy: "idle" })), 3000);
    } catch {
      setSaveStatus((prev) => ({ ...prev, academy: "error" }));
      toast.error("فشل تحديث إعدادات الأكاديمية");
    }
  };

  const handleStampChange = async (file: File) => {
    setIsProcessingStamp(true);
    const toastId = toast.loading("جارٍ تفريغ خلفية صورة الختم تلقائياً...");
    try {
      const result = await removeImageBackground(file);
      setBranding((prev) => ({
        ...prev,
        stamp: result.file,
        stampUrl: result.dataUrl,
      }));
      toast.success("تم تفريغ خلفية الختم بنجاح ✓", { id: toastId });
    } catch {
      setBranding((prev) => ({
        ...prev,
        stamp: file,
        stampUrl: URL.createObjectURL(file),
      }));
      toast.info("تم رفع صورة الختم (سيقوم الخادم بمعالجة الشفافية)", { id: toastId });
    } finally {
      setIsProcessingStamp(false);
    }
  };

  const handleSignatureChange = async (file: File) => {
    setIsProcessingSig(true);
    const toastId = toast.loading("جارٍ تفريغ خلفية صورة التوقيع تلقائياً...");
    try {
      const result = await removeImageBackground(file);
      setBranding((prev) => ({
        ...prev,
        signature: result.file,
        signatureUrl: result.dataUrl,
      }));
      toast.success("تم تفريغ خلفية التوقيع بنجاح ✓", { id: toastId });
    } catch {
      setBranding((prev) => ({
        ...prev,
        signature: file,
        signatureUrl: URL.createObjectURL(file),
      }));
      toast.info("تم رفع صورة التوقيع (سيقوم الخادم بمعالجة الشفافية)", { id: toastId });
    } finally {
      setIsProcessingSig(false);
    }
  };

  const handleBrandingSave = async () => {
    if (!perms.canManageBranding) {
      toast.error("ليس لديك صلاحية لتعديل الهوية البصرية.");
      return;
    }

    try {
      setSaveStatus((prev) => ({ ...prev, branding: "saving" }));
      const formData = new FormData();
      if (branding.logo instanceof File) {
        formData.append("logo", branding.logo);
      }
      if (branding.stamp instanceof File) {
        formData.append("stamp", branding.stamp);
      }
      if (branding.signature instanceof File) {
        formData.append("signature", branding.signature);
      }

      const response = await api.tenants.updateMe(formData);

      if (response.data) {
        const newData = {
          logoUrl: response.data.logo || branding.logoUrl,
          stampUrl: response.data.stamp || branding.stampUrl,
          signatureUrl: response.data.signature || branding.signatureUrl,
        };
        setBranding({
          logo: null,
          stamp: null,
          signature: null,
          ...newData,
        });
        setInitialBranding(newData);
      }

      await refreshTenant();
      queryClient.invalidateQueries({ queryKey: ["academy"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setSaveStatus((prev) => ({ ...prev, branding: "success" }));
      toast.success("تم تحديث الهوية البصرية والختم والتوقيع بنجاح ✓");
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, branding: "idle" })), 3000);
    } catch {
      setSaveStatus((prev) => ({ ...prev, branding: "error" }));
      toast.error("فشل تحديث الهوية البصرية والختم");
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedNewOwner) return;
    if (!transferPassword) {
      toast.error("يرجى إدخال كلمة المرور الحالية لتأكيد نقل الملكية.");
      return;
    }

    try {
      setTransferring(true);
      await api.tenants.transferOwnership(selectedNewOwner, transferPassword);
      toast.success("تم نقل ملكية النادي بنجاح. سيتم تحديث صلاحياتك.");
      setShowTransferConfirm(false);
      setTransferPassword("");
      window.location.reload();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "فشل نقل الملكية");
    } finally {
      setTransferring(false);
    }
  };

  const tabs = [
    { id: "profile", label: "الملف الشخصي", icon: User },
    { id: "security", label: "الأمان والحماية", icon: Shield },
    { id: "notifications", label: "الإشعارات", icon: Bell },
    { id: "preferences", label: "التفضيلات", icon: Globe },
    ...(perms.canManageAcademy
      ? [{ id: "academy", label: "إعدادات الأكاديمية", icon: Building2 }]
      : []),
    ...(perms.canManageBranding
      ? [{ id: "branding", label: "الهوية والختم والتوقيع", icon: Stamp }]
      : []),
    ...(canViewSubscriptionBilling
      ? [{ id: "billing", label: "اشتراك المنصة والفوترة", icon: CreditCard }]
      : []),
  ];

  return (
    <div className="space-y-10 pb-12">
      <PageHeader
        title="الإعدادات والحساب"
        description="إدارة ملفك الشخصي، حماية الحساب والجلسات النشطة، تفضيلات الإشعارات، وإعدادات الأكاديمية."
        icon={Settings}
      />

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 shrink-0 space-y-1" role="tablist" aria-label="أقسام الإعدادات">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-end",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <tab.icon
                className={cn(
                  "w-5 h-5 shrink-0",
                  activeTab === tab.id ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 glass-card p-6 min-h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* =========================================================
                  1. PROFILE TAB
              ========================================================= */}
              {activeTab === "profile" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h2 className="text-xl font-black text-white">الملف الشخصي</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      تحديث صورتك الشخصية، بيانات الاتصال، واستعراض معلومات الدور والفروع المخصصة لك
                    </p>
                  </div>
                  <hr className="border-white/5" />

                  {/* Avatar + Identity Overview Card */}
                  <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className="relative group">
                        <div className="w-24 h-24 rounded-2xl gradient-brand flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-primary/20 overflow-hidden border-2 border-white/10">
                          {profile.avatarUrl && !removeAvatar ? (
                            <img
                              src={profile.avatarUrl}
                              alt="الصورة الشخصية"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            profile.first_name?.[0]?.toUpperCase() || "U"
                          )}
                        </div>
                        <label
                          htmlFor="avatar-upload-input"
                          className="absolute -bottom-2 -end-2 w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg cursor-pointer hover:scale-105 transition-transform border-2 border-slate-950"
                          title="تغيير الصورة الشخصية"
                        >
                          <Camera className="w-4 h-4" />
                          <input
                            id="avatar-upload-input"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleAvatarFileSelect(e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-white">
                            {profile.first_name} {profile.last_name}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-primary/15 text-primary border border-primary/25">
                            {ROLE_LABELS[userRole as keyof typeof ROLE_LABELS] || userRole}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            نشط
                          </span>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          صيغ الصور المدعومة: PNG, JPG, WEBP بحد أقصى 5 ميجابايت
                        </p>

                        {profile.avatarUrl && !removeAvatar && (
                          <button
                            type="button"
                            onClick={() => {
                              setAvatarFile(null);
                              setRemoveAvatar(true);
                              setProfile((prev) => ({ ...prev, avatarUrl: "" }));
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-destructive hover:underline pt-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>إزالة الصورة الحالية</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Account Metadata */}
                    <div className="w-full sm:w-auto grid grid-cols-2 sm:flex sm:flex-col gap-2 text-xs bg-white/[0.02] p-3.5 rounded-xl border border-white/5">
                      {userMeta.created_at && (
                        <div className="flex items-center justify-between sm:justify-start gap-2">
                          <span className="text-muted-foreground">تاريخ الانضمام:</span>
                          <span className="font-bold text-white">
                            <bdi>{formatDate(userMeta.created_at)}</bdi>
                          </span>
                        </div>
                      )}
                      {userMeta.last_login && (
                        <div className="flex items-center justify-between sm:justify-start gap-2">
                          <span className="text-muted-foreground">آخر دخول:</span>
                          <span className="font-bold text-white">
                            <bdi>{formatDate(userMeta.last_login)}</bdi>
                          </span>
                        </div>
                      )}
                      {userMeta.last_login_ip && (
                        <div className="flex items-center justify-between sm:justify-start gap-2 col-span-2">
                          <span className="text-muted-foreground">عنوان IP الأخير:</span>
                          <span className="font-mono text-[11px] text-primary">
                            <bdi>{userMeta.last_login_ip}</bdi>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Assigned Branches Pill Bar */}
                  <div className="p-4 rounded-xl bg-white/[0.015] border border-white/5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>نطاق الفروع المخصصة لحسابك:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["platform_admin", "tenant_owner", "manager"].includes(userRole) ? (
                        <span className="px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-bold">
                          جميع فروع الأكاديمية (وصول كامل)
                        </span>
                      ) : userMeta.branch_names.length > 0 ? (
                        userMeta.branch_names.map((bName) => (
                          <span
                            key={bName}
                            className="px-3 py-1 rounded-lg bg-white/5 text-white border border-white/10 text-xs font-bold"
                          >
                            {bName}
                          </span>
                        ))
                      ) : (
                        <span className="px-3 py-1 rounded-lg bg-white/5 text-muted-foreground text-xs">
                          الفرع العام
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Personal Information Form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
                    <div className="space-y-2">
                      <label htmlFor="profile-first-name" className="text-sm font-bold">
                        الاسم الأول
                      </label>
                      <input
                        id="profile-first-name"
                        type="text"
                        autoComplete="given-name"
                        className="w-full p-3 rounded-xl border border-white/10 bg-background/50 focus:border-primary/50 outline-none transition-all text-sm font-medium"
                        value={profile.first_name}
                        onChange={(e) =>
                          setProfile({ ...profile, first_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-last-name" className="text-sm font-bold">
                        الاسم الأخير
                      </label>
                      <input
                        id="profile-last-name"
                        type="text"
                        autoComplete="family-name"
                        className="w-full p-3 rounded-xl border border-white/10 bg-background/50 focus:border-primary/50 outline-none transition-all text-sm font-medium"
                        value={profile.last_name}
                        onChange={(e) =>
                          setProfile({ ...profile, last_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="profile-phone" className="text-sm font-bold">
                        رقم الهاتف
                      </label>
                      <input
                        id="profile-phone"
                        type="tel"
                        dir="ltr"
                        autoComplete="tel"
                        placeholder="+962 7X XXX XXXX"
                        className="w-full p-3 rounded-xl border border-white/10 bg-background/50 focus:border-primary/50 outline-none transition-all text-sm font-medium text-end"
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="profile-email" className="text-sm font-bold">
                          البريد الإلكتروني
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowFullEmail(!showFullEmail)}
                          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          {showFullEmail ? (
                            <>
                              <EyeOff className="w-3 h-3" />
                              <span>إخفاء</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" />
                              <span>إظهار بالكامل</span>
                            </>
                          )}
                        </button>
                      </div>
                      <input
                        id="profile-email"
                        type="text"
                        dir="ltr"
                        className="w-full p-3 rounded-xl border border-white/5 bg-muted/40 cursor-not-allowed outline-none text-sm font-mono text-muted-foreground text-end"
                        value={
                          showFullEmail
                            ? profile.email
                            : maskEmailAddress(profile.email)
                        }
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-2">
                    <button
                      onClick={handleProfileSave}
                      disabled={
                        saveStatus.profile === "saving" ||
                        profileNamesInvalid ||
                        !profileHasChanges
                      }
                      className={cn(
                        "px-7 py-3 rounded-xl text-white text-sm font-black shadow-lg transition-all flex items-center gap-2 disabled:opacity-50",
                        saveStatus.profile === "success"
                          ? "bg-emerald-600"
                          : "gradient-brand hover:opacity-90 active:scale-95"
                      )}
                    >
                      {saveStatus.profile === "saving" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : saveStatus.profile === "success" ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {saveStatus.profile === "saving"
                        ? "جاري الحفظ..."
                        : saveStatus.profile === "success"
                          ? "تم الحفظ بنجاح ✓"
                          : "حفظ التغييرات"}
                    </button>
                    {profileNamesInvalid && (
                      <p className="text-xs font-bold text-destructive">
                        الاسم الأول والأخير مطلوبان قبل الحفظ.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* =========================================================
                  2. SECURITY TAB (Available to ALL users)
              ========================================================= */}
              {activeTab === "security" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h2 className="text-xl font-black text-white">الأمان وحماية الحساب</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      تغيير كلمة المرور، إدارة الجلسات والأجهزة المتصلة، ومراجعة سجل النشاط الأمني لحسابك
                    </p>
                  </div>
                  <hr className="border-white/5" />

                  {/* Section A: Password Change */}
                  <form
                    onSubmit={handlePasswordChange}
                    className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-6 max-w-2xl"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <KeyRound className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-white">تغيير كلمة المرور</h3>
                          <p className="text-xs text-muted-foreground">
                            يُنصح باستخدام كلمة مرور قوية وفريدة لا تقل عن 12 حرفاً
                          </p>
                        </div>
                      </div>
                      {userMeta.password_changed_at && (
                        <span className="text-[11px] font-bold text-muted-foreground bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                          آخر تحديث: <bdi>{formatDate(userMeta.password_changed_at)}</bdi>
                        </span>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="sec-current-password" className="text-xs font-bold">
                          كلمة المرور الحالية
                        </label>
                        <div className="relative">
                          <input
                            id="sec-current-password"
                            type={showCurrentPassword ? "text" : "password"}
                            autoComplete="current-password"
                            value={passwordForm.current_password}
                            onChange={(e) =>
                              setPasswordForm({
                                ...passwordForm,
                                current_password: e.target.value,
                              })
                            }
                            className="w-full p-3 pe-11 rounded-xl border border-white/10 bg-background/50 focus:border-primary/50 outline-none text-sm"
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-white"
                            aria-label="إظهار أو إخفاء كلمة المرور الحالية"
                          >
                            {showCurrentPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="sec-new-password" className="text-xs font-bold">
                            كلمة المرور الجديدة
                          </label>
                          <div className="relative">
                            <input
                              id="sec-new-password"
                              type={showNewPassword ? "text" : "password"}
                              autoComplete="new-password"
                              minLength={8}
                              maxLength={128}
                              value={passwordForm.new_password}
                              onChange={(e) =>
                                setPasswordForm({
                                  ...passwordForm,
                                  new_password: e.target.value,
                                })
                              }
                              className="w-full p-3 pe-11 rounded-xl border border-white/10 bg-background/50 focus:border-primary/50 outline-none text-sm"
                              placeholder="••••••••"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-white"
                              aria-label="إظهار أو إخفاء كلمة المرور الجديدة"
                            >
                              {showNewPassword ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="sec-confirm-password" className="text-xs font-bold">
                            تأكيد كلمة المرور الجديدة
                          </label>
                          <input
                            id="sec-confirm-password"
                            type={showNewPassword ? "text" : "password"}
                            autoComplete="new-password"
                            minLength={8}
                            maxLength={128}
                            value={passwordForm.new_password_confirm}
                            onChange={(e) =>
                              setPasswordForm({
                                ...passwordForm,
                                new_password_confirm: e.target.value,
                              })
                            }
                            className="w-full p-3 rounded-xl border border-white/10 bg-background/50 focus:border-primary/50 outline-none text-sm"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>

                      {/* Real-time Strength Meter */}
                      {passwordForm.new_password.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">مؤشر قوة كلمة المرور:</span>
                            <span className="font-bold text-white">
                              {passwordStrength.label}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 h-1.5">
                            {[1, 2, 3, 4].map((bar) => (
                              <div
                                key={bar}
                                className={cn(
                                  "rounded-full transition-all duration-300",
                                  passwordStrength.score >= bar
                                    ? passwordStrength.color
                                    : "bg-white/10"
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      <label className="flex items-center gap-2.5 text-xs text-muted-foreground cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={passwordForm.logout_other_devices}
                          onChange={(e) =>
                            setPasswordForm({
                              ...passwordForm,
                              logout_other_devices: e.target.checked,
                            })
                          }
                          className="rounded border-white/20 bg-background text-primary focus:ring-primary"
                        />
                        <span>
                          إنهاء جميع الجلسات النشطة في الأجهزة والمتصفحات الأخرى فور تغيير كلمة المرور
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={
                        saveStatus.password === "saving" ||
                        !passwordForm.current_password ||
                        passwordForm.new_password.length < 8 ||
                        passwordForm.new_password !== passwordForm.new_password_confirm
                      }
                      className="px-6 py-2.5 rounded-xl gradient-brand text-white text-xs font-black shadow-lg hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {saveStatus.password === "saving" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                      <span>تحديث كلمة المرور</span>
                    </button>
                  </form>

                  {/* Section B: Active Sessions & Devices */}
                  <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                          <Laptop className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-white">
                            الجلسات النشطة والأجهزة المتصلة
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            مراجعة الرموز النشطة المرتبطة بحسابك وإنهاء أي جلسة غير معروفة فوراً
                          </p>
                        </div>
                      </div>

                      {sessions.length > 1 && (
                        <button
                          type="button"
                          disabled={revokingAll}
                          onClick={handleLogoutAllDevices}
                          className="px-4 py-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive hover:text-white text-xs font-black transition-all flex items-center gap-2 self-start sm:self-auto"
                        >
                          {revokingAll ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <LogOut className="w-3.5 h-3.5" />
                          )}
                          <span>إنهاء جميع الجلسات الأخرى</span>
                        </button>
                      )}
                    </div>

                    {loadingSecurity ? (
                      <div className="py-8 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : sessions.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4">
                        لا توجد جلسات إضافية مسجلة حالياً.
                      </p>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {sessions.map((sess) => (
                          <div
                            key={sess.jti}
                            className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white font-mono">
                                  جلسة #{sess.jti.slice(0, 8)}
                                </span>
                                {sess.is_latest && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                    الجلسة الأحدث / الحالية
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                بدأت في <bdi>{formatDate(sess.created_at)}</bdi> · تنتهي في{" "}
                                <bdi>{formatDate(sess.expires_at)}</bdi>
                              </p>
                            </div>

                            {!sess.is_latest && (
                              <button
                                type="button"
                                disabled={revokingJti === sess.jti}
                                onClick={() => handleRevokeSession(sess.jti)}
                                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-destructive/20 text-muted-foreground hover:text-destructive border border-white/10 text-xs font-bold transition-all self-start sm:self-auto"
                              >
                                {revokingJti === sess.jti ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  "إنهاء الجلسة"
                                )}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section C: Recent Security Activity */}
                  <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <History className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white">
                          سجل النشاط الأمني الأخير
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          آخر عمليات تسجيل الدخول والتغييرات الحساسة المرتبطة بحسابك
                        </p>
                      </div>
                    </div>

                    {loadingSecurity ? (
                      <div className="py-8 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : activityLogs.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4">
                        لا توجد سجلات نشاط أمني مسجلة حتى الآن.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-start border-collapse">
                          <thead>
                            <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                              <th className="py-3 px-3 text-start">الحدث</th>
                              <th className="py-3 px-3 text-start">الجهاز / المتصفح</th>
                              <th className="py-3 px-3 text-start">عنوان IP</th>
                              <th className="py-3 px-3 text-start">التاريخ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-xs">
                            {activityLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-white/[0.01]">
                                <td className="py-3 px-3 font-bold text-white">
                                  {SECURITY_ACTION_LABELS[log.action] || log.action}
                                </td>
                                <td className="py-3 px-3 text-muted-foreground">
                                  {summarizeUserAgent(log.user_agent)}
                                </td>
                                <td className="py-3 px-3 font-mono text-muted-foreground">
                                  <bdi>{log.ip_address || "—"}</bdi>
                                </td>
                                <td className="py-3 px-3 text-muted-foreground">
                                  <bdi>{formatDate(log.created_at)}</bdi>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Section D: Ownership Transfer (Tenant Owner only) */}
                  {userRole === "tenant_owner" && (
                    <div className="p-6 border border-destructive/20 bg-destructive/5 rounded-2xl space-y-4">
                      <div className="flex items-center gap-3 text-destructive">
                        <AlertTriangle className="w-6 h-6" />
                        <h3 className="font-bold">منطقة الخطر — نقل ملكية النادي</h3>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        نقل الملكية هو إجراء <strong>حساس ودائم</strong>. عند إتمام هذا الإجراء،
                        ستنتقل كافة صلاحيات المالك إلى الموظف المختار، بينما سيتم تحويل حسابك إلى
                        رتبة &quot;مدير&quot;.
                      </p>

                      <div className="space-y-2 pt-2 max-w-md">
                        <label className="text-sm font-bold">اختر الموظف الجديد للملكية</label>
                        <Select
                          value={selectedNewOwner}
                          onChange={(e) => setSelectedNewOwner(e.target.value)}
                        >
                          <option value="">-- اختر موظفاً --</option>
                          {staff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.full_name} (
                              {ROLE_LABELS[s.role as keyof typeof ROLE_LABELS] || s.role})
                            </option>
                          ))}
                        </Select>
                      </div>

                      <button
                        disabled={!selectedNewOwner}
                        onClick={() => setShowTransferConfirm(true)}
                        className="btn-danger"
                      >
                        بدء إجراء نقل الملكية
                      </button>

                      <Modal
                        open={showTransferConfirm}
                        onClose={() => {
                          setShowTransferConfirm(false);
                          setTransferPassword("");
                        }}
                        size="sm"
                      >
                        <ModalHeader
                          icon={
                            <AlertTriangle className="w-5 h-5 text-destructive animate-pulse" />
                          }
                          title="تأكيد نقل الملكية"
                          onClose={() => {
                            setShowTransferConfirm(false);
                            setTransferPassword("");
                          }}
                        />
                        <ModalBody className="space-y-4">
                          <p className="text-sm leading-relaxed text-white text-start">
                            هل أنت متأكد تماماً من رغبتك في نقل ملكية النادي إلى{" "}
                            <strong>
                              {staff.find((s) => s.id === selectedNewOwner)?.full_name}
                            </strong>
                            ؟
                          </p>
                          <div className="space-y-2 text-start">
                            <label
                              htmlFor="confirm-transfer-password"
                              className="text-xs font-bold text-muted-foreground"
                            >
                              أدخل كلمة المرور الحالية لتأكيد الهوية:
                            </label>
                            <input
                              id="confirm-transfer-password"
                              type="password"
                              autoComplete="current-password"
                              value={transferPassword}
                              onChange={(e) => setTransferPassword(e.target.value)}
                              className="w-full p-3 rounded-xl border border-white/10 bg-background/60 focus:border-destructive outline-none text-sm"
                              placeholder="كلمة المرور الحالية"
                            />
                          </div>
                        </ModalBody>
                        <ModalFooter>
                          <button
                            onClick={() => {
                              setShowTransferConfirm(false);
                              setTransferPassword("");
                            }}
                            className="btn-secondary"
                          >
                            إلغاء
                          </button>
                          <button
                            disabled={transferring || !transferPassword}
                            onClick={handleTransferOwnership}
                            className="btn-danger"
                          >
                            {transferring ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "نعم، انقل الملكية الآن"
                            )}
                          </button>
                        </ModalFooter>
                      </Modal>
                    </div>
                  )}
                </div>
              )}

              {/* =========================================================
                  3. NOTIFICATIONS TAB (In-App Only)
              ========================================================= */}
              {activeTab === "notifications" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h2 className="text-xl font-black text-white">إعدادات الإشعارات</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      التحكم في التنبيهات الفورية داخل المنصة (In-App Notifications) حسب نوع الحدث
                    </p>
                  </div>
                  <hr className="border-white/5" />

                  {/* Master In-App Toggle */}
                  <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-4 max-w-2xl">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">
                          تفعيل الإشعارات داخل المنصة
                        </p>
                        <p className="text-xs text-muted-foreground">
                          استلام تنبيهات فورية في جرس الإشعارات أعلى لوحة التحكم
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifications.in_app.enabled}
                      onClick={() =>
                        setNotifications((prev) => ({
                          ...prev,
                          in_app: { ...prev.in_app, enabled: !prev.in_app.enabled },
                        }))
                      }
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                        notifications.in_app.enabled ? "bg-primary" : "bg-secondary"
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                          notifications.in_app.enabled
                            ? "translate-x-5 rtl:-translate-x-5"
                            : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {/* Topic Toggles */}
                  <div className="space-y-3 max-w-2xl">
                    {[
                      {
                        key: "billing" as const,
                        title: "الفواتير والاشتراكات والمدفوعات",
                        desc: "إشعارات إصدار الفواتير، استلام الدفعات، وطلبات تجديد اشتراكات الطلاب",
                        locked: false,
                      },
                      {
                        key: "attendance" as const,
                        title: "الحضور والجلسات التدريبية",
                        desc: "تنبيهات تسجيل الحضور عبر الكشك وتحديثات الحصص اليومية",
                        locked: false,
                      },
                      {
                        key: "promotions" as const,
                        title: "الترقيات واختبارات الأحزمة",
                        desc: "تنبيهات استحقاق الطلاب للترقية ونتائج اختبارات الأحزمة",
                        locked: false,
                      },
                      {
                        key: "security" as const,
                        title: "تنبيهات الأمان والحساب (إلزامي)",
                        desc: "تنبيهات الأمان المهمة وتغييرات كلمة المرور والصلاحيات",
                        locked: true,
                      },
                    ].map((item) => {
                      const checked = item.locked
                        ? true
                        : notifications.in_app[item.key] && notifications.in_app.enabled;

                      return (
                        <div
                          key={item.key}
                          className={cn(
                            "p-4 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-between gap-4 transition-opacity",
                            !notifications.in_app.enabled && !item.locked && "opacity-50"
                          )}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-white">{item.title}</p>
                              {item.locked && (
                                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{item.desc}</p>
                          </div>

                          <button
                            type="button"
                            role="switch"
                            disabled={item.locked || !notifications.in_app.enabled}
                            aria-checked={checked}
                            onClick={() => {
                              if (item.locked) return;
                              setNotifications((prev) => ({
                                ...prev,
                                in_app: {
                                  ...prev.in_app,
                                  [item.key]: !prev.in_app[item.key],
                                },
                              }));
                            }}
                            className={cn(
                              "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                              checked ? "bg-primary" : "bg-secondary",
                              item.locked || !notifications.in_app.enabled
                                ? "cursor-not-allowed opacity-60"
                                : "cursor-pointer"
                            )}
                          >
                            <span
                              aria-hidden="true"
                              className={cn(
                                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                checked
                                  ? "translate-x-5 rtl:-translate-x-5"
                                  : "translate-x-0"
                              )}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleNotificationsSave}
                    disabled={
                      saveStatus.notifications === "saving" || !notificationsHasChanges
                    }
                    className={cn(
                      "px-7 py-3 rounded-xl text-white text-sm font-black shadow-lg transition-all flex items-center gap-2 disabled:opacity-50",
                      saveStatus.notifications === "success"
                        ? "bg-emerald-600"
                        : "gradient-brand hover:opacity-90 active:scale-95"
                    )}
                  >
                    {saveStatus.notifications === "saving" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saveStatus.notifications === "success" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>
                      {saveStatus.notifications === "saving"
                        ? "جاري الحفظ..."
                        : saveStatus.notifications === "success"
                          ? "تم الحفظ بنجاح ✓"
                          : "حفظ إعدادات الإشعارات"}
                    </span>
                  </button>
                </div>
              )}

              {/* =========================================================
                  4. PREFERENCES TAB
              ========================================================= */}
              {activeTab === "preferences" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h2 className="text-xl font-black text-white">تفضيلات الواجهة والعرض</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      تخصيص مظهر المنصة (الوضع الداكن/الفاتح)، اللغة المفضلة، ونمط عرض البيانات
                    </p>
                  </div>
                  <hr className="border-white/5" />

                  <div className="space-y-6 max-w-2xl">
                    {/* Theme Selection */}
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-white block">
                        مظهر الواجهة (Theme)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          {
                            id: "dark" as const,
                            label: "الوضع الداكن",
                            desc: "مريح للعين ومثالي للإضاءة المنخفضة",
                            icon: Moon,
                          },
                          {
                            id: "light" as const,
                            label: "الوضع الفاتح",
                            desc: "تباين واضح للإضاءة النهارية",
                            icon: Sun,
                          },
                          {
                            id: "system" as const,
                            label: "تلقائي (حسب الجهاز)",
                            desc: "يتبع إعدادات نظام التشغيل تلقائياً",
                            icon: Monitor,
                          },
                        ].map((mode) => {
                          const isSelected =
                            preferences.ui_preferences.theme === mode.id ||
                            (!preferences.ui_preferences.theme && currentTheme === mode.id);
                          return (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => {
                                setTheme(mode.id);
                                setPreferences((prev) => ({
                                  ...prev,
                                  ui_preferences: {
                                    ...prev.ui_preferences,
                                    theme: mode.id,
                                  },
                                }));
                              }}
                              className={cn(
                                "p-4 rounded-2xl border text-start transition-all flex flex-col gap-2",
                                isSelected
                                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <mode.icon
                                  className={cn(
                                    "w-5 h-5",
                                    isSelected ? "text-primary" : "text-muted-foreground"
                                  )}
                                />
                                {isSelected && (
                                  <CheckCircle2 className="w-4 h-4 text-primary" />
                                )}
                              </div>
                              <p className="text-sm font-black text-white">{mode.label}</p>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {mode.desc}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Language & Default Period */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold">اللغة المفضلة للحساب</label>
                        <Select
                          value={preferences.language_pref}
                          onChange={(e) =>
                            setPreferences((prev) => ({
                              ...prev,
                              language_pref: e.target.value as "ar" | "en",
                            }))
                          }
                        >
                          <option value="ar">العربية (RTL)</option>
                          <option value="en">English (LTR)</option>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold">
                          الفترة الافتراضية لملخصات لوحة التحكم
                        </label>
                        <Select
                          value={preferences.ui_preferences.default_dashboard_period}
                          onChange={(e) =>
                            setPreferences((prev) => ({
                              ...prev,
                              ui_preferences: {
                                ...prev.ui_preferences,
                                default_dashboard_period: e.target.value as any,
                              },
                            }))
                          }
                        >
                          <option value="today">اليوم</option>
                          <option value="week">هذا الأسبوع</option>
                          <option value="month">هذا الشهر</option>
                          <option value="year">هذه السنة</option>
                        </Select>
                      </div>
                    </div>

                    {/* Compact Tables Toggle */}
                    <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-white">
                          نمط الجداول المضغوط (Compact Tables)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          تقليل المسافات العمودية في جداول الطلاب والفواتير لعرض صفوف أكثر في الشاشة الواحدة
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={preferences.ui_preferences.compact_tables}
                        onClick={() =>
                          setPreferences((prev) => ({
                            ...prev,
                            ui_preferences: {
                              ...prev.ui_preferences,
                              compact_tables: !prev.ui_preferences.compact_tables,
                            },
                          }))
                        }
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                          preferences.ui_preferences.compact_tables
                            ? "bg-primary"
                            : "bg-secondary"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            preferences.ui_preferences.compact_tables
                              ? "translate-x-5 rtl:-translate-x-5"
                              : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handlePreferencesSave}
                    disabled={
                      saveStatus.preferences === "saving" || !preferencesHasChanges
                    }
                    className={cn(
                      "px-7 py-3 rounded-xl text-white text-sm font-black shadow-lg transition-all flex items-center gap-2 disabled:opacity-50",
                      saveStatus.preferences === "success"
                        ? "bg-emerald-600"
                        : "gradient-brand hover:opacity-90 active:scale-95"
                    )}
                  >
                    {saveStatus.preferences === "saving" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saveStatus.preferences === "success" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>
                      {saveStatus.preferences === "saving"
                        ? "جاري الحفظ..."
                        : saveStatus.preferences === "success"
                          ? "تم الحفظ بنجاح ✓"
                          : "حفظ التفضيلات"}
                    </span>
                  </button>
                </div>
              )}

              {/* =========================================================
                  5. ACADEMY TAB
              ========================================================= */}
              {activeTab === "academy" && perms.canManageAcademy && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h2 className="text-lg font-semibold">إعدادات الأكاديمية</h2>
                    <p className="text-sm text-muted-foreground">
                      تخصيص هوية الأكاديمية ومعلوماتها العامة
                    </p>
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
                        onChange={(e) =>
                          setAcademy({ ...academy, business_name: e.target.value })
                        }
                      />
                    </div>

                    {/* Tax Configuration */}
                    <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">
                            الرقم الضريبي (Tax ID / VAT)
                          </label>
                          <span className="text-xs text-muted-foreground">اختياري</span>
                        </div>
                        <input
                          type="text"
                          dir="ltr"
                          placeholder="مثال: 300000000000003"
                          className="w-full p-2.5 rounded-lg border bg-background/50 focus:border-primary/50 outline-none transition-all font-mono placeholder:text-muted-foreground/40"
                          value={academy.tax_number}
                          onChange={(e) =>
                            setAcademy({ ...academy, tax_number: e.target.value })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-white/5">
                        <div className="space-y-0.5 pe-4">
                          <div className="text-sm font-medium">
                            إظهار الرقم الضريبي في الفاتورة
                          </div>
                          <div className="text-xs text-muted-foreground">
                            إظهار أو إخفاء الرقم الضريبي في ترويسة الفواتير المطبوعة والمصدرة ورمز التحقق (QR)
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={academy.show_tax_number}
                          onClick={() =>
                            setAcademy({
                              ...academy,
                              show_tax_number: !academy.show_tax_number,
                            })
                          }
                          className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                            academy.show_tax_number ? "bg-primary" : "bg-secondary"
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              academy.show_tax_number
                                ? "translate-x-5 rtl:-translate-x-5"
                                : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">العملة الافتراضية</label>
                        <Select
                          value={academy.default_currency}
                          onChange={(e) =>
                            setAcademy({ ...academy, default_currency: e.target.value })
                          }
                        >
                          <option value="JOD">JOD</option>
                          <option value="SAR">SAR</option>
                          <option value="AED">AED</option>
                          <option value="KWD">KWD</option>
                          <option value="BHD">BHD</option>
                          <option value="OMR">OMR</option>
                          <option value="QAR">QAR</option>
                          <option value="EGP">EGP</option>
                          <option value="USD">USD</option>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">المنطقة الزمنية</label>
                        <Select
                          value={academy.timezone}
                          onChange={(e) =>
                            setAcademy({ ...academy, timezone: e.target.value })
                          }
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
                    disabled={
                      saveStatus.academy === "saving" ||
                      !canEditAcademy ||
                      !academyHasChanges
                    }
                    className={cn(
                      "px-6 py-2.5 rounded-lg text-white text-sm font-medium shadow-lg transition-all flex items-center gap-2 disabled:opacity-50",
                      saveStatus.academy === "success"
                        ? "bg-green-600"
                        : "gradient-brand hover:opacity-90"
                    )}
                  >
                    {saveStatus.academy === "saving" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saveStatus.academy === "success" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saveStatus.academy === "saving"
                      ? "جاري الحفظ..."
                      : saveStatus.academy === "success"
                        ? "تم الحفظ بنجاح"
                        : "حفظ التغييرات"}
                  </button>
                </div>
              )}

              {/* =========================================================
                  6. BRANDING TAB
              ========================================================= */}
              {activeTab === "branding" && perms.canManageBranding && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h2 className="text-xl font-black text-white">
                      الهوية، الختم والتوقيع الرسمي
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      تخصيص شعار النادي، ختم الإدارة الرسمي، وتوقيع المسؤول المعتمد للظهور تلقائياً على الفواتير والسندات
                    </p>
                  </div>
                  <hr className="border-border/50" />

                  <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-white">
                        ميزة التفريغ التلقائي للخلفية (Auto Background Removal)
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        عند رفع صورة الختم أو التوقيع، يقوم النظام تلقائياً وبشكل فوري بإزالة الخلفية الورقية البيضاء وجعلها شفافة بالكامل.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* 1. Club Logo */}
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <Palette className="w-4 h-4" />
                          </div>
                          <label className="text-sm font-bold text-white">
                            شعار النادي (Logo)
                          </label>
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-4">
                          يظهر في رأس الفواتير، التقارير ولوحة التحكم
                        </p>
                      </div>

                      <div className="relative group border-2 border-dashed border-border rounded-xl p-4 hover:bg-muted/30 transition-colors flex flex-col items-center justify-center text-center cursor-pointer min-h-[160px]">
                        {branding.logo ? (
                          <div className="flex flex-col items-center">
                            <div className="w-20 h-20 rounded-lg overflow-hidden mb-2 bg-background/50 flex items-center justify-center border border-white/10">
                              <img
                                src={URL.createObjectURL(branding.logo)}
                                alt="New Logo"
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                            <p className="text-xs text-primary font-bold">
                              {branding.logo.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              انقر للتغيير
                            </p>
                          </div>
                        ) : branding.logoUrl ? (
                          <div className="flex flex-col items-center">
                            <div className="w-20 h-20 rounded-lg overflow-hidden mb-2 bg-background/50 flex items-center justify-center border border-white/10">
                              <img
                                src={branding.logoUrl}
                                alt="Current Logo"
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                              انقر لتغيير الشعار
                            </p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                            <p className="text-xs font-bold text-white">رفع الشعار</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              PNG, JPG حتى 5MB
                            </p>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setBranding({ ...branding, logo: e.target.files[0] });
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* 2. Official Stamp */}
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                              <Stamp className="w-4 h-4" />
                            </div>
                            <label className="text-sm font-bold text-white">
                              ختم النادي الرسمي
                            </label>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black border border-emerald-500/20">
                            تفريغ تلقائي
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-4">
                          يُطبع كختم رسمي معتمد في أسفل الفاتورة
                        </p>
                      </div>

                      <div className="relative group border-2 border-dashed border-border rounded-xl p-4 hover:bg-muted/30 transition-colors flex flex-col items-center justify-center text-center cursor-pointer min-h-[160px]">
                        {isProcessingStamp ? (
                          <div className="flex flex-col items-center py-4">
                            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                            <p className="text-xs font-bold text-white">
                              جارٍ تفريغ الخلفية...
                            </p>
                          </div>
                        ) : branding.stampUrl ? (
                          <div className="flex flex-col items-center">
                            <div className="w-20 h-20 rounded-xl overflow-hidden mb-2 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:8px_8px] bg-white flex items-center justify-center border border-emerald-500/30 p-2 shadow-inner">
                              <img
                                src={branding.stampUrl}
                                alt="Club Stamp"
                                className="max-w-full max-h-full object-contain -rotate-6"
                              />
                            </div>
                            <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              خلفية مفرغة وجاهزة
                            </span>
                            <p className="text-[10px] text-muted-foreground mt-1 group-hover:text-primary">
                              انقر للاستبدال
                            </p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-muted-foreground mb-2 group-hover:text-emerald-400 transition-colors" />
                            <p className="text-xs font-bold text-white">رفع صورة الختم</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              يفرغ النظام الخلفية تلقائياً
                            </p>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={isProcessingStamp}
                          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleStampChange(e.target.files[0]);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* 3. Authorized Signature */}
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                              <PenTool className="w-4 h-4" />
                            </div>
                            <label className="text-sm font-bold text-white">
                              توقيع المسؤول المعتمد
                            </label>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black border border-blue-500/20">
                            تفريغ تلقائي
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-4">
                          يُطبع فوق سطر التوقيع المعتمد بالفاتورة
                        </p>
                      </div>

                      <div className="relative group border-2 border-dashed border-border rounded-xl p-4 hover:bg-muted/30 transition-colors flex flex-col items-center justify-center text-center cursor-pointer min-h-[160px]">
                        {isProcessingSig ? (
                          <div className="flex flex-col items-center py-4">
                            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-2" />
                            <p className="text-xs font-bold text-white">
                              جارٍ تفريغ الخلفية...
                            </p>
                          </div>
                        ) : branding.signatureUrl ? (
                          <div className="flex flex-col items-center">
                            <div className="w-28 h-16 rounded-xl overflow-hidden mb-2 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:8px_8px] bg-white flex items-center justify-center border border-blue-500/30 p-2 shadow-inner">
                              <img
                                src={branding.signatureUrl}
                                alt="Signature"
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                            <span className="text-[10px] font-black text-blue-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              خلفية مفرغة وجاهزة
                            </span>
                            <p className="text-[10px] text-muted-foreground mt-1 group-hover:text-primary">
                              انقر للاستبدال
                            </p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-muted-foreground mb-2 group-hover:text-blue-400 transition-colors" />
                            <p className="text-xs font-bold text-white">رفع صورة التوقيع</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              يفرغ النظام الخلفية تلقائياً
                            </p>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={isProcessingSig}
                          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleSignatureChange(e.target.files[0]);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleBrandingSave}
                      disabled={
                        saveStatus.branding === "saving" ||
                        !brandingHasChanges ||
                        isProcessingStamp ||
                        isProcessingSig
                      }
                      className={cn(
                        "px-7 py-3 rounded-2xl text-white text-sm font-black shadow-xl transition-all flex items-center gap-2 disabled:opacity-50",
                        saveStatus.branding === "success"
                          ? "bg-emerald-600"
                          : "gradient-brand hover:brightness-110 active:scale-95"
                      )}
                    >
                      {saveStatus.branding === "saving" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : saveStatus.branding === "success" ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {saveStatus.branding === "saving"
                        ? "جاري الحفظ..."
                        : saveStatus.branding === "success"
                          ? "تم الحفظ بنجاح ✓"
                          : "حفظ الهوية والختم والتوقيع"}
                    </button>
                  </div>
                </div>
              )}

              {/* =========================================================
                  7. SUBSCRIPTION BILLING TAB (Academy Owners & Managers)
              ========================================================= */}
              {activeTab === "billing" && canViewSubscriptionBilling && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h2 className="text-xl font-black text-white">إدارة اشتراك الأكاديمية</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      تتبع حدود باقتك الحالية واطلب الترقية أو تغيير الباقة بسهولة.
                    </p>
                  </div>
                  <hr className="border-white/5" />

                  {tenantFullData && (
                    <div className="space-y-6">
                      {(() => {
                        const currentPlan = plans.find((p) => p.id === tenantFullData.plan);
                        const limitsExceeded =
                          tenantFullData.active_students_count >
                            (currentPlan?.max_students ?? 0) ||
                          tenantFullData.active_locations_count >
                            (currentPlan?.max_locations ?? 0) ||
                          tenantFullData.active_staff_count > (currentPlan?.max_staff ?? 0);

                        return (
                          <div
                            className={cn(
                              "p-6 rounded-3xl border relative overflow-hidden transition-all duration-300",
                              limitsExceeded
                                ? "bg-destructive/10 border-destructive/20 text-white"
                                : "bg-white/[0.02] border-white/5 text-white"
                            )}
                          >
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
                                <h3 className="text-2xl font-black mt-2 text-white">
                                  {currentPlan?.name || "الباقة الافتراضية"}
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-xl">
                                  {tenantFullData.status === "trial"
                                    ? `أنت حالياً في الفترة التجريبية المجانية. سيتم تفعيل باقة "${currentPlan?.name || "الباقة المختارة"}" والفوترة تلقائياً بمجرد انتهاء فترة التجربة.`
                                    : currentPlan?.description ||
                                      "باقة مخصصة لإدارة الأندية والأكاديميات بكفاءة."}
                                </p>
                              </div>

                              <div className="text-start md:text-end shrink-0">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-1">
                                  قيمة الاشتراك
                                </span>
                                {currentPlan?.price_yearly &&
                                parseFloat(currentPlan.price_yearly) > 0 ? (
                                  <>
                                    <span className="text-3xl font-black text-primary">
                                      <bdi>
                                        {formatCurrency(
                                          currentPlan.price_yearly,
                                          currentPlan.currency
                                        )}
                                      </bdi>
                                    </span>
                                    <span className="text-xs font-bold text-muted-foreground block mt-1">
                                      سنوياً
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-3xl font-black text-primary">
                                      <bdi>
                                        {formatCurrency(
                                          currentPlan?.price_monthly ?? 0,
                                          currentPlan?.currency ?? academy.default_currency
                                        )}
                                      </bdi>
                                    </span>
                                    <span className="text-xs font-bold text-muted-foreground block mt-1">
                                      شهرياً
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {tenantFullData.status === "trial" && (
                              <div className="mt-6 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm font-bold">
                                <div className="flex items-center gap-3">
                                  <Clock className="w-5 h-5 shrink-0 animate-pulse text-amber-500" />
                                  <div className="text-start">
                                    <p className="text-white font-black">
                                      الحساب في الفترة التجريبية
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      سيتم بدء اشتراكك الفعلي في باقة{" "}
                                      {currentPlan?.name || "الباقة المختارة"} فور انتهاء التجربة.
                                    </p>
                                  </div>
                                </div>
                                <div className="bg-amber-500/10 px-4 py-2 rounded-xl text-center border border-amber-500/25 min-w-[120px] shrink-0">
                                  <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">
                                    المتبقي بالتجربة
                                  </p>
                                  <p className="text-lg font-black text-white">
                                    {tenantFullData.trial_days_remaining !== null &&
                                    tenantFullData.trial_days_remaining !== undefined
                                      ? tenantFullData.trial_days_remaining === 0
                                        ? "ينتهي اليوم"
                                        : tenantFullData.trial_days_remaining === 1
                                          ? "يوم واحد"
                                          : tenantFullData.trial_days_remaining === 2
                                            ? "يومان"
                                            : `${tenantFullData.trial_days_remaining} يوم`
                                      : "بضعة أيام"}
                                  </p>
                                </div>
                              </div>
                            )}

                            {limitsExceeded && (
                              <div className="mt-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3 text-sm font-bold animate-pulse">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                <span>
                                  تنبيه: لقد تجاوزت بعض حدود باقتك الحالية. يرجى الترقية أو تقليل أعداد السجلات النشطة للعودة للحد الطبيعي.
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Limits Progress Grid */}
                      {(() => {
                        const currentPlan = plans.find((p) => p.id === tenantFullData.plan);
                        const getProgressPct = (curr: number, max: number) =>
                          Math.min(100, Math.round((curr / (max || 1)) * 100));

                        const stats = [
                          {
                            label: "الفروع النشطة",
                            curr: tenantFullData.active_locations_count ?? 0,
                            max: currentPlan?.max_locations ?? 1,
                            icon: Building2,
                          },
                          {
                            label: "الطلاب النشطون",
                            curr: tenantFullData.active_students_count ?? 0,
                            max: currentPlan?.max_students ?? 100,
                            icon: Users,
                          },
                          {
                            label: "الموظفون النشطون",
                            curr: tenantFullData.active_staff_count ?? 0,
                            max: currentPlan?.max_staff ?? 10,
                            icon: UserCog,
                          },
                        ];

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {stats.map((s) => {
                              const pct = getProgressPct(s.curr, s.max);
                              const exceeded = s.curr > s.max;
                              return (
                                <div
                                  key={s.label}
                                  className={cn(
                                    "glass-card p-5 space-y-4 border transition-all",
                                    exceeded
                                      ? "border-destructive/30 bg-destructive/5"
                                      : "border-white/5"
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-muted-foreground">
                                      {s.label}
                                    </span>
                                    <div
                                      className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center bg-white/5",
                                        exceeded ? "text-destructive" : "text-primary"
                                      )}
                                    >
                                      <s.icon className="w-4 h-4" />
                                    </div>
                                  </div>

                                  <div className="flex items-baseline justify-between gap-2">
                                    <span
                                      className={cn(
                                        "text-2xl font-black",
                                        exceeded ? "text-destructive" : "text-white"
                                      )}
                                    >
                                      {s.curr}
                                    </span>
                                    <span className="text-xs font-bold text-muted-foreground">
                                      من أصل {s.max}
                                    </span>
                                  </div>

                                  <div className="space-y-1">
                                    <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                                      <div
                                        className={cn(
                                          "h-full rounded-full transition-all duration-500",
                                          exceeded
                                            ? "bg-destructive shadow-md shadow-destructive/20"
                                            : "bg-primary shadow-md shadow-primary/20"
                                        )}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground/60">
                                      <span>{pct}%</span>
                                      {exceeded && (
                                        <span className="text-destructive font-black">
                                          تجاوزت الحد!
                                        </span>
                                      )}
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
                        <h3 className="text-lg font-black text-white">
                          استعراض الباقات المتاحة
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          اختر الباقة المناسبة لاحتياجاتك واطلب الترقية فوراً.
                        </p>
                      </div>

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
                            "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5",
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
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            وفر 3 أشهر (12.5%-)
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {plans.map((p) => {
                        const isCurrent =
                          tenantFullData && p.id === tenantFullData.plan;
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
                          <div
                            key={p.id}
                            className={cn(
                              "glass-card p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:scale-[1.02]",
                              isCurrent
                                ? "border-primary bg-primary/[0.04] shadow-xl shadow-primary/10"
                                : "border-white/5 hover:border-white/10 hover:bg-white/[0.01]"
                            )}
                          >
                            {isCurrent && (
                              <span className="absolute top-4 end-4 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-[9px] font-black uppercase tracking-widest z-10">
                                الباقة النشطة
                              </span>
                            )}

                            <div className="space-y-5 pt-4 text-start">
                              <div>
                                <h4
                                  className={cn(
                                    "text-lg font-black transition-colors",
                                    isCurrent ? "text-primary" : "text-white"
                                  )}
                                >
                                  {p.name}
                                </h4>
                                <p className="text-xs text-muted-foreground mt-1.5 min-h-[2.5rem] leading-relaxed">
                                  {p.description || "باقة مرنة وسريعة للأندية الناشئة."}
                                </p>
                              </div>

                              <div className="py-4 px-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-2 text-start">
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                    {billingCycle === "monthly"
                                      ? "الاشتراك الشهري"
                                      : billingCycle === "yearly"
                                        ? "الاشتراك السنوي"
                                        : "الاشتراك لسنتين"}
                                  </span>
                                  <div className="flex flex-col items-end">
                                    {billingCycle !== "monthly" && originalVal > 0 && (
                                      <span className="text-xs text-muted-foreground/60 line-through font-bold mb-0.5">
                                        <bdi>
                                          {originalVal.toFixed(2)} {currency}
                                        </bdi>
                                      </span>
                                    )}
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-2xl font-black text-primary">
                                        <bdi>{priceVal.toFixed(2)}</bdi>
                                      </span>
                                      <span className="text-[10px] text-muted-foreground font-black uppercase">
                                        {currency}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {billingCycle !== "monthly" && (
                                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-emerald-400 text-[10px] font-bold">
                                    <span>
                                      ما يعادل {monthlyEquivalent.toFixed(2)} {currency}/شهر
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black">
                                      وفرت {savingsVal.toFixed(2)} {currency}!
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-3 gap-2 py-1">
                                <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl py-2 px-1 text-center">
                                  <p className="text-[9px] font-black text-muted-foreground mb-0.5">
                                    الطلاب
                                  </p>
                                  <p className="text-xs font-black text-white">
                                    {p.max_students}
                                  </p>
                                </div>
                                <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl py-2 px-1 text-center">
                                  <p className="text-[9px] font-black text-muted-foreground mb-0.5">
                                    الفروع
                                  </p>
                                  <p className="text-xs font-black text-white">
                                    {p.max_locations}
                                  </p>
                                </div>
                                <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl py-2 px-1 text-center">
                                  <p className="text-[9px] font-black text-muted-foreground mb-0.5">
                                    الموظفين
                                  </p>
                                  <p className="text-xs font-black text-white">
                                    {p.max_staff}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="pt-6 mt-6 border-t border-white/5">
                              {isCurrent ? (
                                <button
                                  disabled
                                  className="w-full py-3 rounded-xl bg-white/5 border border-white/5 text-muted-foreground text-xs font-black cursor-not-allowed"
                                >
                                  {tenantFullData?.status === "trial"
                                    ? "سيتم التفعيل تلقائياً بعد التجربة"
                                    : "أنت مشترك في هذه الباقة"}
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
                      <h3 className="text-lg font-black text-white">
                        سجل طلبات تغيير الباقات
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        متابعة حالة طلبات الترقية أو التعديل المقدمة لمدير النظام.
                      </p>
                    </div>

                    {subRequests.length === 0 ? (
                      <div className="glass-card py-12 text-center border-dashed border-white/10 bg-transparent flex flex-col items-center justify-center">
                        <CreditCard className="w-10 h-10 text-muted-foreground/30 mb-4" />
                        <p className="text-sm text-muted-foreground">
                          لا يوجد أي طلبات سابقة لتغيير الباقة.
                        </p>
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
                              {subRequests.map((req) => (
                                <tr
                                  key={req.id}
                                  className="hover:bg-white/[0.01] transition-colors"
                                >
                                  <td className="py-4 px-5 text-start">
                                    <span className="font-bold">{req.new_plan_name}</span>
                                    {req.old_plan_name && (
                                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                                        بدلاً من {req.old_plan_name}
                                      </span>
                                    )}
                                  </td>
                                  <td
                                    className="py-4 px-5 text-start max-w-xs truncate"
                                    title={req.reason}
                                  >
                                    {req.reason || "—"}
                                  </td>
                                  <td className="py-4 px-5 text-start text-xs text-muted-foreground">
                                    <bdi>{formatDate(req.created_at)}</bdi>
                                  </td>
                                  <td className="py-4 px-5 text-start">
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                        req.status === "pending" &&
                                          "bg-amber-500/10 border-amber-500/20 text-amber-400",
                                        req.status === "approved" &&
                                          "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                                        req.status === "rejected" &&
                                          "bg-red-500/10 border-red-500/20 text-red-400"
                                      )}
                                    >
                                      {req.status === "pending" && "معلق"}
                                      {req.status === "approved" && "مقبول ✓"}
                                      {req.status === "rejected" && "مرفوض ✗"}
                                    </span>
                                  </td>
                                  <td
                                    className="py-4 px-5 text-start max-w-xs text-xs text-muted-foreground"
                                    title={req.admin_notes}
                                  >
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
                  <Modal
                    open={showPlanModal && !!selectedNewPlan}
                    onClose={() => {
                      setShowPlanModal(false);
                      setRequestReason("");
                    }}
                    size="sm"
                  >
                    <ModalHeader
                      icon={<CreditCard className="w-5 h-5" />}
                      title="طلب تغيير باقة الاشتراك"
                      onClose={() => {
                        setShowPlanModal(false);
                        setRequestReason("");
                      }}
                    />
                    <ModalBody className="space-y-4">
                      {selectedNewPlan &&
                        (() => {
                          const monthly =
                            parseFloat(selectedNewPlan.price_monthly) || 0;
                          const currency = selectedNewPlan.currency || "SAR";
                          let priceVal = monthly;
                          let cycleTextText = "شهرياً";

                          if (billingCycle === "yearly") {
                            priceVal = monthly * 11;
                            cycleTextText = "سنوياً (خصم 8.3% - وفرت شهر!)";
                          } else if (billingCycle === "biennial") {
                            priceVal = monthly * 21;
                            cycleTextText = "كل سنتين (خصم 12.5% - وفرت 3 أشهر!)";
                          }

                          return (
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2 text-start text-xs">
                              <p className="text-muted-foreground">
                                الباقة المستهدفة:{" "}
                                <strong className="text-white font-bold">
                                  {selectedNewPlan.name}
                                </strong>
                              </p>
                              <p className="text-muted-foreground">
                                قيمة الاشتراك المقدرة:{" "}
                                <strong className="text-white font-bold">
                                  {priceVal.toFixed(2)} {currency} {cycleTextText}
                                </strong>
                              </p>
                            </div>
                          );
                        })()}

                      <div className="space-y-2 text-start">
                        <label className="text-sm font-bold text-white">
                          سبب طلب تغيير الباقة (اختياري)
                        </label>
                        <textarea
                          rows={4}
                          placeholder="اكتب هنا التفاصيل الإضافية أو المتطلبات الخاصة بك لمدير المنصة..."
                          className="w-full p-3 rounded-xl border bg-background/50 border-white/5 focus:border-primary/50 outline-none text-sm text-white transition-all placeholder:text-muted-foreground/40"
                          value={requestReason}
                          onChange={(e) => setRequestReason(e.target.value)}
                        />
                      </div>
                    </ModalBody>

                    <ModalFooter>
                      <button
                        onClick={() => {
                          setShowPlanModal(false);
                          setRequestReason("");
                        }}
                        className="btn-secondary"
                      >
                        إلغاء
                      </button>
                      <button
                        disabled={submittingPlanRequest}
                        onClick={async () => {
                          try {
                            setSubmittingPlanRequest(true);
                            const cycleText =
                              billingCycle === "monthly"
                                ? "شهري"
                                : billingCycle === "yearly"
                                  ? "سنوي (1 سنة)"
                                  : "سنتين (2 سنة)";
                            const reasonPayload = `[دورة الدفع المطلوبة: ${cycleText}]\n${requestReason}`;
                            await api.tenants.subscriptionRequests.create({
                              new_plan: selectedNewPlan.id,
                              billing_cycle: billingCycle,
                              reason: reasonPayload,
                            });
                            toast.success("تم إرسال طلب تغيير الباقة بنجاح ✓");
                            setShowPlanModal(false);
                            setRequestReason("");
                            await refreshRequests();
                          } catch (e: any) {
                            toast.error(
                              e.response?.data?.non_field_errors?.[0] ||
                                e.response?.data?.error ||
                                "فشل إرسال الطلب. قد يكون لديك طلب معلق بالفعل."
                            );
                          } finally {
                            setSubmittingPlanRequest(false);
                          }
                        }}
                        className="btn-primary"
                      >
                        {submittingPlanRequest ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "إرسال الطلب الآن"
                        )}
                      </button>
                    </ModalFooter>
                  </Modal>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
