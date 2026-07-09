import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Calendar, Plus, Loader2, Landmark, CheckCircle2, DollarSign, ChevronLeft, Eye, RefreshCw, Check, Trash } from "lucide-react";
import { toast } from "sonner";

interface Payslip {
  id: number;
  payroll_run: number;
  staff_member: number;
  staff_name: string;
  staff_email: string;
  staff_role: string;
  employment_type: string;
  basic_salary: string;
  calculated_units: string;
  unit_rate: string;
  allowances: string;
  deductions: string;
  net_salary: string;
  status: "pending" | "paid";
  payment_method: string;
  notes: string;
}

interface PayrollRun {
  id: number;
  year: number;
  month: number;
  status: "draft" | "approved" | "paid";
  notes: string;
  total_amount: number;
  payslips_count: number;
  payslips?: Payslip[];
  created_at: string;
}

export function PayrollTab() {
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRunForm, setNewRunForm] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, notes: "" });
  const [editingPayslipId, setEditingPayslipId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ allowances: "0", deductions: "0", payment_method: "cash", notes: "" });

  // Queries
  const { data: runs, isLoading: loadingRuns } = useQuery<PayrollRun[]>({
    queryKey: ["staff", "payroll-runs"],
    queryFn: () => api.staff.payrollRuns.list().then((r: any) => r.data.results || r.data),
  });

  const { data: activeRunDetails, isLoading: loadingDetails } = useQuery<PayrollRun>({
    queryKey: ["staff", "payroll-run", selectedRunId],
    queryFn: () => api.staff.payrollRuns.get(selectedRunId!).then((r: any) => r.data),
    enabled: selectedRunId !== null,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => api.staff.payrollRuns.create(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["staff", "payroll-runs"] });
      setSelectedRunId(res.data.id);
      setShowCreateModal(false);
      toast.success("تم إنشاء مسير الرواتب بنجاح");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.month?.[0] || "تعذر إنشاء مسير الرواتب";
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.staff.payrollRuns.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "payroll-runs"] });
      setSelectedRunId(null);
      toast.success("تم حذف مسير الرواتب بنجاح");
    },
    onError: () => toast.error("تعذر حذف مسير الرواتب"),
  });

  const recalculateMutation = useMutation({
    mutationFn: (id: number) => api.staff.payrollRuns.recalculate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "payroll-run", selectedRunId] });
      queryClient.invalidateQueries({ queryKey: ["staff", "payroll-runs"] });
      toast.success("تم إعادة احتساب الرواتب بنجاح");
    },
    onError: () => toast.error("تعذر إعادة احتساب الرواتب"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.staff.payrollRuns.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "payroll-run", selectedRunId] });
      queryClient.invalidateQueries({ queryKey: ["staff", "payroll-runs"] });
      toast.success("تم اعتماد مسير الرواتب بنجاح");
    },
    onError: () => toast.error("تعذر اعتماد مسير الرواتب"),
  });

  const payMutation = useMutation({
    mutationFn: (id: number) => api.staff.payrollRuns.markPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "payroll-run", selectedRunId] });
      queryClient.invalidateQueries({ queryKey: ["staff", "payroll-runs"] });
      toast.success("تم تسجيل دفع الرواتب بنجاح لجميع الموظفين");
    },
    onError: () => toast.error("تعذر تسجيل دفع الرواتب"),
  });

  const updatePayslipMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.staff.payslips.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "payroll-run", selectedRunId] });
      queryClient.invalidateQueries({ queryKey: ["staff", "payroll-runs"] });
      setEditingPayslipId(null);
      toast.success("تم تحديث قسيمة الراتب بنجاح");
    },
    onError: () => toast.error("تعذر تحديث قسيمة الراتب"),
  });

  const handleStartEditPayslip = (payslip: Payslip) => {
    setEditingPayslipId(payslip.id);
    setEditForm({
      allowances: payslip.allowances,
      deductions: payslip.deductions,
      payment_method: payslip.payment_method || "cash",
      notes: payslip.notes || "",
    });
  };

  const handleSavePayslip = (id: number) => {
    updatePayslipMutation.mutate({
      id,
      ...editForm,
    });
  };

  if (loadingRuns) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const MONTHS_NAMES = [
    "",
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
  ];

  const STATUS_LABELS = {
    draft: { label: "مسودة", style: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    approved: { label: "معتمد", style: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
    paid: { label: "مدفوع", style: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  };

  return (
    <div className="space-y-6">
      {selectedRunId === null ? (
        // Runs List View
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-lg">مسيرات الرواتب الشهرية</h2>
              <p className="text-sm text-muted-foreground mt-1">توليد مسيرات الرواتب الشهرية، اعتمادها ودفعها للموظفين والمدربين.</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-brand text-white text-[10px] font-black uppercase tracking-wider hover:scale-[1.03] transition-all"
            >
              <Plus className="w-4 h-4" />
              توليد مسير جديد
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-secondary/50">
                <tr>
                  <th className="px-4 py-3 rounded-s-lg text-start">الفترة</th>
                  <th className="px-4 py-3 text-start">الحالة</th>
                  <th className="px-4 py-3 text-start">الموظفين</th>
                  <th className="px-4 py-3 text-start">إجمالي الرواتب</th>
                  <th className="px-4 py-3 text-start">ملاحظات</th>
                  <th className="px-4 py-3 rounded-e-lg text-end">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {runs?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      لا يوجد مسيرات رواتب منشأة حالياً. ابدأ بتوليد مسير جديد!
                    </td>
                  </tr>
                ) : (
                  runs?.map((run) => (
                    <tr key={run.id} className="hover:bg-secondary/5 transition-colors">
                      <td className="px-4 py-4 font-bold text-foreground">
                        {MONTHS_NAMES[run.month]} {run.year}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${STATUS_LABELS[run.status]?.style}`}>
                          {STATUS_LABELS[run.status]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{run.payslips_count} موظف</td>
                      <td className="px-4 py-4 font-black text-primary">
                        {run.total_amount} JOD
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground truncate max-w-xs">{run.notes || "—"}</td>
                      <td className="px-4 py-4 text-end">
                        <button
                          onClick={() => setSelectedRunId(run.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/20 bg-primary/5 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          عرض ومراجعة
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Run Detail View
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedRunId(null)}
              className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4 rtl-flip" />
              العودة لقائمة المسيرات
            </button>

            <div className="flex items-center gap-3">
              {activeRunDetails?.status === "draft" && (
                <>
                  <button
                    onClick={() => recalculateMutation.mutate(selectedRunId)}
                    disabled={recalculateMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border/40 hover:bg-secondary/20 text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${recalculateMutation.isPending && "animate-spin"}`} />
                    إعادة احتساب الحصص
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(selectedRunId)}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    اعتماد الرواتب
                  </button>
                </>
              )}

              {activeRunDetails?.status !== "paid" && (
                <button
                  onClick={() => payMutation.mutate(selectedRunId)}
                  disabled={payMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all disabled:opacity-50"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  تسجيل دفع الرواتب
                </button>
              )}

              {activeRunDetails?.status === "draft" && (
                <button
                  onClick={() => {
                    if (confirm("هل أنت متأكد من حذف مسير الرواتب هذا بالكامل؟")) {
                      deleteMutation.mutate(selectedRunId);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10 text-xs font-bold transition-all"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="glass-card p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6 mb-6">
                <div>
                  <h2 className="font-semibold text-xl">
                    مسير رواتب {MONTHS_NAMES[activeRunDetails!.month]} {activeRunDetails!.year}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">{activeRunDetails!.notes || "لا توجد ملاحظات لمسير الرواتب"}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-start">
                    <div className="text-xs text-muted-foreground">الحالة</div>
                    <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full border text-[11px] font-black ${STATUS_LABELS[activeRunDetails!.status]?.style}`}>
                      {STATUS_LABELS[activeRunDetails!.status]?.label}
                    </span>
                  </div>
                  <div className="text-start">
                    <div className="text-xs text-muted-foreground">إجمالي القيمة</div>
                    <div className="text-lg font-black text-primary mt-1">{activeRunDetails!.total_amount} JOD</div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground bg-secondary/50">
                    <tr>
                      <th className="px-3 py-3 rounded-s-lg text-start">الموظف</th>
                      <th className="px-3 py-3 text-start">الراتب الأساسي</th>
                      <th className="px-3 py-3 text-start">الوحدات (ساعة/حصة)</th>
                      <th className="px-3 py-3 text-start">الإضافات/العلاوات</th>
                      <th className="px-3 py-3 text-start">الخصومات</th>
                      <th className="px-3 py-3 text-start">الراتب الصافي</th>
                      <th className="px-3 py-3 text-start">الدفع</th>
                      <th className="px-3 py-3 rounded-e-lg text-end">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {activeRunDetails?.payslips?.map((slip) => {
                      const isEditing = editingPayslipId === slip.id;
                      const EMPLOYMENT_LABELS: Record<string, string> = {
                        full_time: "دوام كامل",
                        part_time: "بالساعة",
                        session_based: "بالحصة",
                      };

                      return (
                        <tr key={slip.id} className="hover:bg-secondary/5 transition-colors">
                          {/* Member */}
                          <td className="px-3 py-4">
                            <div>
                              <div className="font-bold text-foreground">{slip.staff_name}</div>
                              <div className="text-[10px] text-primary font-bold uppercase tracking-widest">{EMPLOYMENT_LABELS[slip.employment_type]}</div>
                            </div>
                          </td>

                          {/* Basic Salary */}
                          <td className="px-3 py-4 text-foreground">{slip.basic_salary} JOD</td>

                          {/* Units */}
                          <td className="px-3 py-4 text-muted-foreground">
                            {slip.calculated_units !== "0.00" ? (
                              <div>
                                <span className="font-black text-foreground">{slip.calculated_units}</span> × {slip.unit_rate} JOD
                              </div>
                            ) : "—"}
                          </td>

                          {/* Allowances */}
                          <td className="px-3 py-4 text-emerald-500 font-bold">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editForm.allowances}
                                onChange={(e) => setEditForm({ ...editForm, allowances: e.target.value })}
                                className="w-20 px-2 py-1 rounded border border-border/40 bg-background/50 text-xs text-foreground focus:outline-none"
                              />
                            ) : slip.allowances !== "0.00" ? `+${slip.allowances} JOD` : "—"}
                          </td>

                          {/* Deductions */}
                          <td className="px-3 py-4 text-red-500 font-bold">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editForm.deductions}
                                onChange={(e) => setEditForm({ ...editForm, deductions: e.target.value })}
                                className="w-20 px-2 py-1 rounded border border-border/40 bg-background/50 text-xs text-foreground focus:outline-none"
                              />
                            ) : slip.deductions !== "0.00" ? `-${slip.deductions} JOD` : "—"}
                          </td>

                          {/* Net Salary */}
                          <td className="px-3 py-4 font-black text-foreground">{slip.net_salary} JOD</td>

                          {/* Method / Status */}
                          <td className="px-3 py-4">
                            {isEditing ? (
                              <select
                                value={editForm.payment_method}
                                onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
                                className="px-2 py-1 rounded border border-border/40 bg-background/50 text-xs text-foreground"
                              >
                                <option value="cash">نقداً</option>
                                <option value="bank_transfer">تحويل بنكي</option>
                                <option value="check">شيك</option>
                                <option value="other">أخرى</option>
                              </select>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${slip.status === "paid" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                                {slip.status === "paid" ? "مدفوع" : "معلق"}
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-4 text-end">
                            {activeRunDetails.status === "draft" && (
                              isEditing ? (
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => handleSavePayslip(slip.id)}
                                    disabled={updatePayslipMutation.isPending}
                                    className="px-2.5 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:scale-105 transition-all"
                                  >
                                    حفظ
                                  </button>
                                  <button
                                    onClick={() => setEditingPayslipId(null)}
                                    className="px-2.5 py-1.5 rounded-lg border border-border/40 text-xs font-bold hover:bg-secondary/20"
                                  >
                                    إلغاء
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleStartEditPayslip(slip)}
                                  className="px-3 py-1.5 rounded-xl border border-border/40 hover:bg-secondary/20 text-xs font-semibold"
                                >
                                  تعديل البدلات
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Run Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-lg text-foreground">توليد مسير رواتب جديد</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">السنة</label>
                <input
                  type="number"
                  value={newRunForm.year}
                  onChange={(e) => setNewRunForm({ ...newRunForm, year: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-border/40 bg-background/50 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">الشهر</label>
                <select
                  value={newRunForm.month}
                  onChange={(e) => setNewRunForm({ ...newRunForm, month: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-border/40 bg-background/50 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  {MONTHS_NAMES.map((name, i) => i > 0 && (
                    <option key={i} value={i}>{name} ({i})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">ملاحظات</label>
              <textarea
                value={newRunForm.notes}
                onChange={(e) => setNewRunForm({ ...newRunForm, notes: e.target.value })}
                rows={3}
                placeholder="مثال: رواتب هذا الشهر تشمل مكافآت المدربين للموسم الرياضي"
                className="w-full px-3 py-2 rounded-xl border border-border/40 bg-background/50 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => createMutation.mutate(newRunForm)}
                disabled={createMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                إنشاء وتوليد
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 rounded-xl border border-border/40 hover:bg-secondary/20 text-xs font-bold transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
