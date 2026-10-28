"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Printer, Download, X, Loader2, ChevronRight, ChevronLeft, FileSpreadsheet, Layers } from "lucide-react";
import type { Invoice, InvoiceClubInfo } from "@/types";
import { InvoiceDocument } from "@/components/dashboard/billing/InvoiceDocument";
import { ConsolidatedInvoiceDocument } from "@/components/dashboard/billing/ConsolidatedInvoiceDocument";
import { printInvoices, printConsolidatedStatement } from "@/lib/invoice-print-engine";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface BatchInvoicePrintModalProps {
  open: boolean;
  onClose: () => void;
  invoices: Invoice[];
  clubInfo?: InvoiceClubInfo | null;
}

type ViewMode = "statement" | "all" | "single";

export function BatchInvoicePrintModal({
  open,
  onClose,
  invoices,
  clubInfo,
}: BatchInvoicePrintModalProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("statement");

  if (!open || invoices.length === 0) return null;

  const totalSum = invoices.reduce((acc, inv) => acc + Number(inv.total_amount || 0), 0);
  const currency = invoices[0]?.currency || "JOD";

  const handlePrint = async () => {
    setIsPrinting(true);
    if (viewMode === "statement") {
      toast.loading(`جارٍ تجهيز طباعة كشف فواتير مجمع (${invoices.length} بند)...`, { id: "batch-print" });
      try {
        await printConsolidatedStatement(invoices, { clubInfo });
        toast.success("تم إرسال الكشف المجمع للطباعة بنجاح ✓", { id: "batch-print" });
      } catch (err) {
        console.error("Print error:", err);
        toast.error("حدث خطأ أثناء محاولة الطباعة", { id: "batch-print" });
      } finally {
        setIsPrinting(false);
      }
    } else {
      toast.loading(`جارٍ تجهيز طباعة ${invoices.length} فاتورة منفصلة...`, { id: "batch-print" });
      try {
        await printInvoices(invoices, { clubInfo });
        toast.success("تم إرسال الفواتير للطباعة بنجاح ✓", { id: "batch-print" });
      } catch (err) {
        console.error("Print error:", err);
        toast.error("حدث خطأ أثناء محاولة الطباعة", { id: "batch-print" });
      } finally {
        setIsPrinting(false);
      }
    }
  };

  const handlePrintSingle = async () => {
    const current = invoices[activeIndex];
    if (!current) return;
    setIsPrinting(true);
    toast.loading(`جارٍ تجهيز طباعة الفاتورة #${current.invoice_number}...`, { id: "batch-print" });
    try {
      await printInvoices([current], { clubInfo });
      toast.success("تم إرسال الفاتورة للطباعة بنجاح ✓", { id: "batch-print" });
    } catch (err) {
      console.error("Print error:", err);
      toast.error("حدث خطأ أثناء محاولة الطباعة", { id: "batch-print" });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsPrinting(true);
    toast.info("يرجى اختيار 'حفظ بتنسيق PDF' / 'Save as PDF' من نافذة الطباعة", { duration: 4000 });
    try {
      if (viewMode === "statement") {
        await printConsolidatedStatement(invoices, { clubInfo });
      } else {
        await printInvoices(invoices, { clubInfo });
      }
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("فشل تجهيز ملف PDF");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="2xl" className="max-w-5xl h-[92vh] flex flex-col p-0 overflow-hidden bg-background/95 backdrop-blur-xl border border-white/10">
      {/* Modal Header */}
      <div className="p-4 sm:p-6 border-b border-white/10 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            معاينة وطباعة الفواتير ({invoices.length})
          </h2>
          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
            <span>تم تحديد <strong>{invoices.length}</strong> فاتورة</span>
            <span>•</span>
            <span>الإجمالي: <strong className="text-white font-mono">{formatCurrency(totalSum, currency)}</strong></span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {invoices.length > 1 && (
            <div className="flex items-center rounded-xl bg-white/5 p-1 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("statement")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  viewMode === "statement" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-white"
                }`}
                title="عرض جميع الفواتير الـ 22 في بيان خدمة واحد مجمع"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>كشف مجمع ({invoices.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("all")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  viewMode === "all" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-white"
                }`}
                title="عرض كل فاتورة على صفحة مستقلة"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>فواتير منفصلة ({invoices.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("single")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  viewMode === "single" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-white"
                }`}
              >
                تصفح مفرد
              </button>
            </div>
          )}

          {viewMode === "single" && invoices.length > 1 && (
            <button
              type="button"
              onClick={handlePrintSingle}
              disabled={isPrinting}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-primary" />
              <span>طباعة الحالية (#{invoices[activeIndex]?.invoice_number})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isPrinting}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>تحميل PDF</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            {isPrinting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            <span>
              {viewMode === "statement"
                ? `طباعة الكشف المجمع (${invoices.length})`
                : `طباعة الفواتير (${invoices.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modal Body / Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-black/20">
        {viewMode === "single" && invoices.length > 1 && (
          <div className="flex items-center justify-between max-w-4xl mx-auto px-2 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
              disabled={activeIndex === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
              السابقة
            </button>
            <span className="font-bold text-white">
              فاتورة {activeIndex + 1} من {invoices.length} (#{invoices[activeIndex].invoice_number}) — {invoices[activeIndex].student_name}
            </span>
            <button
              type="button"
              onClick={() => setActiveIndex((prev) => Math.min(invoices.length - 1, prev + 1))}
              disabled={activeIndex === invoices.length - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30"
            >
              التالية
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {viewMode === "statement" ? (
          <div className="animate-in fade-in duration-200">
            <ConsolidatedInvoiceDocument
              invoices={invoices}
              clubInfo={clubInfo}
            />
          </div>
        ) : viewMode === "single" ? (
          <div className="animate-in fade-in duration-200">
            <InvoiceDocument
              invoice={invoices[activeIndex]}
              clubInfo={clubInfo}
            />
          </div>
        ) : (
          <div className="space-y-8 max-w-4xl mx-auto">
            {invoices.map((inv, idx) => (
              <div key={inv.id} className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
                  <span className="font-bold text-white">
                    #{idx + 1} — الفاتورة: {inv.invoice_number}
                  </span>
                  <span>المشترك: {inv.student_name}</span>
                </div>
                <InvoiceDocument invoice={inv} clubInfo={clubInfo} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
