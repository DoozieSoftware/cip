import { api } from './client';
import { buildApiUrl, requestRaw } from '../../../shared/api/client';
import type { ApiEnvelope } from '../../../shared/api/envelope';
import type {
  PaginationMeta,
  DepartmentDashboardCounts,
  DepartmentReportDetail,
  DepartmentReportListItem,
  DepartmentReportMedia,
  DepartmentOfficer,
  InternalNote,
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
  /** Scoped department for multi-membership staff (resolver-validated). */
  department_id?: string;
  assignment_kind?: 'primary' | 'secondary';
}

export interface Membership {
  id: string;
  code: string;
  name: string;
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

export interface ManagedDepartment {
  id: string;
  code: string;
  name: string;
}

export interface AttachableUser {
  id: string;
  name: string | null;
  mobile: string;
  email: string | null;
  roles?: string[];
}

export interface ProofCaptureLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: string;
}

export const departmentApi = {
  dashboard: (params: Record<string, unknown> = {}) =>
    api.get<DepartmentDashboardCounts>('/department/dashboard', params),

  memberships: () => api.get<Membership[]>('/department/memberships'),

  listReports: (filters: ReportListFilters = {}) =>
    requestRaw<ApiEnvelope<DepartmentReportListItem[]>>('/department/reports', {
      method: 'GET',
      query: filters as Record<string, string | number | boolean | undefined | null>,
    }).then((response) => ({
      data: response.data,
      meta: {
        current_page: Number(response.meta?.current_page ?? response.meta?.page ?? 1),
        per_page: Number(response.meta?.per_page ?? filters.per_page ?? 20),
        total: Number(response.meta?.total ?? response.data.length),
        last_page: Number(response.meta?.last_page ?? 1),
      },
    })),

  showReport: (id: string) => api.get<DepartmentReportDetail>(`/department/reports/${id}`),

  showReportInDepartment: (id: string, departmentId: string) =>
    api.get<DepartmentReportDetail>(`/department/reports/${id}`, {
      department_id: departmentId,
    }),

  /**
   * Uploads proof photos to a department report. The endpoint expects
   * multipart form-data with the files under `photos[]` and an optional
   * `note` string; uploaded media comes back with role "proof".
   */
  uploadProof: (
    id: string,
    files: File[],
    capture: ProofCaptureLocation,
    assignmentId?: string,
    departmentId?: string,
    note?: string,
  ) => {
    const form = new FormData();
    for (const file of files) {
      form.append('photos[]', file);
    }
    form.append('capture_latitude', String(capture.latitude));
    form.append('capture_longitude', String(capture.longitude));
    if (capture.accuracy != null) form.append('capture_accuracy', String(capture.accuracy));
    if (capture.altitude != null) form.append('capture_altitude', String(capture.altitude));
    if (capture.heading != null) form.append('capture_heading', String(capture.heading));
    if (capture.speed != null) form.append('capture_speed', String(capture.speed));
    form.append('capture_timestamp', capture.timestamp);
    if (assignmentId) form.append('assignment_id', assignmentId);
    if (departmentId) form.append('department_id', departmentId);
    if (note) {
      form.append('note', note);
    }
    return api.upload<{
      media: DepartmentReportMedia[];
      verification_status: 'processing';
    }>(`/department/reports/${id}/photos`, form);
  },

  /**
   * Soft-removes a wrongly-uploaded proof photo. The backend marks the
   * media row is_replaced rather than deleting it, so it drops out of
   * the active gallery but the file and audit trail survive.
   */
  removeProof: (reportId: string, mediaId: string) =>
    api.delete<{ success: boolean }>(`/department/reports/${reportId}/photos/${mediaId}`),

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
    return buildApiUrl('/department/reports/export', Object.fromEntries(params));
  },

  exportDownload: (format: 'csv' | 'xlsx' | 'pdf', filters: ReportListFilters = {}) => {
    const today = new Date().toISOString().slice(0, 10);
    return api.download(
      '/department/reports/export',
      { ...filters, format },
      `department-reports-${today}.${format}`,
    );
  },

  action: (
    id: string,
    event: WorkflowEvent,
    note: string | undefined,
    expectedWorkflowVersion: number,
    departmentId?: string,
  ) =>
    api.post<DepartmentReportListItem>(`/department/reports/${id}/${event}`, {
      ...(note ? { note } : {}),
      expected_workflow_version: expectedWorkflowVersion,
      ...(departmentId ? { department_id: departmentId } : {}),
    }),

  completeTask: (reportId: string, assignmentId: string, note?: string, departmentId?: string) =>
    api.post<DepartmentReportDetail>(
      `/department/reports/${reportId}/tasks/${assignmentId}/complete`,
      { ...(note ? { note } : {}), ...(departmentId ? { department_id: departmentId } : {}) },
      { department_id: departmentId },
    ),

  listNotes: (id: string, departmentId?: string) =>
    api.get<InternalNote[]>(`/department/reports/${id}/notes`, {
      department_id: departmentId,
    }),

  addNote: (id: string, body: string, departmentId?: string) =>
    api.post<InternalNote>(
      `/department/reports/${id}/note`,
      { body },
      { department_id: departmentId },
    ),
};

export const adminApi = {
  listDepartments: () =>
    api.get<ManagedDepartment[]>('/admin/departments', {
      active: true,
      per_page: 100,
    }),

  listOfficers: (departmentId: string) =>
    api.get<{ data: DepartmentOfficer[]; meta: { total: number } }>(
      `/admin/departments/${departmentId}/officers`,
    ),

  listAttachableUsers: () =>
    api
      .get<AttachableUser[]>('/admin/users', { status: 'active', per_page: 100 })
      .then((users) =>
        users.filter(
          (user) =>
            user.roles === undefined ||
            user.roles.some((role) =>
              ['department_officer', 'department_admin', 'moderator', 'super_admin'].includes(role),
            ),
        ),
      ),

  attachOfficer: (departmentId: string, payload: AttachOfficerPayload) =>
    api.post<{ pivot_id: string; department_id: string }>(
      `/admin/departments/${departmentId}/officers`,
      payload,
    ),

  detachOfficer: (departmentId: string, userId: string) =>
    api.delete<{ removed: boolean }>(`/admin/departments/${departmentId}/officers/${userId}`),

  updateAdmin: (departmentId: string, payload: AdminUpdatePayload) =>
    api.patch<AdminUpdatePayload>(`/admin/departments/${departmentId}/admin`, payload),
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
  dashboard: () => api.get<SecurityDashboardSnapshot>('/admin/security/dashboard'),
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
    api.get<{ data: AuditLogRow[]; meta: PaginationMeta }>(
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
    return buildApiUrl('/admin/audit-logs', Object.fromEntries(params));
  },
};
