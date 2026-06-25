"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { FolderOpen, Loader2, CheckCircle, Upload, FileText, AlertCircle, Trash2 } from "lucide-react";
import { parseApiError } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input, Textarea, ErrorBanner } from "@/components/ui/form-field";

interface UploadDocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: number;
  studentName: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];

export default function UploadDocumentDialog({
  isOpen,
  onClose,
  studentId,
  studentName,
}: UploadDocumentDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documentType, setDocumentType] = useState<string>("id");
  const [name, setName] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  
  const [validationError, setValidationError] = useState<string | null>(null);

  const createDocMutation = useMutation({
    mutationFn: (formData: FormData) =>
      api.students.documents.create(studentId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-documents", studentId.toString()] });
      onClose();
      // Reset state
      setDocumentType("id");
      setName("");
      setFile(null);
      setNotes("");
      setExpiresAt("");
      setValidationError(null);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setValidationError("صيغة الملف غير مدعومة. يرجى اختيار ملف PDF أو صورة (PNG, JPG).");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setValidationError("حجم الملف كبير جداً. الحد الأقصى هو 10 ميجابايت.");
      return;
    }

    setFile(selectedFile);
    // Autofill name if it is currently empty
    if (!name) {
      const fileNameWithoutExtension = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
      setName(fileNameWithoutExtension);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setValidationError(null);
    const selectedFile = e.dataTransfer.files?.[0];
    if (!selectedFile) return;

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setValidationError("صيغة الملف غير مدعومة. يرجى اختيار ملف PDF أو صورة (PNG, JPG).");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setValidationError("حجم الملف كبير جداً. الحد الأقصى هو 10 ميجابايت.");
      return;
    }

    setFile(selectedFile);
    if (!name) {
      const fileNameWithoutExtension = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
      setName(fileNameWithoutExtension);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!file) {
      setValidationError("يرجى اختيار أو رفع ملف الوثيقة أولاً.");
      return;
    }

    if (!name.trim()) {
      setValidationError("يرجى إدخال اسم الوثيقة.");
      return;
    }

    const formData = new FormData();
    formData.append("document_type", documentType);
    formData.append("name", name.trim());
    formData.append("file", file);
    if (notes.trim()) {
      formData.append("notes", notes.trim());
    }
    if (expiresAt) {
      formData.append("expires_at", expiresAt);
    }

    createDocMutation.mutate(formData);
  };

  const errorMessage = createDocMutation.isError
    ? parseApiError(createDocMutation.error, "حدث خطأ أثناء رفع الوثيقة. يرجى المحاولة مرة أخرى.")
    : validationError;

  return (
    <Modal open={isOpen} onClose={onClose} size="md">
      <ModalHeader
        icon={<FolderOpen className="w-5 h-5" />}
        title="رفع وثيقة ومستند جديد"
        subtitle={studentName}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-5">
          {/* File Upload Zone */}
          <FormField label="ملف الوثيقة" required>
            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/10 hover:border-primary/50 bg-white/[0.02] hover:bg-white/[0.04] rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3 group relative overflow-hidden"
              >
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground group-hover:scale-110 group-hover:text-primary transition-all duration-300">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">اسحب وأسقط الملف هنا أو اضغط للتصفح</p>
                  <p className="text-xs font-semibold text-muted-foreground/60 mt-1">
                    صيغ الملفات المدعومة: PDF, PNG, JPG (الحد الأقصى: 10 ميجابايت)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-colors hover:border-white/15 text-start">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate max-w-[240px]">{file.name}</p>
                    <p className="text-[10px] font-bold text-muted-foreground/60 mt-1">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  disabled={createDocMutation.isPending}
                  className="w-9 h-9 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors"
                  title="حذف الملف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="نوع الوثيقة" required>
              <Select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                disabled={createDocMutation.isPending}
                required
              >
                <option value="id">هوية وطنية / إقامة</option>
                <option value="passport">جواز السفر</option>
                <option value="medical">تقرير طبي</option>
                <option value="waiver">إخلاء مسؤولية</option>
                <option value="photo_consent">موافقة تصوير</option>
                <option value="other">أخرى</option>
              </Select>
            </FormField>

            <FormField label="اسم الوثيقة" required>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={createDocMutation.isPending}
                placeholder="أدخل اسماً للوثيقة (مثال: الهوية وجه أول)"
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="تاريخ انتهاء الصلاحية" hint="اتركه فارغاً إذا كانت الوثيقة لا تنتهي">
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={createDocMutation.isPending}
              />
            </FormField>
          </div>

          <FormField label="ملاحظات إضافية">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={createDocMutation.isPending}
              placeholder="اكتب أي ملاحظات أو تفاصيل عن هذا المستند..."
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
              disabled={createDocMutation.isPending}
              className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={createDocMutation.isPending || !file || !name.trim()}
              className="flex-1 py-3 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {createDocMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              رفع المستند
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
