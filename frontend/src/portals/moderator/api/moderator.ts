import { api } from './client';
import type {
  AnalyticsSummary,
  AiPerformance,
  Category,
  CursorPaginated,
  MergePayload,
  ReportDetail,
  ReportListItem,
  ReviewPayload,
} from '../types';

export interface QueueFilters {
  status?: string;
  category?: string;
  ward?: string;
  district?: string;
  confidence_min?: number;
  confidence_max?: number;
  // Matches the backend's `from`/`to` query params (see QueueController::applyFilters).
  from?: string;
  to?: string;
  cursor?: string;
  per_page?: number;
}

interface ApiModeratorReport {
  id: string;
  tracking_number: string;
  title: string;
  description?: string | null;
  ai_confidence: number | null;
  fraud_score: number | null;
  duplicate_score: number | null;
  mock_gps_score: number | null;
  submitted_at?: string | null;
  created_at?: string | null;
  report_type?: Category | null;
  status?: { code?: string | null } | null;
}

interface ApiCursorPage<T> {
  items: T[];
  next_cursor?: string | null;
  prev_cursor?: string | null;
}

function normalizeQueueItem(report: ApiModeratorReport): ReportListItem {
  return {
    id: report.id,
    tracking_number: report.tracking_number,
    title: report.title,
    category: report.report_type ?? null,
    department: null,
    status_code: (report.status?.code ?? 'submitted') as ReportListItem['status_code'],
    ai_confidence: report.ai_confidence,
    fraud_score: report.fraud_score,
    duplicate_score: report.duplicate_score,
    mock_gps_score: report.mock_gps_score,
    submitted_at: report.submitted_at ?? report.created_at ?? new Date(0).toISOString(),
    ward: null,
    district: null,
    evidence_count: 0,
  };
}

function normalizeCursorPage(page: ApiCursorPage<ApiModeratorReport>): CursorPaginated<ReportListItem> {
  return {
    data: (page.items ?? []).map((report) => normalizeQueueItem(report)),
    next_cursor: page.next_cursor ?? null,
    prev_cursor: page.prev_cursor ?? null,
  };
}

export const queueApi = {
  list: (filters: QueueFilters = {}) =>
    api.get<ApiCursorPage<ApiModeratorReport>>('/moderator/queue', filters as Record<string, unknown>)
      .then((page) => normalizeCursorPage(page)),

  duplicates: (filters: QueueFilters = {}) =>
    api.get<ApiCursorPage<ApiModeratorReport>>('/moderator/duplicates', filters as Record<string, unknown>)
      .then((page) => normalizeCursorPage(page)),

  fraud: (filters: QueueFilters = {}) =>
    api.get<ApiCursorPage<ApiModeratorReport>>('/moderator/fraud', filters as Record<string, unknown>)
      .then((page) => normalizeCursorPage(page)),

  // QueueController::show() nests the resource under a `report` key
  // (`respond(['report' => ...])`) — one level deeper than the
  // ApiResponse envelope `client.ts` already unwraps.
  show: (id: string) => api.get<{ report: ReportDetail }>(`/moderator/reports/${id}`).then((r) => r.report),
};

export const actionsApi = {
  review: (id: string, payload: ReviewPayload) =>
    api.post<{ report: ReportDetail }>(`/moderator/reports/${id}/review`, payload).then((r) => r.report),

  merge: (id: string, payload: MergePayload) =>
    api.post<{ merged_count: number; merged_report_ids: string[] }>(`/moderator/reports/${id}/merge`, payload),

  reject: (id: string, payload: { reason_code: string; remarks?: string }) =>
    api.post<{ report: ReportDetail }>(`/moderator/reports/${id}/reject`, payload).then((r) => r.report),

  escalate: (id: string, payload: { reason_code: string; remarks?: string; level?: string }) =>
    api.post<{ report: ReportDetail }>(`/moderator/reports/${id}/escalate`, payload).then((r) => r.report),

  // T-M7-010's endpoint lives under /admin, not /moderator, but
  // ReassignReportRequest::authorize() already permits the moderator
  // role — only super_admin's route middleware guards the path prefix.
  reassign: (id: string, payload: { department_id: string; officer_id?: string; reason: string }) =>
    api.post<{ id: string; report_id: string; department_id: string; officer_id: string | null }>(
      `/admin/reports/${id}/reassign`,
      payload,
    ),
};

export const analyticsApi = {
  summary: () => api.get<AnalyticsSummary>('/moderator/analytics/summary'),
  aiPerformance: (window: '24h' | '7d' | '30d' = '7d') =>
    api.get<AiPerformance>('/moderator/analytics/ai-performance', { window }),
};
