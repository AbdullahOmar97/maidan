// =============================================================================
// MAIDAN — Shared TypeScript Types
// =============================================================================

export type UserRole =
  | "platform_admin"
  | "tenant_owner"
  | "manager"
  | "branch_manager"
  | "front_desk"
  | "instructor"
  | "finance"
  | "parent"
  | "student"
  | "read_only";

export interface User {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  avatar: string | null;
  avatar_url: string | null;
  language_pref: "ar" | "en";
  primary_location_id: number | null;
  created_at: string;
  last_login: string;
}

export type StudentStatus = "active" | "inactive" | "trial" | "lead" | "suspended" | "graduated";
export type Gender = "male" | "female" | "other" | "prefer_not";

export interface Student {
  id: number;
  student_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string | null;
  age: number | null;
  gender: Gender;
  phone: string;
  email: string;
  whatsapp: string;
  photo: string | null;
  photo_url: string | null;
  status: StudentStatus;
  source: string;
  location_id: number;
  family: Family | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  waiver_signed: boolean;
  notes: string;
  current_belt: BeltSummary | null;
  active_membership: MembershipSummary | null;
  belt_history: BeltHistoryItem[];
  created_at: string;
}

export interface BeltHistoryItem {
  belt_name: string;
  color: string;
  promoted_at: string;
  is_current: boolean;
}

export interface StudentNote {
  id: number;
  student_id: number;
  author_id: number;
  author_name: string;
  note_type: "general" | "medical" | "billing" | "behavior" | "progress";
  content: string;
  is_private: boolean;
  created_at: string;
}

export interface StudentDocument {
  id: number;
  student_id: number;
  document_type: string;
  name: string;
  file: string;
  uploaded_by_id: number;
  notes: string;
  expires_at: string | null;
  created_at: string;
}

export interface Family {
  id: number;
  name: string;
  primary_contact_name: string;
  primary_contact_phone: string;
  primary_contact_email: string;
  member_count: number;
  created_at: string;
}

export interface Location {
  id: number;
  name: string;
  name_ar: string;
  city: string;
  country: string;
  phone: string;
  capacity: number;
  is_active: boolean;
}

export interface BeltSummary {
  name: string;
  color: string;
  promoted_at: string;
}

export interface BeltRank {
  id: number;
  martial_art: string;
  name: string;
  color_hex: string;
  order_index: number;
  min_attendance_sessions: number;
  min_months_since_last: number;
}

export interface MembershipSummary {
  id: number;
  plan_name: string;
  start_date: string;
  end_date: string;
  status: string;
}

export type InvoiceStatus = "draft" | "pending" | "paid" | "overdue" | "void" | "refunded" | "partially_paid";

export interface Invoice {
  id: number;
  invoice_number: string;
  student_id: number;
  student_name: string;
  membership_id: number | null;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  status: InvoiceStatus;
  due_date: string;
  paid_at: string | null;
  notes: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: number;
  session_id: number;
  student_id: number;
  student_name: string;
  session_date: string;
  checked_in_at: string;
  check_in_method: "kiosk" | "manual" | "app" | "qr";
  notes: string;
}

export interface AttendanceHistoryRecord {
  class_name: string;
  date: string;
  checked_in_at: string;
  method: "kiosk" | "manual" | "app" | "qr";
}

export interface ClassSession {
  id: number;
  schedule_id: number;
  class_name: string;
  location_name: string;
  date: string;
  instructor_id: number | null;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  attendance_count: number;
}

// Dashboard KPIs
export interface DashboardKPIs {
  students: {
    active: number;
    trial: number;
    new_this_month: number;
  };
  revenue: {
    this_month: number;
    last_month: number;
    change_pct: number;
    overdue: number;
    currency: string;
  };
  attendance: {
    today: number;
    active_sessions: number;
  };
  promotions: {
    this_month: number;
  };
}

// Pagination response
export interface PaginatedResponse<T> {
  count: number;
  total_pages: number;
  current_page: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    detail: unknown;
  };
}

export interface NotificationLog {
  id: number;
  student: number | null;
  recipient_phone: string;
  recipient_email: string;
  channel: "whatsapp" | "email" | "sms" | "in_app";
  content: string;
  status: "queued" | "sent" | "delivered" | "failed";
  created_at: string;
}
