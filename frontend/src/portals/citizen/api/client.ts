import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  request,
  requestPaginated,
  upload,
  buildApiUrl,
  getToken,
  normalizePaginationMeta,
} from '../../../shared/api/client';
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
  address?: string;
  accuracy_m?: number;
  media_files?: File[];
  mock_gps_score?: number;
}

export async function submitReportPayload(
  input: CreateReportInput,
): Promise<{ id: string; status: string }> {
  const created = await request<ApiReportPayload>('/reports', {
    method: 'POST',
    body: {
      report_type_id: input.report_type_id,
      title: input.title,
      description: input.description,
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address ?? null,
      accuracy: input.accuracy_m ?? null,
      mock_gps_score: input.mock_gps_score ?? null,
    },
  });
  const reportId = created.id;

  if (input.media_files && input.media_files.length > 0) {
    void Promise.all(input.media_files.map((file) => uploadMedia(reportId, file))).catch(
      () => undefined,
    );
  }

  const createdReport = normalizeReport(created);
  return {
    id: createdReport.id,
    status: createdReport.status?.code ?? 'submitted',
  };
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

export function useCitizenReports(page = 1, perPage = 25) {
  return useQuery({
    queryKey: ['citizen', 'reports', page, perPage],
    queryFn: async () => {
      const { data, meta } = await requestPaginated<ApiReportPayload>(
        '/citizen/reports',
        { query: { page, per_page: perPage } },
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
