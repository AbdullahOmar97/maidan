import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = "JOD", locale = "ar-JO"): string {
  const num = typeof amount === "string" ? parseFloat(amount) || 0 : (amount ?? 0);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

export const ARABIC_MONTH_NAMES = [
  "",
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export const ARABIC_MONTHS_WITH_NUMBERS = [
  "",
  "يناير (1)",
  "فبراير (2)",
  "مارس (3)",
  "أبريل (4)",
  "مايو (5)",
  "يونيو (6)",
  "يوليو (7)",
  "أغسطس (8)",
  "سبتمبر (9)",
  "أكتوبر (10)",
  "نوفمبر (11)",
  "ديسمبر (12)",
];

/**
 * Returns formatted month name with number, e.g. "أكتوبر (10)" or "أكتوبر (10) 2026"
 */
export function formatMonthName(month: number, year?: number): string {
  const name = ARABIC_MONTHS_WITH_NUMBERS[month] || "";
  return year ? `${name} ${year}` : name;
}

/**
 * Formats "YYYY-MM" or Date into Arabic month with number and year, e.g. "أكتوبر (10) 2026"
 */
export function formatMonthYear(val?: string | Date | null): string {
  if (!val) return "";
  if (val instanceof Date) {
    const m = val.getMonth() + 1;
    const y = val.getFullYear();
    return `${ARABIC_MONTHS_WITH_NUMBERS[m] || ""} ${y}`;
  }
  const str = String(val).trim();
  const ymMatch = str.match(/^(\d{4})-(\d{1,2})$/);
  if (ymMatch) {
    const y = ymMatch[1];
    const m = parseInt(ymMatch[2], 10);
    return `${ARABIC_MONTHS_WITH_NUMBERS[m] || ""} ${y}`;
  }
  const d = new Date(str);
  if (!Number.isNaN(d.getTime())) {
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    return `${ARABIC_MONTHS_WITH_NUMBERS[m] || ""} ${y}`;
  }
  return str;
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "غير محدد";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "غير محدد";
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const monthWithNum = ARABIC_MONTHS_WITH_NUMBERS[month] || String(month);
  return `${day} ${monthWithNum} ${year}`;
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

export function isInvoiceOverdue(status: string, dueDate: string): boolean {
  if (status === "overdue") return true;
  if (status === "pending" || status === "partially_paid") {
    return new Date(dueDate) < new Date();
  }
  return false;
}

export function truncate(str: string, length: number): string {
  return str.length > length ? `${str.slice(0, length)}...` : str;
}

export function translateErrorMessage(message: string): string {
  const errorTranslations: Record<string, string> = {
    "This academy slug is already taken.": "رابط الأكاديمية مستخدم بالفعل",
    "User with this email already exists.": "البريد الإلكتروني مسجل مسبقاً",
    "This field may not be blank.": "هذا الحقل مطلوب",
    "This field is required.": "هذا الحقل مطلوب",
    "Enter a valid email address.": "أدخل بريد إلكتروني صحيح",
    "Ensure this field has at least 8 characters.": "يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل",
    "This academy slug is already taken": "رابط الأكاديمية مستخدم بالفعل",
    "User with this email already exists": "البريد الإلكتروني مسجل مسبقاً",
    "Invalid email or password": "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    "Authentication failed": "فشل المصادقة",
  };

  for (const [en, ar] of Object.entries(errorTranslations)) {
    if (message.includes(en)) return ar;
  }
  return message;
}

export function parseApiError(err: any, defaultMessage = "حدث خطأ في النظام"): string {
  if (!err) return defaultMessage;
  
  const errorData = err.response?.data;
  if (!errorData) {
    if (err.message) return translateErrorMessage(err.message);
    return defaultMessage;
  }

  // Extract nested error if present
  const apiError = errorData.error || errorData;

  const fieldLabels: Record<string, string> = {
    first_name: "الاسم الأول",
    last_name: "الاسم الأخير",
    phone: "رقم الهاتف",
    email: "البريد الإلكتروني",
    gender: "الجنس",
    status: "الحالة",
    location_id: "الفرع",
    location: "الفرع",
    non_field_errors: "خطأ",
    detail: "التفاصيل",
  };

  const formatErrorsObj = (obj: any): string[] => {
    return Object.entries(obj).map(([key, value]) => {
      const fieldName = fieldLabels[key] || key;
      let errorText = "";
      if (Array.isArray(value)) {
        errorText = value.join(", ");
      } else if (typeof value === "object" && value !== null) {
        errorText = JSON.stringify(value);
      } else {
        errorText = String(value);
      }
      
      if (key === "non_field_errors") {
        return translateErrorMessage(errorText);
      }
      return `${fieldName}: ${translateErrorMessage(errorText)}`;
    });
  };

  // If there's a detail object with field errors, use it
  if (apiError.detail && typeof apiError.detail === "object" && !Array.isArray(apiError.detail)) {
    const messages = formatErrorsObj(apiError.detail);
    if (messages.length > 0) return messages.join("\n");
  }

  // Otherwise check if the apiError itself has field errors
  if (typeof apiError === "object" && !Array.isArray(apiError)) {
    const { code, message, detail, ...rest } = apiError;
    if (Object.keys(rest).length > 0) {
      const messages = formatErrorsObj(rest);
      if (messages.length > 0) return messages.join("\n");
    }
    
    if (detail && typeof detail === "string") {
      return translateErrorMessage(detail);
    }
    
    if (message) {
      return translateErrorMessage(message);
    }
  }

  if (typeof apiError === "string") {
    return translateErrorMessage(apiError);
  }

  return defaultMessage;
}

