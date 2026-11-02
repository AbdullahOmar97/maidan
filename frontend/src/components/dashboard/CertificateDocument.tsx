"use client";

import React from "react";
import type { PublicCertificateVerification } from "@/types";
import { Award, ShieldCheck, Calendar, Lock, QrCode as QrIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CertificateDocumentProps {
  data: PublicCertificateVerification;
  qrDataUrl?: string;
  className?: string;
}

export default function CertificateDocument({
  data,
  qrDataUrl,
  className,
}: CertificateDocumentProps) {
  return (
    <div
      className={cn(
        "w-full max-w-4xl bg-gradient-to-br from-slate-900 via-[#0e1626] to-slate-900 text-slate-100 rounded-3xl p-6 sm:p-10 border-2 border-amber-500/30 shadow-2xl relative overflow-hidden print-certificate-canvas print:p-4 print:border-amber-700",
        className
      )}
      dir="rtl"
    >
      {/* Decorative corner borders */}
      <div className="absolute top-2.5 start-2.5 w-12 h-12 border-t-2 border-s-2 border-amber-500/60 rounded-tl-lg pointer-events-none print:w-8 print:h-8 print:border-amber-700" />
      <div className="absolute top-2.5 end-2.5 w-12 h-12 border-t-2 border-e-2 border-amber-500/60 rounded-tr-lg pointer-events-none print:w-8 print:h-8 print:border-amber-700" />
      <div className="absolute bottom-2.5 start-2.5 w-12 h-12 border-b-2 border-s-2 border-amber-500/60 rounded-bl-lg pointer-events-none print:w-8 print:h-8 print:border-amber-700" />
      <div className="absolute bottom-2.5 end-2.5 w-12 h-12 border-b-2 border-e-2 border-amber-500/60 rounded-br-lg pointer-events-none print:w-8 print:h-8 print:border-amber-700" />

      {/* Decorative inner golden border */}
      <div className="border border-amber-500/20 rounded-2xl p-6 sm:p-8 flex flex-col justify-between min-h-[580px] relative bg-gradient-to-b from-white/[0.02] to-transparent print-certificate-inner print:min-h-0 print:p-4 print:border-amber-700/40">
        
        {/* Header: Club Info & Logo */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-amber-500/20 pb-5 print:pb-2.5 print:border-amber-700/30">
          <div className="flex items-center gap-3.5 text-center sm:text-right">
            {data.tenant_info?.logo_url ? (
              <img
                src={data.tenant_info.logo_url}
                alt={data.tenant_info.name}
                className="w-16 h-16 object-contain rounded-xl bg-white/5 p-1 border border-white/10 shrink-0 print:w-12 print:h-12 print:bg-transparent"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner print:w-11 print:h-11">
                <Award className="w-7 h-7 print:w-6 print:h-6" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-black text-amber-200 tracking-wide print:text-amber-900 print:text-base">
                {data.tenant_info?.name || "نادي الرياضات القتالية"}
              </h2>
              {data.tenant_info?.business_name && (
                <p className="text-xs text-slate-400 font-medium print:text-slate-600 print:text-[10px]">
                  {data.tenant_info.business_name}
                </p>
              )}
              <p className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider mt-0.5 print:text-amber-800 print:text-[8px]">
                منظومة توثيق واعتماد الأحزمة الرياضية
              </p>
            </div>
          </div>

          {/* Official Badge & Serial */}
          <div className="text-center sm:text-left flex flex-col items-center sm:items-end">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold mb-1 print:border-amber-800 print:text-amber-900 print:text-[9px] print:py-0.5">
              <Award className="w-3.5 h-3.5 text-amber-400 print:w-3 print:h-3" />
              <span>شهادة رسمية صادرة</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono print:text-slate-600 print:text-[9px]">
              رقم الاعتماد: <span className="font-bold text-slate-200 print:text-slate-900">{data.certificate_number}</span>
            </div>
          </div>
        </div>

        {/* Body Section */}
        <div className="my-6 text-center space-y-4 print:my-2 print:space-y-1.5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-amber-400/90 font-black print:text-amber-800 print:text-[9px]">
              CERTIFICATE OF BELT PROMOTION
            </p>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight print:text-slate-900 print:text-xl">
              شهادة اجتياز فحص وترقية حزام
            </h1>
          </div>

          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto print:text-slate-700 print:text-[10px]">
            تشهد إدارة النادي واللجنة الفنية المعتمدة بأن الطالب الرياضي:
          </p>

          {/* Student Name */}
          <div className="py-1 print:py-0.5">
            <div className="inline-block relative">
              <span className="text-2xl sm:text-3xl font-black text-amber-300 px-6 tracking-wide drop-shadow-md print:text-amber-900 print:text-2xl">
                {data.student_name}
              </span>
              <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-amber-500/60 to-transparent mt-1.5 print:via-amber-800" />
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed print:text-slate-800 print:text-[10px]">
            قد استوفى بنجاح كافة المعايير الفنية والانضباطية واجتاز اختبار الترقية المقرر في رياضة{" "}
            <strong className="text-white print:text-slate-900 font-black">{data.martial_art}</strong>، وتم منحه
            رتبة:
          </p>

          {/* Belt Rank Ribbon Badge */}
          <div className="flex flex-col items-center justify-center gap-1.5 pt-1 print:pt-0.5">
            <div className="inline-flex items-center gap-3 px-5 py-2 rounded-2xl bg-white/5 border border-white/10 shadow-lg print:bg-slate-100 print:border-slate-300 print:py-1 print:px-3">
              <div
                className="w-4 h-4 rounded-full border border-white/30 shrink-0 shadow-sm print:w-3 print:h-3"
                style={{ backgroundColor: data.belt_color || "#ffffff" }}
              />
              <span className="text-base sm:text-lg font-black text-white print:text-slate-900 print:text-sm">
                {data.belt_name_ar || data.belt_name}
              </span>
              {data.belt_name_ar && data.belt_name && (
                <span className="text-xs text-slate-400 font-medium print:text-slate-600 print:text-[10px]">
                  ({data.belt_name})
                </span>
              )}
            </div>

            {/* Belt Graphic Bar */}
            <div
              className="w-44 h-2.5 rounded-full relative overflow-hidden border border-black/40 shadow-inner print:w-36 print:h-2"
              style={{ backgroundColor: data.belt_color || "#ffffff" }}
            >
              {/* Black rank bar on the belt tip */}
              <div className="absolute end-0 top-0 bottom-0 w-10 bg-neutral-900 border-s border-neutral-700" />
            </div>
          </div>

          {/* Exam and Grading metadata pills */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs pt-2 text-slate-300 print:text-slate-700 print:pt-1 print:text-[9px] print:gap-2">
            {data.exam_name && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/5 print:border-slate-300 print:py-0.5 print:px-2">
                <span className="text-slate-400">الاختبار:</span>
                <span className="font-bold text-white print:text-slate-900">{data.exam_name}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/5 print:border-slate-300 print:py-0.5 print:px-2">
              <Calendar className="w-3.5 h-3.5 text-amber-400 print:text-amber-800 print:w-3 print:h-3" />
              <span className="text-slate-400">تاريخ المنح:</span>
              <span className="font-bold text-white print:text-slate-900">{data.issue_date}</span>
            </div>
            {data.technical_grade && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/5 print:border-slate-300 print:py-0.5 print:px-2">
                <span className="text-slate-400">التقدير الفني:</span>
                <span className="font-black text-emerald-400 print:text-emerald-800">{data.technical_grade}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer: Signatures, Stamp & QR Code */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center pt-4 border-t border-amber-500/20 print:border-amber-700/30 print:pt-2 print:gap-2">
          {/* Right: QR Code for Verification */}
          <div className="flex items-center sm:justify-start justify-center gap-3 print:gap-2">
            {qrDataUrl ? (
              <div className="p-1 bg-white rounded-xl shadow-md shrink-0">
                <img src={qrDataUrl} alt="QR Code" className="w-16 h-16 sm:w-18 sm:h-18 print:w-14 print:h-14" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center print:w-14 print:h-14">
                <QrIcon className="w-7 h-7 text-slate-400" />
              </div>
            )}
            <div className="text-[10px] text-slate-400 leading-tight print:text-[8px]">
              <p className="font-bold text-slate-200 print:text-slate-900">مسح للتحقق الفوري</p>
              <p className="text-[9px] mt-0.5 print:text-slate-600 print:text-[7px]">Scan to Verify</p>
              <p className="font-mono text-[9px] text-amber-400/90 mt-0.5 print:text-amber-800 print:text-[7px]">
                {data.certificate_number}
              </p>
            </div>
          </div>

          {/* Center: Official Stamp / Seal */}
          <div className="flex flex-col items-center justify-center text-center">
            {data.tenant_info?.stamp_url ? (
              <img
                src={data.tenant_info.stamp_url}
                alt="Official Seal"
                className="w-18 h-18 sm:w-20 sm:h-20 object-contain rounded-full p-1 opacity-90 drop-shadow-lg print:w-14 print:h-14"
              />
            ) : (
              <div className="w-18 h-18 rounded-full border-2 border-dashed border-amber-500/40 flex flex-col items-center justify-center text-amber-400/80 p-1.5 text-center shadow-inner print:border-amber-800 print:w-14 print:h-14">
                <ShieldCheck className="w-5 h-5 mb-0.5 text-amber-400 print:text-amber-800 print:w-4 print:h-4" />
                <span className="text-[8px] font-black uppercase tracking-wider print:text-[7px]">ختم النادي الرسمي</span>
              </div>
            )}
          </div>

          {/* Left: Examiner / Head Coach Signature */}
          <div className="flex flex-col items-center sm:items-end text-center sm:text-left">
            {data.tenant_info?.signature_url ? (
              <img
                src={data.tenant_info.signature_url}
                alt="Authorized Signature"
                className="h-10 object-contain mb-0.5 print:h-8"
              />
            ) : (
              <div className="h-9 flex items-center text-amber-300 font-serif italic text-sm print:text-slate-800 print:h-7">
                {data.signed_by_name || "Head Coach"}
              </div>
            )}
            <div className="w-32 h-px bg-slate-600 print:bg-slate-400 mb-0.5 print:w-28" />
            <p className="text-xs font-bold text-white print:text-slate-900 print:text-[10px]">{data.signed_by_name}</p>
            <p className="text-[10px] text-slate-400 print:text-slate-600 print:text-[8px]">{data.signed_by_title}</p>
          </div>
        </div>

        {/* Bottom Security Fingerprint Audit Bar */}
        <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-[9px] text-slate-400 print:text-slate-600 print:mt-1 print:pt-1 print:text-[8px]">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-emerald-400 shrink-0 print:w-2.5 print:h-2.5" />
            <span>البصمة الرقمية (SHA-256 HMAC):</span>
            <span className="font-mono text-slate-300 print:text-slate-800 font-medium truncate max-w-[200px] sm:max-w-none">
              {data.digital_fingerprint}
            </span>
          </div>
          <div className="mt-0.5 sm:mt-0 print:text-[7px]">
            وثيقة إلكترونية موثقة وفق المعايير القياسية العالمية
          </div>
        </div>
      </div>
    </div>
  );
}
