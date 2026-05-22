"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Award, Calendar, FileText, Loader2, CheckCircle } from "lucide-react";
import { cn, parseApiError } from "@/lib/utils";
import type { BeltRank, PaginatedResponse } from "@/types";
import { Select } from "@/components/ui/select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, Textarea, ErrorBanner } from "@/components/ui/form-field";

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

  const ranks = ranksData?.results ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRankId) return;
    promotionMutation.mutate({
      student: studentId,
      belt_rank: Number(selectedRankId),
      promoted_at: promotedAt,
      notes,
      is_current: true,
    });
  };

  /* Build error message string */
  const errorMessage = promotionMutation.isError
    ? parseApiError(promotionMutation.error, "يرجى التأكد من اتصال الإنترنت والمحاولة مرة أخرى.")
    : null;

  return (
    <Modal open={isOpen} onClose={onClose} size="sm">
      <ModalHeader
        icon={<Award className="w-5 h-5" />}
        title="ترقية الطالب"
        subtitle={studentName}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-4">
          {/* Current belt chip */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-secondary/30 border border-border/50 text-sm w-fit">
            <span className="text-muted-foreground text-xs">الحزام الحالي:</span>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full ring-1 ring-white/10"
                style={{ backgroundColor: currentBeltColor ?? "#888" }}
              />
              <span className="font-semibold text-xs">{currentBeltName ?? "لا يوجد"}</span>
            </div>
          </div>

          <FormField label="الحزام الجديد" required>
            <Select
              value={selectedRankId}
              onChange={(e) => setSelectedRankId(Number(e.target.value))}
              disabled={ranksLoading || promotionMutation.isPending}
              required
            >
              <option value="">اختر الحزام...</option>
              {ranks.map((rank) => (
                <option key={rank.id} value={rank.id}>{rank.name}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="تاريخ الترقية" required>
            <Input
              type="date"
              value={promotedAt}
              onChange={(e) => setPromotedAt(e.target.value)}
              disabled={promotionMutation.isPending}
              required
            />
          </FormField>

          <FormField label="ملاحظات">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={promotionMutation.isPending}
              placeholder="اكتب أي ملاحظات حول أداء الطالب في الاختبار..."
              rows={3}
            />
          </FormField>

          <ErrorBanner message={errorMessage} />
        </ModalBody>

        <ModalFooter>
          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={promotionMutation.isPending || !selectedRankId}
              className="flex-1 py-3 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {promotionMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              تأكيد الترقية
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
