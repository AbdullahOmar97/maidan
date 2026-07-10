"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import { parseApiError, cn } from "@/lib/utils";
import { Loader2, Search, Users, X, CheckCircle2 } from "lucide-react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import type { Family } from "@/types";

interface LinkFamilyDialogProps {
  studentId: number;
  studentName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function LinkFamilyDialog({ studentId, studentName, isOpen, onClose, onSuccess }: LinkFamilyDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const debouncedSearch = useDebounce(search, 350);

  const { data: results, isFetching } = useQuery<{ results: Family[] }>({
    queryKey: ["families-search-for-student", debouncedSearch],
    queryFn: () =>
      api.families.list({ search: debouncedSearch, page_size: 8 }).then((r) => r.data),
    enabled: debouncedSearch.length >= 2,
  });

  const mutation = useMutation({
    mutationFn: (familyId: number) => api.families.addMember(familyId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["family"] });
      queryClient.invalidateQueries({ queryKey: ["families"] });
      toast.success(`تم ربط ${studentName} بعائلة ${selectedFamily?.name} بنجاح`);
      setSearch("");
      setSelectedFamily(null);
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      toast.error(parseApiError(err, "حدث خطأ أثناء ربط الطالب بالعائلة."));
    },
  });

  const handleConfirm = () => {
    if (!selectedFamily) return;
    mutation.mutate(selectedFamily.id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-card overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Decorative */}
        <div className="absolute top-0 end-0 w-40 h-40 bg-primary/10 blur-3xl -me-20 -mt-20 pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">ربط الطالب بعائلة</h2>
              <p className="text-xs font-bold text-muted-foreground">{studentName}</p>
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
              onChange={(e) => { setSearch(e.target.value); setSelectedFamily(null); }}
              placeholder="ابحث باسم العائلة أو رقم هاتف المسؤول..."
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
                results?.results?.map((family) => (
                  <button
                    key={family.id}
                    onClick={() => setSelectedFamily(family)}
                    className={cn(
                      "w-full text-start flex items-center gap-4 p-3 rounded-xl border transition-all",
                      selectedFamily?.id === family.id
                        ? "border-primary/40 bg-primary/10"
                        : "border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/5"
                    )}
                  >
                    {/* Family Icon */}
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-white truncate">{family.name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground truncate">
                        المسؤول: {family.primary_contact_name} ({family.member_count} أفراد)
                      </p>
                    </div>
                    {/* Check */}
                    {selectedFamily?.id === family.id && (
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    )}
                  </button>
                ))
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
              disabled={!selectedFamily || mutation.isPending}
              className="flex-1 py-3 rounded-xl gradient-brand text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Users className="w-4 h-4" />
              )}
              ربط بالعائلة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
