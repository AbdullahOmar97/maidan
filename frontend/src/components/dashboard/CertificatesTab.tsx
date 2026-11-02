"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { PromotionCertificate, PaginatedResponse } from "@/types";
import {
  Award,
  Search,
  Printer,
  Copy,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Lock,
  QrCode,
  CheckCircle2,
  Trash2,
  Filter,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { getArabicBeltName } from "@/lib/beltUtils";
import CertificateModal from "./CertificateModal";
import Link from "next/link";

export default function CertificatesTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCert, setSelectedCert] = useState<PromotionCertificate | null>(null);
  const [revokingCert, setRevokingCert] = useState<PromotionCertificate | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const { data: certsData, isLoading } = useQuery<PaginatedResponse<PromotionCertificate> | PromotionCertificate[]>({
    queryKey: ["belts", "certificates", search, statusFilter],
    queryFn: () =>
      api.belts.certificates
        .list({
          search: search || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
        })
        .then((r: any) => r.data),
  });

  const certificates: PromotionCertificate[] = Array.isArray(certsData)
    ? certsData
    : certsData?.results || [];

  const revokeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      api.belts.certificates.revoke(id, reason),
    onSuccess: () => {
      toast.success("تم إلغاء الشهادة بنجاح.");
      queryClient.invalidateQueries({ queryKey: ["belts", "certificates"] });
      setRevokingCert(null);
      setRevokeReason("");
    },
    onError: () => toast.error("حدث خطأ أثناء إلغاء الشهادة."),
  });

  const handleCopyLink = (uuid: string) => {
    const url = `${window.location.origin}/verify/certificate/${uuid}`;
    navigator.clipboard.writeText(url);
    toast.success("تم نسخ رابط التحقق الإلكتروني للشهادة");
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Tab Header & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-lg text-white">سجل الشهادات الموثقة</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            إدارة كافة الشهادات الصادرة للأحزمة، ومتابعة روابط التحقق ورموز الاستجابة السريعة (QR).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو رقم الشهادة..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pr-9 pl-3 text-xs text-white placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <Search className="w-4 h-4 text-muted-foreground absolute top-2.5 right-3" />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:border-primary focus:outline-none"
          >
            <option value="all" className="bg-neutral-900 text-white">كافة الحالات</option>
            <option value="active" className="bg-neutral-900 text-emerald-400">سارية المفعول</option>
            <option value="revoked" className="bg-neutral-900 text-rose-400">ملغاة</option>
          </select>
        </div>
      </div>

      {/* Certificates Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : certificates.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
          <Award className="w-12 h-12 mx-auto mb-3 opacity-20 text-muted-foreground" />
          <p className="text-sm font-bold text-white">لا توجد شهادات صادرة حالياً</p>
          <p className="text-xs text-muted-foreground mt-1">
            يتم إصدار الشهادات تلقائياً عند ترقية أي طالب أو اجتيازه لاختبار الحزام.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certificates.map((cert) => {
            const isRevoked = cert.status === "revoked";
            return (
              <div
                key={cert.id}
                className={cn(
                  "glass-card p-5 rounded-2xl border transition-all flex flex-col justify-between group relative overflow-hidden",
                  isRevoked
                    ? "border-rose-500/20 bg-rose-500/[0.02]"
                    : "border-white/5 hover:border-amber-500/30 hover:bg-white/[0.02]"
                )}
              >
                <div>
                  {/* Top card row: Serial & Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-[11px] font-bold text-amber-300">
                      {cert.certificate_number}
                    </span>
                    {isRevoked ? (
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-bold flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        ملغاة
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        موثقة ومعتمدة
                      </span>
                    )}
                  </div>

                  {/* Student & Belt Info */}
                  <div className="space-y-2">
                    <Link
                      href={`/dashboard/students/${cert.student}`}
                      className="text-base font-black text-white hover:text-primary transition-colors block"
                    >
                      {cert.student_name}
                    </Link>

                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full border border-white/30 shrink-0"
                        style={{ backgroundColor: cert.belt_color || "#ffffff" }}
                      />
                      <span className="text-xs font-bold text-slate-200">
                        {getArabicBeltName(cert.belt_name, cert.belt_name_ar)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">({cert.martial_art})</span>
                    </div>

                    <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1">
                      <p>
                        تاريخ المنح: <strong className="text-slate-300">{formatDate(cert.issue_date)}</strong>
                      </p>
                      {cert.exam_name && (
                        <p className="truncate">
                          الحدث: <span className="text-slate-300">{cert.exam_name}</span>
                        </p>
                      )}
                      {cert.technical_grade && (
                        <p>
                          التقييم: <strong className="text-emerald-400">{cert.technical_grade}</strong>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedCert(cert)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                      title="عرض الشهادة والـ QR"
                    >
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span>عرض الشهادة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(cert.uuid)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-95"
                      title="نسخ رابط التحقق"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {!isRevoked && (
                    <button
                      type="button"
                      onClick={() => setRevokingCert(cert)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      title="إلغاء الشهادة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Certificate Modal */}
      {selectedCert && (
        <CertificateModal
          isOpen={Boolean(selectedCert)}
          onClose={() => setSelectedCert(null)}
          certificateUuid={selectedCert.uuid}
          certificateNumber={selectedCert.certificate_number}
          studentName={selectedCert.student_name}
          beltName={selectedCert.belt_name}
          beltNameAr={selectedCert.belt_name_ar}
          beltColor={selectedCert.belt_color}
          martialArt={selectedCert.martial_art}
          examName={selectedCert.exam_name}
          issueDate={selectedCert.issue_date}
          technicalGrade={selectedCert.technical_grade}
        />
      )}

      {/* Revocation Confirmation Dialog */}
      {revokingCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-card max-w-md w-full p-6 border border-rose-500/30 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-base font-black text-white">إلغاء الشهادة الرسمية</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              أنت على وشك إلغاء الشهادة رقم <strong className="text-white font-mono">{revokingCert.certificate_number}</strong> للطالب{" "}
              <strong className="text-white">{revokingCert.student_name}</strong>. سيتم تحويل حالة الشهادة في صفحة التحقق العلنية إلى ملغاة.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">سبب الإلغاء:</label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="اكتب سبب إلغاء الشهادة..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRevokingCert(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-white"
              >
                تراجع
              </button>
              <button
                type="button"
                disabled={revokeMutation.isPending || !revokeReason.trim()}
                onClick={() =>
                  revokeMutation.mutate({
                    id: revokingCert.id,
                    reason: revokeReason.trim(),
                  })
                }
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black transition-all disabled:opacity-50"
              >
                {revokeMutation.isPending ? "جاري الإلغاء..." : "تأكيد إلغاء الشهادة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
