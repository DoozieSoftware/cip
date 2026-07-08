import { api } from './client';
import type {
  PaginationMeta,
  DepartmentDashboardCounts,
  DepartmentReportListItem,
  DepartmentOfficer,
  InternalNote,
  Paginated,
  ReportListItem,
  WorkflowEvent,
} from '../types';

/**
 * M11 — Operations (department) REST surface.
 *
 * Mirrors the M10 `moderator.ts` shape so the rest of the
 * portal (hooks, components) can stay consistent. The
 * underlying routes are documented in
 * `backend/storage/api-docs/openapi.yaml` under the
 * `Operations` and `Department Admin` tags.
 */

export interface ReportListFilters {
  status?: string;
  priority?: string;
  category?: string;
  ward_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface AdminUpdatePayload {
  default_sla_minutes?: number;
  working_hours?: Array<{ day: string; open: string; close: string }>;
  holiday_calendar?: string[];
  escalation_matrix?: Array<{ after_minutes: number; escalate_to?: string | null }>;
}

export interface AttachOfficerPayload {
  user_id: string;
  is_manager?: boolean;
  assigned_at?: string;
}

export const departmentApi = {
  dashboard: () =>
    api.get<{ success: boolean; data: DepartmentDashboardCounts }>(
      '/department/dashboard',
    ),

  listReports: (filters: ReportListFilters = {}) =>
    api.get<Paginated<DepartmentReportListItem>>(
      '/department/reports',
      filters as Record<string, unknown>,
    ),

  showReport: (id: string) =>
    api.get<{ success: boolean; data: DepartmentReportListItem }>(
      `/department/reports/${id}`,
    ),

  /**
   * Builds the export URL for display only (e.g. showing the caller
   * what request will be made) — not for navigation/download. The
   * endpoint requires a bearer Authorization header this app has no
   * cookie session to supply, so an actual download must go through
   * exportDownload() below.
   */
  exportUrl: (format: 'csv' | 'xlsx' | 'pdf', filters: ReportListFilters = {}) => {
    const params = new URLSearchParams();
    params.set('format', format);
    for (const [k, v] of Object.entries(filters)) {
      if (v === undefined || v === null || v === '') continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        params.set(k, String(v));
      }
    }
    const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';
    return `${base.replace(/\/$/, '')}/department/reports/export?${params.toString()}`;
  },

  exportDownload: (format: 'csv' | 'xlsx' | 'pdf', filters: ReportListFilters = {}) => {
    const today = new Date().toISOString().slice(0, 10);
    return api.download(
      '/department/reports/export',
      { ...filters, format } as Record<string, unknown>,
      `department-reports-${today}.${format}`,
    );
  },

  action: (id: string, event: WorkflowEvent, note?: string) =>
    api.post<{ success: boolean; data: DepartmentReportListItem }>(
      `/department/reports/${id}/${event}`,
      note ? { note } : {},
    ),

  listNotes: (id: string) =>
    api.get<{ success: boolean; data: InternalNote[] }>(
      `/department/reports/${id}/notes`,
    ),

  addNote: (id: string, body: string) =>
    api.post<{ success: boolean; data: InternalNote }>(
      `/department/reports/${id}/note`,
      { body },
    ),
};

export const adminApi = {
  listOfficers: (departmentId: string) =>
    api.get<{ success: boolean; data: DepartmentOfficer[]; meta: { total: number } }>(
      `/admin/departments/${departmentId}/officers`,
    ),

  attachOfficer: (departmentId: string, payload: AttachOfficerPayload) =>
    api.post<{ success: boolean; data: { pivot_id: string; department_id: string } }>(
      `/admin/departments/${departmentId}/officers`,
      payload,
    ),

  detachOfficer: (departmentId: string, userId: string) =>
    api.delete<{ success: boolean; data: { removed: boolean } }>(
      `/admin/departments/${departmentId}/officers/${userId}`,
    ),

  updateAdmin: (departmentId: string, payload: AdminUpdatePayload) =>
    api.patch<{ success: boolean; data: AdminUpdatePayload }>(
      `/admin/departments/${departmentId}/admin`,
      payload,
    ),
};


// --- Security dashboard (T-M11-020) ---------------------------------
// Per docs/08 §19. Read-only aggregator for the operations portal.

export interface SecurityFailedLogin {
  id: string;
  user_id: string | null;
  user_name: string | null;
  mobile: string;
  ip: string | null;
  failure_reason: string | null;
  login_at: string;
}

export interface SecurityUserRecord {
  id: string;
  name: string | null;
  mobile: string;
  email: string | null;
  status: string;
  updated_at: string | null;
}

export interface SecurityEventRow {
  id: string;
  event: string;
  severity: string;
  user_id: string | null;
  ip: string | null;
  user_agent?: string | null;
  metadata?: unknown;
  created_at: string | null;
}

export interface SecurityWidget<T> {
  count: number;
  recent: T[];
}

export interface SecurityDashboardSnapshot {
  failed_logins: SecurityWidget<SecurityFailedLogin>;
  locked_accounts: SecurityWidget<SecurityUserRecord>;
  mock_gps_reports: SecurityWidget<SecurityEventRow>;
  spam_detection: SecurityWidget<SecurityEventRow>;
  rate_limited_users: SecurityWidget<SecurityEventRow>;
  suspicious_devices: SecurityWidget<SecurityEventRow>;
  blocked_users: SecurityWidget<SecurityUserRecord>;
  security_alerts: SecurityWidget<SecurityEventRow>;
  generated_at: string;
}

export const securityApi = {
  dashboard: () =>
    api.get<{ success: boolean; data: SecurityDashboardSnapshot }>(
      '/admin/security/dashboard',
    ),
};

// Re-export the shared ReportListItem for callers that
// only need the operations portal.
export type { ReportListItem };


// --- Audit log search (T-M11-019) ----------------------------------
// Per docs/08 §18 — the read-only auditor surface.

export interface AuditLogFilters {
  user_id?: string;
  role?: string;
  action?: string;
  entity?: string;
  entity_id?: string;
  ip?: string;
  device_fingerprint?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  user_name: string | null;
  roles: string[];
  entity: string;
  entity_id: string | null;
  action: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  device_fingerprint: string | null;
  request_id: string | null;
  created_at: string | null;
}

export const auditApi = {
  list: (filters: AuditLogFilters = {}) =>
    api.get<{ success: boolean; data: AuditLogRow[]; meta: PaginationMeta }>(
      '/admin/audit-logs',
      filters as Record<string, unknown>,
    ),

  // Build a CSV export URL the browser can navigate to. The
  // backend doesn't have a dedicated audit-logs export endpoint
  // yet, so we send the rows to a small in-browser CSV builder
  // via the list endpoint and let the page handle the download.
  exportUrl: (filters: AuditLogFilters = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v === undefined || v === null || v === '') continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        params.set(k, String(v));
      }
    }
    const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';
    return `${base.replace(/\/$/, '')}/admin/audit-logs?${params.toString()}`;
  },
};
