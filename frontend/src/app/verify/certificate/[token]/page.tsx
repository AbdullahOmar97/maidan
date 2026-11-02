"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import type { PublicCertificateVerification } from "@/types";
import {
  ShieldCheck,
  ShieldAlert,
  Printer,
  Share2,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CertificateDocument from "@/components/dashboard/CertificateDocument";
import { SpeechReaderButton } from "@/components/ui/speech-reader-button";

export default function CertificateVerificationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params?.token as string;
  const shouldAutoPrint = searchParams?.get("print") === "true" || searchParams?.get("print") === "1";

  const [data, setData] = useState<PublicCertificateVerification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

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
    const currentUrl = `${window.location.origin}/verify/certificate/${token}`;
    QRCode.toDataURL(currentUrl, {
      width: 250,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    })
      .then((url: string) => setQrDataUrl(url))
      .catch((e: unknown) => console.error("QR Code generation error:", e));
  }, [token]);

  // Auto-trigger print when requested via query param
  useEffect(() => {
    if (!shouldAutoPrint || isLoading || !data || !qrDataUrl) return;

    const timer = setTimeout(() => {
      window.print();
    }, 600);

    return () => clearTimeout(timer);
  }, [shouldAutoPrint, isLoading, data, qrDataUrl]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/verify/certificate/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success("تم نسخ رابط التحقق بنجاح.");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShare = async () => {
    if (typeof window === "undefined" || !data) return;
    const url = `${window.location.origin}/verify/certificate/${token}`;
    const title = `شهادة ترقية حزام ${data.belt_name} - ${data.student_name}`;
    const text = `شهادة معتمدة وموثقة رقمياً لاجتياز فحص الترقية الصادرة من ${data.tenant_info?.name}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err) {
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
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col items-center py-8 px-4 sm:px-6 print-page-wrapper print:p-0 print:m-0 print:bg-white print:block" dir="rtl">
      {/* Strict Single-Page A4 Landscape Print Stylesheet */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-page-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            min-height: 0 !important;
            background: transparent !important;
            display: block !important;
          }
          .print-certificate-canvas {
            border: 3px solid #b45309 !important;
            border-radius: 12px !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
            width: 100% !important;
            max-width: 100% !important;
            height: 194mm !important;
            max-height: 194mm !important;
            margin: 0 auto !important;
            padding: 12px 18px !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
          .print-certificate-inner {
            border: 1px solid #d97706 !important;
            border-radius: 8px !important;
            height: 100% !important;
            max-height: 100% !important;
            padding: 10px 16px !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            min-height: 0 !important;
            overflow: hidden !important;
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
        <div className="flex flex-wrap items-center gap-2">
          <SpeechReaderButton
            text={`شهادة معتمدة من ${data.tenant_info?.name || "الأكاديمية"} للطالب ${data.student_name} بنيل حزام ${data.belt_name_ar || data.belt_name} في رياضة ${data.martial_art || "الفنون القتالية"}، بتاريخ ${data.issue_date}. حالة الشهادة: ${isValid ? "موثقة ورسمية" : "ملغاة أو غير صالحة"}.`}
            label="استماع للشهادة"
            className="touch-target"
          />
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

      {/* Official Master Certificate Diploma Document */}
      <CertificateDocument data={data} qrDataUrl={qrDataUrl} />

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
