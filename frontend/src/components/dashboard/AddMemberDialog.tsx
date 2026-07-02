"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import { parseApiError, getStatusBadgeClass, getStatusLabel, cn } from "@/lib/utils";
import { Loader2, Search, UserPlus, X, Award, CheckCircle2 } from "lucide-react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import type { Family, Student } from "@/types";

interface AddMemberDialogProps {
  family: Family;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddMemberDialog({ family, isOpen, onClose, onSuccess }: AddMemberDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const debouncedSearch = useDebounce(search, 350);

  const { data: results, isFetching } = useQuery<{ results: Student[] }>({
    queryKey: ["students-search-for-family", debouncedSearch],
    queryFn: () =>
      api.students.list({ search: debouncedSearch, page_size: 8 }).then((r) => r.data),
    enabled: debouncedSearch.length >= 2,
  });

  const mutation = useMutation({
    mutationFn: (studentId: number) => api.families.addMember(family.id, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family", family.id] });
      queryClient.invalidateQueries({ queryKey: ["families"] });
      toast.success(`تم ربط ${selectedStudent?.full_name} بعائلة ${family.name} بنجاح`);
      setSearch("");
      setSelectedStudent(null);
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      toast.error(parseApiError(err, "حدث خطأ أثناء ربط الطالب بالعائلة."));
    },
  });

  const handleConfirm = () => {
    if (!selectedStudent) return;
    mutation.mutate(selectedStudent.id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-card overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Decorative */}
        <div className="absolute top-0 end-0 w-40 h-40 bg-emerald-500/10 blur-3xl -me-20 -mt-20 pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">ربط طالب بالعائلة</h2>
              <p className="text-xs font-bold text-muted-foreground">{family.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedStudent(null); }}
              placeholder="ابحث باسم الطالب أو رقم الهاتف..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pe-10 text-sm font-bold text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-all"
            />
            {isFetching && (
              <Loader2 className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
            )}
          </div>

          {/* Results */}
          {debouncedSearch.length >= 2 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results?.results?.length === 0 && !isFetching ? (
                <p className="text-center text-sm font-bold text-muted-foreground py-6">لا توجد نتائج</p>
              ) : (
                results?.results?.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className={cn(
                      "w-full text-start flex items-center gap-4 p-3 rounded-xl border transition-all",
                      selectedStudent?.id === student.id
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/5"
                    )}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
                      {student.photo_url ? (
                        <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full gradient-brand flex items-center justify-center text-white font-black">
                          {student.first_name?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-white truncate">{student.full_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] font-bold text-muted-foreground font-mono">{student.student_number}</p>
                        {student.family && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black">
                            مرتبط بعائلة أخرى
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Status + check */}
                    <div className="flex items-center gap-2 shrink-0">
                      {(student as any).current_belt && (
                        <div
                          className="w-4 h-4 rounded-full border border-white/20"
                          style={{ backgroundColor: (student as any).current_belt?.color }}
                          title={(student as any).current_belt?.name}
                        />
                      )}
                      {selectedStudent?.id === student.id && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Selected preview */}
          {selectedStudent && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
              <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-1">الطالب المحدد</p>
              <p className="font-black text-white">{selectedStudent.full_name}</p>
              {selectedStudent.family && (
                <p className="text-xs font-bold text-amber-400 mt-1">
                  ⚠️ سيتم نقله من عائلته الحالية
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              إلغاء
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedStudent || mutation.isPending}
              className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              ربط بالعائلة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
