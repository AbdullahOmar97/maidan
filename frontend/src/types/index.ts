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
  | "staff"
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
  assigned_location_ids: number[];
  branch_names: string[];
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
  martial_art?: string;
  notes?: string;
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
  billing_address?: string;
  notes?: string;
  member_count: number;
  created_at: string;
}

export interface FamilyMember {
  id: number;
  student_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  photo_url: string | null;
  age: number | null;
  gender: string;
  phone: string;
  email: string;
  status: StudentStatus;
  current_belt: { name: string; color: string; promoted_at: string } | null;
  active_membership: { id: number; plan_name: string; status: string; end_date: string | null } | null;
  created_at: string;
}

export interface FamilyStats {
  member_count: number;
  active_count: number;
  active_memberships: number;
  total_billed: number;
  outstanding_balance: number;
  attendance_last_90_days: number;
}

export interface FamilyDetail extends Family {
  members: FamilyMember[];
  stats: FamilyStats;
}

export interface Location {
  id: number;
  name: string;
  name_ar?: string;
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
  name_ar?: string;
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

export interface MembershipPlan {
  id: number;
  name: string;
  description: string;
  billing_cycle: "weekly" | "monthly" | "quarterly" | "semi_annual" | "annual" | "one_time";
  price: number;
  currency: string;
  setup_fee: number;
  tax_rate: number;
  max_classes_per_week: number | null;
  is_unlimited: boolean;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
  created_at: string;
}

export type MembershipStatus =
  | "active"
  | "expired"
  | "cancelled"
  | "paused"
  | "pending"
  | "pending_approval";

export interface Membership {
  id: number;
  student_id: number;
  student_name: string;
  plan_id: number;
  plan_name: string;
  price: number;
  currency: string;
  start_date: string;
  end_date: string | null;
  status: MembershipStatus;
  auto_renew: boolean;
  notes: string;
  approved_by_id: string | null;
  approved_at: string | null;
  created_by_id: string | null;
  created_at: string;
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
  plan_name: string | null;
  is_recurring: boolean;
  created_by_id: string | null;
  created_by_name: string | null;
  paid_by_id: string | null;
  paid_by_name: string | null;
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

export interface StaffPermissions {
  can_manage_students?: boolean;
  can_view_billing?: boolean;
  can_manage_billing?: boolean;
  can_create_invoice?: boolean;
  can_mark_invoice_paid?: boolean;
  can_renew_subscription?: boolean;
  can_change_subscription?: boolean;
  can_approve_subscription?: boolean;
  can_void_invoice?: boolean;
  can_apply_discount?: boolean;
  can_manage_schedules?: boolean;
  can_manage_locations?: boolean;
  can_view_reports?: boolean;
  can_manage_staff?: boolean;
  [key: string]: boolean | undefined;
}

export interface StaffMember {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  avatar_url: string | null;
  branch_names: string[];
  assigned_location_ids: number[];
  permissions: StaffPermissions;
}

export interface NotificationLog {
  id: number;
  student: number | null;
  recipient_phone: string;
  recipient_email: string;
  channel: "whatsapp" | "email" | "sms" | "in_app";
  content: string;
  status: "queued" | "sent" | "delivered" | "failed" | "read";
  subject?: string;
  created_at: string;
}

// =============================================================================
// Store & E-Commerce Types
// =============================================================================
export interface ProductOption {
  id: number;
  name: string;
  value: string;
  additional_price: string;
  stock: number;
  min_stock_threshold: number;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: string;
  currency: string;
  image: string | null;
  is_active: boolean;
  options: ProductOption[];
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  product: number;
  product_name: string;
  option: number | null;
  option_value: string | null;
  quantity: number;
  unit_price: string;
  total_price: string;
}

export interface Order {
  id: number;
  student: number;
  student_name: string;
  status: "pending" | "processing" | "ready" | "completed" | "cancelled";
  payment_method: "cash" | "online";
  payment_status: "pending" | "paid" | "refunded" | "failed";
  invoice: number | null;
  invoice_number: string | null;
  total_amount: string;
  notes: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface BeltExam {
  id: number;
  name: string;
  date: string;
  martial_art: string;
  location: number;
  location_name: string;
  notes: string;
  candidates_count: number;
  created_at: string;
}

export interface ExamCandidate {
  id: number;
  exam: number;
  student: number;
  student_name: string;
  student_photo: string | null;
  current_belt_name: string;
  current_belt_color: string;
  target_belt: number;
  target_belt_name: string;
  target_belt_color: string;
  technical_grade: string;
  instructor_notes: string;
  status: "pending" | "passed" | "failed";
  graded_by_id: string | null;
  graded_at: string | null;
  created_at: string;
}
