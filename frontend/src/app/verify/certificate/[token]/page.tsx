"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import type { PublicCertificateVerification } from "@/types";
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  Printer,
  Share2,
  Copy,
  CheckCircle2,
  Award,
  Calendar,
  Lock,
  ExternalLink,
  QrCode as QrIcon,
  Loader2,
  Building2,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CertificateVerificationPage() {
  const params = useParams();
  const token = params?.token as string;

  const [data, setData] = useState<PublicCertificateVerification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const certRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    setIsLoading(true);

    api
      .verifyCertificate(token)
      .then((res: any) => {
        if (!isMounted) return;
        setData(res.data);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        const msg =
          err?.response?.data?.detail ||
          "لم يتم العثور على الشهادة أو أن رابط التحقق غير صالح.";
        setError(msg);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Generate QR code data URL pointing to the live URL
  useEffect(() => {
    if (typeof window === "undefined" || !token) return;
    const currentUrl = window.location.href;
    QRCode.toDataURL(currentUrl, {
      width: 250,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    })
      .then((url) => setQrDataUrl(url))
      .catch((e) => console.error("QR Code generation error:", e));
  }, [token]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    toast.success("تم نسخ رابط التحقق بنجاح.");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShare = async () => {
    if (typeof window === "undefined" || !data) return;
    const url = window.location.href;
    const title = `شهادة ترقية حزام ${data.belt_name} - ${data.student_name}`;
    const text = `شهادة معتمدة وموثقة رقمياً لاجتياز فحص الترقية الصادرة من ${data.tenant_info?.name}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err) {
        // Fallback to clipboard
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-400 mb-4" />
        <h2 className="text-lg font-bold">جاري التحقق من السجل الرقمي للشهادة...</h2>
        <p className="text-xs text-slate-400 mt-1">يتم فحص البصمة الرقمية وبيانات التوثيق المعتمدة</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 shadow-xl">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-black text-rose-300 mb-2">تعذر التحقق من الوثيقة</h1>
        <p className="text-sm text-slate-400 max-w-md mb-6">{error || "الرابط غير صحيح أو تم حذف السجل."}</p>
        <a
          href="/"
          className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold transition-all text-slate-300"
        >
          العودة للرئيسية
        </a>
      </div>
    );
  }

  const isRevoked = data.status === "revoked";
  const isTampered = Boolean(data.is_tampered);
  const isValid = data.is_valid && !isRevoked && !isTampered;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col items-center py-8 px-4 sm:px-6" dir="rtl">
      {/* Print Stylesheet overrides */}
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-certificate-canvas {
            border: 3px solid #b45309 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
        }
      `}</style>

      {/* Top Verification Header (Screen Only) */}
      <div className="w-full max-w-4xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          {isValid ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold shadow-lg shadow-emerald-950/40">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>وثيقة رسمية معتمدة وموثقة رقمياً</span>
            </div>
          ) : isRevoked ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold shadow-lg shadow-rose-950/40">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>شهادة ملغاة رسمياً / Revoked</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold shadow-lg shadow-amber-950/40">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
              <span>فشل التحقق الأمني من البصمة الرقمية</span>
            </div>
          )}

          <div className="text-[11px] text-slate-400 hidden md:block">
            رقم الشهادة: <span className="font-mono text-slate-200 font-bold">{data.certificate_number}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all shadow-md active:scale-95 touch-target"
            title="طباعة أو حفظ بصيغة PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة / حفظ PDF</span>
          </button>
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all active:scale-95 touch-target"
            title="مشاركة الرابط"
          >
            {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>مشاركة</span>
          </button>
        </div>
      </div>

      {/* Revocation Warning Banner if revoked */}
      {isRevoked && (
        <div className="w-full max-w-4xl mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3 no-print">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div>
            <p className="font-black text-sm">تم إلغاء هذه الشهادة</p>
            <p className="mt-1 text-slate-300">
              سبب الإلغاء: {data.revocation_reason || "تم سحب الشهادة بقرار من إدارة النادي."}
            </p>
          </div>
        </div>
      )}

      {/* Tamper Warning if hash check failed */}
      {isTampered && (
        <div className="w-full max-w-4xl mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3 no-print">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <p className="font-black text-sm">تحذير أمني: لم تتطابق البصمة الرقمية للشهادة</p>
            <p className="mt-1 text-slate-300">
              {data.tamper_warning || "قد تكون بيانات هذه الشهادة قد تعرضت للتعديل أو النقل غير المصرح به."}
            </p>
          </div>
        </div>
      )}

      {/* Main Certificate Diploma Canvas */}
      <div
        ref={certRef}
        className="w-full max-w-4xl bg-gradient-to-br from-slate-900 via-[#0e1626] to-slate-900 text-slate-100 rounded-3xl p-6 sm:p-10 border-2 border-amber-500/30 shadow-2xl relative overflow-hidden print-certificate-canvas print:p-8 print:border-amber-700"
      >
        {/* Decorative corner borders */}
        <div className="absolute top-2.5 start-2.5 w-12 h-12 border-t-2 border-s-2 border-amber-500/60 rounded-tl-lg pointer-events-none" />
        <div className="absolute top-2.5 end-2.5 w-12 h-12 border-t-2 border-e-2 border-amber-500/60 rounded-tr-lg pointer-events-none" />
        <div className="absolute bottom-2.5 start-2.5 w-12 h-12 border-b-2 border-s-2 border-amber-500/60 rounded-bl-lg pointer-events-none" />
        <div className="absolute bottom-2.5 end-2.5 w-12 h-12 border-b-2 border-e-2 border-amber-500/60 rounded-br-lg pointer-events-none" />

        {/* Decorative inner golden border */}
        <div className="border border-amber-500/20 rounded-2xl p-6 sm:p-8 flex flex-col justify-between min-h-[580px] relative bg-gradient-to-b from-white/[0.02] to-transparent print:min-h-0 print:border-amber-700/40">
          
          {/* Header: Club Info & Logo */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-amber-500/20 pb-6 print:border-amber-700/30">
            <div className="flex items-center gap-3.5 text-center sm:text-right">
              {data.tenant_info?.logo_url ? (
                <img
                  src={data.tenant_info.logo_url}
                  alt={data.tenant_info.name}
                  className="w-16 h-16 object-contain rounded-xl bg-white/5 p-1 border border-white/10 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                  <Award className="w-7 h-7" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-black text-amber-200 tracking-wide print:text-amber-900">
                  {data.tenant_info?.name || "نادي الرياضات القتالية"}
                </h2>
                {data.tenant_info?.business_name && (
                  <p className="text-xs text-slate-400 font-medium print:text-slate-600">
                    {data.tenant_info.business_name}
                  </p>
                )}
                <p className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider mt-0.5 print:text-amber-800">
                  منظومة توثيق واعتماد الأحزمة الرياضية
                </p>
              </div>
            </div>

            {/* Official Badge & Serial */}
            <div className="text-center sm:text-left flex flex-col items-center sm:items-end">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold mb-1 print:border-amber-800 print:text-amber-900">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>شهادة رسمية صادرة</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono print:text-slate-600">
                رقم الاعتماد: <span className="font-bold text-slate-200 print:text-slate-900">{data.certificate_number}</span>
              </div>
            </div>
          </div>

          {/* Body Section */}
          <div className="my-8 text-center space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-amber-400/90 font-black print:text-amber-800">
                CERTIFICATE OF BELT PROMOTION
              </p>
              <h1 className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight print:text-slate-900">
                شهادة اجتياز فحص وترقية حزام
              </h1>
            </div>

            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto print:text-slate-700">
              تشهد إدارة النادي واللجنة الفنية المعتمدة بأن الطالب الرياضي:
            </p>

            {/* Student Name */}
            <div className="py-2">
              <div className="inline-block relative">
                <span className="text-2xl sm:text-4xl font-black text-amber-300 px-6 tracking-wide drop-shadow-md print:text-amber-900">
                  {data.student_name}
                </span>
                <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-amber-500/60 to-transparent mt-2 print:via-amber-800" />
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed print:text-slate-800">
              قد استوفى بنجاح كافة المعايير الفنية والانضباطية واجتاز اختبار الترقية المقرر في رياضة{" "}
              <strong className="text-white print:text-slate-900 font-black">{data.martial_art}</strong>، وتم منحه
              رتبة:
            </p>

            {/* Belt Rank Ribbon Badge */}
            <div className="flex flex-col items-center justify-center gap-2 pt-2">
              <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-white/5 border border-white/10 shadow-lg print:bg-slate-100 print:border-slate-300">
                <div
                  className="w-4 h-4 rounded-full border border-white/30 shrink-0 shadow-sm"
                  style={{ backgroundColor: data.belt_color || "#ffffff" }}
                />
                <span className="text-lg sm:text-xl font-black text-white print:text-slate-900">
                  {data.belt_name_ar || data.belt_name}
                </span>
                {data.belt_name_ar && data.belt_name && (
                  <span className="text-xs text-slate-400 font-medium print:text-slate-600">
                    ({data.belt_name})
                  </span>
                )}
              </div>

              {/* Belt Graphic Bar */}
              <div
                className="w-48 h-3 rounded-full relative overflow-hidden border border-black/40 shadow-inner"
                style={{ backgroundColor: data.belt_color || "#ffffff" }}
              >
                {/* Black rank bar on the belt tip */}
                <div className="absolute end-0 top-0 bottom-0 w-12 bg-neutral-900 border-s border-neutral-700" />
              </div>
            </div>

            {/* Exam and Grading metadata pills */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs pt-3 text-slate-300 print:text-slate-700">
              {data.exam_name && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/5 print:border-slate-300">
                  <span className="text-slate-400">الاختبار:</span>
                  <span className="font-bold text-white print:text-slate-900">{data.exam_name}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/5 print:border-slate-300">
                <Calendar className="w-3.5 h-3.5 text-amber-400 print:text-amber-800" />
                <span className="text-slate-400">تاريخ المنح:</span>
                <span className="font-bold text-white print:text-slate-900">{data.issue_date}</span>
              </div>
              {data.technical_grade && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/5 print:border-slate-300">
                  <span className="text-slate-400">التقدير الفني:</span>
                  <span className="font-black text-emerald-400 print:text-emerald-800">{data.technical_grade}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer: Signatures, Stamp & QR Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center pt-6 border-t border-amber-500/20 print:border-amber-700/30">
            {/* Right: QR Code for Verification */}
            <div className="flex items-center sm:justify-start justify-center gap-3">
              {qrDataUrl ? (
                <div className="p-1.5 bg-white rounded-xl shadow-md shrink-0">
                  <img src={qrDataUrl} alt="QR Code" className="w-16 h-16 sm:w-20 sm:h-20" />
                </div>
              ) : (
                <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center">
                  <QrIcon className="w-8 h-8 text-slate-400" />
                </div>
              )}
              <div className="text-[10px] text-slate-400 leading-tight">
                <p className="font-bold text-slate-200 print:text-slate-900">مسح للتحقق الفوري</p>
                <p className="text-[9px] mt-0.5 print:text-slate-600">Scan to Verify Digital Credential</p>
                <p className="font-mono text-[9px] text-amber-400/90 mt-1 print:text-amber-800">
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
                  className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-full p-1 opacity-90 drop-shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-amber-500/40 flex flex-col items-center justify-center text-amber-400/80 p-2 text-center shadow-inner print:border-amber-800">
                  <ShieldCheck className="w-6 h-6 mb-1 text-amber-400 print:text-amber-800" />
                  <span className="text-[8px] font-black uppercase tracking-wider">ختم النادي الرسمي</span>
                </div>
              )}
            </div>

            {/* Left: Examiner / Head Coach Signature */}
            <div className="flex flex-col items-center sm:items-end text-center sm:text-left">
              {data.tenant_info?.signature_url ? (
                <img
                  src={data.tenant_info.signature_url}
                  alt="Authorized Signature"
                  className="h-12 object-contain mb-1"
                />
              ) : (
                <div className="h-10 flex items-center text-amber-300 font-serif italic text-base print:text-slate-800">
                  {data.signed_by_name || "Head Coach"}
                </div>
              )}
              <div className="w-36 h-px bg-slate-600 print:bg-slate-400 mb-1" />
              <p className="text-xs font-bold text-white print:text-slate-900">{data.signed_by_name}</p>
              <p className="text-[10px] text-slate-400 print:text-slate-600">{data.signed_by_title}</p>
            </div>
          </div>

          {/* Bottom Security Fingerprint Audit Bar */}
          <div className="mt-4 pt-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-[9px] text-slate-400 print:text-slate-600">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>البصمة الرقمية (SHA-256 HMAC):</span>
              <span className="font-mono text-slate-300 print:text-slate-800 font-medium truncate max-w-[220px] sm:max-w-none">
                {data.digital_fingerprint}
              </span>
            </div>
            <div className="mt-1 sm:mt-0">
              وثيقة إلكترونية موثقة وفق المعايير القياسية العالمية لاعتماد الرتب
            </div>
          </div>
        </div>
      </div>

      {/* Security Audit Details Card (Screen Only) */}
      <div className="w-full max-w-4xl mt-6 p-5 rounded-2xl bg-white/[0.02] border border-white/5 text-xs no-print">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>معلومات التوثيق والأمان الرقمي</span>
          </div>
          <button
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="text-[11px] text-primary hover:underline font-bold"
          >
            {showTechnicalDetails ? "إخفاء التفاصيل الفنية" : "عرض التفاصيل الفنية"}
          </button>
        </div>

        {showTechnicalDetails && (
          <div className="mt-4 pt-4 border-t border-white/5 space-y-3 text-slate-400 font-mono text-[11px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500">معرف الشهادة المرجعي (UUID):</span>
              <span className="text-slate-200 select-all">{data.uuid}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500">الرقم التسلسلي:</span>
              <span className="text-slate-200 select-all">{data.certificate_number}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500">التحقق من التشفير:</span>
              <span className={cn("font-bold", isValid ? "text-emerald-400" : "text-rose-400")}>
                {isValid ? "HMAC SHA-256 MATCHED & VERIFIED" : "VERIFICATION FAILED"}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500">تاريخ التوثيق:</span>
              <span className="text-slate-200">{new Date(data.created_at).toLocaleString("ar-JO")}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
