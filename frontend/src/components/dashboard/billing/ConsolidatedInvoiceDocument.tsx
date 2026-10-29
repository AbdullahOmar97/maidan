"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Invoice, InvoiceClubInfo } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ConsolidatedInvoiceDocumentProps {
  invoices: Invoice[];
  clubInfo?: InvoiceClubInfo | null;
  taxNumber?: string;
  crNumber?: string;
  clubAddress?: string;
}

export function ConsolidatedInvoiceDocument({
  invoices,
  clubInfo,
  taxNumber = "300000000000003",
  crNumber = "",
  clubAddress,
}: ConsolidatedInvoiceDocumentProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const club = invoices[0]?.club_info || clubInfo;
  const clubName = club?.name || "نادي ميدان الرياضي";
  const clubBusinessName = club?.business_name || "MAIDAN SPORTS CLUB";
  const address = clubAddress || club?.address || invoices[0]?.location_name || "المملكة العربية السعودية";
  const phone = club?.phone || "";
  const email = club?.email || "";
  const currency = invoices[0]?.currency || "JOD";

  const totalAmount = invoices.reduce((acc, inv) => acc + Number(inv.total_amount || 0), 0);
  const totalSubtotal = invoices.reduce((acc, inv) => acc + Number(inv.subtotal || inv.total_amount || 0), 0);
  const totalTax = invoices.reduce((acc, inv) => acc + Number(inv.tax_amount || 0), 0);
  const totalPaid = invoices.reduce((acc, inv) => acc + Number(inv.amount_paid || 0), 0);
  const totalDue = invoices.reduce((acc, inv) => acc + Number(inv.amount_due || 0), 0);

  useEffect(() => {
    const payload = [
      `Seller: ${clubName}`,
      taxNumber ? `VAT: ${taxNumber}` : "",
      `Date: ${new Date().toISOString().split("T")[0]}`,
      `Consolidated Statement: ${invoices.length} invoices`,
      `Total: ${totalAmount} ${currency}`,
      `Tax: ${totalTax} ${currency}`,
    ].filter(Boolean).join("\n");

    QRCode.toDataURL(payload, {
      width: 140,
      margin: 1,
      color: { dark: "#111827", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch((e: unknown) => console.error("Error generating statement QR:", e));
  }, [clubName, taxNumber, invoices.length, totalAmount, totalTax, currency]);

  return (
    <div className="relative bg-white text-gray-900 font-sans p-6 sm:p-8 rounded-xl border border-gray-200 shadow-sm max-w-4xl mx-auto text-xs leading-relaxed select-text print:border-none print:shadow-none print:p-0">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b-2 border-gray-900">
        <div className="flex items-center gap-3.5">
          {club?.logo ? (
            <img src={club.logo} alt="Logo" className="w-16 h-16 object-contain rounded-lg border border-gray-200 p-1" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gray-900 text-white flex items-center justify-center font-black text-sm tracking-wider">
              MAIDAN
            </div>
          )}
          <div>
            <h1 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">{clubName}</h1>
            <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">{clubBusinessName}</p>
            <div className="text-[10px] text-gray-500 space-y-0.5 mt-1 font-medium">
              {taxNumber && <div>الرقم الضريبي / VAT: <strong>{taxNumber}</strong></div>}
              {crNumber && <div>السجل التجاري / CR: <strong>{crNumber}</strong></div>}
              {address && <div>العنوان: {address}</div>}
              {(phone || email) && <div>{phone && `هاتف: ${phone}`} {email && `• بريد: ${email}`}</div>}
            </div>
          </div>
        </div>

        <div className="sm:text-end min-w-[200px]">
          <div className="inline-flex flex-col items-end bg-primary text-primary-foreground px-3 py-1.5 rounded-lg mb-2 shadow-sm">
            <span className="text-xs font-black">كشف فواتير مجمع</span>
            <span className="text-[9px] font-bold tracking-widest text-primary-foreground/80">CONSOLIDATED STATEMENT</span>
          </div>
          <div className="space-y-0.5 text-[10px]">
            <div className="flex justify-between sm:justify-end gap-2">
              <span className="text-gray-500">تاريخ الكشف / Date:</span>
              <span className="font-bold text-gray-900">{formatDate(new Date().toISOString())}</span>
            </div>
            <div className="flex justify-between sm:justify-end gap-2">
              <span className="text-gray-500">عدد الفواتير / Count:</span>
              <span className="font-mono font-bold text-gray-900">{invoices.length} فاتورة</span>
            </div>
            <div className="flex justify-between sm:justify-end gap-2">
              <span className="text-gray-500">إجمالي المطالبات / Total:</span>
              <span className="font-mono font-bold text-primary">{formatCurrency(totalAmount, currency)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Verification Card */}
      <div className="my-4 p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xs font-black text-gray-900">كشف فواتير ومطالبات مالية مجمعة</h2>
          <p className="text-[10px] text-gray-600 mt-0.5">
            يتضمن هذا المستند جميع الفواتير المحددة أدناه بإجمالي {invoices.length} بند خدمات واشتراكات.
          </p>
        </div>
        {qrDataUrl && (
          <img src={qrDataUrl} alt="Statement QR" className="w-14 h-14 object-contain rounded border border-gray-200" />
        )}
      </div>

      {/* Line Items Table with All Invoices */}
      <div className="border border-gray-200 rounded-lg overflow-x-auto my-4">
        <table className="w-full border-collapse text-start text-[10px]">
          <thead>
            <tr className="bg-gray-100/80 text-gray-800 font-bold border-b border-gray-200">
              <th className="py-2 px-2 text-center w-8">#</th>
              <th className="py-2 px-3 text-start w-28">رقم الفاتورة<br /><span className="text-[8px] font-normal text-gray-500">Invoice No</span></th>
              <th className="py-2 px-3 text-start">المشترك / الطالب<br /><span className="text-[8px] font-normal text-gray-500">Student Name</span></th>
              <th className="py-2 px-3 text-start">بيان الخدمة / الباقة<br /><span className="text-[8px] font-normal text-gray-500">Description / Plan</span></th>
              <th className="py-2 px-3 text-center w-20">الاستحقاق<br /><span className="text-[8px] font-normal text-gray-500">Due Date</span></th>
              <th className="py-2 px-3 text-center w-16">الحالة<br /><span className="text-[8px] font-normal text-gray-500">Status</span></th>
              <th className="py-2 px-3 text-end w-24">المبلغ<br /><span className="text-[8px] font-normal text-gray-500">Amount ({currency})</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.map((inv, idx) => {
              const plan = inv.plan_name || inv.notes || "اشتراك خدمات رياضية";
              return (
                <tr key={inv.id} className="hover:bg-gray-50/50">
                  <td className="py-2 px-2 text-center font-bold text-gray-500">{idx + 1}</td>
                  <td className="py-2 px-3 font-mono font-bold text-gray-900">{inv.invoice_number}</td>
                  <td className="py-2 px-3">
                    <span className="font-bold text-gray-900">{inv.student_name}</span>
                    {inv.student_number && (
                      <span className="block text-[8px] text-gray-500 font-mono">#{inv.student_number}</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <span className="font-medium text-gray-800">{plan}</span>
                    {inv.notes && inv.plan_name && (
                      <span className="block text-[8px] text-gray-500 line-clamp-1">{inv.notes}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center font-mono text-gray-600">
                    {formatDate(inv.due_date)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {(() => {
                      const isPaid = inv.status === "paid" || (Number(inv.amount_due ?? 0) <= 0 && Number(inv.total_amount ?? 0) > 0);
                      const isPartial = inv.status === "partially_paid" || (Number(inv.amount_paid ?? 0) > 0 && Number(inv.amount_due ?? 0) > 0);
                      const isOverdue = inv.status === "overdue" || Boolean(inv.is_overdue);
                      const isVoid = inv.status === "void";
                      const isRefunded = inv.status === "refunded";

                      if (isPaid) {
                        return (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            مدفوعة
                          </span>
                        );
                      }
                      if (isPartial) {
                        return (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            مدفوعة جزئياً
                          </span>
                        );
                      }
                      if (isOverdue) {
                        return (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-50 text-red-700 border border-red-200">
                            متأخرة
                          </span>
                        );
                      }
                      if (isRefunded) {
                        return (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            مستردة
                          </span>
                        );
                      }
                      if (isVoid) {
                        return (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                            ملغاة
                          </span>
                        );
                      }
                      return (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          معلقة
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-2 px-3 text-end font-mono font-bold text-gray-900">
                    {formatCurrency(inv.total_amount, inv.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
        {/* Left: Club Terms */}
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-1">
          <p className="text-[9px] font-black text-gray-700 uppercase">ملاحظات واعتماد الكشف</p>
          <p className="text-[9px] text-gray-600 leading-normal">
            كشف حساب مالي صادر من النظام الآلي ومطابق للقيود المحاسبية.
          </p>
          <p className="text-[8px] text-gray-500">
            إجمالي عدد الفواتير المدرجة: <strong>{invoices.length}</strong> فاتورة.
          </p>
        </div>

        {/* Right: Totals */}
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-1.5 text-[10px]">
          <div className="flex justify-between items-center text-gray-600">
            <span>المجموع الفرعي / Subtotal:</span>
            <span className="font-mono font-bold">{formatCurrency(totalSubtotal, currency)}</span>
          </div>
          {totalTax > 0 && (
            <div className="flex justify-between items-center text-gray-600">
              <span>إجمالي الضريبة / Total VAT:</span>
              <span className="font-mono font-bold">{formatCurrency(totalTax, currency)}</span>
            </div>
          )}
          <div className="border-t border-gray-300 pt-1 flex justify-between items-center text-xs font-black text-gray-900">
            <span>الإجمالي الكلي / Grand Total:</span>
            <span className="font-mono text-primary text-sm font-black">{formatCurrency(totalAmount, currency)}</span>
          </div>
          {totalPaid > 0 && (
            <div className="flex justify-between items-center text-emerald-700 font-bold">
              <span>إجمالي المسدد / Paid:</span>
              <span className="font-mono">{formatCurrency(totalPaid, currency)}</span>
            </div>
          )}
          {totalDue > 0 && (
            <div className="flex justify-between items-center text-amber-700 font-bold border-t border-gray-200 pt-1">
              <span>المتبقي المستحق / Balance Due:</span>
              <span className="font-mono">{formatCurrency(totalDue, currency)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Signatures & Stamp */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 text-center">
        <div className="border border-gray-200 rounded-lg p-2 flex flex-col items-center justify-between min-h-[90px]">
          <span className="text-[9px] font-bold text-gray-700">توقيع المسؤول المالي المعتمد</span>
          <div className="h-10 flex items-center justify-center">
            {club?.signature ? (
              <img src={club.signature} alt="Signature" className="max-h-10 object-contain mix-blend-multiply" />
            ) : (
              <div className="w-28 border-b border-gray-400 mt-4" />
            )}
          </div>
          <span className="text-[8px] text-gray-400">Authorized Signature</span>
        </div>

        <div className="border border-gray-200 rounded-lg p-2 flex flex-col items-center justify-between min-h-[90px]">
          <span className="text-[9px] font-bold text-gray-700">ختم النادي الرسمي</span>
          <div className="h-10 flex items-center justify-center">
            {club?.stamp ? (
              <img src={club.stamp} alt="Stamp" className="max-h-10 object-contain -rotate-3 mix-blend-multiply" />
            ) : (
              <div className="w-12 h-12 rounded-full border border-dashed border-gray-400 flex items-center justify-center text-[7px] text-gray-400">
                ختم الإدارة
              </div>
            )}
          </div>
          <span className="text-[8px] text-gray-400">OFFICIAL STAMP</span>
        </div>
      </div>
    </div>
  );
}
