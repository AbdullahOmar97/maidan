"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Invoice, InvoiceClubInfo } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";

interface InvoiceDocumentProps {
  invoice: Invoice;
  clubInfo?: InvoiceClubInfo | null;
  taxNumber?: string;
  crNumber?: string;
  clubAddress?: string;
}

export function InvoiceDocument({
  invoice,
  clubInfo,
  taxNumber = "300000000000003",
  crNumber = "",
  clubAddress,
}: InvoiceDocumentProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const club = invoice.club_info || clubInfo;
  const clubName = club?.name || "نادي ميدان الرياضي";
  const clubBusinessName = club?.business_name || "MAIDAN SPORTS CLUB";
  const address = clubAddress || club?.address || invoice.location_name || "المملكة العربية السعودية";
  const phone = club?.phone || "";
  const email = club?.email || "";

  useEffect(() => {
    const payload = [
      `Seller: ${clubName}`,
      taxNumber ? `VAT: ${taxNumber}` : "",
      `Date: ${invoice.created_at || invoice.due_date}`,
      `Invoice: ${invoice.invoice_number}`,
      `Total: ${invoice.total_amount} ${invoice.currency}`,
      `Tax: ${invoice.tax_amount || 0} ${invoice.currency}`,
    ].filter(Boolean).join("\n");

    QRCode.toDataURL(payload, {
      width: 140,
      margin: 1,
      color: { dark: "#111827", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch((e: unknown) => console.error("Error generating QR:", e));
  }, [invoice, clubName, taxNumber]);

  const isPaid = invoice.status === "paid";
  const isPartiallyPaid = invoice.status === "partially_paid";
  const isOverdue = invoice.status === "overdue" || invoice.is_overdue;
  const isVoid = invoice.status === "void";
  const isRefunded = invoice.status === "refunded";

  let statusClass = "bg-amber-50 text-amber-900 border-amber-300";
  let statusTextAr = "معلقة";
  let statusTextEn = "PENDING";

  if (isPaid) {
    statusClass = "bg-emerald-50 text-emerald-900 border-emerald-300";
    statusTextAr = "مدفوعة بالكامل";
    statusTextEn = "PAID IN FULL";
  } else if (isPartiallyPaid) {
    statusClass = "bg-blue-50 text-blue-900 border-blue-300";
    statusTextAr = "مسددة جزئياً";
    statusTextEn = "PARTIALLY PAID";
  } else if (isOverdue) {
    statusClass = "bg-red-50 text-red-900 border-red-300";
    statusTextAr = "متأخرة";
    statusTextEn = "OVERDUE";
  } else if (isVoid) {
    statusClass = "bg-pink-50 text-pink-900 border-pink-300";
    statusTextAr = "ملغاة";
    statusTextEn = "VOID";
  } else if (isRefunded) {
    statusClass = "bg-orange-50 text-orange-900 border-orange-300";
    statusTextAr = "مستردة";
    statusTextEn = "REFUNDED";
  }

  const membershipPlan = invoice.plan_name || invoice.membership_details?.plan_name || "اشتراك خدمات رياضية";
  const cycle = invoice.membership_details?.billing_cycle || "";
  const startDate = invoice.membership_details?.start_date ? formatDate(invoice.membership_details.start_date) : null;
  const endDate = invoice.membership_details?.end_date ? formatDate(invoice.membership_details.end_date) : null;
  const periodText = startDate && endDate ? `الفترة: من ${startDate} إلى ${endDate}` : "";

  return (
    <div className="relative bg-white text-gray-900 font-sans p-6 sm:p-8 rounded-xl border border-gray-200 shadow-sm max-w-4xl mx-auto text-xs leading-relaxed select-text print:border-none print:shadow-none print:p-0">
      {/* Watermarks */}
      {isVoid && (
        <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 border-4 border-dashed border-red-500 text-red-600 font-black text-3xl sm:text-5xl px-8 py-3 rounded-2xl opacity-20 pointer-events-none select-none">
          ملغاة — VOID
        </div>
      )}
      {isRefunded && (
        <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 border-4 border-dashed border-amber-500 text-amber-600 font-black text-3xl sm:text-5xl px-8 py-3 rounded-2xl opacity-20 pointer-events-none select-none">
          مستردة — REFUNDED
        </div>
      )}

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
          <div className="inline-flex flex-col items-end bg-gray-900 text-white px-3 py-1.5 rounded-lg mb-2">
            <span className="text-xs font-black">فاتورة ضريبية</span>
            <span className="text-[9px] font-bold tracking-widest text-gray-300">TAX INVOICE</span>
          </div>
          <div className="space-y-0.5 text-[10px]">
            <div className="flex justify-between sm:justify-end gap-2">
              <span className="text-gray-500">رقم الفاتورة / No:</span>
              <span className="font-mono font-bold text-gray-900">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between sm:justify-end gap-2">
              <span className="text-gray-500">تاريخ الإصدار / Date:</span>
              <span className="text-gray-900">{formatDate(invoice.created_at)}</span>
            </div>
            <div className="flex justify-between sm:justify-end gap-2">
              <span className="text-gray-500">تاريخ الاستحقاق / Due:</span>
              <span className="text-gray-900">{formatDate(invoice.due_date)}</span>
            </div>
            {invoice.paid_at && (
              <div className="flex justify-between sm:justify-end gap-2">
                <span className="text-gray-500">تاريخ السداد / Paid:</span>
                <span className="text-gray-900">{formatDate(invoice.paid_at)}</span>
              </div>
            )}
          </div>
          <div className="mt-2 text-end">
            <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black tracking-wider border ${statusClass}`}>
              {statusTextAr} • {statusTextEn}
            </span>
          </div>
        </div>
      </header>

      {/* Parties Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-4">
        {/* Customer / Student */}
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50/50">
          <div className="bg-gray-100/80 px-3 py-1.5 text-[10px] font-black uppercase text-gray-700 border-b border-gray-200">
            العميل / المشترك (Bill To)
          </div>
          <div className="p-3 space-y-1">
            <h2 className="text-sm font-black text-gray-900">{invoice.student_name}</h2>
            {invoice.student_number && (
              <p className="text-[10px] text-gray-600">رقم العضوية: <strong>{invoice.student_number}</strong></p>
            )}
            {invoice.student_phone && (
              <p className="text-[10px] text-gray-600">الهاتف: <bdi>{invoice.student_phone}</bdi></p>
            )}
            {invoice.student_email && (
              <p className="text-[10px] text-gray-600">البريد: {invoice.student_email}</p>
            )}
            {invoice.location_name && (
              <p className="text-[10px] text-gray-600">الفرع: {invoice.location_name}</p>
            )}
          </div>
        </div>

        {/* Verification QR */}
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50/50 flex flex-col justify-between">
          <div className="bg-gray-100/80 px-3 py-1.5 text-[10px] font-black uppercase text-gray-700 border-b border-gray-200">
            التحقق الإلكتروني (E-Invoice QR)
          </div>
          <div className="p-3 flex items-center gap-3">
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR Code" className="w-16 h-16 rounded border border-gray-200 shrink-0" />
            )}
            <div className="text-[9px] text-gray-600 leading-snug">
              <p className="font-semibold text-gray-800 mb-1">فاتورة رسمية صادرة وموثقة إلكترونياً.</p>
              {invoice.created_by_name && <p>المحرر: {invoice.created_by_name}</p>}
              {invoice.paid_by_name && <p>مستلم الدفع: {invoice.paid_by_name}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="border border-gray-200 rounded-lg overflow-x-auto my-4">
        <table className="w-full border-collapse text-start text-[10px]">
          <thead>
            <tr className="bg-gray-100/80 text-gray-800 font-bold border-b border-gray-200">
              <th className="py-2 px-3 text-center w-8">#</th>
              <th className="py-2 px-3 text-start">بيان الخدمة / Description</th>
              <th className="py-2 px-3 text-center w-12">الكمية<br /><span className="text-[8px] font-normal text-gray-500">Qty</span></th>
              <th className="py-2 px-3 text-end w-20">سعر الوحدة<br /><span className="text-[8px] font-normal text-gray-500">Price</span></th>
              <th className="py-2 px-3 text-end w-20">الخصم<br /><span className="text-[8px] font-normal text-gray-500">Discount</span></th>
              <th className="py-2 px-3 text-end w-20">الضريبة<br /><span className="text-[8px] font-normal text-gray-500">VAT ({invoice.tax_rate || 0}%)</span></th>
              <th className="py-2 px-3 text-end w-24">المجموع<br /><span className="text-[8px] font-normal text-gray-500">Total ({invoice.currency})</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2.5 px-3 text-center font-bold text-gray-500">1</td>
              <td className="py-2.5 px-3">
                <div className="font-black text-gray-900 text-[11px]">{membershipPlan}</div>
                {periodText && <div className="text-[9px] text-gray-600">{periodText}</div>}
                {cycle && <div className="text-[9px] text-gray-500">النوع: {cycle}</div>}
                {invoice.notes && <div className="text-[9px] text-gray-600 italic mt-0.5">{invoice.notes}</div>}
              </td>
              <td className="py-2.5 px-3 text-center font-bold">1</td>
              <td className="py-2.5 px-3 text-end font-mono">{formatCurrency(invoice.subtotal, invoice.currency)}</td>
              <td className="py-2.5 px-3 text-end font-mono text-red-600">
                {invoice.discount_amount > 0 ? `-${formatCurrency(invoice.discount_amount, invoice.currency)}` : "0.00"}
              </td>
              <td className="py-2.5 px-3 text-end font-mono">{formatCurrency(invoice.tax_amount || 0, invoice.currency)}</td>
              <td className="py-2.5 px-3 text-end font-mono font-bold text-gray-900">
                {formatCurrency(invoice.total_amount, invoice.currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
        {/* Left: Notes & Transactions */}
        <div className="space-y-3">
          {invoice.payments && invoice.payments.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-100/80 px-2.5 py-1 text-[9px] font-black text-gray-700 border-b border-gray-200">
                سجل الدفعات المستلمة (Payments)
              </div>
              <div className="p-2 space-y-1">
                {invoice.payments.map((p) => (
                  <div key={p.id} className="flex justify-between items-center text-[9px] border-b border-gray-100 last:border-0 pb-1">
                    <div>
                      <span className="font-bold text-gray-800">{p.provider}</span>
                      {p.paid_at && <span className="text-gray-500 text-[8px] ms-1">({formatDate(p.paid_at)})</span>}
                    </div>
                    <span className="font-mono font-bold text-emerald-700">{formatCurrency(p.amount, p.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invoice.credit_notes && invoice.credit_notes.length > 0 && (
            <div className="border border-amber-200 bg-amber-50/40 rounded-lg p-2 text-[9px]">
              <div className="font-black text-amber-900 mb-1">إشعارات دائنة صادرة (Credit Notes):</div>
              {invoice.credit_notes.map((cn) => (
                <div key={cn.id} className="flex justify-between items-center text-amber-800">
                  <span>{cn.credit_note_number} ({cn.reason})</span>
                  <span className="font-mono font-bold">{formatCurrency(cn.amount, cn.currency)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-2.5 border border-dashed border-gray-200 text-[9px] text-gray-600 space-y-1">
            <p className="font-bold text-gray-800">شروط وأحكام الفاتورة:</p>
            <p>• تعتبر هذه الفاتورة مستنداً محاسبياً رسمياً معتمداً من إدارة النادي.</p>
            <p>• الرسوم خاضعة للوائح النادي والاشتراكات المقررة نظاماً.</p>
          </div>
        </div>

        {/* Right: Financial Totals */}
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50/50">
          <div className="divide-y divide-gray-100 text-[10px]">
            <div className="flex justify-between px-3 py-1.5 text-gray-600">
              <span>المبلغ الخاضع للضريبة / Subtotal:</span>
              <span className="font-mono font-bold text-gray-900">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between px-3 py-1.5 text-red-600">
                <span>إجمالي الخصم / Discount:</span>
                <span className="font-mono font-bold">-{formatCurrency(invoice.discount_amount, invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between px-3 py-1.5 text-gray-600">
              <span>ضريبة القيمة المضافة / VAT ({invoice.tax_rate || 0}%):</span>
              <span className="font-mono font-bold text-gray-900">{formatCurrency(invoice.tax_amount || 0, invoice.currency)}</span>
            </div>
            <div className="flex justify-between px-3 py-2 bg-gray-100/80 font-black text-xs border-y-2 border-gray-900">
              <span>المجموع الإجمالي / Grand Total:</span>
              <span className="font-mono text-sm text-gray-900">{formatCurrency(invoice.total_amount, invoice.currency)}</span>
            </div>
            {invoice.amount_paid > 0 && (
              <div className="flex justify-between px-3 py-1.5 text-emerald-700 bg-emerald-50/50">
                <span>المبلغ المدفوع / Amount Paid:</span>
                <span className="font-mono font-bold">{formatCurrency(invoice.amount_paid, invoice.currency)}</span>
              </div>
            )}
            <div className={`flex justify-between px-3 py-2 font-black text-xs ${invoice.amount_due > 0 ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-700"}`}>
              <span>المبلغ المستحق / Balance Due:</span>
              <span className="font-mono text-sm">{formatCurrency(invoice.amount_due, invoice.currency)}</span>
            </div>
          </div>

          {/* Stamp & Signature block */}
          <div className="p-3 border-t border-gray-200 grid grid-cols-2 gap-3 text-center text-[9px] text-gray-500">
            <div>
              <p className="font-bold text-gray-700">توقيع المسؤول المعتمد</p>
              <div className="h-12 flex items-center justify-center my-1 relative">
                {club?.signature ? (
                  <img
                    src={club.signature}
                    alt="Authorized Signature"
                    className="max-h-11 max-w-full object-contain mix-blend-multiply"
                  />
                ) : (
                  <div className="border-b border-gray-300 w-3/4 mx-auto mt-6" />
                )}
              </div>
              <p className="text-[8px] text-gray-400">Authorized Sign</p>
            </div>
            <div>
              <p className="font-bold text-gray-700">ختم النادي الرسمي</p>
              <div className="h-12 flex items-center justify-center my-1 relative">
                {club?.stamp ? (
                  <img
                    src={club.stamp}
                    alt="Official Stamp"
                    className="max-h-12 max-w-full object-contain -rotate-3 mix-blend-multiply"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full border border-dashed border-gray-300 flex items-center justify-center mx-auto text-[7px] text-gray-400 font-bold">
                    ختم الإدارة
                  </div>
                )}
              </div>
              <p className="text-[8px] text-gray-400">Official Stamp</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="pt-3 border-t border-gray-200 flex justify-between text-[9px] text-gray-400">
        <div>MAIDAN Sports Club Management Platform — نظام ميدان لإدارة الأندية</div>
        <div>مستند رسمي صادر إلكترونياً</div>
      </footer>
    </div>
  );
}
