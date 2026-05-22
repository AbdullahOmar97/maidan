"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Calendar, Loader2, CheckCircle, Clock, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { FormField, Input } from "@/components/ui/form-field";

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

  const {
    data: sessionsData,
    isLoading: sessionsLoading,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ["student-potential-sessions", studentId, selectedDate],
    queryFn: () =>
      api.students.potentialSessions(studentId, selectedDate).then((res) => res.data),
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
      toast.error(err.response?.data?.error ?? "فشل تسجيل الحضور");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return;
    const payload = selectedSession.is_schedule
      ? { schedule_id: selectedSession.id, date: selectedDate }
      : { session_id: selectedSession.id };
    checkinMutation.mutate(payload);
  };

  const existingSessions: SessionInfo[] = sessionsData?.existing ?? [];
  const schedules: SessionInfo[] = (sessionsData?.schedules ?? []).map(
    (s: any) => ({ ...s, is_schedule: true })
  );
  const allAvailable = [...existingSessions, ...schedules];

  return (
    <Modal open={isOpen} onClose={onClose} size="sm">
      <ModalHeader
        icon={<Calendar className="w-5 h-5" />}
        title="تسجيل حضور يدوي"
        subtitle={studentName}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-4">
          <FormField label="تاريخ الحصة" required>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              required
            />
          </FormField>

          <FormField label="اختر الحصة" required>
            {sessionsLoading ? (
              <div className="h-28 flex items-center justify-center border border-dashed border-border rounded-xl">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : allAvailable.length > 0 ? (
              <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar">
                {allAvailable.map((session) => {
                  const key = `${session.is_schedule ? "sched" : "sess"}-${session.id}`;
                  const isSelected =
                    selectedSession?.id === session.id &&
                    selectedSession?.is_schedule === session.is_schedule;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedSession(session)}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-end",
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border/60 hover:bg-secondary/50"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{session.class_name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {session.start_time} – {session.end_time}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md border",
                          session.is_schedule
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        )}
                      >
                        {session.is_schedule ? "جدول" : "حصة"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-8 border border-dashed border-border rounded-xl bg-secondary/10">
                <Info className="w-7 h-7 opacity-20" />
                <p className="text-xs text-muted-foreground">لا توجد حصص مجدولة لهذا التاريخ</p>
              </div>
            )}
          </FormField>
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
              disabled={checkinMutation.isPending || !selectedSession}
              className="flex-1 py-3 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {checkinMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              تسجيل الحضور
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
