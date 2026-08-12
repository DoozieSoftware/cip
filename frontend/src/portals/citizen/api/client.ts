import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  request,
  requestPaginated,
  upload,
  buildApiUrl,
  getToken,
  normalizePaginationMeta,
} from '../../../shared/api/client';
import { ApiError } from '../../../shared/api/errors';
import {
  type ReportType,
  type Department,
  type ReportSummary,
  type ReportDetail,
  type NotificationItem,
  type PaginationMeta,
  type LifecycleGroup,
  OPEN_STATUSES,
  AWAITING_CITIZEN_STATUSES,
  CLOSED_STATUSES,
  REJECTED_STATUSES,
  MERGED_STATUSES,
  lifecycleGroup,
} from '../types';

export type {
  ReportType,
  Department,
  ReportSummary,
  ReportDetail,
  NotificationItem,
  PaginationMeta,
  LifecycleGroup,
};
export { lifecycleGroup };

export {
  OPEN_STATUSES,
  AWAITING_CITIZEN_STATUSES,
  CLOSED_STATUSES,
  REJECTED_STATUSES,
  MERGED_STATUSES,
};

export interface ApiReportPayload extends Omit<ReportDetail, 'type' | 'media' | 'timeline'> {
  report_type?: ReportSummary['type'];
  type?: ReportSummary['type'];
  media?: ReportDetail['media'];
  timeline?: ReportDetail['timeline'];
}

interface ApiMediaPayload {
  id: string;
  type: string;
  signed_url?: string;
}

interface EvidenceManifest {
  ready: boolean;
  errors: Record<string, string>;
  revision: string;
}

export function normalizeReport(payload: ApiReportPayload): ReportDetail {
  return {
    ...payload,
    type: payload.type ?? payload.report_type ?? null,
    media: payload.media ?? [],
    timeline: payload.timeline ?? [],
  };
}

export function shouldRefreshSubmittedReport(report: ReportDetail | undefined): boolean {
  if (!report) return true;

  const status = report.status?.code;
  const expectedMedia = report.media_count ?? 0;

  return (
    status === 'submitted' || status === 'ai_processing' || expectedMedia > report.media.length
  );
}

