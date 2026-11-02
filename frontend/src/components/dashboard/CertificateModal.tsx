"use client";

import { useEffect, useState, useRef } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import {
  Award,
  Download,
  Printer,
  Copy,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Lock,
  QrCode as QrIcon,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CertificateModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  certificateUuid: string;
  certificateNumber?: string;
  studentName?: string;
  beltName?: string;
  beltColor?: string;
  martialArt?: string;
  examName?: string;
  issueDate?: string;
  technicalGrade?: string;
  clubName?: string;
}

export default function CertificateModal({
  open,
  isOpen,
  onClose,
  certificateUuid,
  certificateNumber,
  studentName,
  beltName,
  beltColor = "#ffffff",
  martialArt = "BJJ",
  examName,
  issueDate,
  technicalGrade,
  clubName = "MAIDAN",
}: CertificateModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const isModalOpen = Boolean(open ?? isOpen);

  // Compute public verification URL
  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/certificate/${certificateUuid}`
      : `/verify/certificate/${certificateUuid}`;

  useEffect(() => {
    if (!certificateUuid || !isOpen) return;

    QRCode.toDataURL(publicUrl, {
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
  }, [certificateUuid, isOpen, publicUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("تم نسخ رابط التحقق الإلكتروني للشهادة.");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenPublicPage = () => {
    window.open(publicUrl, "_blank");
  };

  const handlePrint = () => {
    // Open the dedicated public certificate page and trigger print, or open in new window
    const printWindow = window.open(publicUrl, "_blank");
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  return (
    <Modal open={isModalOpen} onClose={onClose} size="2xl">
      <ModalHeader
        title="شهادة الترقية والاعتماد الإلكترونية"
        subtitle="عرض الشهادة الموثقة مع رمز الاستجابة السريعة (QR) ورابط التحقق العلني"
        icon={<Award className="w-5 h-5 text-amber-400" />}
        onClose={onClose}
      />
      <ModalBody>
        <div className="space-y-6 text-right" dir="rtl">
          {/* Status badge & serial */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>شهادة رسمية موثقة ومؤمنة بتشفير SHA-256</span>
            </div>
            {certificateNumber && (
              <div className="text-[11px] font-mono text-slate-300">
                الرقم المرجعي: <span className="font-bold text-white">{certificateNumber}</span>
              </div>
            )}
          </div>

          {/* Certificate Miniature Diploma Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-amber-500/40 relative overflow-hidden shadow-xl text-center space-y-4">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-black">{clubName}</p>
              <h3 className="text-xl font-black text-white mt-0.5">شهادة اجتياز فحص وترقية حزام</h3>
            </div>

            <p className="text-xs text-muted-foreground">تمنح هذه الشهادة رسمياً إلى الطالب:</p>
            <h4 className="text-2xl font-black text-amber-300 tracking-wide">{studentName}</h4>

            {/* Belt Rank badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/5 border border-white/10 mx-auto">
              <div
                className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0"
                style={{ backgroundColor: beltColor }}
              />
              <span className="text-sm font-bold text-white">{beltName}</span>
              <span className="text-[10px] text-muted-foreground">({martialArt})</span>
            </div>

            {/* Details */}
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400 pt-1">
              {examName && <span>الحدث: <strong className="text-slate-200">{examName}</strong></span>}
              {issueDate && <span>التاريخ: <strong className="text-slate-200">{issueDate}</strong></span>}
              {technicalGrade && (
                <span>النتيجة: <strong className="text-emerald-400">{technicalGrade}</strong></span>
              )}
            </div>

            {/* QR Code Section */}
            <div className="pt-3 flex flex-col items-center justify-center">
              {qrDataUrl ? (
                <div className="p-2 bg-white rounded-xl shadow-md inline-block">
                  <img src={qrDataUrl} alt="QR Code" className="w-24 h-24" />
                </div>
              ) : (
                <div className="w-24 h-24 bg-white/10 rounded-xl flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-2 font-mono">
                امسح الرمز أو شارك الرابط للتحقق الفوري من صحة الشهادة
              </p>
            </div>
          </div>

          {/* Copyable Public Link */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">رابط التحقق العلني المباشر:</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-300 font-mono text-left focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "تم النسخ" : "نسخ"}</span>
              </button>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex items-center justify-between w-full" dir="rtl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-white transition-all"
          >
            إغلاق
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenPublicPage}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>فتح صفحة التحقق</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all shadow-md"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة / حفظ كـ PDF</span>
            </button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
}
