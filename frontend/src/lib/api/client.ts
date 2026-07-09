import axios, { AxiosError, type AxiosInstance } from "axios";
import { getSession } from "next-auth/react";

declare module "axios" {
  interface AxiosRequestConfig {
    /** Skip NextAuth getSession — use for AllowAny API routes (register, public catalog). */
    skipAuth?: boolean;
  }
}

let API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

if (typeof window !== "undefined") {
  try {
    const url = new URL(API_URL);
    url.hostname = window.location.hostname;
    API_URL = url.toString().replace(/\/$/, "");
  } catch (e) {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------
const parsedTimeout = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? "", 10);
const requestTimeoutMs =
  Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 30000;

const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: requestTimeoutMs,
});

// Attach JWT token from NextAuth session (skip on public routes — avoids slow/stuck session fetch blocking AllowAny calls)
apiClient.interceptors.request.use(async (config) => {
  if (!config.skipAuth) {
    const session = await getSession();
    if (session) {
      const token = (session as unknown as Record<string, unknown>).accessToken as string;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }
  return config;
});

// Standardized error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const data = error.response?.data as any;
    const errorCode = data?.error?.code;

    if (status === 401) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    if (status === 403 && (errorCode === "tenant_inactive" || errorCode === "subscription_expired")) {
      const isStatusPage = typeof window !== "undefined" && (
        window.location.pathname.includes("/status") || 
        window.location.pathname === "/login"
      );

      if (typeof window !== "undefined" && !isStatusPage) {
        const statusType = errorCode === "tenant_inactive" ? data.error.status : "expired";
        window.location.href = `/status?type=${statusType}&message=${encodeURIComponent(data.error.message)}`;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

// ---------------------------------------------------------------------------
// Typed API Client — all endpoints
// ---------------------------------------------------------------------------
export const api = {
  // Auth
  auth: {
    login: (data: { email: string; password: string }) =>
      apiClient.post("/auth/login/", data),
    me: () => apiClient.get("/auth/me/"),
    updateProfile: (data: unknown) => apiClient.patch("/auth/me/", data),
    logout: (refresh: string) => apiClient.post("/auth/logout/", { refresh }),
    passwordSetup: (data: any) =>
      apiClient.post("/auth/password/setup/", data, { skipAuth: true }),
  },
  
  // Tenants (Academy Settings)
  tenants: {
    me: () => apiClient.get("/academy/me/"),
    updateMe: (data: unknown) => {
      const isFormData = data instanceof FormData;
      // For FormData, we must NOT send Content-Type: application/json so the
      // browser can set multipart/form-data with the correct boundary automatically.
      return apiClient.patch("/academy/me/", data, {
        headers: isFormData ? { "Content-Type": undefined } : {},
      });
    },
    transferOwnership: (userId: string) => apiClient.post("/academy/transfer-ownership/", { user_id: userId }),
    subscriptionRequests: {
      list: () => apiClient.get("/academy/subscription-requests/"),
      create: (data: { new_plan: number; billing_cycle?: string; reason?: string }) => apiClient.post("/academy/subscription-requests/", data),
    },
  },


  // Dashboard
  dashboard: {
    kpi: () => apiClient.get("/reporting/dashboard/"),
    revenue: (months?: number) =>
      apiClient.get("/reporting/revenue/", { params: { months } }),
    attendance: (period?: string) =>
      apiClient.get("/reporting/attendance/", { params: { period } }),
    retention: () => apiClient.get("/reporting/retention/"),
    belts: () => apiClient.get("/reporting/belts/"),
  },

  // Students
  students: {
    list: (params?: Record<string, unknown>) =>
      apiClient.get("/students/", { params }),
    kioskSearch: (search: string, locationId?: number) =>
      apiClient.get("/students/kiosk_search/", { params: { search, location_id: locationId } }),
    get: (id: number) => apiClient.get(`/students/${id}/`),
    create: (data: unknown) => apiClient.post("/students/", data),
    update: (id: number, data: unknown) =>
      apiClient.patch(`/students/${id}/`, data),
    delete: (id: number) => apiClient.delete(`/students/${id}/`),
    stats: () => apiClient.get("/students/stats/"),
    checkin: (id: number) =>
      apiClient.post(`/students/${id}/quick_checkin/`),
    attendanceHistory: (id: number) =>
      apiClient.get(`/students/${id}/attendance_history/`),
    potentialSessions: (id: number, date?: string) =>
      apiClient.get(`/students/${id}/potential_sessions/`, { params: { date } }),
    manualCheckin: (id: number, data: { session_id?: number; schedule_id?: number; date?: string }) =>
      apiClient.post(`/students/${id}/manual_checkin/`, data),
    notes: {
      list: (studentId: number) =>
        apiClient.get(`/students/${studentId}/notes/`),
      create: (studentId: number, data: unknown) =>
        apiClient.post(`/students/${studentId}/notes/`, data),
      delete: (studentId: number, id: number) =>
        apiClient.delete(`/students/${studentId}/notes/${id}/`),
    },
    documents: {
      list: (studentId: number) =>
        apiClient.get(`/students/${studentId}/documents/`),
      create: (studentId: number, data: FormData) =>
        apiClient.post(`/students/${studentId}/documents/`, data, {
          headers: { "Content-Type": undefined },
        }),
      delete: (studentId: number, id: number) =>
        apiClient.delete(`/students/${studentId}/documents/${id}/`),
    },
  },

  // Families
  families: {
    list: (params?: Record<string, unknown>) => apiClient.get("/families/", { params }),
    get: (id: number) => apiClient.get(`/families/${id}/`),
    create: (data: unknown) => apiClient.post("/families/", data),
    update: (id: number, data: unknown) => apiClient.patch(`/families/${id}/`, data),
    delete: (id: number) => apiClient.delete(`/families/${id}/`),
    members: (id: number) => apiClient.get(`/families/${id}/members/`),
    addMember: (id: number, studentId: number) =>
      apiClient.post(`/families/${id}/add_member/`, { student_id: studentId }),
    removeMember: (id: number, studentId: number) =>
      apiClient.post(`/families/${id}/remove_member/`, { student_id: studentId }),
    stats: (id: number) => apiClient.get(`/families/${id}/stats/`),
  },

  // Locations
  locations: {
    list: () => apiClient.get("/students/locations/"),
    create: (data: unknown) => apiClient.post("/students/locations/", data),
    update: (id: number, data: unknown) => apiClient.patch(`/students/locations/${id}/`, data),
    delete: (id: number) => apiClient.delete(`/students/locations/${id}/`),
  },

  // Attendance
  attendance: {
    schedules: {
      list: (params?: Record<string, unknown>) =>
        apiClient.get("/attendance/schedules/", { params }),
      create: (data: unknown) => apiClient.post("/attendance/schedules/", data),
      update: (id: number, data: unknown) =>
        apiClient.patch(`/attendance/schedules/${id}/`, data),
      delete: (id: number) => apiClient.delete(`/attendance/schedules/${id}/`),
    },
    sessions: {
      today: (locationId?: number) => apiClient.get("/attendance/sessions/today/", { params: { location_id: locationId } }),
      list: (params?: Record<string, unknown>) =>
        apiClient.get("/attendance/sessions/", { params }),
    },
    records: {
      list: (sessionId: number) =>
        apiClient.get("/attendance/records/", { params: { session_id: sessionId } }),
      create: (data: unknown) => apiClient.post("/attendance/records/", data),
      delete: (id: number) => apiClient.delete(`/attendance/records/${id}/`),
      kiosk: (data: { student_id?: number; student_number?: string; phone?: string; session_id?: number }) =>
        apiClient.post("/attendance/records/kiosk/", data),
    },
    classTypes: () => apiClient.get("/attendance/class-types/"),
  },

  // Belts
  belts: {
    ranks: () => apiClient.get("/belts/ranks/"),
    createRank: (data: unknown) => apiClient.post("/belts/ranks/", data),
    updateRank: (id: number, data: unknown) => apiClient.patch(`/belts/ranks/${id}/`, data),
    deleteRank: (id: number) => apiClient.delete(`/belts/ranks/${id}/`),
    eligibility: () => apiClient.get("/belts/eligibility/"),
    promote: (data: unknown) => apiClient.post("/belts/promotions/", data),
  },

  // Billing
  billing: {
    plans: {
      list: () => apiClient.get("/billing/plans/"),
      create: (data: unknown) => apiClient.post("/billing/plans/", data),
      update: (id: number, data: unknown) => apiClient.patch(`/billing/plans/${id}/`, data),
      delete: (id: number) => apiClient.delete(`/billing/plans/${id}/`),
    },
    memberships: {
      list: (params?: Record<string, unknown>) =>
        apiClient.get("/billing/memberships/", { params }),
      create: (data: unknown) => apiClient.post("/billing/memberships/", data),
      cancel: (id: number, reason: string) =>
        apiClient.post(`/billing/memberships/${id}/cancel/`, { reason }),
    },
    invoices: {
      list: (params?: Record<string, unknown>) =>
        apiClient.get("/billing/invoices/", { params }),
      get: (id: number) => apiClient.get(`/billing/invoices/${id}/`),
      create: (data: unknown) => apiClient.post("/billing/invoices/", data),
      summary: () => apiClient.get("/billing/invoices/summary/"),
      overdue: () => apiClient.get("/billing/invoices/overdue/"),
      markPaid: (id: number, data?: { payment_method?: string; note?: string }) =>
        apiClient.post(`/billing/invoices/${id}/mark_paid/`, data ?? {}),
      void: (id: number) =>
        apiClient.post(`/billing/invoices/${id}/void/`),
    },
    payments: {
      initiate: (data: unknown) => apiClient.post("/billing/payments/initiate/", data),
    },
  },

  // Messaging
  messaging: {
    templates: () => apiClient.get("/messaging/templates/"),
    logs: (params?: Record<string, unknown>) =>
      apiClient.get("/messaging/logs/", { params }),
    campaigns: {
      list: () => apiClient.get("/messaging/campaigns/"),
      create: (data: unknown) => apiClient.post("/messaging/campaigns/", data),
      send: (id: number) =>
        apiClient.post(`/messaging/campaigns/${id}/send/`),
    },
  },

  // Staff
  staff: {
    list: (params?: Record<string, unknown>) =>
      apiClient.get("/staff/", { params }),
    get: (id: string) => apiClient.get(`/staff/${id}/`),
    create: (data: unknown) => apiClient.post("/staff/", data),
    update: (id: string, data: unknown) => apiClient.patch(`/staff/${id}/`, data),
  },

  // Platform (Global Admin)
  platform: {
    tenants: {
      list: () => apiClient.get("/platform/tenants/"),
      get: (id: number) => apiClient.get(`/platform/tenants/${id}/`),
      create: (data: unknown) => apiClient.post("/platform/tenants/", data),
      update: (id: number, data: unknown) => apiClient.patch(`/platform/tenants/${id}/`, data),
      delete: (id: number) => apiClient.delete(`/platform/tenants/${id}/`),
      register: (data: unknown) =>
        apiClient.post("/platform/tenants/register/", data, { skipAuth: true }),
    },
    plans: {
      list: () => apiClient.get("/platform/plans/", { skipAuth: true }),
    },
    subscriptionRequests: {
      list: () => apiClient.get("/platform/subscription-requests/"),
      approve: (id: number, data?: { admin_notes?: string }) => apiClient.post(`/platform/subscription-requests/${id}/approve/`, data ?? {}),
      reject: (id: number, data: { admin_notes: string }) => apiClient.post(`/platform/subscription-requests/${id}/reject/`, data),
    },
  },
  
  // Store (Club E-Commerce)
  store: {
    products: {
      list: () => apiClient.get("/store/products/"),
      get: (id: number) => apiClient.get(`/store/products/${id}/`),
      create: (data: unknown) => apiClient.post("/store/products/", data),
      update: (id: number, data: unknown) => apiClient.patch(`/store/products/${id}/`, data),
      delete: (id: number) => apiClient.delete(`/store/products/${id}/`),
      addOption: (id: number, data: unknown) => apiClient.post(`/store/products/${id}/options/`, data),
    },
    orders: {
      list: () => apiClient.get("/store/orders/"),
      get: (id: number) => apiClient.get(`/store/orders/${id}/`),
      create: (data: unknown) => apiClient.post("/store/orders/", data),
      updateStatus: (id: number, data: { status?: string; payment_status?: string }) =>
        apiClient.post(`/store/orders/${id}/update-status/`, data),
      cancel: (id: number) => apiClient.post(`/store/orders/${id}/cancel/`),
    },
  },

};

export type ApiError = {
  error: {
    code: string;
    message: string;
    detail: unknown;
  };
};
