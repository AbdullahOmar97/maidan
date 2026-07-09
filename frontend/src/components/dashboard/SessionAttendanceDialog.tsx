"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import { parseApiError, cn } from "@/lib/utils";
import { Loader2, Users, X, Clock, Trash2, Search, UserPlus, CheckCircle } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { useDebounce } from "@/lib/hooks/use-debounce";
import type { ClassSession, Student } from "@/types";

interface AttendanceRecordData {
  id: number;
  student_id: number;
  student_name: string;
  checked_in_at: string;
  check_in_method: string;
}

interface SessionAttendanceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  session: ClassSession;
}

export default function SessionAttendanceDialog({ isOpen, onClose, session }: SessionAttendanceDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const debouncedSearch = useDebounce(search, 350);

  // Fetch checked-in students for this session
  const { data: records = [], isLoading: isLoadingRecords } = useQuery<AttendanceRecordData[]>({
    queryKey: ["session-attendance-records", session.id],
    queryFn: () =>
      api.attendance.records
        .list(session.id)
        .then((res: any) => (Array.isArray(res.data) ? res.data : res.data.results || [])),
    enabled: isOpen,
  });

  // Fetch students for manual check-in search
  const { data: searchResults, isFetching: isSearching } = useQuery<{ results: Student[] }>({
    queryKey: ["students-search-for-session-checkin", debouncedSearch],
    queryFn: () =>
      api.students.list({ search: debouncedSearch, page_size: 5 }).then((r) => r.data),
    enabled: debouncedSearch.length >= 2,
  });

  // Check in mutation
  const checkinMutation = useMutation({
    mutationFn: (studentId: number) =>
      api.attendance.records.create({
        session_id: session.id,
        student_id: studentId,
        check_in_method: "manual",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-attendance-records", session.id] });
      queryClient.invalidateQueries({ queryKey: ["attendance", "sessions", "today"] });
      toast.success("تم تسجيل حضور الطالب بنجاح");
      setSearch("");
      setSelectedStudent(null);
    },
    onError: (err: any) => {
      toast.error(parseApiError(err, "فشل تسجيل حضور الطالب."));
    },
  });

  // Delete attendance record mutation
  const checkoutMutation = useMutation({
    mutationFn: (recordId: number) => api.attendance.records.delete(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-attendance-records", session.id] });
      queryClient.invalidateQueries({ queryKey: ["attendance", "sessions", "today"] });
      toast.success("تم إلغاء تسجيل حضور الطالب");
    },
    onError: (err: any) => {
      toast.error(parseApiError(err, "حدث خطأ أثناء إلغاء الحضور."));
    },
  });

  const handleManualCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    checkinMutation.mutate(selectedStudent.id);
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case "kiosk_qr":
      case "qr":
        return "مسح الرمز (QR)";
      case "phone":
      case "keypad":
        return "رقم الهاتف";
      case "manual":
        return "يدوي (لوحة التحكم)";
      default:
        return method || "تلقائي";
    }
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        icon={<Users className="w-5 h-5 text-primary" />}
        title="تفاصيل الحضور للحصة"
        subtitle={`${session.class_name} — ${session.location_name}`}
        onClose={onClose}
      />

      <ModalBody className="grid grid-cols-1 md:grid-cols-5 gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
        {/* Left Side: Checked-in Students List (3 cols) */}
        <div className="md:col-span-3 space-y-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white">الطلاب الحاضرون ({records.length})</h3>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              اليوم: {session.date.split(" ")[0]}
            </span>
          </div>

          {isLoadingRecords ? (
            <div className="h-64 flex flex-col items-center justify-center border border-white/5 bg-white/[0.01] rounded-2xl">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
              <p className="text-xs text-muted-foreground">جاري تحميل الحاضرين...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-white/10 bg-white/[0.01] rounded-2xl text-center p-6">
              <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-bold text-muted-foreground">لا يوجد أي حضور مسجل لهذه الحصة حتى الآن.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">يمكنك مسح الكروت عبر الكشك أو إضافة طلاب يدوياً من القائمة الجانبية.</p>
            </div>
          ) : (
            <div className="border border-white/5 bg-white/[0.01] rounded-2xl overflow-hidden flex-1 max-h-[400px] overflow-y-auto custom-scrollbar">
              <div className="divide-y divide-white/5">
                {records.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xs">
                        {record.student_name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">{record.student_name}</p>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3 text-primary/70" />
                          حضر الساعة {formatTime(record.checked_in_at)} ({getMethodLabel(record.check_in_method)})
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => checkoutMutation.mutate(record.id)}
                      disabled={checkoutMutation.isPending}
                      className="w-8 h-8 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-all disabled:opacity-50"
                      title="إلغاء تسجيل الحضور"
                    >
                      {checkoutMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Manual Check-in Form (2 cols) */}
        <div className="md:col-span-2 border-t md:border-t-0 md:border-r border-white/5 pt-6 md:pt-0 md:pe-6 space-y-4">
          <h3 className="text-sm font-black text-white">تسجيل حضور يدوي سريع</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            ابحث عن أي طالب مسجل في النظام وأضفه إلى كشف الحضور لهذه الحصة مباشرة.
          </p>

          <form onSubmit={handleManualCheckInSubmit} className="space-y-4">
            {/* Search Student Input */}
            <div className="relative">
              <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedStudent(null);
                }}
                placeholder="ابحث باسم الطالب أو الهاتف..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pe-10 text-xs font-bold text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-all"
              />
              {isSearching && (
                <Loader2 className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
              )}
            </div>

            {/* Search Results Dropdown List */}
            {debouncedSearch.length >= 2 && (
              <div className="border border-white/5 bg-black/30 rounded-xl max-h-44 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                {searchResults?.results?.length === 0 && !isSearching ? (
                  <p className="text-center text-xs font-bold text-muted-foreground py-4">لا توجد نتائج مطابقة</p>
                ) : (
                  searchResults?.results?.map((student) => {
                    const isSelected = selectedStudent?.id === student.id;
                    const isAlreadyCheckedIn = records.some((r) => r.student_id === student.id);
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => !isAlreadyCheckedIn && setSelectedStudent(student)}
                        disabled={isAlreadyCheckedIn}
                        className={cn(
                          "w-full text-start flex items-center justify-between p-2 rounded-lg border transition-all text-xs",
                          isSelected
                            ? "border-primary bg-primary/10 text-white"
                            : "border-transparent bg-transparent hover:bg-white/5 text-muted-foreground hover:text-white",
                          isAlreadyCheckedIn && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="font-bold truncate">{student.full_name}</p>
                          <p className="text-[9px] text-muted-foreground/75 mt-0.5">{student.student_number}</p>
                        </div>
                        {isAlreadyCheckedIn ? (
                          <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">حاضر</span>
                        ) : (
                          isSelected && <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Selected Student Confirmation Card */}
            {selectedStudent && (
              <div className="p-3 border border-primary/20 bg-primary/5 rounded-xl text-xs space-y-1">
                <p className="text-[9px] font-black uppercase text-primary tracking-widest">العضو المحدد</p>
                <p className="font-black text-white">{selectedStudent.full_name}</p>
                <p className="text-[10px] text-muted-foreground">{selectedStudent.student_number}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedStudent || checkinMutation.isPending}
              className="w-full py-3 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {checkinMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              تسجيل الحضور للحصة
            </button>
          </form>
        </div>
      </ModalBody>

      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all w-full sm:w-auto"
        >
          إغلاق
        </button>
      </ModalFooter>
    </Modal>
  );
}
