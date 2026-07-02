import { api } from './client';
import type {
  AnalyticsSummary,
  AiPerformance,
  MergePayload,
  Paginated,
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
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

export const queueApi = {
  list: (filters: QueueFilters = {}) =>
    api.get<Paginated<ReportListItem>>('/moderator/queue', filters as Record<string, unknown>),

  duplicates: (filters: QueueFilters = {}) =>
    api.get<Paginated<ReportListItem>>('/moderator/duplicates', filters as Record<string, unknown>),

  fraud: (filters: QueueFilters = {}) =>
    api.get<Paginated<ReportListItem>>('/moderator/fraud', filters as Record<string, unknown>),

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
};

export const analyticsApi = {
  summary: () => api.get<AnalyticsSummary>('/moderator/analytics/summary'),
  aiPerformance: (window: '24h' | '7d' | '30d' = '7d') =>
    api.get<AiPerformance>('/moderator/analytics/ai-performance', { window }),
};
