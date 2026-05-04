import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "SAR", locale = "ar-SA"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string, locale = "ar-SA"): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateStr));
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسابيع`;
  return `منذ ${Math.floor(diffDays / 30)} شهور`;
}

export function getStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    active: "badge-active",
    trial: "badge-trial",
    lead: "badge-lead",
    inactive: "badge-inactive",
    suspended: "badge-inactive",
    paid: "badge-paid",
    pending: "badge-pending",
    overdue: "badge-overdue",
    draft: "badge-inactive",
  };
  return map[status] ?? "badge-inactive";
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    active: "نشط",
    trial: "تجريبي",
    lead: "عميل محتمل",
    inactive: "غير نشط",
    suspended: "موقوف",
    graduated: "خريج",
    paid: "مدفوع",
    pending: "معلق",
    overdue: "متأخر",
    draft: "مسودة",
    void: "ملغي",
    refunded: "مسترجع",
    cancelled: "ملغي",
    partially_paid: "مدفوع جزئياً",
  };
  return map[status] ?? status;
}

export function truncate(str: string, length: number): string {
  return str.length > length ? `${str.slice(0, length)}...` : str;
}
