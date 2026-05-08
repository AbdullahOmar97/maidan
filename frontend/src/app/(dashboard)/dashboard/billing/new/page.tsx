"use client";
import { Select } from "@/components/ui/select";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import {
  ArrowRight, CreditCard, Loader2, AlertCircle, Sparkles,
  User, Info, CheckCircle2, Receipt, Calendar, DollarSign,
  Search, X,
} from "lucide-react";
import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";
import { InputWrapper } from "@/components/form-elements";
import type { Student } from "@/types";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/dashboard/permission-guard";

export default function NewInvoicePage() {
  const router        = useRouter();
  const queryClient   = useQueryClient();
  const searchParams  = useSearchParams();
  const preselectedId = searchParams.get("studentId");

  const [fetchingStudent, setFetchingStudent] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentSearch,   setStudentSearch]   = useState("");
  const [searchResults,   setSearchResults]   = useState<Student[]>([]);
  const [showResults,     setShowResults]     = useState(false);
  const [isSearching,     setIsSearching]     = useState(false);
  const [error,           setError]           = useState("");

  const debouncedSearch = useDebounce(studentSearch, 400);

  const [formData, setFormData] = useState({
    student_id:      "",
    subtotal:        "",
    discount_amount: "0",
    tax_rate:        "0",
    currency:        "JOD",
    due_date:        new Date().toISOString().split("T")[0],
    notes:           "",
    is_recurring:    false,
  });

  // Fetch tenant default currency
  useEffect(() => {
    api.tenants.me().then((res: any) => {
      if (res.data?.currency) {
        setFormData((prev) => ({ ...prev, currency: res.data.currency }));
      }
    });
  }, []);

  // Preselected student
  useEffect(() => {
    if (!preselectedId) return;
    setFetchingStudent(true);
    api.students
      .get(parseInt(preselectedId))
      .then((res: any) => {
        setSelectedStudent(res.data);
        setFormData((prev) => ({ ...prev, student_id: preselectedId }));
      })
      .finally(() => setFetchingStudent(false));
  }, [preselectedId]);

  // Student search
  useEffect(() => {
    const query = debouncedSearch.trim();
    if (query.length >= 2) {
      setIsSearching(true);
      setShowResults(true);
      api.students
        .list({ search: query })
        .then((res: any) => setSearchResults(res.data.results ?? []))
        .finally(() => setIsSearching(false));
    } else {
      setSearchResults([]);
      setShowResults(false);
      setIsSearching(false);
    }
  }, [debouncedSearch]);

  const invoiceMutation = useMutation({
    mutationFn: (payload: any) => api.billing.invoices.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
      toast.success("تم إنشاء الفاتورة بنجاح");
      router.push("/dashboard/billing");
    },
    onError: (err: any) => {
      let message = "حدث خطأ أثناء إنشاء الفاتورة.";
      if (err.response?.data && typeof err.response.data === "object") {
        const msgs = Object.entries(err.response.data)
          .map(([f, m]) => `${f}: ${Array.isArray(m) ? m.join(", ") : m}`)
          .join("\n");
        if (msgs) message = `خطأ في البيانات:\n${msgs}`;
      }
      setError(message);
      toast.error("فشل إنشاء الفاتورة");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.student_id) { setError("يرجى اختيار الطالب"); return; }
    setError("");
    invoiceMutation.mutate({
      ...formData,
      student_id:      parseInt(formData.student_id),
      subtotal:        parseFloat(formData.subtotal),
      discount_amount: parseFloat(formData.discount_amount),
      tax_rate:        parseFloat(formData.tax_rate),
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const selectStudent = (student: Student) => {
    setSelectedStudent(student);
    setFormData((prev) => ({ ...prev, student_id: student.id.toString() }));
    setStudentSearch("");
    setShowResults(false);
  };

  // Computed totals
  const subtotal  = parseFloat(formData.subtotal || "0");
  const discount  = parseFloat(formData.discount_amount || "0");
  const total     = Math.max(0, subtotal - discount);

  if (fetchingStudent) {
    return (
      <div className="h-[60vh] flex items-center justify-center" aria-busy="true">
        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <PermissionGuard permission="can_create_invoice">
      <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-16 md:pb-20">

        {/* ── Header ── */}
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/billing"
            className="touch-target w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all active:scale-90 shrink-0"
            aria-label="العودة إلى قائمة الفواتير"
          >
            <ArrowRight className="w-5 h-5 rtl-flip" aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">إنشاء فاتورة جديدة</h1>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20">
                يدوي
              </span>
            </div>
            <p className="text-muted-foreground text-sm font-bold mt-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              قم بإصدار فاتورة لمرة واحدة أو فاتورة دورية للطالب
            </p>
          </div>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8" noValidate>
          {/* Error alert */}
          {error && (
            <div
              role="alert"
              className="p-5 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold flex items-start gap-3 animate-in fade-in slide-in-from-top-4"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="whitespace-pre-wrap">{error}</div>
            </div>
          )}

          {/*
            Main layout:
            - Mobile: single column (form first, summary below)
            - lg: 2-col with summary sidebar on the right
          */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

            {/* ── Form Fields ── */}
            <div className="lg:col-span-2 space-y-5 md:space-y-8">

              {/* Student Selection */}
              <div
                className={cn(
                  "glass-card p-5 md:p-8 space-y-5 relative transition-all duration-300",
                  showResults ? "z-40 ring-2 ring-primary/20 shadow-primary/10" : "z-20"
                )}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 pointer-events-none" aria-hidden="true" />

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/10" aria-hidden="true">
                    <User className="w-4 h-4" />
                  </div>
                  <h2 className="text-base md:text-lg font-black text-white">اختيار الطالب</h2>
                </div>

                {!selectedStudent ? (
                  <div className="relative">
                    <InputWrapper label="البحث عن الطالب" icon={Search}>
                      <input
                        type="search"
                        id="student-search"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="ابحث بالاسم أو رقم الطالب..."
                        className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30 text-right min-h-[44px]"
                        dir="rtl"
                        aria-label="البحث عن الطالب"
                        autoComplete="off"
                      />
                    </InputWrapper>

                    {showResults && (
                      <div
                        className="absolute z-50 w-full mt-2 glass-card border border-white/10 shadow-2xl max-h-60 overflow-y-auto p-2"
                        role="listbox"
                        aria-label="نتائج البحث"
                      >
                        {isSearching ? (
                          <div className="p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" aria-hidden="true" />
                            <p className="text-xs font-bold">جاري البحث...</p>
                          </div>
                        ) : searchResults.length > 0 ? (
                          searchResults.map((student) => (
                            <button
                              key={student.id}
                              type="button"
                              role="option"
                              aria-selected={false}
                              onClick={() => selectStudent(student)}
                              className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors text-right touch-target"
                            >
                              <div className="w-10 h-10 rounded-lg gradient-brand flex items-center justify-center text-white font-black text-xs shrink-0" aria-hidden="true">
                                {student.first_name?.[0] || "U"}
                              </div>
                              <div className="flex-1 min-w-0 text-right">
                                <p className="text-sm font-bold text-white truncate">{student.full_name}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{student.student_number}</p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-8 text-center text-muted-foreground">
                            <p className="text-xs font-bold">لم يتم العثور على نتائج</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl gradient-brand flex items-center justify-center text-white font-black text-sm shrink-0" aria-hidden="true">
                        {selectedStudent.first_name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-white truncate">{selectedStudent.full_name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{selectedStudent.student_number}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(null)}
                      className="touch-target p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors shrink-0 ml-2"
                      aria-label={`إزالة الطالب ${selectedStudent.full_name}`}
                    >
                      <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              {/* Invoice Details */}
              <div className="glass-card p-5 md:p-8 space-y-5 md:space-y-8 relative overflow-hidden z-10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none" aria-hidden="true" />

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10" aria-hidden="true">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <h2 className="text-base md:text-lg font-black text-white">تفاصيل الفاتورة</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <InputWrapper label="المبلغ الأساسي" icon={DollarSign}>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      name="subtotal"
                      id="subtotal"
                      value={formData.subtotal}
                      onChange={handleChange}
                      placeholder="0.00"
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30 min-h-[44px]"
                      dir="ltr"
                      aria-label="المبلغ الأساسي للفاتورة"
                    />
                  </InputWrapper>

                  <InputWrapper label="العملة" icon={DollarSign}>
                    <Select
                      name="currency"
                      id="currency"
                      value={formData.currency}
                      onChange={handleChange}
                      aria-label="عملة الفاتورة"
                    >
                      <option value="JOD">JOD - دينار أردني</option>
                      <option value="SAR">SAR - ريال سعودي</option>
                      <option value="USD">USD - دولار أمريكي</option>
                      <option value="AED">AED - درهم إماراتي</option>
                    </Select>
                  </InputWrapper>

                  <InputWrapper label="قيمة الخصم (اختياري)" icon={DollarSign}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="discount_amount"
                      id="discount_amount"
                      value={formData.discount_amount}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold min-h-[44px]"
                      dir="ltr"
                      aria-label="قيمة الخصم"
                    />
                  </InputWrapper>

                  <InputWrapper label="تاريخ الاستحقاق" icon={Calendar}>
                    <input
                      required
                      type="date"
                      name="due_date"
                      id="due_date"
                      value={formData.due_date}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold appearance-none min-h-[44px]"
                      aria-label="تاريخ استحقاق الفاتورة"
                    />
                  </InputWrapper>
                </div>

                <InputWrapper label="ملاحظات إضافية" icon={Info}>
                  <textarea
                    name="notes"
                    id="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="ستظهر هذه الملاحظات في الفاتورة..."
                    className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30 text-right resize-none"
                    dir="rtl"
                    aria-label="ملاحظات الفاتورة"
                  />
                </InputWrapper>
              </div>
            </div>

            {/* ── Summary Sidebar ── */}
            <div className="space-y-4 md:space-y-8">
              {/* Summary card */}
              <div className="glass-card p-5 md:p-8 space-y-5 md:space-y-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none" aria-hidden="true" />

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10" aria-hidden="true">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h2 className="text-base md:text-lg font-black text-white">ملخص الفاتورة</h2>
                </div>

                <div className="space-y-3" aria-live="polite" aria-label="ملخص المبالغ">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">المبلغ الفرعي:</span>
                    <span className="text-white font-bold" dir="ltr">{formatCurrency(subtotal, formData.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">الخصم:</span>
                    <span className="text-red-400 font-bold" dir="ltr">-{formatCurrency(discount, formData.currency)}</span>
                  </div>
                  <div className="pt-3 border-t border-white/5 flex justify-between">
                    <span className="text-white font-black">الإجمالي المستحق:</span>
                    <span className="text-primary font-black text-lg md:text-xl" dir="ltr">
                      {formatCurrency(total, formData.currency)}
                    </span>
                  </div>
                </div>

                {/* Recurring toggle */}
                <label
                  htmlFor="is_recurring"
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/[0.08] transition-colors"
                >
                  <input
                    type="checkbox"
                    id="is_recurring"
                    name="is_recurring"
                    checked={formData.is_recurring}
                    onChange={handleChange}
                    className="w-5 h-5 rounded border-white/10 bg-white/5 text-primary focus:ring-primary/20 cursor-pointer"
                    aria-describedby="recurring-desc"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">فاتورة دورية</span>
                    <span id="recurring-desc" className="text-[10px] text-muted-foreground">تتكرر تلقائياً كل شهر</span>
                  </div>
                </label>
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={invoiceMutation.isPending || !selectedStudent || !formData.subtotal}
                  className="touch-target w-full py-4 rounded-[2rem] gradient-brand text-white text-sm font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="إصدار الفاتورة"
                >
                  {invoiceMutation.isPending ? (
                    <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
                  ) : (
                    <>
                      <span>إصدار الفاتورة</span>
                      <CreditCard className="w-5 h-5 group-hover:rotate-12 transition-transform" aria-hidden="true" />
                    </>
                  )}
                </button>

                <Link
                  href="/dashboard/billing"
                  className="touch-target w-full py-4 rounded-[2rem] bg-white/5 border border-white/10 text-white text-sm font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center"
                >
                  إلغاء
                </Link>
              </div>
            </div>
          </div>
        </form>
      </div>
    </PermissionGuard>
  );
}
