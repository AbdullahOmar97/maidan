/**
 * MAIDAN — International-Standard Invoice Print & PDF Generation Engine
 * 
 * Provides self-contained, high-fidelity A4 document formatting with bilingual
 * labels (Arabic / English), ZATCA/e-invoicing verification QR code, official stamps,
 * watermark support, and seamless multi-invoice batch printing.
 */

import QRCode from "qrcode";
import type { Invoice, InvoiceClubInfo } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface InvoicePrintOptions {
  clubInfo?: InvoiceClubInfo | null;
  taxNumber?: string;
  crNumber?: string;
  clubAddress?: string;
}

/**
 * Generate standard ZATCA / Tax verification payload for QR code.
 */
function buildQrPayload(invoice: Invoice, clubName: string, taxNumber: string): string {
  const parts = [
    `Seller: ${clubName}`,
    taxNumber ? `VAT: ${taxNumber}` : "",
    `Date: ${invoice.created_at || invoice.due_date}`,
    `Invoice: ${invoice.invoice_number}`,
    `Total: ${invoice.total_amount} ${invoice.currency}`,
    `Tax: ${invoice.tax_amount || 0} ${invoice.currency}`,
  ].filter(Boolean);
  return parts.join("\n");
}

/**
 * Render single invoice HTML structure.
 */
