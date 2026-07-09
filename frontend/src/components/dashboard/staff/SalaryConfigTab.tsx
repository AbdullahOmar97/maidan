import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { DollarSign, Save, Loader2, Landmark, Clock, Award } from "lucide-react";
import { toast } from "sonner";

interface SalaryConfig {
  id: number;
  staff_member: string;
  staff_name: string;
  staff_email: string;
  staff_role: string;
  employment_type: "full_time" | "part_time" | "session_based";
  basic_salary: string;
  hourly_rate: string;
  session_rate: string;
  currency: string;
}

export function SalaryConfigTab() {
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<number | null>(null);

  // Queries
  const { data: configs, isLoading } = useQuery<SalaryConfig[]>({
    queryKey: ["staff", "salary-configs"],
    queryFn: () => api.staff.salaryConfigs.list().then((r: any) => r.data.results || r.data),
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api.staff.salaryConfigs.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "salary-configs"] });
      toast.success("تم تحديث إعدادات الراتب بنجاح");
    },
    onError: () => {
      toast.error("تعذر تحديث إعدادات الراتب");
    },
    onSettled: () => {
      setSavingId(null);
    },
  });

  const [editValues, setEditValues] = useState<Record<number, Partial<SalaryConfig>>>({});

  const handleFieldChange = (id: number, field: keyof SalaryConfig, value: string) => {
    setEditValues((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSave = (config: SalaryConfig) => {
    const changes = editValues[config.id];
    if (!changes) return;
    setSavingId(config.id);
    updateMutation.mutate({
      id: config.id,
      ...changes,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const EMPLOYMENT_TYPES = [
    { value: "full_time", label: "دوام كامل (راتب شهري)", icon: Landmark },
    { value: "part_time", label: "دوام جزئي (بالساعة)", icon: Clock },
    { value: "session_based", label: "بالحصة/الكلاس", icon: Award },
  ];

  const CURRENCIES = [
    { value: "JOD", label: "دينار أردني (JOD)" },
    { value: "SAR", label: "ريال سعودي (SAR)" },
    { value: "AED", label: "درهم إماراتي (AED)" },
    { value: "KWD", label: "دينار كويتي (KWD)" },
    { value: "USD", label: "دولار أمريكي (USD)" },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold text-lg">تهيئة وإعداد رواتب الموظفين</h2>
            <p className="text-sm text-muted-foreground mt-1">حدد نوع التوظيف والراتب الأساسي أو أسعار الساعات والحصص لكل موظف.</p>
          </div>
          <DollarSign className="w-5 h-5 text-primary" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
              <tr>
                <th className="px-4 py-3 rounded-s-lg text-start whitespace-nowrap">الموظف</th>
                <th className="px-4 py-3 text-start whitespace-nowrap">نوع التوظيف</th>
                <th className="px-4 py-3 text-start whitespace-nowrap">الراتب / الأجر</th>
                <th className="px-4 py-3 text-start whitespace-nowrap">العملة</th>
                <th className="px-4 py-3 rounded-e-lg text-end whitespace-nowrap">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {configs?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    لا يوجد موظفين نشطين لتهيئة رواتبهم
                  </td>
                </tr>
              ) : (
                configs?.map((config) => {
                  const values = { ...config, ...editValues[config.id] };
                  const isModified = editValues[config.id] !== undefined;

                  return (
                    <tr key={config.id} className="hover:bg-secondary/10 transition-colors">
                      {/* Member info */}
                      <td className="px-4 py-4">
                        <div>
                          <div className="font-bold text-foreground">{config.staff_name}</div>
                          <div className="text-xs text-muted-foreground">{config.staff_email}</div>
                        </div>
                      </td>

                      {/* Employment Type */}
                      <td className="px-4 py-4">
                        <select
                          value={values.employment_type}
                          onChange={(e) => handleFieldChange(config.id, "employment_type", e.target.value as any)}
                          className="px-3 py-1.5 rounded-lg border border-border/40 bg-background/50 text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                        >
                          {EMPLOYMENT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Pay Rates based on Type */}
                      <td className="px-4 py-4">
                        {values.employment_type === "full_time" && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">الراتب:</span>
                            <input
                              type="number"
                              value={values.basic_salary}
                              onChange={(e) => handleFieldChange(config.id, "basic_salary", e.target.value)}
                              className="w-24 px-2 py-1 rounded border border-border/40 bg-background/50 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                              placeholder="0.00"
                            />
                          </div>
                        )}
                        {values.employment_type === "part_time" && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">أجر الساعة:</span>
                            <input
                              type="number"
                              value={values.hourly_rate}
                              onChange={(e) => handleFieldChange(config.id, "hourly_rate", e.target.value)}
                              className="w-24 px-2 py-1 rounded border border-border/40 bg-background/50 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                              placeholder="0.00"
                            />
                          </div>
                        )}
                        {values.employment_type === "session_based" && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">أجر الحصة:</span>
                            <input
                              type="number"
                              value={values.session_rate}
                              onChange={(e) => handleFieldChange(config.id, "session_rate", e.target.value)}
                              className="w-24 px-2 py-1 rounded border border-border/40 bg-background/50 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                              placeholder="0.00"
                            />
                          </div>
                        )}
                      </td>

                      {/* Currency */}
                      <td className="px-4 py-4">
                        <select
                          value={values.currency}
                          onChange={(e) => handleFieldChange(config.id, "currency", e.target.value)}
                          className="px-2 py-1.5 rounded-lg border border-border/40 bg-background/50 text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.value}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-4 text-end">
                        <button
                          onClick={() => handleSave(config)}
                          disabled={!isModified || savingId === config.id}
                          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 transition-all text-xs font-semibold disabled:opacity-40 disabled:pointer-events-none"
                        >
                          {savingId === config.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          حفظ
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
