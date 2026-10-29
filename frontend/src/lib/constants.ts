import { UserRole } from "@/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  platform_admin: "مدير النظام",
  tenant_owner: "مالك النادي",
  manager: "مدير",
  branch_manager: "مدير فرع",
  front_desk: "استقبال",
  instructor: "مدرب",
  finance: "مالية",
  staff: "موظف",
  parent: "ولي أمر",
  student: "طالب",
  read_only: "مراقب",
};

export const CURRENCY_OPTIONS = [
  { value: "JOD", label: "JOD" },
  { value: "SAR", label: "SAR" },
  { value: "AED", label: "AED" },
  { value: "KWD", label: "KWD" },
  { value: "BHD", label: "BHD" },
  { value: "OMR", label: "OMR" },
  { value: "QAR", label: "QAR" },
  { value: "EGP", label: "EGP" },
  { value: "USD", label: "USD" },
] as const;
