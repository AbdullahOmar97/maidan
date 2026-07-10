"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { X, Search, Check, AlertCircle, Save, Plus, Award, Loader2, Trash2 } from "lucide-react";
import type { BeltExam, ExamCandidate, BeltRank, Student, PaginatedResponse } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ExamDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: BeltExam;
}

export default function ExamDetailsModal({ isOpen, onClose, exam }: ExamDetailsModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"candidates" | "add">("candidates");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [targetBeltId, setTargetBeltId] = useState<string>("");

  // 1. Fetch Candidates in this exam
  const { data: candidates = [], isLoading: candidatesLoading, refetch: refetchCandidates } = useQuery<ExamCandidate[]>({
    queryKey: ["belts", "exams", exam.id, "candidates"],
    queryFn: () => api.belts.exams.candidates(exam.id).then((r: any) => r.data),
    enabled: isOpen,
  });

  // 2. Fetch all Belt Ranks for this exam's sport
  const { data: ranksData } = useQuery<PaginatedResponse<BeltRank>>({
    queryKey: ["belts", "ranks"],
    queryFn: () => api.belts.ranks().then((r: any) => r.data),
    enabled: isOpen,
  });
  const ranks = ranksData?.results || [];
  const sportRanks = ranks.filter((r) => r.martial_art === exam.martial_art);

  // 3. Fetch auto-eligible students
  const { data: eligibilityData } = useQuery<PaginatedResponse<any>>({
    queryKey: ["belts", "eligibility"],
    queryFn: () => api.belts.eligibility().then((r: any) => r.data),
    enabled: isOpen && activeTab === "add",
  });
  const eligibleList = eligibilityData?.results || [];
  // Filter eligible list to only students whose next belt matches our exam's sport
  const eligibleForSport = eligibleList.filter((e: any) => {
    const targetBelt = ranks.find((r) => r.id === e.next_belt);
    return targetBelt?.martial_art === exam.martial_art;
  });

  // 4. Fetch all active students (fallback search)
  const { data: studentsData } = useQuery({
    queryKey: ["students", "search", searchQuery],
    queryFn: () =>
      api.students.list({ search: searchQuery, status: "active" }).then((r) => r.data),
    enabled: isOpen && activeTab === "add" && searchQuery.length > 1,
  });
  const searchedStudents = studentsData?.results || [];

  // Mutations
  const addCandidatesMutation = useMutation({
    mutationFn: (data: { student_ids: number[]; target_belt_id: number }) =>
      api.belts.exams.addCandidates(exam.id, data),
    onSuccess: (res: any) => {
      toast.success(`تم إضافة ${res.data.created_count} مرشحين للاختبار بنجاح.`);
      setSelectedStudents([]);
      setTargetBeltId("");
      refetchCandidates();
      queryClient.invalidateQueries({ queryKey: ["belts", "exams"] });
      setActiveTab("candidates");
    },
    onError: () => toast.error("حدث خطأ أثناء إضافة المرشحين."),
  });

  const gradeCandidateMutation = useMutation({
    mutationFn: (data: {
      candidate_id: number;
      technical_grade: string;
      instructor_notes: string;
      status: "pending" | "passed" | "failed";
    }) => api.belts.exams.grade(exam.id, data),
    onSuccess: () => {
      toast.success("تم حفظ التقييم وتحديث حالة الترقية بنجاح.");
      refetchCandidates();
      queryClient.invalidateQueries({ queryKey: ["student"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["belts"] });
      queryClient.invalidateQueries({ queryKey: ["student-belt"] });
    },
    onError: () => toast.error("حدث خطأ أثناء حفظ تقييم الطالب."),
  });

  if (!isOpen) return null;

  const handleAddCandidates = () => {
    if (selectedStudents.length === 0) {
      toast.error("يرجى تحديد طالب واحد على الأقل.");
      return;
    }
    if (!targetBeltId) {
      toast.error("يرجى اختيار الحزام المستهدف للترقية.");
      return;
    }
    addCandidatesMutation.mutate({
      student_ids: selectedStudents,
      target_belt_id: Number(targetBeltId),
    });
  };

  const handleGradeCandidate = (
    candidateId: number,
    technicalGrade: string,
    notes: string,
    statusVal: "pending" | "passed" | "failed"
  ) => {
    gradeCandidateMutation.mutate({
      candidate_id: candidateId,
      technical_grade: technicalGrade,
      instructor_notes: notes,
      status: statusVal,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col relative overflow-hidden border border-white/10 text-right" dir="rtl">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-white">{exam.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              التاريخ: <b className="text-primary">{exam.date}</b> • الرياضة: <b className="text-white">{exam.martial_art}</b> • الفرع: <b className="text-white">{exam.location_name}</b>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-6 border-b border-white/5 flex gap-4">
          <button
            onClick={() => setActiveTab("candidates")}
            className={cn(
              "py-3 text-xs font-black uppercase tracking-wider relative transition-all border-b-2",
              activeTab === "candidates" ? "text-primary border-primary" : "text-muted-foreground border-transparent"
            )}
          >
            المرشحون والتقييم ({candidates.length})
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={cn(
              "py-3 text-xs font-black uppercase tracking-wider relative transition-all border-b-2",
              activeTab === "add" ? "text-primary border-primary" : "text-muted-foreground border-transparent"
            )}
          >
            إضافة مرشحين للاختبار
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === "candidates" ? (
            candidatesLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : candidates.length === 0 ? (
              <div className="text-center py-12 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col items-center justify-center text-muted-foreground">
                <Award className="w-12 h-12 mb-3 opacity-25" />
                <p>لا يوجد مرشحون مسجلون في هذا الاختبار حالياً.</p>
                <button onClick={() => setActiveTab("add")} className="mt-4 px-4 py-2 bg-primary/10 border border-primary/20 text-primary text-xs font-bold rounded-xl hover:bg-primary/20 transition-all">
                  إضافة مرشحين
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {candidates.map((cand) => (
                  <CandidateRow
                    key={cand.id}
                    candidate={cand}
                    onGrade={handleGradeCandidate}
                    isPending={gradeCandidateMutation.isPending}
                  />
                ))}
              </div>
            )
          ) : (
            /* Add Candidates Tab */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Select Target Belt */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground block">الحزام المستهدف للترقية:</label>
                  <select
                    value={targetBeltId}
                    onChange={(e) => setTargetBeltId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary focus:outline-none"
                  >
                    <option value="" className="bg-neutral-900 text-muted-foreground">اختر الحزام المستهدف...</option>
                    {sportRanks.map((rank) => (
                      <option key={rank.id} value={rank.id} className="bg-neutral-900 text-white">
                        {rank.name} {rank.name_ar && `(${rank.name_ar})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bulk Action button */}
                <div className="flex items-end">
                  <button
                    onClick={handleAddCandidates}
                    disabled={addCandidatesMutation.isPending || selectedStudents.length === 0}
                    className="w-full bg-primary hover:bg-primary/95 text-white py-3 px-4 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {addCandidatesMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    إضافة المحددين ({selectedStudents.length}) للاختبار
                  </button>
                </div>
              </div>

              {/* Student Search and Filters */}
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن طالب بالاسم لإضافته يدوياً..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 pr-10 text-sm text-white focus:border-primary focus:outline-none text-right"
                  />
                  <Search className="w-4 h-4 text-muted-foreground absolute top-3.5 right-3.5" />
                </div>

                {/* Listing Selection */}
                {searchQuery.length > 1 ? (
                  // Search Results
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground">نتائج البحث عن "{searchQuery}":</p>
                    {searchedStudents.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">لا توجد نتائج مطابقة.</p>
                    ) : (
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                        {searchedStudents
                          .filter((st: any) => !candidates.some((c) => c.student === st.id))
                          .map((st: any) => (
                            <StudentSelectRow
                              key={st.id}
                              student={st}
                              selected={selectedStudents.includes(st.id)}
                              onToggle={() => {
                                setSelectedStudents((prev) =>
                                  prev.includes(st.id) ? prev.filter((id) => id !== st.id) : [...prev, st.id]
                                );
                              }}
                            />
                          ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Auto-eligible List
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-muted-foreground">الطلاب المؤهلون تلقائياً للترقية ({eligibleForSport.length}):</p>
                      <button
                        onClick={() => {
                          const allIds = eligibleForSport
                            .map((e: any) => e.student)
                            .filter((id: number) => !candidates.some((c) => c.student === id));
                          setSelectedStudents(allIds);
                        }}
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        تحديد الكل
                      </button>
                    </div>
                    {eligibleForSport.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6 bg-white/[0.01] border border-white/5 rounded-xl">
                        لا يوجد طلاب مستحقين للترقية تلقائياً في هذه الرياضة حالياً.
                      </p>
                    ) : (
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                        {eligibleForSport
                          .filter((el: any) => !candidates.some((c) => c.student === el.student))
                          .map((el: any) => (
                            <StudentSelectRow
                              key={el.student}
                              student={{ id: el.student, first_name: el.student_name.split(" ")[0], last_name: el.student_name.split(" ").slice(1).join(" ") }}
                              details={`استكمل ${el.sessions_completed}/${el.sessions_required} حصة • ${el.months_since_last} أشهر بالرتبة`}
                              selected={selectedStudents.includes(el.student)}
                              onToggle={() => {
                                setSelectedStudents((prev) =>
                                  prev.includes(el.student) ? prev.filter((id) => id !== el.student) : [...prev, el.student]
                                );
                              }}
                            />
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Subcomponent: CandidateRow
interface CandidateRowProps {
  candidate: ExamCandidate;
  onGrade: (id: number, grade: string, notes: string, status: "pending" | "passed" | "failed") => void;
  isPending: boolean;
}

function CandidateRow({ candidate, onGrade, isPending }: CandidateRowProps) {
  const [grade, setGrade] = useState(candidate.technical_grade || "");
  const [notes, setNotes] = useState(candidate.instructor_notes || "");
  const [status, setStatus] = useState<"pending" | "passed" | "failed">(candidate.status);

  const hasUnsavedChanges =
    grade !== (candidate.technical_grade || "") ||
    notes !== (candidate.instructor_notes || "") ||
    status !== candidate.status;

  return (
    <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col md:flex-row gap-4 items-stretch md:items-center">
      {/* Student Profile Info */}
      <div className="flex items-center gap-3 md:w-1/3 shrink-0">
        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden">
          {candidate.student_photo ? (
            <img src={candidate.student_photo} alt={candidate.student_name} className="w-full h-full object-cover" />
          ) : (
            candidate.student_name.charAt(0)
          )}
        </div>
        <div>
          <h4 className="font-bold text-sm text-white">{candidate.student_name}</h4>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
            <span>الحزام الحالي:</span>
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: candidate.current_belt_color }} />
            <span>{candidate.current_belt_name}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-primary font-bold mt-0.5">
            <span>الحزام المستهدف:</span>
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: candidate.target_belt_color }} />
            <span>{candidate.target_belt_name}</span>
          </div>
        </div>
      </div>

      {/* Inputs Form */}
      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 items-center">
        {/* Technical Grade */}
        <div className="col-span-1">
          <input
            type="text"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            disabled={candidate.status === "passed"}
            placeholder="الدرجة (مثال: A+)"
            className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 text-xs text-white focus:border-primary focus:outline-none"
          />
        </div>

        {/* Result Status */}
        <div className="col-span-1">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            disabled={candidate.status === "passed"}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 text-xs text-white focus:border-primary focus:outline-none"
          >
            <option value="pending" className="bg-neutral-900 text-white">قيد التقييم</option>
            <option value="passed" className="bg-neutral-900 text-emerald-400">ناجح (ترقية)</option>
            <option value="failed" className="bg-neutral-900 text-red-400">إعادة الاختبار</option>
          </select>
        </div>

        {/* Evaluation Notes */}
        <div className="col-span-2">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={candidate.status === "passed"}
            placeholder="ملاحظات المدرب حول الأداء..."
            className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 text-xs text-white focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 shrink-0">
        {candidate.status === "passed" ? (
          <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            تمت الترقية
          </span>
        ) : (
          <button
            onClick={() => onGrade(candidate.id, grade, notes, status)}
            disabled={!hasUnsavedChanges || isPending}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 touch-target",
              hasUnsavedChanges
                ? "bg-primary text-white hover:bg-primary/95"
                : "bg-white/5 border border-white/10 text-muted-foreground cursor-not-allowed"
            )}
          >
            <Save className="w-3.5 h-3.5" />
            حفظ
          </button>
        )}
      </div>
    </div>
  );
}

// Subcomponent: StudentSelectRow
interface StudentSelectRowProps {
  student: any;
  details?: string;
  selected: boolean;
  onToggle: () => void;
}

function StudentSelectRow({ student, details, selected, onToggle }: StudentSelectRowProps) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        "p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs",
        selected
          ? "border-primary bg-primary/5 text-white"
          : "border-white/5 bg-white/[0.01] hover:bg-white/5 text-muted-foreground"
      )}
    >
      <div>
        <p className={cn("font-bold", selected ? "text-white" : "text-muted-foreground hover:text-white")}>
          {student.first_name} {student.last_name}
        </p>
        {details && <p className="text-[10px] text-muted-foreground mt-1">{details}</p>}
      </div>
      <div
        className={cn(
          "w-4 h-4 rounded-md border flex items-center justify-center transition-all",
          selected ? "border-primary bg-primary text-white" : "border-white/20"
        )}
      >
        {selected && <Check className="w-3.5 h-3.5" />}
      </div>
    </div>
  );
}
