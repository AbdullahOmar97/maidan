"use client";
import { PageHeader } from "@/components/dashboard/page-header";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Award, Medal, TrendingUp, CheckCircle } from "lucide-react";
import type { BeltRank, PaginatedResponse } from "@/types";
import { useState } from "react";
import PromoteStudentDialog from "@/components/dashboard/PromoteStudentDialog";
import { PermissionGuard } from "@/components/dashboard/permission-guard";


export default function BeltsPage() {
  // ... (state and queries)
  const [promotionDialog, setPromotionDialog] = useState<{
    isOpen: boolean;
    studentId?: number;
    studentName?: string;
    currentBeltName?: string;
    currentBeltColor?: string;
    nextBeltId?: number;
  }>({ isOpen: false });

  const { data: ranksData, isLoading: ranksLoading } = useQuery<PaginatedResponse<BeltRank>>({
    queryKey: ["belts", "ranks"],
    queryFn: () => api.belts.ranks().then((r) => r.data),
  });

  const { data: eligibilityData, isLoading: eligibilityLoading } = useQuery<PaginatedResponse<any>>({
    queryKey: ["belts", "eligibility"],
    queryFn: () => api.belts.eligibility().then((r) => r.data),
  });

  const ranks = ranksData?.results || [];
  const eligibility = eligibilityData?.results || [];

  return (
    <PermissionGuard permission="can_manage_belts">
    <div className="space-y-10 pb-12">
      <PageHeader
        title="الأحزمة والترقيات"
        description="إدارة نظام الأحزمة والترقيات، متابعة استحقاق الطلاب للحصول على الرتب الجديدة، وتوثيق سجلات الإنجازات الرياضية."
        icon={Award}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Ranks */}
        <div className="lg:col-span-1 glass-card p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">تسلسل الأحزمة</h2>
            <Medal className="w-5 h-5 text-amber-400" />
          </div>

          {ranksLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="shimmer h-12 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {ranks.map((rank) => (
                <div key={rank.id} className="flex items-center gap-3 p-3 rounded-lg border bg-secondary/30">
                  <div className="w-8 h-8 rounded-full shadow-sm" style={{ backgroundColor: rank.color_hex }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{rank.name}</p>
                    <p className="text-xs text-muted-foreground">{rank.min_attendance_sessions} حصة • {rank.min_months_since_last} شهر</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column - Eligibility */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-lg">مؤهلون للترقية</h2>
              <p className="text-sm text-muted-foreground mt-1">طلاب استوفوا متطلبات الحزام التالي</p>
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>

          {eligibilityLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="shimmer h-20 rounded-xl" />
              ))}
            </div>
          ) : eligibility.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
              <CheckCircle className="w-12 h-12 mb-3 opacity-20" />
              <p>لا يوجد طلاب مؤهلون للترقية حالياً</p>
            </div>
          ) : (
            <div className="space-y-4">
              {eligibility.map((item: any) => (
                <div key={item.id} className="p-4 rounded-xl border bg-secondary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-secondary overflow-hidden shrink-0">
                      {item.student_photo ? (
                        <img src={item.student_photo} alt={item.student_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground">
                          {item.student_name?.charAt(0) || "?"}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold">{item.student_name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <span>الحالي:</span>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.current_belt_color }} />
                        <span>{item.current_belt_name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:justify-end">
                    <div className="text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-muted-foreground w-12 text-right">حصص:</span>
                        <span className={`font-medium ${item.has_enough_sessions ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {item.sessions_attended} / {item.required_sessions}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-12 text-right">أشهر:</span>
                        <span className={`font-medium ${item.has_enough_time ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {item.months_in_rank} / {item.required_months}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setPromotionDialog({
                        isOpen: true,
                        studentId: item.student,
                        studentName: item.student_name,
                        currentBeltName: item.current_belt_name,
                        currentBeltColor: item.current_belt_color,
                        nextBeltId: item.next_belt
                      })}
                      className="px-4 py-2 rounded-lg gradient-brand text-white text-sm font-medium hover:opacity-90 transition-all shrink-0"
                    >
                      ترقية
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {promotionDialog.isOpen && (
        <PromoteStudentDialog
          isOpen={promotionDialog.isOpen}
          onClose={() => setPromotionDialog({ isOpen: false })}
          studentId={promotionDialog.studentId!}
          studentName={promotionDialog.studentName!}
          currentBeltName={promotionDialog.currentBeltName}
          currentBeltColor={promotionDialog.currentBeltColor}
          nextBeltId={promotionDialog.nextBeltId}
        />
      )}
    </div>
    </PermissionGuard>
  );
}
