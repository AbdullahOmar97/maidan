import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { FileText, Plus, Loader2, Trash, Upload, Download, ExternalLink, Calendar } from "lucide-react";
import { toast } from "sonner";

interface StaffMember {
  id: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface StaffDocument {
  id: number;
  staff_member: string;
  staff_name: string;
  name: string;
  file: string;
  notes: string;
  file_name: string;
  file_size: number;
  uploaded_at: string;
}

export function DocumentsTab() {
  const queryClient = useQueryClient();
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: "", file: null as File | null, notes: "", staff_member: "" });

  // Queries
  const { data: staffMembers, isLoading: loadingStaff } = useQuery<any>({
    queryKey: ["staff", "list"],
    queryFn: () => api.staff.list().then((r: any) => r.data.results || r.data),
  });

  const { data: documents, isLoading: loadingDocs } = useQuery<StaffDocument[]>({
    queryKey: ["staff", "documents", selectedStaffId],
    queryFn: () => api.staff.documents.list(selectedStaffId ? { staff_member: selectedStaffId } : {}).then((r: any) => r.data.results || r.data),
  });

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => api.staff.documents.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "documents"] });
      setShowUploadModal(false);
      setUploadForm({ name: "", file: null, notes: "", staff_member: "" });
      toast.success("تم رفع المستند بنجاح");
    },
    onError: () => toast.error("تعذر رفع المستند. يرجى التحقق من حجم ونوع الملف."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.staff.documents.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "documents"] });
      toast.success("تم حذف المستند بنجاح");
    },
    onError: () => toast.error("تعذر حذف المستند"),
  });

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file || !uploadForm.name || !uploadForm.staff_member) {
      toast.error("يرجى ملء جميع الحقول المطلوبة واختيار الملف");
      return;
    }

    const formData = new FormData();
    formData.append("name", uploadForm.name);
    formData.append("file", uploadForm.file);
    formData.append("notes", uploadForm.notes);
    formData.append("staff_member", uploadForm.staff_member);

    uploadMutation.mutate(formData);
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const membersList = staffMembers?.results || staffMembers || [];

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-semibold text-lg">ملفات ومستندات الموظفين</h2>
            <p className="text-sm text-muted-foreground mt-1">إدارة عقود الموظفين، بطاقات الهوية، وشهادات التدريب والخبرات المهنية.</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter staff */}
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border/40 bg-background/50 text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="">جميع الموظفين</option>
              {membersList.map((member: any) => (
                <option key={member.id} value={member.id}>
                  {member.full_name || `${member.first_name} ${member.last_name}`}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setShowUploadModal(true);
                if (selectedStaffId) {
                  setUploadForm((f) => ({ ...f, staff_member: selectedStaffId }));
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-brand text-white text-[10px] font-black uppercase tracking-wider hover:scale-[1.03] transition-all shrink-0"
            >
              <Upload className="w-4 h-4" />
              رفع مستند جديد
            </button>
          </div>
        </div>

        {loadingDocs ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents?.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                لا توجد مستندات مرفوعة حالياً.
              </div>
            ) : (
              documents?.map((doc) => (
                <div key={doc.id} className="relative group border border-border/40 bg-secondary/5 hover:bg-secondary/15 transition-all p-5 rounded-2xl flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                        <FileText className="w-5 h-5" />
                      </div>
                      <button
                        onClick={() => {
                          if (confirm("هل أنت متأكد من حذف هذا المستند؟")) {
                            deleteMutation.mutate(doc.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10 transition-all"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground truncate">{doc.name}</h4>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">الموظف: {doc.staff_name}</p>
                    </div>
                    {doc.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2 bg-background/30 p-2 rounded-lg">{doc.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-border/30 pt-3 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(doc.uploaded_at).toLocaleDateString("ar-EG")}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{formatBytes(doc.file_size)}</span>
                      {doc.file && (
                        <a
                          href={doc.file}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded bg-secondary/40 text-foreground hover:bg-secondary/80 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleUploadSubmit} className="glass-card w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-lg text-foreground">رفع مستند جديد</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">الموظف المعني *</label>
              <select
                required
                value={uploadForm.staff_member}
                onChange={(e) => setUploadForm({ ...uploadForm, staff_member: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-border/40 bg-background/50 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="">اختر الموظف...</option>
                {membersList.map((member: any) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name || `${member.first_name} ${member.last_name}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">اسم المستند *</label>
              <input
                required
                type="text"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                placeholder="مثال: عقد العمل لعام 2026، الهوية الشخصية..."
                className="w-full px-3 py-2 rounded-xl border border-border/40 bg-background/50 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">الملف *</label>
              <input
                required
                type="file"
                onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-primary/10 file:text-primary file:hover:bg-primary/20 file:cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">ملاحظات</label>
              <textarea
                value={uploadForm.notes}
                onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                rows={3}
                placeholder="أضف أي تفاصيل أو ملاحظات حول المستند المرفوع..."
                className="w-full px-3 py-2 rounded-xl border border-border/40 bg-background/50 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={uploadMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {uploadMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                رفع المستند
              </button>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-5 py-2.5 rounded-xl border border-border/40 hover:bg-secondary/20 text-xs font-bold transition-all"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
