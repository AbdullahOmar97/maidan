"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Medal, Loader2, CheckCircle, Trash2 } from "lucide-react";
import { parseApiError } from "@/lib/utils";
import type { BeltRank } from "@/types";
import { Select } from "@/components/ui/select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, ErrorBanner } from "@/components/ui/form-field";

interface BeltRankDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rankToEdit?: BeltRank;
  defaultMartialArt?: string;
}

export default function BeltRankDialog({ isOpen, onClose, rankToEdit, defaultMartialArt }: BeltRankDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!rankToEdit;

  const [martialArt, setMartialArt] = useState("BJJ");
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [colorHex, setColorHex] = useState("#FFFFFF");
  const [orderIndex, setOrderIndex] = useState(0);
  const [minSessions, setMinSessions] = useState(0);
  const [minMonths, setMinMonths] = useState(0);

  useEffect(() => {
    if (rankToEdit) {
      setMartialArt(rankToEdit.martial_art || "BJJ");
      setName(rankToEdit.name || "");
      setNameAr(rankToEdit.name_ar || "");
      setColorHex(rankToEdit.color_hex || "#FFFFFF");
      setOrderIndex(rankToEdit.order_index ?? 0);
      setMinSessions(rankToEdit.min_attendance_sessions ?? 0);
      setMinMonths(rankToEdit.min_months_since_last ?? 0);
    } else {
      setMartialArt(defaultMartialArt || "BJJ");
      setName("");
      setNameAr("");
      setColorHex("#FFFFFF");
      setOrderIndex(0);
      setMinSessions(0);
      setMinMonths(0);
    }
  }, [rankToEdit, isOpen]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (isEdit && rankToEdit) {
        return api.belts.updateRank(rankToEdit.id, data);
      } else {
        return api.belts.createRank(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["belts"] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!rankToEdit) return Promise.resolve();
      return api.belts.deleteRank(rankToEdit.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["belts"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      martial_art: martialArt,
      name,
      name_ar: nameAr,
      color_hex: colorHex,
      order_index: Number(orderIndex),
      min_attendance_sessions: Number(minSessions),
      min_months_since_last: Number(minMonths),
      is_active: true,
    });
  };

  const handleDelete = () => {
    if (window.confirm("هل أنت متأكد من رغبتك في حذف هذا الحزام؟")) {
      deleteMutation.mutate();
    }
  };

  const errorMessage = saveMutation.isError
    ? parseApiError(saveMutation.error, "حدث خطأ أثناء حفظ الحزام. يرجى التحقق من البيانات والمحاولة مرة أخرى.")
    : deleteMutation.isError
    ? parseApiError(deleteMutation.error, "لا يمكن حذف هذا الحزام لأنه قيد الاستخدام حالياً من قبل بعض الطلاب.")
    : null;

  return (
    <Modal open={isOpen} onClose={onClose} size="sm">
      <ModalHeader
        icon={<Medal className="w-5 h-5 text-amber-400" />}
        title={isEdit ? "تعديل الحزام" : "إضافة حزام جديد"}
        subtitle={isEdit ? rankToEdit.name : "تحديد الرتبة الرياضية ومتطلبات الترقية"}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="الرياضة القتالية" required>
              <Select
                value={martialArt}
                onChange={(e) => setMartialArt(e.target.value)}
                disabled={saveMutation.isPending || deleteMutation.isPending}
                required
              >
                <option value="BJJ">BJJ (براجيتسو)</option>
                <option value="Karate">Karate (كاراتيه)</option>
                <option value="Taekwondo">Taekwondo (تايكوندو)</option>
                <option value="Judo">Judo (جودو)</option>
              </Select>
            </FormField>

            <FormField label="ترتيب الرتبة" required>
              <Input
                type="number"
                min="0"
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value))}
                disabled={saveMutation.isPending || deleteMutation.isPending}
                required
                placeholder="مثال: 0، 1، 2..."
              />
            </FormField>
          </div>

          <FormField label="اسم الحزام (إنجليزي)" required>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saveMutation.isPending || deleteMutation.isPending}
              required
              placeholder="مثال: Blue Belt"
            />
          </FormField>

          <FormField label="اسم الحزام (عربي)">
            <Input
              type="text"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              disabled={saveMutation.isPending || deleteMutation.isPending}
              placeholder="مثال: الحزام الأزرق"
            />
          </FormField>

          <FormField label="لون الحزام" required>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value)}
                disabled={saveMutation.isPending || deleteMutation.isPending}
                className="w-12 h-10 p-0 rounded-lg border-0 cursor-pointer overflow-hidden bg-transparent shrink-0"
                required
              />
              <Input
                type="text"
                value={colorHex.toUpperCase()}
                onChange={(e) => setColorHex(e.target.value)}
                disabled={saveMutation.isPending || deleteMutation.isPending}
                className="flex-1 uppercase font-mono"
                placeholder="#HEXCODE"
                pattern="^#([A-Fa-f0-9]{6})$"
                required
              />
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="الحد الأدنى للحصص (الترقية)" required>
              <Input
                type="number"
                min="0"
                value={minSessions}
                onChange={(e) => setMinSessions(Number(e.target.value))}
                disabled={saveMutation.isPending || deleteMutation.isPending}
                required
              />
            </FormField>

            <FormField label="الحد الأدنى للشهور (الترقية)" required>
              <Input
                type="number"
                min="0"
                value={minMonths}
                onChange={(e) => setMinMonths(Number(e.target.value))}
                disabled={saveMutation.isPending || deleteMutation.isPending}
                required
              />
            </FormField>
          </div>

          <ErrorBanner message={errorMessage} />
        </ModalBody>

        <ModalFooter>
          <div className="flex items-center justify-between gap-3 w-full">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saveMutation.isPending || deleteMutation.isPending}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center shrink-0"
                title="حذف الحزام"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
              >
                إلغاء
              </button>
            )}

            <button
              type="submit"
              disabled={saveMutation.isPending || deleteMutation.isPending || !name}
              className="flex-1 py-3 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {isEdit ? "حفظ التعديلات" : "إضافة الحزام"}
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
