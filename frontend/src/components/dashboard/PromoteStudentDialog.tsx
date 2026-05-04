"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { X, Award, Calendar, FileText, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BeltRank, PaginatedResponse } from "@/types";

interface PromoteStudentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: number;
  studentName: string;
  currentBeltName?: string;
  currentBeltColor?: string;
  nextBeltId?: number;
}

export default function PromoteStudentDialog({
  isOpen,
  onClose,
  studentId,
  studentName,
  currentBeltName,
  currentBeltColor,
  nextBeltId,
}: PromoteStudentDialogProps) {
  const queryClient = useQueryClient();
  const [selectedRankId, setSelectedRankId] = useState<number | "">(nextBeltId || "");
  const [notes, setNotes] = useState("");
  const [promotedAt, setPromotedAt] = useState(new Date().toISOString().split("T")[0]);

  const { data: ranksData, isLoading: ranksLoading } = useQuery<PaginatedResponse<BeltRank>>({
    queryKey: ["belts", "ranks"],
    queryFn: () => api.belts.ranks().then((r) => r.data),
    enabled: isOpen,
  });

  const promotionMutation = useMutation({
    mutationFn: (data: any) => api.belts.promote(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", studentId.toString()] });
      queryClient.invalidateQueries({ queryKey: ["belts"] });
      onClose();
    },
  });

  if (!isOpen) return null;

  const ranks = ranksData?.results || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRankId) return;

    promotionMutation.mutate({
      student: studentId,
      belt_rank: Number(selectedRankId),
      promoted_at: promotedAt,
      notes: notes,
      is_current: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between gradient-brand-soft">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">ترقية الطالب</h2>
              <p className="text-xs text-muted-foreground">{studentName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Current Status */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/50 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">الحزام الحالي:</span>
              <div className="flex items-center gap-1.5">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: currentBeltColor || "#ccc" }} 
                />
                <span className="font-medium">{currentBeltName || "لا يوجد"}</span>
              </div>
            </div>
          </div>

          {/* New Rank Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              الحزام الجديد
            </label>
            <select
              value={selectedRankId}
              onChange={(e) => setSelectedRankId(Number(e.target.value))}
              disabled={ranksLoading || promotionMutation.isPending}
              className="w-full h-11 px-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
              required
            >
              <option value="">اختر الحزام...</option>
              {ranks.map((rank) => (
                <option key={rank.id} value={rank.id}>
                  {rank.name}
                </option>
              ))}
            </select>
          </div>

          {/* Promotion Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              تاريخ الترقية
            </label>
            <input
              type="date"
              value={promotedAt}
              onChange={(e) => setPromotedAt(e.target.value)}
              disabled={promotionMutation.isPending}
              className="w-full h-11 px-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              ملاحظات
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={promotionMutation.isPending}
              className="w-full p-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[100px] resize-none"
              placeholder="اكتب أي ملاحظات حول أداء الطالب في الاختبار..."
            />
          </div>

          {/* Error Message */}
          {promotionMutation.isError && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 space-y-2">
              <p className="font-bold flex items-center justify-between">
                <span>حدث خطأ أثناء حفظ الترقية</span>
                <span className="px-1.5 py-0.5 rounded bg-destructive/20 text-[10px]">
                  Status: {(promotionMutation.error as any)?.response?.status || "Network/Unknown"}
                </span>
              </p>
              <div className="opacity-90 leading-relaxed max-h-32 overflow-y-auto pr-1 text-[11px]">
                {(() => {
                  const data = (promotionMutation.error as any)?.response?.data;
                  if (!data) return "يرجى التأكد من اتصال الإنترنت والمحاولة مرة أخرى.";
                  if (typeof data === "string") return data.substring(0, 200);
                  if (typeof data === "object") {
                    return Object.entries(data).map(([key, val]) => (
                      <div key={key} className="mb-1">
                        <span className="font-bold">{key}:</span> {JSON.stringify(val)}
                      </div>
                    ));
                  }
                  return "حدث خطأ غير معروف.";
                })()}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl bg-secondary hover:bg-secondary/80 transition-all font-medium"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={promotionMutation.isPending || !selectedRankId}
              className="flex-[2] h-11 rounded-xl gradient-brand text-white font-medium shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {promotionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  تأكيد الترقية
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
