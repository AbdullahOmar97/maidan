"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Loader2, AlertCircle, Sparkles, MapPin,
  Phone, Mail, User, Info, CheckCircle2,
  Camera, X, Award, CreditCard, HeartPulse,
  Users, ShieldCheck, Calendar, Globe,
  MessageSquare, ChevronLeft, ChevronRight, FileText,
  ShoppingBag, Package, Trash2, Plus, Minus, Search
} from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, ErrorBanner } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import type { Location, BeltRank, MembershipPlan, Family, Product, ProductOption } from "@/types";
import { parseApiError, cn, formatCurrency } from "@/lib/utils";
import { NATIONALITIES, BLOOD_TYPES, LEAD_SOURCES, EMERGENCY_RELATIONS } from "@/lib/constants";
import { useTenant } from "@/lib/providers/tenant-provider";

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type TabType = "basic" | "subscription" | "products" | "personal" | "medical" | "notes";

interface SelectedProductItem {
  product_id: number;
  product_name: string;
  product_price: number;
  product_currency: string;
  option_id?: number | null;
  option_name?: string | null;
  additional_price: number;
  quantity: number;
  max_stock?: number;
}

export function AddStudentModal({ isOpen, onClose, onSuccess }: AddStudentModalProps) {
  const { tenant } = useTenant();
  const tenantCurrency = tenant?.default_currency || "JOD";
  const [activeTab, setActiveTab] = useState<TabType>("basic");
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [belts, setBelts] = useState<BeltRank[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProductItem[]>([]);
  const [productOptionsState, setProductOptionsState] = useState<Record<number, number | "">>({});
  const [productSearch, setProductSearch] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const topRef = useRef<HTMLDivElement>(null);

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    // Basic Info (Mandatory: full_name, location_id)
    full_name: "",
    location_id: "" as number | "",
    phone: "",
    email: "",
    whatsapp: "",
    gender: "male" as "male" | "female",
    status: "active" as "active" | "trial" | "lead" | "inactive",

    // Personal & Demographic (Optional)
    date_of_birth: "",
    nationality: "",

    // Emergency & Family (Optional)
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relation: "",
    family_id: "" as number | "",

    // Medical (Optional)
    blood_type: "",
    allergies: "",
    medical_notes: "",

    // Belts & Subscription (Optional)
    initial_belt_id: "" as number | "",
    initial_membership_plan_id: "" as number | "",
    membership_start_date: new Date().toISOString().split("T")[0],

    // Marketing, Notes & Consents (Optional)
    source: "",
    notes: "",
    internal_notes: "",
    waiver_signed: false,
    photo_consent: false,
  });

  // Calculate age if DOB provided
  const calculatedAge = formData.date_of_birth ? (() => {
    const today = new Date();
    const birth = new Date(formData.date_of_birth);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  })() : null;

  useEffect(() => {
    if (isOpen) {
      setActiveTab("basic");
      setError("");
      setPhoto(null);
      setPhotoPreview(null);
      setLocationsLoading(true);

      // Load locations (required)
      api.locations.list()
        .then((res: any) => {
          const locationData = res.data.results || res.data;
          const locs = Array.isArray(locationData) ? locationData : [];
          setLocations(locs);
          if (locs.length > 0) {
            setFormData(prev => ({
              ...prev,
              location_id: prev.location_id || locs[0].id
            }));
          }
        })
        .catch((err) => {
          console.error("Failed to fetch locations", err);
          setError("فشل تحميل قائمة الفروع. يرجى التأكد من وجود فرع واحد على الأقل.");
        })
        .finally(() => {
          setLocationsLoading(false);
        });

      // Load belts (optional)
      api.belts.ranks()
        .then((res: any) => {
          const ranksData = res.data?.results ?? res.data ?? [];
          setBelts(Array.isArray(ranksData) ? ranksData : []);
        })
        .catch(() => setBelts([]));

      // Load membership plans (optional)
      api.billing.plans.list()
        .then((res: any) => {
          const plansData = res.data?.results ?? res.data ?? [];
          setPlans(Array.isArray(plansData) ? plansData : []);
        })
        .catch(() => setPlans([]));

      // Load families (optional)
      api.families.list()
        .then((res: any) => {
          const famData = res.data?.results ?? res.data ?? [];
          setFamilies(Array.isArray(famData) ? famData : []);
        })
        .catch(() => setFamilies([]));

      // Load store products (optional)
      setLoadingProducts(true);
      api.store.products.list()
        .then((res: any) => {
          const pData = res.data?.results ?? res.data ?? [];
          setProducts(Array.isArray(pData) ? pData.filter((p: Product) => p.is_active) : []);
        })
        .catch(() => setProducts([]))
        .finally(() => setLoadingProducts(false));

      setSelectedProducts([]);
      setProductOptionsState({});
      setProductSearch("");
    }
  }, [isOpen]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("حجم الصورة يجب ألا يتجاوز 5 ميجابايت");
        return;
      }
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === "location_id" || name === "family_id" || name === "initial_belt_id" || name === "initial_membership_plan_id") {
      setFormData(prev => ({ ...prev, [name]: value === "" ? "" : parseInt(value, 10) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const copyPhoneToWhatsapp = () => {
    if (formData.phone) {
      setFormData(prev => ({ ...prev, whatsapp: prev.phone }));
    }
  };

  const addProductToOrder = (product: Product, specificOption?: ProductOption) => {
    let option: ProductOption | undefined = specificOption;
    if (!option && product.options && product.options.length > 0) {
      const selectedOptId = productOptionsState[product.id];
      option = product.options.find(o => o.id === Number(selectedOptId)) || product.options[0];
    }

    setSelectedProducts(prev => {
      const existingIndex = prev.findIndex(p => p.product_id === product.id && p.option_id === (option?.id || null));
      if (existingIndex > -1) {
        const updated = [...prev];
        const maxStock = option ? option.stock : 999;
        if (updated[existingIndex].quantity < maxStock) {
          updated[existingIndex].quantity += 1;
        }
        return updated;
      }
      const unitPrice = parseFloat(product.price) + (option ? parseFloat(option.additional_price) : 0);
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          product_price: unitPrice,
          product_currency: product.currency || tenantCurrency,
          option_id: option?.id || null,
          option_name: option ? `${option.name}: ${option.value}` : null,
          additional_price: option ? parseFloat(option.additional_price) : 0,
          quantity: 1,
          max_stock: option ? option.stock : undefined,
        }
      ];
    });
  };

  const updateProductQuantity = (index: number, delta: number) => {
    setSelectedProducts(prev => {
      const updated = [...prev];
      const target = updated[index];
      const newQty = target.quantity + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      const max = target.max_stock ?? 999;
      target.quantity = Math.min(newQty, max);
      return updated;
    });
  };

  const removeProductFromOrder = (index: number) => {
    setSelectedProducts(prev => prev.filter((_, i) => i !== index));
  };

  const filteredProducts = products.filter(p => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
  });

  const selectedPlan = plans.find(p => p.id === Number(formData.initial_membership_plan_id));
  const planPrice = selectedPlan ? Number(selectedPlan.price) : 0;
  const productsTotal = selectedProducts.reduce((sum, p) => sum + (p.product_price * p.quantity), 0);
  const grandTotal = planPrice + productsTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name?.trim()) {
      setActiveTab("basic");
      setError("يرجى إدخال اسم الطالب الكامل");
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      return;
    }

    if (!formData.location_id) {
      setActiveTab("basic");
      setError("يرجى اختيار الفرع");
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      return;
    }

    setError("");
    setIsSubmitting(true);

    const initialProductsPayload = selectedProducts.map(p => ({
      product_id: p.product_id,
      option_id: p.option_id || null,
      quantity: p.quantity,
    }));

    try {
      if (photo) {
        const data = new FormData();
        Object.entries(formData).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            data.append(k, String(v));
          }
        });
        if (initialProductsPayload.length > 0) {
          data.append("initial_products", JSON.stringify(initialProductsPayload));
        }
        data.append("photo", photo);
        await api.students.create(data);
      } else {
        const payload: Record<string, any> = {};
        Object.entries(formData).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            payload[k] = v;
          }
        });
        if (initialProductsPayload.length > 0) {
          payload.initial_products = initialProductsPayload;
        }
        await api.students.create(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(parseApiError(err, "حدث خطأ أثناء إضافة الطالب. يرجى التحقق من البيانات."));
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tabs config with icon and count indicator
  const tabs = [
    {
      id: "basic" as TabType,
      label: "البيانات الأساسية",
      icon: User,
      badge: "إلزامي",
      badgeColor: "text-primary bg-primary/10 border-primary/20",
    },
    {
      id: "subscription" as TabType,
      label: "الاشتراك والحزام",
      icon: Award,
      hasData: Boolean(formData.initial_membership_plan_id || formData.initial_belt_id),
    },
    {
      id: "products" as TabType,
      label: "المعدات والمنتجات",
      icon: ShoppingBag,
      badge: selectedProducts.length > 0 ? `${selectedProducts.length}` : undefined,
      badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      hasData: selectedProducts.length > 0,
    },
    {
      id: "personal" as TabType,
      label: "الشخصية والعائلة",
      icon: Users,
      hasData: Boolean(formData.date_of_birth || formData.nationality || formData.family_id || formData.emergency_contact_name || formData.emergency_contact_phone),
    },
    {
      id: "medical" as TabType,
      label: "السجل الطبي",
      icon: HeartPulse,
      hasData: Boolean(formData.blood_type || formData.allergies || formData.medical_notes),
    },
    {
      id: "notes" as TabType,
      label: "الملاحظات والإقرارات",
      icon: FileText,
      hasData: Boolean(formData.notes || formData.internal_notes || formData.source || formData.waiver_signed || formData.photo_consent),
    },
  ];

  return (
    <Modal open={isOpen} onClose={onClose} size="2xl">
      <ModalHeader
        title="إضافة طالب جديد"
        subtitle="نموذج شامل للتسجيل — فقط الاسم والفرع إلزاميان، وبقية البيانات اختيارية بالكامل"
        icon={<Sparkles className="w-5 h-5" />}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Navigation Tabs */}
        <div className="shrink-0 px-6 sm:px-8 pt-3 pb-2 border-b border-white/[0.06] bg-white/[0.01]">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all shrink-0 border",
                    isActive
                      ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                      : "bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06] hover:text-white border-white/[0.05]"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold border", tab.badgeColor)}>
                      {tab.badge}
                    </span>
                  )}
                  {tab.hasData && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <ModalBody className="space-y-5">
          <div ref={topRef} />
          <ErrorBanner message={error} />

          {/* TAB 1: BASIC INFO */}
          {activeTab === "basic" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Photo Picker */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="relative group">
                  <div className="w-18 h-18 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                    {photoPreview ? (
                      <img src={photoPreview} alt="معاينة الصورة" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-7 h-7 text-muted-foreground/50" />
                    )}
                  </div>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white mb-0.5">صورة الطالب الشخصية (اختياري)</p>
                  <p className="text-[11px] text-muted-foreground mb-2">تُستخدم في بطاقة الطالب والتعرف السريع واختبارات الأحزمة (PNG أو JPG)</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all"
                  >
                    {photoPreview ? "تغيير الصورة" : "اختر صورة للطالب"}
                  </button>
                </div>
              </div>

              {/* Full Name & Branch (MANDATORY) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="اسم الطالب الكامل" required hint="الاسم الأول والأخير">
                  <Input
                    required
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="مثال: عبدالله عمر سالم"
                  />
                </FormField>

                <FormField label="الفرع / النادي" required hint="مكان تدريب الطالب">
                  {locationsLoading ? (
                    <div className="w-full h-11 bg-white/5 animate-pulse rounded-xl" />
                  ) : (
                    <Select
                      required
                      name="location_id"
                      value={formData.location_id}
                      onChange={handleChange}
                    >
                      <option value="" disabled>اختر الفرع...</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
              </div>

              {/* Phone & WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="رقم الهاتف" hint="اختياري">
                  <Input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="05x xxx xxxx"
                  />
                </FormField>

                <FormField
                  label="رقم الواتساب"
                  hint={
                    formData.phone && !formData.whatsapp ? (
                      <button
                        type="button"
                        onClick={copyPhoneToWhatsapp}
                        className="text-primary hover:underline font-bold text-[10px]"
                      >
                        نسخ رقم الهاتف
                      </button>
                    ) : "اختياري"
                  }
                >
                  <Input
                    type="tel"
                    name="whatsapp"
                    value={formData.whatsapp}
                    onChange={handleChange}
                    placeholder="05x xxx xxxx"
                  />
                </FormField>
              </div>

              {/* Email & Gender & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="البريد الإلكتروني" hint="اختياري">
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="student@example.com"
                  />
                </FormField>

                <FormField label="الجنس" required>
                  <Select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                  >
                    <option value="male">ذكر</option>
                    <option value="female">أنثى</option>
                  </Select>
                </FormField>

                <FormField label="الحالة الأولية" required>
                  <Select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                  >
                    <option value="active">نشط (مشترك فعلي)</option>
                    <option value="trial">تجريبي (فترة تجربة)</option>
                    <option value="lead">عميل محتمل (مهتم)</option>
                    <option value="inactive">غير نشط</option>
                  </Select>
                </FormField>
              </div>
            </div>
          )}

          {/* TAB 2: SUBSCRIPTION & BELT */}
          {activeTab === "subscription" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                <Award className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-white mb-0.5">تحديد الحزام والاشتراك المبدئي (اختياري)</p>
                  <p className="text-muted-foreground">يمكنك إلحاق الطالب بباقة اشتراك أو منحه رتبة الحزام الأولية مباشرة، أو تركها لاحقاً.</p>
                </div>
              </div>

              {/* Membership Plan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="خطة الاشتراك الأولية" hint="اختياري">
                  <Select
                    name="initial_membership_plan_id"
                    value={formData.initial_membership_plan_id}
                    onChange={handleChange}
                  >
                    <option value="">بدون اشتراك حالياً</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.price} {p.currency || "SAR"} ({p.billing_cycle})
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="تاريخ بدء الاشتراك" hint="يُعتمد فقط عند اختيار باقة">
                  <Input
                    type="date"
                    name="membership_start_date"
                    value={formData.membership_start_date}
                    onChange={handleChange}
                    disabled={!formData.initial_membership_plan_id}
                  />
                </FormField>
              </div>

              {/* Belt Rank */}
              <FormField label="الحزام الأولي / الرتبة الرياضية" hint="اختياري">
                <Select
                  name="initial_belt_id"
                  value={formData.initial_belt_id}
                  onChange={handleChange}
                >
                  <option value="">بدون حزام مسجل</option>
                  {belts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.name_ar ? `(${b.name_ar})` : ""} — [{b.martial_art}]
                    </option>
                  ))}
                </Select>
              </FormField>

              {/* Belt Rank Swatch Preview */}
              {formData.initial_belt_id && (() => {
                const selectedBelt = belts.find(b => b.id === Number(formData.initial_belt_id));
                if (!selectedBelt) return null;
                return (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div
                      className="w-5 h-5 rounded-md border border-white/20 shadow-sm shrink-0"
                      style={{ backgroundColor: selectedBelt.color_hex }}
                    />
                    <div className="text-xs">
                      <span className="font-bold text-white">{selectedBelt.name}</span>
                      <span className="text-muted-foreground ms-2">رياضة: {selectedBelt.martial_art}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB: PRODUCTS & GEAR */}
          {activeTab === "products" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-start gap-3">
                <ShoppingBag className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-white mb-0.5">تجهيز الطالب بالمعدات والزي المبدئي (اختياري)</p>
                  <p className="text-muted-foreground">
                    يمكنك إضافة بدلة التدريب، القفازات، أو الأدوات الخاصة بالنادي مباشرة عند التسجيل ليتم خصمها من المخزون وإنشاء فاتورة رسمية للطالب.
                  </p>
                </div>
              </div>

              {/* Selected Items Cart */}
              {selectedProducts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-1">
                    <span>المعدات المختارة ({selectedProducts.length})</span>
                    <span className="text-emerald-400 font-black">
                      المجموع: {formatCurrency(productsTotal, tenant?.currency)}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
                    {selectedProducts.map((item, index) => (
                      <div
                        key={`${item.product_id}-${item.option_id ?? "none"}-${index}`}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{item.product_name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              {item.option_name && (
                                <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-slate-300">
                                  {item.option_name}
                                </span>
                              )}
                              <span>سعر الوحدة: {formatCurrency(item.product_price, tenant?.currency)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {/* Quantity Counter */}
                          <div className="flex items-center border border-white/10 rounded-lg bg-white/5 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => updateProductQuantity(index, -1)}
                              className="p-1 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 text-xs font-bold text-white min-w-[1.5rem] text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateProductQuantity(index, 1)}
                              disabled={item.max_stock !== undefined && item.quantity >= item.max_stock}
                              className="p-1 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors disabled:opacity-40"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Line item total */}
                          <span className="text-xs font-black text-white min-w-[4rem] text-end">
                            {formatCurrency(item.product_price * item.quantity, tenant?.currency)}
                          </span>

                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => removeProductFromOrder(index)}
                            className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                            title="إزالة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Product Catalog Picker */}
              <div className="space-y-3 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="ابحث في متجر الأكاديمية (الاسم، الوصف)..."
                      className="ps-9 h-9 text-xs"
                    />
                  </div>
                </div>

                {loadingProducts ? (
                  <div className="flex items-center justify-center p-8 text-muted-foreground text-xs gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>جاري تحميل المنتجات المتوفرة...</span>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-white/[0.01] border border-dashed border-white/10">
                    <Package className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs font-bold text-muted-foreground">لا توجد منتجات متوفرة مطابقة</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {productSearch ? "جرب البحث بكلمات أخرى" : "لم يتم إضافة منتجات في متجر الأكاديمية بعد"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pe-1">
                    {filteredProducts.map((prod) => {
                      const options = prod.options || [];
                      const selectedOptId = productOptionsState[prod.id] ?? (options.length > 0 ? options[0].id : null);
                      const selectedOpt = options.find((o) => o.id === selectedOptId);

                      const effectivePrice = Number(prod.price) + (selectedOpt ? Number(selectedOpt.additional_price || 0) : 0);
                      const effectiveStock = selectedOpt ? selectedOpt.stock : 999;
                      const isOutOfStock = selectedOpt !== undefined && effectiveStock <= 0;

                      return (
                        <div
                          key={prod.id}
                          className="flex flex-col justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-black text-white line-clamp-1">{prod.name}</span>
                              <span className="text-xs font-black text-emerald-400 shrink-0">
                                {formatCurrency(effectivePrice, tenant?.currency)}
                              </span>
                            </div>

                            {options.length > 0 && (
                              <div className="pt-1">
                                <label className="text-[10px] text-muted-foreground block mb-1">الخيار / المقاس:</label>
                                <select
                                  value={selectedOptId ?? ""}
                                  onChange={(e) =>
                                    setProductOptionsState((prev) => ({
                                      ...prev,
                                      [prod.id]: Number(e.target.value),
                                    }))
                                  }
                                  className="w-full text-[11px] bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-primary"
                                >
                                  {options.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                      {opt.name}: {opt.value}
                                      {Number(opt.additional_price) > 0 ? ` (+${formatCurrency(Number(opt.additional_price), tenant?.currency)})` : ""}
                                      {` (متبقي: ${opt.stock})`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-white/5">
                            <span className="text-[10px] text-muted-foreground">
                              {selectedOpt ? (
                                isOutOfStock ? (
                                  <span className="text-red-400 font-bold">نفد المخزون</span>
                                ) : (
                                  <span>المتوفر: {effectiveStock}</span>
                                )
                              ) : (
                                <span className="text-emerald-400/80">متوفر</span>
                              )}
                            </span>

                            <button
                              type="button"
                              onClick={() => addProductToOrder(prod, selectedOpt)}
                              disabled={isOutOfStock}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>إضافة</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Total Calculation Card */}
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="text-muted-foreground">قيمة الاشتراك المبدئي: </span>
                  <span className="font-bold text-white">{formatCurrency(planPrice, tenant?.currency)}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground">قيمة المعدات: </span>
                  <span className="font-bold text-emerald-400">{formatCurrency(productsTotal, tenant?.currency)}</span>
                </div>
                <div className="space-y-0.5 text-end">
                  <span className="text-muted-foreground block text-[10px]">الإجمالي المطلوب:</span>
                  <span className="font-black text-sm text-primary">{formatCurrency(grandTotal, tenant?.currency)}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PERSONAL & FAMILY & EMERGENCY */}
          {activeTab === "personal" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Demographics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="تاريخ الميلاد"
                  hint={calculatedAge !== null ? `العمر التقديري: ${calculatedAge} سنة` : "اختياري"}
                >
                  <Input
                    type="date"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                  />
                </FormField>

                <FormField label="الجنسية" hint="اختياري">
                  <Select
                    name="nationality"
                    value={formData.nationality}
                    onChange={handleChange}
                  >
                    <option value="">اختر الجنسية...</option>
                    {NATIONALITIES.map((n) => (
                      <option key={n.code} value={n.code}>
                        {n.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              {/* Family Linking */}
              <FormField label="ربط بعائلة مسجلة" hint="اختياري — لدمج الفواتير وسجل العائلة">
                <Select
                  name="family_id"
                  value={formData.family_id}
                  onChange={handleChange}
                >
                  <option value="">بدون عائلة (طالب فردي)</option>
                  {families.map((fam) => (
                    <option key={fam.id} value={fam.id}>
                      عائلة {fam.name} — (مسؤول: {fam.primary_contact_name} - {fam.primary_contact_phone})
                    </option>
                  ))}
                </Select>
              </FormField>

              {/* Emergency Contact Header */}
              <div className="pt-2 border-t border-white/5">
                <p className="text-xs font-black text-white mb-3 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-blue-400" />
                  بيانات التواصل في حالات الطوارئ وولي الأمر
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField label="اسم جهة الاتصال / ولي الأمر" hint="اختياري">
                    <Input
                      name="emergency_contact_name"
                      value={formData.emergency_contact_name}
                      onChange={handleChange}
                      placeholder="مثال: عمر سالم (الأب)"
                    />
                  </FormField>

                  <FormField label="هاتف الطوارئ" hint="اختياري">
                    <Input
                      type="tel"
                      name="emergency_contact_phone"
                      value={formData.emergency_contact_phone}
                      onChange={handleChange}
                      placeholder="05x xxx xxxx"
                    />
                  </FormField>

                  <FormField label="صلة القرابة" hint="اختياري">
                    <Select
                      name="emergency_contact_relation"
                      value={formData.emergency_contact_relation}
                      onChange={handleChange}
                    >
                      <option value="">اختر صلة القرابة...</option>
                      {EMERGENCY_RELATIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MEDICAL & HEALTH */}
          {activeTab === "medical" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-start gap-3">
                <HeartPulse className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-white mb-0.5">السجل الصحي والطبي (اختياري)</p>
                  <p className="text-muted-foreground">تُستخدم هذه المعلومات لضمان سلامة الطالب أثناء التدريبات والبطولات.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="فصيلة الدم" hint="اختياري">
                  <Select
                    name="blood_type"
                    value={formData.blood_type}
                    onChange={handleChange}
                  >
                    <option value="">غير محددة</option>
                    {BLOOD_TYPES.map((bt) => (
                      <option key={bt} value={bt}>
                        {bt}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="الحساسية إن وجدت" hint="أدوية، أطعمة، بيئة...">
                  <Input
                    name="allergies"
                    value={formData.allergies}
                    onChange={handleChange}
                    placeholder="مثال: حساسية البنسلين، حساسية الغبار"
                  />
                </FormField>
              </div>

              <FormField label="ملاحظات صحية أو طبية خاصة" hint="أمراض مزمنة، إصابات مفاصل سابقة، تنبيهات للمدرب...">
                <textarea
                  name="medical_notes"
                  value={formData.medical_notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="اكتب أي ملاحظات طبية مهمة يجب على الكادر التدريبي معرفتها..."
                  className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-xs font-semibold focus:border-primary/50 focus:bg-white/[0.05] focus:outline-none transition-all placeholder:text-muted-foreground/30 resize-none"
                />
              </FormField>
            </div>
          )}

          {/* TAB 5: NOTES & CONSENTS & MARKETING */}
          {activeTab === "notes" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Marketing Lead Source */}
              <FormField label="مصدر معرفة النادي (قناة الاستقطاب)" hint="اختياري">
                <Select
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                >
                  <option value="">اختر المصدر...</option>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              {/* General & Internal Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="ملاحظات عامة حول الطالب" hint="مرئية في الملف">
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="ملاحظات عامة، أهداف الطالب الرياضية..."
                    className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-xs font-semibold focus:border-primary/50 focus:bg-white/[0.05] focus:outline-none transition-all placeholder:text-muted-foreground/30 resize-none"
                  />
                </FormField>

                <FormField label="ملاحظات داخلية خاصة بالإدارة" hint="سرية للموظفين والمدربين فقط">
                  <textarea
                    name="internal_notes"
                    value={formData.internal_notes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="ملاحظات متابعة، خصومات استثنائية، سلوك..."
                    className="w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-xs font-semibold focus:border-primary/50 focus:bg-white/[0.05] focus:outline-none transition-all placeholder:text-muted-foreground/30 resize-none"
                  />
                </FormField>
              </div>

              {/* Waivers & Consents */}
              <div className="pt-2 border-t border-white/5 space-y-3">
                <p className="text-xs font-black text-white mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  الموافقات والإقرارات الرسمية
                </p>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-all">
                  <input
                    type="checkbox"
                    name="waiver_signed"
                    checked={formData.waiver_signed}
                    onChange={handleChange}
                    className="mt-1 rounded border-white/20 bg-white/5 text-primary focus:ring-primary h-4 w-4 shrink-0"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-white block mb-0.5">تم توقيع إقرار إخلاء المسؤولية الرياضية والطبية</span>
                    <span className="text-muted-foreground text-[11px]">يقر المشترك / ولي أمره بالموافقة على الشروط واللوائح التنظيمية للنادي.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-all">
                  <input
                    type="checkbox"
                    name="photo_consent"
                    checked={formData.photo_consent}
                    onChange={handleChange}
                    className="mt-1 rounded border-white/20 bg-white/5 text-primary focus:ring-primary h-4 w-4 shrink-0"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-white block mb-0.5">الموافقة على التصوير والنشر الإعلامي</span>
                    <span className="text-muted-foreground text-[11px]">يسمح بنشر صور الطالب في منصات النادي والفعاليات والبطولات الرسمية.</span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <div className="flex items-center justify-between gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              إلغاء
            </button>

            <div className="flex items-center gap-2">
              {/* Tab Navigation Shortcuts */}
              {activeTab !== "basic" && (
                <button
                  type="button"
                  onClick={() => {
                    const idx = tabs.findIndex(t => t.id === activeTab);
                    if (idx > 0) setActiveTab(tabs[idx - 1].id);
                  }}
                  className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <ChevronRight className="w-3.5 h-3.5 rtl-flip" />
                  <span>السابق</span>
                </button>
              )}

              {activeTab !== "notes" && (
                <button
                  type="button"
                  onClick={() => {
                    const idx = tabs.findIndex(t => t.id === activeTab);
                    if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1].id);
                  }}
                  className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <span>التالي</span>
                  <ChevronLeft className="w-3.5 h-3.5 rtl-flip" />
                </button>
              )}

              {/* Main Submit Button - Available from ANY tab! */}
              <button
                type="submit"
                disabled={isSubmitting || locationsLoading}
                className="px-6 py-3 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                حفظ بيانات الطالب
              </button>
            </div>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}