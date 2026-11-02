"use client";

import { useEffect, useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import {
  Award,
  Printer,
  Copy,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { PublicCertificateVerification } from "@/types";
import { getArabicBeltName } from "@/lib/beltUtils";
import CertificateDocument from "./CertificateDocument";

interface CertificateModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  certificateUuid: string;
  certificateNumber?: string;
  studentName?: string;
  beltName?: string;
  beltNameAr?: string;
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
  studentName = "",
  beltName = "",
  beltNameAr,
  beltColor = "#ffffff",
  martialArt = "Martial Arts",
  examName,
  issueDate,
  technicalGrade,
  clubName = "MAIDAN",
}: CertificateModalProps) {
  const [certData, setCertData] = useState<PublicCertificateVerification | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const isModalOpen = Boolean(open ?? isOpen);

  // Compute public verification URL
  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/certificate/${certificateUuid}`
      : `/verify/certificate/${certificateUuid}`;

  // Fetch full official certificate details from API for signatures, stamps, fingerprints & logo
  useEffect(() => {
    if (!certificateUuid || !isModalOpen) return;

    let isMounted = true;
    setIsLoading(true);

    api
      .verifyCertificate(certificateUuid)
      .then((res: any) => {
        if (!isMounted) return;
        setCertData(res.data);
      })
      .catch((err: any) => {
        console.error("Failed to load full certificate data, using fallback props:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [certificateUuid, isModalOpen]);

  // Generate QR code data URL pointing to the live URL
  useEffect(() => {
    if (!certificateUuid || !isModalOpen) return;

    QRCode.toDataURL(publicUrl, {
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
  }, [certificateUuid, isModalOpen, publicUrl]);

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
    // Open the dedicated single-page print endpoint which auto-triggers the print dialog
    window.open(`${publicUrl}?print=true`, "_blank");
  };

  // Build a resolved certificate object, merging fetched data with fallback props
  const resolvedData: PublicCertificateVerification = {
    uuid: certificateUuid,
    certificate_number: certData?.certificate_number || certificateNumber || `CERT-${certificateUuid.slice(0, 8)}`,
    student_name: certData?.student_name || studentName || "الطالب الرياضي",
    belt_name: certData?.belt_name || beltName,
    belt_name_ar: certData?.belt_name_ar || beltNameAr || getArabicBeltName(certData?.belt_name || beltName),
    belt_color: certData?.belt_color || beltColor,
    martial_art: certData?.martial_art || martialArt,
    exam_name: certData?.exam_name || examName,
    issue_date: certData?.issue_date || issueDate || new Date().toISOString().split("T")[0],
    technical_grade: certData?.technical_grade || technicalGrade,
    signed_by_name: certData?.signed_by_name || "المدرب الفني المعتمد",
    signed_by_title: certData?.signed_by_title || "المدير الفني العام / Head Coach",
    digital_fingerprint: certData?.digital_fingerprint || "SHA256-PENDING-VERIFICATION",
    status: certData?.status || "active",
    is_valid: certData?.is_valid ?? true,
    is_tampered: certData?.is_tampered,
    created_at: certData?.created_at || new Date().toISOString(),
    tenant_info: {
      name: certData?.tenant_info?.name || clubName,
      business_name: certData?.tenant_info?.business_name,
      logo_url: certData?.tenant_info?.logo_url,
      stamp_url: certData?.tenant_info?.stamp_url,
      signature_url: certData?.tenant_info?.signature_url,
    },
  };

  return (
    <Modal open={isModalOpen} onClose={onClose} size="2xl" className="max-w-5xl">
      <ModalHeader
        title="شهادة الترقية والاعتماد الإلكترونية"
        subtitle="عرض الشهادة الرسمية الموثقة مع رمز الاستجابة السريعة (QR) والختم والتوقيع المعتمد"
        icon={<Award className="w-5 h-5 text-amber-400" />}
        onClose={onClose}
      />
      <ModalBody className="p-4 sm:p-6">
        <div className="space-y-5 text-right" dir="rtl">
          {/* Status bar & Quick Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>شهادة رسمية موثقة ومعتمدة</span>
              </div>
              {isLoading && (
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>مزامنة الأختام والتوقيعات...</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "تم النسخ" : "نسخ الرابط"}</span>
              </button>
              <button
                type="button"
                onClick={handleOpenPublicPage}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>صفحة التحقق</span>
              </button>
            </div>
          </div>

          {/* Master Certificate Diploma Canvas */}
          <div className="w-full flex justify-center">
            <CertificateDocument data={resolvedData} qrDataUrl={qrDataUrl} />
          </div>

          {/* Direct Public Link Input */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-slate-400">رابط التحقق العلني المباشر للشهادة:</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-300 font-mono text-left focus:outline-none select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 active:scale-95"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "تم النسخ" : "نسخ الرابط"}</span>
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة / حفظ كـ PDF (صفحة واحدة)</span>
            </button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
}