async function renderSingleInvoiceHtml(
  invoice: Invoice,
  options: InvoicePrintOptions = {},
  pageIndex: number,
  totalPages: number
): Promise<string> {
  const club = invoice.club_info || options.clubInfo;
  const clubName = club?.name || "نادي ميدان الرياضي";
  const clubBusinessName = club?.business_name || "MAIDAN SPORTS CLUB";
  const taxNumber = options.taxNumber || club?.tax_number || "300000000000003";
  const crNumber = options.crNumber || club?.cr_number || "";
  const phone = club?.phone || "";
  const email = club?.email || "";
  const address = options.clubAddress || club?.address || invoice.location_name || "المملكة العربية السعودية";

  // Build QR code data URL
  let qrDataUrl = "";
  try {
    const qrPayload = buildQrPayload(invoice, clubName, taxNumber);
    qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 140,
      margin: 1,
      color: { dark: "#111827", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  } catch (err) {
    console.error("Failed to generate invoice QR:", err);
  }

  // Status-dependent styling and badges
  const isPaid = invoice.status === "paid";
  const isPartiallyPaid = invoice.status === "partially_paid";
  const isOverdue = invoice.status === "overdue" || invoice.is_overdue;
  const isVoid = invoice.status === "void";
  const isRefunded = invoice.status === "refunded";

  let statusBadgeClass = "badge-pending";
  let statusBadgeTextAr = "معلقة";
  let statusBadgeTextEn = "PENDING";

  if (isPaid) {
    statusBadgeClass = "badge-paid";
    statusBadgeTextAr = "مدفوعة بالكامل";
    statusBadgeTextEn = "PAID IN FULL";
  } else if (isPartiallyPaid) {
    statusBadgeClass = "badge-partial";
    statusBadgeTextAr = "مسددة جزئياً";
    statusBadgeTextEn = "PARTIALLY PAID";
  } else if (isOverdue) {
    statusBadgeClass = "badge-overdue";
    statusBadgeTextAr = "متأخرة";
    statusBadgeTextEn = "OVERDUE";
  } else if (isVoid) {
    statusBadgeClass = "badge-void";
    statusBadgeTextAr = "ملغاة";
    statusBadgeTextEn = "VOID";
  } else if (isRefunded) {
    statusBadgeClass = "badge-refunded";
    statusBadgeTextAr = "مستردة";
    statusBadgeTextEn = "REFUNDED";
  }

  const membershipPlan = invoice.plan_name || invoice.membership_details?.plan_name || "اشتراك خدمات رياضية";
  const cycle = invoice.membership_details?.billing_cycle || "";
  const startDate = invoice.membership_details?.start_date ? formatDate(invoice.membership_details.start_date) : null;
  const endDate = invoice.membership_details?.end_date ? formatDate(invoice.membership_details.end_date) : null;
  const periodText = startDate && endDate ? `الفترة: من ${startDate} إلى ${endDate}` : "";

  return `
    <div class="invoice-sheet">
      <div class="invoice-page">
        ${isVoid ? `<div class="watermark watermark-void">ملغاة — VOID</div>` : ""}
        ${isRefunded ? `<div class="watermark watermark-refunded">مستردة — REFUNDED</div>` : ""}

      <!-- Header -->
      <header class="invoice-header">
        <div class="header-brand">
          ${club?.logo ? `<img src="${club.logo}" alt="Logo" class="club-logo" />` : `<div class="club-logo-placeholder">MAIDAN</div>`}
          <div>
            <h1 class="club-title">${clubName}</h1>
            <p class="club-subtitle">${clubBusinessName}</p>
            <div class="club-meta">
              ${taxNumber ? `<span>الرقم الضريبي / VAT: <strong>${taxNumber}</strong></span>` : ""}
              ${crNumber ? `<span>السجل التجاري / CR: <strong>${crNumber}</strong></span>` : ""}
              ${address ? `<span>العنوان: ${address}</span>` : ""}
              ${phone ? `<span>هاتف: ${phone}</span>` : ""}
              ${email ? `<span>بريد: ${email}</span>` : ""}
            </div>
          </div>
        </div>

        <div class="header-doc-info">
          <div class="doc-badge">
            <span class="doc-badge-ar">فاتورة ضريبية</span>
            <span class="doc-badge-en">TAX INVOICE</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">رقم الفاتورة / No:</span>
            <span class="meta-value mono font-bold">${invoice.invoice_number}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">تاريخ الإصدار / Date:</span>
            <span class="meta-value">${formatDate(invoice.created_at)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">تاريخ الاستحقاق / Due:</span>
            <span class="meta-value">${formatDate(invoice.due_date)}</span>
          </div>
          ${invoice.paid_at ? `
          <div class="meta-row">
            <span class="meta-label">تاريخ السداد / Paid At:</span>
            <span class="meta-value">${formatDate(invoice.paid_at)}</span>
          </div>` : ""}
          <div class="meta-row mt-2">
            <span class="status-pill ${statusBadgeClass}">
              ${statusBadgeTextAr} • ${statusBadgeTextEn}
            </span>
          </div>
        </div>
      </header>

      <!-- Parties Divider Grid -->
      <div class="parties-grid">
        <!-- Customer / Student -->
        <div class="party-card">
          <div class="party-card-title">
            <span>العميل / المشترك (Bill To)</span>
          </div>
          <div class="party-card-body">
            <h2 class="student-name">${invoice.student_name}</h2>
            ${invoice.student_number ? `<p class="party-item">رقم العضوية / ID: <strong>${invoice.student_number}</strong></p>` : ""}
            ${invoice.student_phone ? `<p class="party-item">رقم الهاتف / Phone: <bdi>${invoice.student_phone}</bdi></p>` : ""}
            ${invoice.student_email ? `<p class="party-item">البريد / Email: ${invoice.student_email}</p>` : ""}
            ${invoice.location_name ? `<p class="party-item">الفرع / Branch: ${invoice.location_name}</p>` : ""}
          </div>
        </div>

        <!-- Verification QR & Audit -->
        <div class="party-card qr-card">
          <div class="party-card-title">
            <span>التحقق الإلكتروني (E-Invoice QR)</span>
          </div>
          <div class="qr-body">
            ${qrDataUrl ? `<img src="${qrDataUrl}" alt="Invoice QR" class="qr-img" />` : ""}
            <div class="qr-details">
              <p class="qr-note">فاتورة رسمية صادرة وموثقة إلكترونياً طبقاً للمواصفات القياسية.</p>
              ${invoice.created_by_name ? `<p class="audit-item">المحرر: ${invoice.created_by_name}</p>` : ""}
              ${invoice.paid_by_name ? `<p class="audit-item">مستلم الدفع: ${invoice.paid_by_name}</p>` : ""}
            </div>
          </div>
        </div>
      </div>

      <!-- Line Items Table -->
      <div class="table-wrapper">
        <table class="items-table">
          <thead>
            <tr>
              <th class="th-num">#</th>
              <th class="th-desc">بيان الخدمة / Description</th>
              <th class="th-qty">الكمية<br><small>Qty</small></th>
              <th class="th-price">سعر الوحدة<br><small>Unit Price</small></th>
              <th class="th-discount">الخصم<br><small>Discount</small></th>
              <th class="th-tax">الضريبة<br><small>VAT (${invoice.tax_rate || 0}%)</small></th>
              <th class="th-total">المجموع<br><small>Total (${invoice.currency})</small></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="td-num">1</td>
              <td class="td-desc">
                <div class="item-title">${membershipPlan}</div>
                ${periodText ? `<div class="item-sub">${periodText}</div>` : ""}
                ${cycle ? `<div class="item-sub">نوع الاشتراك: ${cycle}</div>` : ""}
                ${invoice.notes ? `<div class="item-notes">${invoice.notes}</div>` : ""}
              </td>
              <td class="td-qty">1</td>
              <td class="td-price mono">${formatCurrency(invoice.subtotal, invoice.currency)}</td>
              <td class="td-discount mono">${invoice.discount_amount > 0 ? `-${formatCurrency(invoice.discount_amount, invoice.currency)}` : "0.00"}</td>
              <td class="td-tax mono">${formatCurrency(invoice.tax_amount || 0, invoice.currency)}</td>
              <td class="td-total mono font-bold">${formatCurrency(invoice.total_amount, invoice.currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Totals & Payment Breakdown -->
      <div class="summary-section">
        <!-- Notes & Payment History -->
        <div class="summary-left">
          ${invoice.payments && invoice.payments.length > 0 ? `
          <div class="payments-box">
            <h3 class="payments-box-title">سجل المدفوعات المستلمة (Payment History)</h3>
            <table class="payments-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>طريقة الدفع</th>
                  <th>المرجع</th>
                  <th class="text-end">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.payments.map((p) => `
                <tr>
                  <td>${p.paid_at ? formatDate(p.paid_at) : "-"}</td>
                  <td>${p.provider}</td>
                  <td class="mono font-xs">${p.provider_transaction_id || "-"}</td>
                  <td class="mono text-end font-bold">${formatCurrency(p.amount, p.currency)}</td>
                </tr>`).join("")}
              </tbody>
            </table>
          </div>` : ""}

          ${invoice.credit_notes && invoice.credit_notes.length > 0 ? `
          <div class="payments-box credit-box">
            <h3 class="payments-box-title">الإشعارات الدائنة المرتبطة (Credit Notes)</h3>
            <div class="credit-list">
              ${invoice.credit_notes.map((cn) => `
              <div class="credit-item">
                <div>
                  <strong class="mono text-amber">${cn.credit_note_number}</strong> — ${cn.reason_display || cn.reason}
                  <small class="block text-muted">${formatDate(cn.issued_at)}</small>
                </div>
                <div class="mono font-bold text-amber">${formatCurrency(cn.amount, cn.currency)}</div>
              </div>`).join("")}
            </div>
          </div>` : ""}

          <div class="terms-box">
            <p class="terms-title">شروط وأحكام النادي:</p>
            <ul class="terms-list">
              <li>المبالغ المدفوعة خاضعة للوائح النادي والاشتراكات المعتمدة.</li>
              <li>يرجى إبراز بطاقة العضوية أو الرمز الشريطي QR عند بوابات الدخول.</li>
              <li>هذه الفاتورة مستند رسمي محوسب ولا تحتاج إلى توقيع ورقي.</li>
            </ul>
          </div>
        </div>

        <!-- Financial Summary Totals -->
        <div class="summary-right">
          <div class="totals-table">
            <div class="total-row">
              <span class="total-label">المبلغ الخاضع للضريبة / Subtotal:</span>
              <span class="total-val mono">${formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            ${invoice.discount_amount > 0 ? `
            <div class="total-row discount-row">
              <span class="total-label">إجمالي الخصم / Discount:</span>
              <span class="total-val mono">-${formatCurrency(invoice.discount_amount, invoice.currency)}</span>
            </div>` : ""}
            <div class="total-row">
              <span class="total-label">ضريبة القيمة المضافة / VAT (${invoice.tax_rate || 0}%):</span>
              <span class="total-val mono">${formatCurrency(invoice.tax_amount || 0, invoice.currency)}</span>
            </div>
            <div class="total-row grand-total-row">
              <span class="total-label font-bold">المجموع الإجمالي / Grand Total:</span>
              <span class="total-val mono font-black text-lg">${formatCurrency(invoice.total_amount, invoice.currency)}</span>
            </div>
            ${invoice.amount_paid > 0 ? `
            <div class="total-row paid-row">
              <span class="total-label">المبلغ المدفوع / Amount Paid:</span>
              <span class="total-val mono font-bold text-success">${formatCurrency(invoice.amount_paid, invoice.currency)}</span>
            </div>` : ""}
            <div class="total-row balance-row ${invoice.amount_due > 0 ? 'has-balance' : 'zero-balance'}">
              <span class="total-label font-bold">المبلغ المستحق / Balance Due:</span>
              <span class="total-val mono font-black text-lg">${formatCurrency(invoice.amount_due, invoice.currency)}</span>
            </div>
          </div>

          <!-- Signatures & Official Stamp -->
          <div class="signatures-box">
            <div class="sig-block">
              <span class="sig-title">توقيع المسؤول المعتمد</span>
              <div class="sig-content">
                ${club?.signature ? `<img src="${club.signature}" class="sig-img" alt="Authorized Signature" />` : `<div class="sig-line"></div>`}
              </div>
              <span class="sig-sub">Authorized Signature</span>
            </div>
            <div class="sig-block">
              <span class="sig-title">ختم النادي الرسمي</span>
              <div class="stamp-content">
                ${club?.stamp ? `<img src="${club.stamp}" class="stamp-img" alt="Official Stamp" />` : `
                  <div class="stamp-placeholder">
                    <span>ختم الإدارة<br>OFFICIAL STAMP</span>
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Bar -->
      <footer class="invoice-footer">
        <div>MAIDAN Cloud Management Platform — نظام ميدان لإدارة الأندية الرياضية</div>
        <div>صفحة ${pageIndex} من ${totalPages}</div>
      </footer>
    </div>
  </div>
  `;
}

/**
 * Return CSS stylesheet for pristine A4 international invoice printing.
 */
function getInvoiceStyles(): string {
  return `
    @charset "UTF-8";
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", "Tahoma", sans-serif;
      direction: rtl;
      text-align: start;
      color: #111827;
      background: #ffffff;
      line-height: 1.45;
      font-size: 11px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      letter-spacing: -0.02em;
    }
    .font-bold { font-weight: 700; }
    .font-black { font-weight: 900; }
    .text-lg { font-size: 14px; }
    .text-end { text-align: end; }
    .text-muted { color: #6b7280; }
    .text-amber { color: #b45309; }
    .text-success { color: #047857; }
    .block { display: block; }
    .mt-2 { margin-top: 6px; }

    /* Print Sheets & Multi-page Break Isolation */
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      height: auto !important;
      min-height: 100% !important;
      overflow: visible !important;
      position: static !important;
    }

    @media print {
      html, body {
        height: auto !important;
        overflow: visible !important;
        position: static !important;
      }
    }

    .invoice-sheet {
      display: block !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      box-sizing: border-box !important;
      page-break-before: auto !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      margin: 0 0 10mm 0 !important;
      padding: 0 !important;
    }
    .invoice-sheet:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
      margin-bottom: 0 !important;
    }

    @media print {
      .invoice-sheet {
        margin: 0 !important;
        page-break-after: always !important;
        break-after: page !important;
      }
      .invoice-sheet:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
    }

    /* Page container */
    .invoice-page {
      position: relative;
      background: #ffffff;
      padding: 0;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* Watermarks */
    .watermark {
      position: absolute;
      top: 45%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 54px;
      font-weight: 900;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 12px 40px;
      border: 6px dashed;
      border-radius: 16px;
      pointer-events: none;
      z-index: 50;
      opacity: 0.22;
    }
    .watermark-void { color: #dc2626; border-color: #dc2626; }
    .watermark-refunded { color: #d97706; border-color: #d97706; }

    /* Header */
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      padding-bottom: 14px;
      border-bottom: 2px solid #111827;
      margin-bottom: 14px;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .club-logo {
      width: 70px;
      height: 70px;
      object-fit: contain;
      border-radius: 8px;
    }
    .club-logo-placeholder {
      width: 70px;
      height: 70px;
      border-radius: 10px;
      background: #111827;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 13px;
      letter-spacing: 1px;
    }
    .club-title {
      font-size: 18px;
      font-weight: 900;
      color: #111827;
      line-height: 1.2;
    }
    .club-subtitle {
      font-size: 11px;
      font-weight: 700;
      color: #4b5563;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .club-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: 4px;
      font-size: 10px;
      color: #4b5563;
    }

    .header-doc-info {
      text-align: end;
      min-width: 220px;
    }
    .doc-badge {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-end;
      background: #111827;
      color: #ffffff;
      padding: 6px 12px;
      border-radius: 6px;
      margin-bottom: 8px;
    }
    .doc-badge-ar {
      font-size: 13px;
      font-weight: 900;
    }
    .doc-badge-en {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.1em;
      opacity: 0.85;
    }
    .meta-row {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      font-size: 10px;
      line-height: 1.5;
    }
    .meta-label { color: #6b7280; font-weight: 600; }
    .meta-value { color: #111827; }

    .status-pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.05em;
      border: 1px solid;
    }
    .badge-paid { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
    .badge-partial { background: #eff6ff; color: #1e40af; border-color: #bfdbfe; }
    .badge-pending { background: #fffbeb; color: #92400e; border-color: #fde68a; }
    .badge-overdue { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
    .badge-void { background: #fdf2f8; color: #9d174d; border-color: #fbcfe8; }
    .badge-refunded { background: #fff7ed; color: #9a3412; border-color: #fed7aa; }

    /* Parties Section */
    .parties-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 14px;
      margin-bottom: 14px;
    }
    .party-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      background: #fafafa;
    }
    .party-card-title {
      background: #f3f4f6;
      padding: 5px 10px;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      color: #374151;
      border-bottom: 1px solid #e5e7eb;
    }
    .party-card-body {
      padding: 8px 10px;
    }
    .student-name {
      font-size: 13px;
      font-weight: 900;
      color: #111827;
      margin-bottom: 4px;
    }
    .party-item {
      font-size: 10px;
      color: #4b5563;
      margin-bottom: 2px;
    }
    .qr-card .qr-body {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
    }
    .qr-img {
      width: 72px;
      height: 72px;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .qr-details {
      font-size: 9px;
      color: #4b5563;
      line-height: 1.35;
    }
    .qr-note { margin-bottom: 4px; color: #374151; font-weight: 600; }
    .audit-item { color: #6b7280; }

    /* Items Table */
    .table-wrapper {
      margin-bottom: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    .items-table th {
      background: #f3f4f6;
      color: #111827;
      font-weight: 800;
      padding: 7px 8px;
      border-bottom: 1px solid #e5e7eb;
      text-align: start;
      line-height: 1.2;
    }
    .items-table th small {
      font-size: 8px;
      color: #6b7280;
      font-weight: normal;
    }
    .items-table td {
      padding: 8px 8px;
      border-bottom: 1px solid #f3f4f6;
      vertical-align: top;
    }
    .th-num, .td-num { width: 32px; text-align: center; }
    .th-qty, .td-qty { width: 44px; text-align: center; font-weight: 700; }
    .th-price, .td-price { width: 90px; text-align: end; }
    .th-discount, .td-discount { width: 80px; text-align: end; }
    .th-tax, .td-tax { width: 85px; text-align: end; }
    .th-total, .td-total { width: 105px; text-align: end; }
    .item-title { font-size: 11px; font-weight: 800; color: #111827; }
    .item-sub { font-size: 9px; color: #4b5563; margin-top: 1px; }
    .item-notes { font-size: 9px; color: #6b7280; margin-top: 2px; font-style: italic; }

    /* Summary & Totals */
    .summary-section {
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 16px;
      margin-bottom: 14px;
    }
    .payments-box {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    .payments-box-title {
      background: #f9fafb;
      padding: 5px 8px;
      font-size: 9px;
      font-weight: 800;
      color: #374151;
      border-bottom: 1px solid #e5e7eb;
    }
    .payments-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
    }
    .payments-table th {
      padding: 4px 8px;
      background: #f3f4f6;
      color: #6b7280;
      font-weight: 700;
      text-align: start;
    }
    .payments-table td {
      padding: 4px 8px;
      border-top: 1px solid #f3f4f6;
    }
    .font-xs { font-size: 8px; }

    .credit-box { border-color: #fde68a; }
    .credit-box .payments-box-title { background: #fffbeb; color: #92400e; }
    .credit-list { padding: 6px 8px; display: flex; flex-direction: column; gap: 4px; }
    .credit-item { display: flex; justify-content: space-between; font-size: 9px; }

    .terms-box {
      background: #f9fafb;
      border: 1px dashed #e5e7eb;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 9px;
      color: #4b5563;
    }
    .terms-title { font-weight: 800; color: #111827; margin-bottom: 2px; }
    .terms-list { padding-right: 14px; list-style-type: square; }
    .terms-list li { margin-bottom: 1px; }

    .totals-table {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      background: #fafafa;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 10px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 10px;
    }
    .total-label { color: #4b5563; }
    .total-val { font-weight: 700; color: #111827; }
    .discount-row { color: #dc2626; }
    .discount-row .total-label, .discount-row .total-val { color: #dc2626; }
    .grand-total-row {
      background: #f3f4f6;
      border-top: 2px solid #111827;
      border-bottom: 2px solid #111827;
      padding: 8px 10px;
    }
    .paid-row { background: #f0fdf4; }
    .balance-row {
      padding: 8px 10px;
      border-bottom: 0;
    }
    .has-balance { background: #fef2f2; color: #991b1b; }
    .has-balance .total-label, .has-balance .total-val { color: #991b1b; }
    .zero-balance { background: #f9fafb; color: #065f46; }
    .zero-balance .total-label, .zero-balance .total-val { color: #065f46; }

    /* Signatures */
    .signatures-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 14px;
    }
    .sig-block {
      border: 1px dashed #d1d5db;
      border-radius: 6px;
      padding: 8px;
      text-align: center;
      min-height: 70px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .sig-title { font-size: 9px; font-weight: 800; color: #374151; }
    .sig-content {
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .sig-img {
      max-height: 46px;
      max-width: 90%;
      object-fit: contain;
    }
    .sig-line { border-bottom: 1px solid #9ca3af; width: 70%; margin: 18px auto 2px; }
    .sig-sub { font-size: 8px; color: #6b7280; }
    .stamp-content {
      height: 58px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .stamp-img {
      max-height: 56px;
      max-width: 85px;
      object-fit: contain;
      transform: rotate(-3deg);
    }
    .stamp-placeholder {
      width: 58px;
      height: 58px;
      border: 2px dashed #9ca3af;
      border-radius: 50%;
      margin: 2px auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7px;
      font-weight: 800;
      color: #6b7280;
      text-align: center;
      line-height: 1.1;
    }

    /* Footer */
    .invoice-footer {
      border-top: 1px solid #e5e7eb;
      padding-top: 8px;
      font-size: 9px;
      color: #9ca3af;
      display: flex;
      justify-content: space-between;
      margin-top: auto;
    }
  `;
}

/**
 * Builds a full HTML document string containing multiple or single invoices.
 */
export async function buildInvoicesDocumentHtml(
  invoices: Invoice[],
  options: InvoicePrintOptions = {}
): Promise<string> {
  const renderedPages = await Promise.all(
    invoices.map((inv, idx) =>
      renderSingleInvoiceHtml(inv, options, idx + 1, invoices.length)
    )
  );

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>فاتورة - MAIDAN Invoices (${invoices.length})</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          ${getInvoiceStyles()}
        </style>
      </head>
      <body>
        ${renderedPages.join("\n")}
      </body>
    </html>
  `;
}

/**
 * Executes a clean, popup-safe print job via a hidden sandboxed iframe.
 */
export async function printInvoices(
  invoices: Invoice[],
  options: InvoicePrintOptions = {}
): Promise<void> {
  if (!invoices || invoices.length === 0) return;

  const html = await buildInvoicesDocumentHtml(invoices, options);

  return new Promise((resolve) => {
    // Clean up any stale print frames first
    const staleFrames = document.querySelectorAll("iframe[data-maidan-print]");
    staleFrames.forEach((el) => el.remove());

    const iframe = document.createElement("iframe");
    iframe.setAttribute("data-maidan-print", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.style.zIndex = "-99999";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      if (iframe.parentNode) document.body.removeChild(iframe);
      resolve();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    let isCleanedUp = false;
    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
        resolve();
      }, 500);
    };

    const triggerPrint = async () => {
      try {
        // Wait for all QR codes, logo, stamp, and signature images to fully load
        const images = Array.from(doc.images || []);
        if (images.length > 0) {
          await Promise.all(
            images.map((img) => {
              if (img.complete) return Promise.resolve();
              return new Promise((res) => {
                img.onload = res;
                img.onerror = res;
                setTimeout(res, 2500);
              });
            })
          );
        }

        // Wait an additional tick for web fonts and layout spooling
        await new Promise((r) => setTimeout(r, 200));

        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          // Bind to onafterprint so iframe remains alive until print preview/export finishes
          iframe.contentWindow.onafterprint = cleanup;
          iframe.contentWindow.print();
          // Fallback cleanup after 2 minutes if onafterprint doesn't fire
          setTimeout(cleanup, 120000);
        } else {
          cleanup();
        }
      } catch (err) {
        console.error("Print execution failed:", err);
        cleanup();
      }
    };

    if (doc.readyState === "complete") {
      triggerPrint();
    } else {
      iframe.contentWindow!.onload = triggerPrint;
    }
  });
}

/**
 * Builds HTML for a single Consolidated Billing Statement containing all invoices as line items.
 */
export async function buildConsolidatedStatementHtml(
  invoices: Invoice[],
  options: InvoicePrintOptions = {}
): Promise<string> {
  const club = invoices[0]?.club_info || options.clubInfo;
  const clubName = club?.name || "نادي ميدان الرياضي";
  const clubBusinessName = club?.business_name || "MAIDAN SPORTS CLUB";
  const taxNumber = options.taxNumber || club?.tax_number || "300000000000003";
  const crNumber = options.crNumber || club?.cr_number || "";
  const phone = club?.phone || "";
  const email = club?.email || "";
  const address = options.clubAddress || club?.address || invoices[0]?.location_name || "المملكة العربية السعودية";
  const currency = invoices[0]?.currency || "JOD";

  const totalAmount = invoices.reduce((acc, inv) => acc + Number(inv.total_amount || 0), 0);
  const totalSubtotal = invoices.reduce((acc, inv) => acc + Number(inv.subtotal || inv.total_amount || 0), 0);
  const totalTax = invoices.reduce((acc, inv) => acc + Number(inv.tax_amount || 0), 0);
  const totalPaid = invoices.reduce((acc, inv) => acc + Number(inv.amount_paid || 0), 0);
  const totalDue = invoices.reduce((acc, inv) => acc + Number(inv.amount_due || 0), 0);

  let qrDataUrl = "";
  try {
    const qrPayload = [
      `Seller: ${clubName}`,
      taxNumber ? `VAT: ${taxNumber}` : "",
      `Date: ${new Date().toISOString().split("T")[0]}`,
      `Consolidated Statement: ${invoices.length} invoices`,
      `Total: ${totalAmount} ${currency}`,
      `Tax: ${totalTax} ${currency}`,
    ].filter(Boolean).join("\n");

    qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 140,
      margin: 1,
      color: { dark: "#111827", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  } catch (err) {
    console.error("Statement QR generation failed:", err);
  }

  const tableRowsHtml = invoices.map((inv, idx) => {
    const plan = inv.plan_name || inv.notes || "اشتراك خدمات رياضية";
    return `
      <tr>
        <td class="td-num">${idx + 1}</td>
        <td class="td-invoice mono font-bold">${inv.invoice_number}</td>
        <td class="td-student">
          <strong>${inv.student_name}</strong>
          ${inv.student_number ? `<span class="block text-muted mono text-xs">#${inv.student_number}</span>` : ""}
        </td>
        <td class="td-desc">
          <span>${plan}</span>
          ${inv.notes && inv.plan_name ? `<span class="block text-muted text-xs">${inv.notes}</span>` : ""}
        </td>
        <td class="td-date">${formatDate(inv.due_date)}</td>
        <td class="td-status">
          <span class="status-chip ${inv.status === 'paid' ? 'chip-paid' : inv.status === 'void' ? 'chip-void' : 'chip-pending'}">
            ${inv.status === 'paid' ? 'مدفوعة' : inv.status === 'void' ? 'ملغاة' : 'معلقة'}
          </span>
        </td>
        <td class="td-price mono font-bold text-end">${formatCurrency(inv.total_amount, inv.currency)}</td>
      </tr>
    `;
  }).join("\n");

  const statementStyles = `
    .statement-table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 10px;
    }
    .statement-table th {
      background: #f3f4f6;
      color: #1f2937;
      font-weight: 800;
      padding: 7px 8px;
      border: 1px solid #e5e7eb;
      text-align: start;
    }
    .statement-table td {
      padding: 6px 8px;
      border: 1px solid #e5e7eb;
      vertical-align: middle;
    }
    .status-chip {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 8px;
      font-weight: 700;
    }
    .chip-paid { background: #d1fae5; color: #065f46; }
    .chip-void { background: #fee2e2; color: #991b1b; }
    .chip-pending { background: #fef3c7; color: #92400e; }
  `;

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>كشف فواتير مجمع - ${clubName} (${invoices.length})</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          ${getInvoiceStyles()}
          ${statementStyles}
        </style>
      </head>
      <body>
        <div class="invoice-sheet">
          <div class="invoice-page">
            <!-- Header -->
            <header class="invoice-header">
              <div class="header-brand">
                ${club?.logo ? `<img src="${club.logo}" alt="Logo" class="club-logo" />` : `<div class="club-logo-placeholder">MAIDAN</div>`}
                <div>
                  <h1 class="club-title">${clubName}</h1>
                  <p class="club-subtitle">${clubBusinessName}</p>
                  <div class="club-meta">
                    ${taxNumber ? `<span>الرقم الضريبي / VAT: <strong>${taxNumber}</strong></span>` : ""}
                    ${crNumber ? `<span>السجل التجاري / CR: <strong>${crNumber}</strong></span>` : ""}
                    ${address ? `<span>العنوان: ${address}</span>` : ""}
                    ${phone ? `<span>هاتف: ${phone}</span>` : ""}
                    ${email ? `<span>بريد: ${email}</span>` : ""}
                  </div>
                </div>
              </div>

              <div class="header-doc-info">
                <div class="doc-badge">
                  <span class="doc-badge-ar">كشف فواتير مجمع</span>
                  <span class="doc-badge-en">CONSOLIDATED STATEMENT</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">تاريخ الإصدار / Date:</span>
                  <span class="meta-value">${formatDate(new Date().toISOString())}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">عدد الفواتير / Count:</span>
                  <span class="meta-value mono font-bold">${invoices.length} فاتورة</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">إجمالي المطالبات / Total:</span>
                  <span class="meta-value mono font-bold">${formatCurrency(totalAmount, currency)}</span>
                </div>
              </div>
            </header>

            <!-- Description & Line Items Table with All Invoices -->
            <div class="table-wrapper">
              <table class="statement-table">
                <thead>
                  <tr>
                    <th style="width: 25px; text-align: center;">#</th>
                    <th style="width: 100px;">رقم الفاتورة</th>
                    <th>المشترك / الطالب</th>
                    <th>بيان الخدمة / الباقة</th>
                    <th style="width: 80px; text-align: center;">الاستحقاق</th>
                    <th style="width: 65px; text-align: center;">الحالة</th>
                    <th style="width: 90px; text-align: end;">المبلغ (${currency})</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRowsHtml}
                </tbody>
              </table>
            </div>

            <!-- Financial Summary & Signatures -->
            <div class="summary-container">
              <div class="summary-grid">
                <div class="totals-table">
                  <div class="total-row">
                    <span class="total-label">المجموع الفرعي / Subtotal:</span>
                    <span class="total-val mono font-bold">${formatCurrency(totalSubtotal, currency)}</span>
                  </div>
                  ${totalTax > 0 ? `
                  <div class="total-row">
                    <span class="total-label">إجمالي الضريبة / Total VAT:</span>
                    <span class="total-val mono font-bold">${formatCurrency(totalTax, currency)}</span>
                  </div>` : ""}
                  <div class="total-row grand-total-row">
                    <span class="total-label font-black">المجموع الإجمالي / Grand Total:</span>
                    <span class="total-val mono font-black text-lg">${formatCurrency(totalAmount, currency)}</span>
                  </div>
                  ${totalPaid > 0 ? `
                  <div class="total-row">
                    <span class="total-label">إجمالي المسدد / Paid:</span>
                    <span class="total-val mono font-bold text-success">${formatCurrency(totalPaid, currency)}</span>
                  </div>` : ""}
                  ${totalDue > 0 ? `
                  <div class="total-row balance-row has-balance">
                    <span class="total-label font-bold">المتبقي المستحق / Balance Due:</span>
                    <span class="total-val mono font-black text-lg">${formatCurrency(totalDue, currency)}</span>
                  </div>` : ""}
                </div>

                <div class="signatures-box">
                  <div class="sig-block">
                    <span class="sig-title">توقيع المسؤول المالي</span>
                    <div class="sig-content">
                      ${club?.signature ? `<img src="${club.signature}" class="sig-img" alt="Authorized Signature" />` : `<div class="sig-line"></div>`}
                    </div>
                    <span class="sig-sub">Authorized Signature</span>
                  </div>
                  <div class="sig-block">
                    <span class="sig-title">ختم النادي الرسمي</span>
                    <div class="stamp-content">
                      ${club?.stamp ? `<img src="${club.stamp}" class="stamp-img" alt="Official Stamp" />` : `
                        <div class="stamp-placeholder">
                          <span>ختم الإدارة<br>OFFICIAL STAMP</span>
                        </div>
                      `}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <footer class="invoice-footer">
              <div>MAIDAN Cloud Management Platform — نظام إدارة الأندية الرياضية</div>
              <div>كشف فواتير موحد — إجمالي ${invoices.length} بند</div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Print consolidated master invoice statement.
 */
export async function printConsolidatedStatement(
  invoices: Invoice[],
  options: InvoicePrintOptions = {}
): Promise<void> {
  if (!invoices || invoices.length === 0) return;

  const html = await buildConsolidatedStatementHtml(invoices, options);

  return new Promise((resolve) => {
    const staleFrames = document.querySelectorAll("iframe[data-maidan-print]");
    staleFrames.forEach((el) => el.remove());

    const iframe = document.createElement("iframe");
    iframe.setAttribute("data-maidan-print", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.style.zIndex = "-99999";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      if (iframe.parentNode) document.body.removeChild(iframe);
      resolve();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    let isCleanedUp = false;
    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
        resolve();
      }, 500);
    };

    const triggerPrint = async () => {
      try {
        const images = Array.from(doc.images || []);
        if (images.length > 0) {
          await Promise.all(
            images.map((img) => {
              if (img.complete) return Promise.resolve();
              return new Promise((res) => {
                img.onload = res;
                img.onerror = res;
                setTimeout(res, 2500);
              });
            })
          );
        }
        await new Promise((r) => setTimeout(r, 200));

        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.onafterprint = cleanup;
          iframe.contentWindow.print();
          setTimeout(cleanup, 120000);
        } else {
          cleanup();
        }
      } catch (err) {
        console.error("Statement print execution failed:", err);
        cleanup();
      }
    };

    if (doc.readyState === "complete") {
      triggerPrint();
    } else {
      iframe.contentWindow!.onload = triggerPrint;
    }
  });
}