interface ApiNotificationItem {
  id: string;
  subject?: string | null;
  body: string;
  channel: string;
  read_at?: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

interface NotificationsInboxResponse {
  items: ApiNotificationItem[];
  next_cursor?: string | null;
  unread_count?: number;
}

export function normalizeNotification(item: ApiNotificationItem): NotificationItem {
  return {
    id: item.id,
    title: item.subject ?? '',
    body: item.body,
    channel: item.channel,
    read_at: item.read_at,
    created_at: item.created_at,
    data: item.metadata ?? null,
  };
}

export function useReportTypes() {
  return useQuery({
    queryKey: ['report-types'],
    queryFn: async () => {
      const data = await request<ReportType[]>('/report-types');
      return data.filter((t) => t);
    },
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      return request<Department[]>('/departments', {
        query: { per_page: 100 },
      });
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const data = await request<NotificationsInboxResponse>('/notifications', {
        query: { per_page: 50 },
      });
      return (data.items ?? []).map((item) => normalizeNotification(item));
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await request<unknown>(`/notifications/${id}/read`, { method: 'POST' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export interface CreateReportInput {
  report_type_id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  reporter_latitude?: number;
  reporter_longitude?: number;
  reporter_accuracy_m?: number;
  reporter_gps_provider?: string;
  reporter_captured_at?: string;
  address?: string;
  accuracy_m?: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  gps_provider?: string;
  captured_at?: string;
  media_files?: File[];
  mock_gps_score?: number;
  idempotency_key?: string;
}

export async function submitReportPayload(
  input: CreateReportInput,
): Promise<{ id: string; status: string }> {
  const idempotencyKey =
    input.idempotency_key ??
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `report-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const created = await request<ApiReportPayload>('/reports', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: {
      report_type_id: input.report_type_id,
      title: input.title,
      description: input.description,
      latitude: input.latitude,
      longitude: input.longitude,
      reporter_latitude: input.reporter_latitude ?? input.latitude,
      reporter_longitude: input.reporter_longitude ?? input.longitude,
      reporter_accuracy: input.reporter_accuracy_m ?? null,
      reporter_gps_provider: input.reporter_gps_provider ?? null,
      reporter_captured_at: input.reporter_captured_at ?? null,
      address: input.address ?? null,
      accuracy: input.accuracy_m ?? null,
      altitude: input.altitude ?? null,
      heading: input.heading ?? null,
      speed: input.speed ?? null,
      gps_provider: input.gps_provider ?? null,
      captured_at: input.captured_at ?? null,
      mock_gps_score: input.mock_gps_score ?? null,
    },
  });
  const reportId = created.id;

  const files = input.media_files ?? [];
  if (files.length > 0) {
    await Promise.all(files.map((file) => uploadMedia(reportId, file)));
  }

  const finalize = async () =>
    request<ApiReportPayload>(`/reports/${reportId}/finalize`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    });

  if (files.length > 0) {
    // Hashing is asynchronous. Poll the server manifest so a successful
    // response always means the durable evidence set was actually finalized.
    const deadline = Date.now() + 30_000;
    while (true) {
      try {
        const manifest = await request<EvidenceManifest>(`/reports/${reportId}/evidence-manifest`);
        if (manifest.ready) break;
      } catch {
        // A transient manifest read is safe to retry while the upload queue
        // settles; finalization below remains the authoritative gate.
      }
      if (Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  try {
    const finalized = await finalize();
    const normalized = normalizeReport(finalized);
    return { id: normalized.id, status: normalized.status?.code ?? 'submitted' };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'EVIDENCE_NOT_READY') {
      throw new ApiError(
        error.status,
        error.code,
        'Evidence is still processing. Please retry when all uploads are ready.',
        error.details,
        error.traceId,
      );
    }
    throw error;
  }
}

const MEDIA_UPLOAD_TIMEOUT_MS = 60_000;

async function uploadMedia(reportId: string, file: File): Promise<void> {
  const isVideo = file.type.startsWith('video/');
  const path = isVideo ? `/reports/${reportId}/video` : `/reports/${reportId}/photos`;
  const fd = new FormData();
  if (isVideo) {
    fd.append('video', file);
  } else {
    fd.append('photos[]', file);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MEDIA_UPLOAD_TIMEOUT_MS);
  try {
    await upload<unknown>(path, fd, { signal: controller.signal });
  } catch (err) {
    console.warn('media upload error', file.name, err);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitReportPayload,
    onSuccess: (report) => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['citizen', 'reports'] });
      void qc.invalidateQueries({ queryKey: ['report', report.id] });
    },
  });
}

export function useReportDetail(id: string | undefined) {
  return useQuery({
    enabled: id !== undefined,
    queryKey: ['report', id],
    refetchInterval: (query) => (shouldRefreshSubmittedReport(query.state.data) ? 3_000 : false),
    queryFn: async () => {
      const report = await request<ApiReportPayload>(`/citizen/reports/${id}`);
      let media: ApiMediaPayload[] = [];

      const mediaResponse = await request<{ media: ApiMediaPayload[] }>(
        `/reports/${id}/media`,
      ).catch(() => null);
      if (mediaResponse !== null) {
        media = mediaResponse.media;
      }

      return normalizeReport({
        ...report,
        media: media.map((item) => ({
          id: item.id,
          kind: item.type.toUpperCase() === 'VIDEO' ? 'video' : 'photo',
          signed_url: item.signed_url,
        })),
      });
    },
  });
}

export interface CitizenReportFilters {
  status?: string;
  category?: string;
  area?: string;
  date_from?: string;
  date_to?: string;
  cursor?: string;
  cursor_mode?: boolean;
}

export function useCitizenReports(
  page = 1,
  perPage = 25,
  search = '',
  filters: CitizenReportFilters = {},
) {
  return useQuery({
    queryKey: ['citizen', 'reports', page, perPage, search, filters],
    queryFn: async () => {
      const { data, meta } = await requestPaginated<ApiReportPayload>(
        '/citizen/reports',
        {
          query: {
            page: filters.cursor ? undefined : page,
            per_page: perPage,
            q: search || undefined,
            status: filters.status || undefined,
            category: filters.category || undefined,
            area: filters.area || undefined,
            date_from: filters.date_from || undefined,
            date_to: filters.date_to || undefined,
            cursor: filters.cursor || undefined,
            cursor_mode: filters.cursor_mode || undefined,
          },
        },
        perPage,
      );

      return {
        data: data.map((report) => normalizeReport(report)),
        meta,
      };
    },
  });
}

export function useReportTimeline(id: string | undefined) {
  return useQuery({
    enabled: id !== undefined,
    queryKey: ['report', id, 'timeline'],
    queryFn: async () => {
      return request<ReportDetail['timeline']>(`/reports/${id}/timeline`);
    },
  });
}

export function useMergeDispute(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reason: string) => {
      await request<unknown>(`/citizen/reports/${id}/dispute-merge`, {
        method: 'POST',
        body: { reason },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['report', id] });
    },
  });
}

export function useVerifyResolution(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const data = await request<{ report: ApiReportPayload }>(`/citizen/reports/${id}/verify`, {
        method: 'POST',
      });
      return normalizeReport(data.report);
    },
    onSuccess: (report) => {
      qc.setQueryData(['report', id], report);
      void qc.invalidateQueries({ queryKey: ['citizen', 'reports'] });
      void qc.invalidateQueries({ queryKey: ['report', id, 'timeline'] });
    },
  });
}

export function useDisputeResolution(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reason: string) => {
      const data = await request<{ report: ApiReportPayload }>(`/citizen/reports/${id}/dispute`, {
        method: 'POST',
        body: { reason },
      });
      return normalizeReport(data.report);
    },
    onSuccess: (report) => {
      qc.setQueryData(['report', id], report);
      void qc.invalidateQueries({ queryKey: ['citizen', 'reports'] });
      void qc.invalidateQueries({ queryKey: ['report', id, 'timeline'] });
    },
  });
}

// Re-export buildApiUrl for any callers that need to construct URLs.
export { buildApiUrl, getToken, normalizePaginationMeta };
