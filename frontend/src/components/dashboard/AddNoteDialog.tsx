"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { ClipboardList, Loader2, CheckCircle, Shield, ShieldAlert } from "lucide-react";
import { parseApiError } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Textarea, ErrorBanner } from "@/components/ui/form-field";

interface AddNoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: number;
  studentName: string;
}

export default function AddNoteDialog({
  isOpen,
  onClose,
  studentId,
  studentName,
}: AddNoteDialogProps) {
  const queryClient = useQueryClient();
  const [noteType, setNoteType] = useState<string>("general");
  const [content, setContent] = useState<string>("");
  const [isPrivate, setIsPrivate] = useState<boolean>(false);

  const createNoteMutation = useMutation({
    mutationFn: (data: { note_type: string; content: string; is_private: boolean }) =>
      api.students.notes.create(studentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-notes", studentId.toString()] });
      onClose();
      // Reset form fields
      setContent("");
      setNoteType("general");
      setIsPrivate(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    createNoteMutation.mutate({
      note_type: noteType,
      content: content.trim(),
      is_private: isPrivate,
    });
  };

  const errorMessage = createNoteMutation.isError
    ? parseApiError(createNoteMutation.error, "حدث خطأ أثناء إضافة الملاحظة. يرجى المحاولة مرة أخرى.")
    : null;

  return (
    <Modal open={isOpen} onClose={onClose} size="sm">
      <ModalHeader
        icon={<ClipboardList className="w-5 h-5" />}
        title="إضافة ملاحظة جديدة"
        subtitle={studentName}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-5">
          <FormField label="نوع الملاحظة" required>
            <Select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
              disabled={createNoteMutation.isPending}
              required
            >
              <option value="general">عامة</option>
              <option value="medical">طبية</option>
              <option value="billing">مالية</option>
              <option value="behavior">سلوكية</option>
              <option value="progress">مستوى / تقدم</option>
            </Select>
          </FormField>

          <FormField label="محتوى الملاحظة" required>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={createNoteMutation.isPending}
              placeholder="اكتب تفاصيل الملاحظة هنا..."
              rows={4}
              required
            />
          </FormField>

          {/* Privacy Switch (Styled container) */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between transition-colors hover:border-white/10 text-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground">
                {isPrivate ? <ShieldAlert className="w-5 h-5 text-amber-400" /> : <Shield className="w-5 h-5 text-emerald-400" />}
              </div>
              <div className="text-start">
                <p className="text-sm font-bold text-white">ملاحظة سرية (خاصة)</p>
                <p className="text-[10px] font-bold text-muted-foreground/60 mt-0.5">
                  {isPrivate ? "تظهر فقط لمدراء النظام والمسؤولين" : "تظهر لجميع الموظفين المصرح لهم"}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPrivate}
                disabled={createNoteMutation.isPending}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-checked:bg-primary rounded-full peer peer-focus:ring-2 peer-focus:ring-primary/20 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
            </label>
          </div>

          <ErrorBanner message={errorMessage} />
        </ModalBody>

        <ModalFooter>
          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={createNoteMutation.isPending}
              className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={createNoteMutation.isPending || !content.trim()}
              className="flex-1 py-3 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {createNoteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              حفظ الملاحظة
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
