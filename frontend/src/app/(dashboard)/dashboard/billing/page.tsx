"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { formatCurrency, formatDate, getStatusBadgeClass, getStatusLabel, cn } from "@/lib/utils";
import {
  CreditCard, AlertTriangle, CheckCircle, Clock,
  TrendingUp, Search, Filter, Plus, Download, ChevronRight, Sparkles, Receipt
} from "lucide-react";
import type { Invoice, PaginatedResponse } from "@/types";
import Link from "next/link";

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <tr className="group hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
      <td className="py-5 px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <Receipt className="w-4 h-4" />
          </div>
          <p className="font-black text-sm text-white tracking-tight">{invoice.invoice_number}</p>
        </div>
      </td>
      <td className="py-5 px-6">
        <p className="font-bold text-sm text-white">{invoice.student_name}</p>
      </td>
      <td className="py-5 px-6">
        <span className={cn("px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border", getStatusBadgeClass(invoice.status))}>
          {getStatusLabel(invoice.status)}
        </span>
      </td>
      <td className="py-5 px-6 text-sm font-bold text-muted-foreground" dir="ltr">
        {formatDate(invoice.due_date)}
      </td>
      <td className="py-5 px-6 text-right">
        <p className="font-black text-sm text-white" dir="ltr">
          {formatCurrency(invoice.total_amount, invoice.currency)}
        </p>
        {invoice.amount_due > 0 && invoice.status !== "paid" && (
          <p className="text-[10px] font-bold text-amber-400 mt-1" dir="ltr">
            متبقي: {formatCurrency(invoice.amount_due, invoice.currency)}
          </p>
        )}
      </td>
      <td className="py-5 px-6 text-left">
        <Link
          href={`/dashboard/billing/invoices/${invoice.id}`}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-muted-foreground hover:bg-primary hover:text-white transition-all active:scale-90"
        >
          <ChevronRight className="w-4 h-4 rtl-flip" />
        </Link>
      </td>
    </tr>
  );
}

export default function BillingPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const { data: summary } = useQuery({
    queryKey: ["billing", "summary"],
    queryFn: () => api.billing.invoices.summary().then((r) => r.data),
  });

  const { data: invoices, isLoading } = useQuery<PaginatedResponse<Invoice>>({
    queryKey: ["billing", "invoices", { status, search }],
    queryFn: () =>
      api.billing.invoices.list({ status: status || undefined, search: search || undefined }).then((r) => r.data),
  });

  const summaryCards = [
    {
      label: "مدفوع هذا الشهر",
      value: summary?.paid_this_month ?? 0,
      icon: CheckCircle,
      color: "emerald" as const,
    },
    {
      label: "إجمالي معلق",
      value: summary?.total_pending ?? 0,
      icon: Clock,
      color: "amber" as const,
    },
    {
      label: "متأخر",
      value: summary?.total_overdue ?? 0,
      icon: AlertTriangle,
      color: "red" as const,
      badge: summary?.overdue_count,
    },
    {
      label: "إجمالي مدفوع",
      value: summary?.total_paid ?? 0,
      icon: TrendingUp,
      color: "primary" as const,
    },
  ];

  const colorStyles = {
    emerald: {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      glow: "shadow-emerald-500/20"
    },
    amber: {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      glow: "shadow-amber-500/20"
    },
    red: {
      text: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      glow: "shadow-red-500/20"
    },
    primary: {
      text: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
      glow: "shadow-primary/20"
    },
  };

  return (
    <div className="space-y-10 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
              <CreditCard className="w-5 h-5" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">الفواتير والمدفوعات</h1>
          </div>
          <p className="text-muted-foreground text-sm font-bold flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            إدارة الشؤون المالية وتتبع الإيرادات بدقة
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all active:scale-95">
            <Download className="w-4 h-4" />
            تصدير التقارير
          </button>
          <Link
            href="/dashboard/billing/new"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl gradient-brand text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            فاتورة جديدة
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryCards.map((card) => {
          const style = colorStyles[card.color];
          return (
            <div key={card.label} className="glass-card p-6 relative overflow-hidden group">
              <div className={cn("absolute top-0 right-0 w-24 h-24 blur-3xl -mr-12 -mt-12 transition-colors opacity-30", style.bg)} />
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className={cn("w-12 h-12 rounded-2xl border flex items-center justify-center transition-all group-hover:scale-110", style.bg, style.border, style.text, style.glow)}>
                  <card.icon className="w-6 h-6" />
                </div>
                {card.badge && (
                  <span className="px-3 py-1 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest border border-red-500/20">
                    {card.badge} فواتير
                  </span>
                )}
              </div>
              <div className="relative z-10">
                <p className="text-3xl font-black text-white tracking-tighter" dir="ltr">
                  {formatCurrency(card.value)}
                </p>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mt-2">{card.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="space-y-6">
        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 p-2 bg-white/[0.02] border border-white/5 rounded-2xl">
          <div className="relative flex-1 group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="البحث بالطالب، رقم الفاتورة..."
              className="w-full pr-11 pl-4 py-3 rounded-xl bg-white/5 border border-white/5 focus:border-primary/50 focus:bg-white/10 focus:outline-none text-sm font-bold text-white transition-all placeholder:text-muted-foreground/50"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-6 py-3 rounded-xl bg-white/5 border border-white/5 focus:border-primary/50 focus:bg-white/10 focus:outline-none text-sm font-black text-white transition-all min-w-[180px] appearance-none cursor-pointer"
          >
            <option value="" className="bg-slate-900">جميع الحالات</option>
            <option value="pending" className="bg-slate-900">معلق</option>
            <option value="paid" className="bg-slate-900">مدفوع</option>
            <option value="overdue" className="bg-slate-900">متأخر</option>
            <option value="void" className="bg-slate-900">ملغي</option>
          </select>
        </div>

        {/* Table Container */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5">
                  <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">رقم الفاتورة</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">اسم الطالب</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">الحالة</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">تاريخ الاستحقاق</th>
                  <th className="py-5 px-6 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">المبلغ الإجمالي</th>
                  <th className="py-5 px-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="py-6 px-6">
                          <div className="h-4 bg-white/5 rounded-lg w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : invoices?.results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-32 text-center">
                      <div className="max-w-xs mx-auto">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                          <Receipt className="w-10 h-10 text-muted-foreground opacity-20" />
                        </div>
                        <p className="text-white font-black text-lg">لا توجد سجلات مالية</p>
                        <p className="text-muted-foreground text-sm font-bold mt-2">ابدأ بإصدار أول فاتورة للطالب الآن.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  invoices?.results.map((invoice) => (
                    <InvoiceRow key={invoice.id} invoice={invoice} />
                  ))
                )}
              </tbody>
            </table>
          </div>
          {invoices && invoices.total_pages > 1 && (
             <div className="p-6 bg-white/[0.01] border-t border-white/5 flex items-center justify-between">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  عرض {invoices.results.length} من أصل {invoices.count} سجل
                </p>
                <div className="flex items-center gap-2">
                   <button className="px-4 py-2 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-white/10 hover:text-white transition-all disabled:opacity-30">السابق</button>
                   <button className="px-4 py-2 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-white/10 hover:text-white transition-all disabled:opacity-30">التالي</button>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

