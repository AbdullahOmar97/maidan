"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { 
  ArrowRight, CreditCard, Loader2, AlertCircle, Sparkles, 
  User, Info, CheckCircle2, Receipt, Calendar, DollarSign,
  Search, X
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const preselectedStudentId = searchParams.get("studentId");

  const [fetchingStudent, setFetchingStudent] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  const debouncedSearch = useDebounce(studentSearch, 400);

  const [formData, setFormData] = useState({
    student_id: "",
    subtotal: "",
    discount_amount: "0",
    tax_rate: "0",
    currency: "JOD",
    due_date: new Date().toISOString().split("T")[0],
    notes: "",
    is_recurring: false,
  });

  // Fetch academy info for default currency
  useEffect(() => {
    api.tenants.me().then((res: any) => {
      if (res.data?.currency) {
        setFormData(prev => ({ ...prev, currency: res.data.currency }));
      }
    });
  }, []);

  // Handle preselected student
  useEffect(() => {
    if (preselectedStudentId) {
      setFetchingStudent(true);
      api.students.get(parseInt(preselectedStudentId))
        .then((res: any) => {
          setSelectedStudent(res.data);
          setFormData(prev => ({ ...prev, student_id: preselectedStudentId }));
        })
        .finally(() => setFetchingStudent(false));
    }
  }, [preselectedStudentId]);

  // Handle student search
  useEffect(() => {
    const query = debouncedSearch.trim();
    if (query.length >= 2) {
      setIsSearching(true);
      setShowResults(true);
      api.students.list({ search: query }).then((res: any) => {
        setSearchResults(res.data.results || []);
      }).finally(() => setIsSearching(false));
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
      let message = "حدث خطأ أثناء إنشاء الفاتورة. يرجى التحقق من البيانات.";
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === "object") {
          const errors = Object.entries(data)
            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`)
            .join("\n");
          if (errors) message = `خطأ في البيانات:\n${errors}`;
        }
      }
      setError(message);
      toast.error("فشل إنشاء الفاتورة");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.student_id) {
      setError("يرجى اختيار الطالب");
      return;
    }

    setError("");

    const payload = {
      ...formData,
      student_id: parseInt(formData.student_id),
      subtotal: parseFloat(formData.subtotal),
      discount_amount: parseFloat(formData.discount_amount),
      tax_rate: parseFloat(formData.tax_rate),
    };
    invoiceMutation.mutate(payload);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value 
    }));
  };

  const selectStudent = (student: Student) => {
    setSelectedStudent(student);
    setFormData(prev => ({ ...prev, student_id: student.id.toString() }));
    setStudentSearch("");
    setShowResults(false);
  };


  if (fetchingStudent) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <Loader2 className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard permission="can_create_invoice">
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <Link
            href="/dashboard/billing"
            className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all active:scale-90"
          >
            <ArrowRight className="w-6 h-6 rtl-flip" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-white tracking-tight">إنشاء فاتورة جديدة</h1>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20">يدوي</span>
            </div>
            <p className="text-muted-foreground text-sm font-bold mt-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              قم بإصدار فاتورة لمرة واحدة أو فاتورة دورية للطالب
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="p-6 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="whitespace-pre-wrap">{error}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Student Selection */}
            <div className={cn("glass-card p-8 space-y-6 relative transition-all duration-300", showResults ? "z-40 ring-2 ring-primary/20 shadow-primary/10" : "z-20")}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
              
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-black text-white">اختيار الطالب</h3>
              </div>

              {!selectedStudent ? (
                <div className="relative">
                  <InputWrapper label="البحث عن الطالب" icon={Search}>
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="ابحث بالاسم أو رقم الطالب..."
                      className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30 text-right"
                      dir="rtl"
                    />
                  </InputWrapper>
                  
                  {showResults && (
                    <div className="absolute z-50 w-full mt-2 glass-card border border-white/10 shadow-2xl max-h-60 overflow-y-auto p-2">
                      {isSearching ? (
                        <div className="p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          <p className="text-xs font-bold">جاري البحث...</p>
                        </div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((student: Student) => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => selectStudent(student)}
                            className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors text-right"
                          >
                            <div className="w-10 h-10 rounded-lg gradient-brand flex items-center justify-center text-white font-black text-xs shrink-0">
                              {student.first_name?.[0] || "U"}
                            </div>
                            <div className="flex-1 min-w-0">
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
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl gradient-brand flex items-center justify-center text-white font-black text-sm">
                      {selectedStudent.first_name[0]}
                    </div>
                    <div>
                      <p className="font-black text-white">{selectedStudent.full_name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{selectedStudent.student_number}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Invoice Details */}
            <div className="glass-card p-8 space-y-8 relative overflow-hidden z-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
              
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
                  <Receipt className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-black text-white">تفاصيل الفاتورة</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputWrapper label="المبلغ الأساسي" icon={DollarSign}>
                  <input
                    required
                    type="number"
                    step="0.01"
                    name="subtotal"
                    value={formData.subtotal}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30"
                    dir="ltr"
                  />
                </InputWrapper>

                <InputWrapper label="العملة" icon={DollarSign}>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-black appearance-none cursor-pointer"
                  >
                    <option value="JOD" className="bg-slate-900">JOD - دينار أردني</option>
                    <option value="SAR" className="bg-slate-900">SAR - ريال سعودي</option>
                    <option value="USD" className="bg-slate-900">USD - دولار أمريكي</option>
                    <option value="AED" className="bg-slate-900">AED - درهم إماراتي</option>
                  </select>
                </InputWrapper>

                <InputWrapper label="قيمة الخصم (اختياري)" icon={DollarSign}>
                  <input
                    type="number"
                    step="0.01"
                    name="discount_amount"
                    value={formData.discount_amount}
                    onChange={handleChange}
                    className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold"
                    dir="ltr"
                  />
                </InputWrapper>

                <InputWrapper label="تاريخ الاستحقاق" icon={Calendar}>
                  <input
                    required
                    type="date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleChange}
                    className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold appearance-none"
                  />
                </InputWrapper>
              </div>

              <InputWrapper label="ملاحظات إضافية" icon={Info}>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="ستظهر هذه الملاحظات في الفاتورة..."
                  className="w-full px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:bg-white/[0.08] focus:outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30 text-right"
                  dir="rtl"
                />
              </InputWrapper>
            </div>
          </div>

          {/* Sidebar / Summary */}
          <div className="space-y-8">
            <div className="glass-card p-8 space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
              
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-black text-white">ملخص الفاتورة</h3>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المبلغ الفرعي:</span>
                  <span className="text-white font-bold" dir="ltr">{formatCurrency(parseFloat(formData.subtotal || "0"), formData.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">الخصم:</span>
                  <span className="text-red-400 font-bold" dir="ltr">-{formatCurrency(parseFloat(formData.discount_amount || "0"), formData.currency)}</span>
                </div>
                <div className="pt-4 border-t border-white/5 flex justify-between">
                  <span className="text-white font-black">الإجمالي المستحق:</span>
                  <span className="text-primary font-black text-xl" dir="ltr">
                    {formatCurrency(
                      Math.max(0, parseFloat(formData.subtotal || "0") - parseFloat(formData.discount_amount || "0")),
                      formData.currency
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                <input
                  type="checkbox"
                  id="is_recurring"
                  name="is_recurring"
                  checked={formData.is_recurring}
                  onChange={handleChange}
                  className="w-5 h-5 rounded border-white/10 bg-white/5 text-primary focus:ring-primary/20"
                />
                <label htmlFor="is_recurring" className="text-xs font-bold text-white cursor-pointer select-none">
                  فاتورة دورية (تتكرر تلقائياً)
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={invoiceMutation.isPending || !selectedStudent || !formData.subtotal}
                className="w-full py-5 rounded-[2rem] gradient-brand text-white text-sm font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group disabled:opacity-50"
              >
                {invoiceMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                  <>
                    <span>إصدار الفاتورة</span>
                    <CreditCard className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  </>
                )}
              </button>
              <Link
                href="/dashboard/billing"
                className="w-full py-5 rounded-[2rem] bg-white/5 border border-white/10 text-white text-sm font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center"
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
