"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { X, Calendar, Loader2, CheckCircle, Clock, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ManualAttendanceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: number;
  studentName: string;
}

interface SessionInfo {
  id: number;
  class_name: string;
  start_time: string;
  end_time: string;
  status?: string;
  is_schedule?: boolean;
}

export default function ManualAttendanceDialog({
  isOpen,
  onClose,
  studentId,
  studentName,
}: ManualAttendanceDialogProps) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null);

  const { data: sessionsData, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ["student-potential-sessions", studentId, selectedDate],
    queryFn: () => api.students.potentialSessions(studentId, selectedDate).then((res) => res.data),
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      refetchSessions();
      setSelectedSession(null);
    }
  }, [selectedDate, isOpen, refetchSessions]);

  const checkinMutation = useMutation({
    mutationFn: (data: any) => api.students.manualCheckin(studentId, data),
    onSuccess: () => {
      toast.success("تم تسجيل الحضور بنجاح");
      queryClient.invalidateQueries({ queryKey: ["student-attendance", studentId.toString()] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "فشل تسجيل الحضور");
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return;

    const payload = selectedSession.is_schedule
      ? { schedule_id: selectedSession.id, date: selectedDate }
      : { session_id: selectedSession.id };

    checkinMutation.mutate(payload);
  };

  const existingSessions = sessionsData?.existing || [];
  const schedules = (sessionsData?.schedules || []).map((s: any) => ({ ...s, is_schedule: true }));
  const allAvailable = [...existingSessions, ...schedules];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between gradient-brand-soft">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">تسجيل حضور يدوي</h2>
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
          {/* Date Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              تاريخ الحصة
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              required
            />
          </div>

          {/* Session Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              اختر الحصة
            </label>
            
            {sessionsLoading ? (
              <div className="h-32 flex items-center justify-center border border-dashed rounded-xl">
                <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
              </div>
            ) : allAvailable.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {allAvailable.map((session) => (
                  <button
                    key={`${session.is_schedule ? 'sched' : 'sess'}-${session.id}`}
                    type="button"
                    onClick={() => setSelectedSession(session)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border transition-all text-right",
                      selectedSession?.id === session.id && selectedSession?.is_schedule === session.is_schedule
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-secondary/50"
                    )}
                  >
                    <div>
                      <p className="text-sm font-bold">{session.class_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {session.start_time} - {session.end_time}
                      </p>
                    </div>
                    {session.is_schedule ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium">
                        جدول
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
                        حصة منشأة
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center border border-dashed rounded-xl bg-secondary/20">
                <Info className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs text-muted-foreground">لا توجد حصص مجدولة لهذا التاريخ</p>
              </div>
            )}
          </div>

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
              disabled={checkinMutation.isPending || !selectedSession}
              className="flex-[2] h-11 rounded-xl gradient-brand text-white font-medium shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {checkinMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري التسجيل...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  تسجيل الحضور
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
