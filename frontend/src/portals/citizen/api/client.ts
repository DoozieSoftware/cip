import { apiRequest, buildApiUrl, getToken, type ApiEnvelope } from '../../../auth/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

function normalizePaginationMeta(
  meta: Record<string, unknown> | undefined,
  fallbackPerPage: number,
): PaginationMeta {
  return {
    page: typeof meta?.page === 'number' ? meta.page : 1,
    per_page: typeof meta?.per_page === 'number' ? meta.per_page : fallbackPerPage,
    total: typeof meta?.total === 'number' ? meta.total : 0,
    last_page: typeof meta?.last_page === 'number' ? meta.last_page : 1,
  };
}

export function useReportTypes() {
  return useQuery({
    queryKey: ['report-types'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<ReportType[]>>('/report-types');
      return res.data.filter((t) => t);
    },
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<Department[]>>('/departments', {
        query: { per_page: 100 },
      });
      return res.data;
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<NotificationsInboxResponse>>('/notifications', {
        query: { per_page: 50 },
      });
      return (res.data.items ?? []).map((item) => normalizeNotification(item));
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest<unknown>(`/notifications/${id}/read`, { method: 'POST' });
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
  const create = await apiRequest<ApiEnvelope<ApiReportPayload>>('/reports', {
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
  const reportId = create.data.id;

  if (input.media_files && input.media_files.length > 0) {
    const token = getToken();
    void Promise.all(input.media_files.map((file) => uploadMedia(reportId, file, token))).catch(
      () => undefined,
    );
  }

  const createdReport = normalizeReport(create.data);
  return {
    id: createdReport.id,
    status: createdReport.status?.code ?? 'submitted',
  };
}

const MEDIA_UPLOAD_TIMEOUT_MS = 60_000;

async function uploadMedia(reportId: string, file: File, token: string | null): Promise<void> {
  const isVideo = file.type.startsWith('video/');
  const url = buildApiUrl(isVideo ? `/reports/${reportId}/video` : `/reports/${reportId}/photos`);
  const fd = new FormData();
  if (isVideo) {
    fd.append('video', file);
  } else {
    fd.append('photos[]', file);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MEDIA_UPLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
      credentials: 'same-origin',
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn('media upload failed', file.name, res.status);
    }
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
      const report = await apiRequest<ApiEnvelope<ApiReportPayload>>(`/citizen/reports/${id}`);
      let media: ApiMediaPayload[] = [];

      const mediaResponse = await apiRequest<ApiEnvelope<{ media: ApiMediaPayload[] }>>(
        `/reports/${id}/media`,
      ).catch(() => null);
      if (mediaResponse !== null) {
        media = mediaResponse.data.media;
      }

      return normalizeReport({
        ...report.data,
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
      const res = await apiRequest<ApiEnvelope<ApiReportPayload[]>>('/citizen/reports', {
        query: { page, per_page: perPage },
      });

      return {
        data: res.data.map((report) => normalizeReport(report)),
        meta: normalizePaginationMeta(res.meta, perPage),
      };
    },
  });
}

export function useReportTimeline(id: string | undefined) {
  return useQuery({
    enabled: id !== undefined,
    queryKey: ['report', id, 'timeline'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<ReportDetail['timeline']>>(
        `/reports/${id}/timeline`,
      );
      return res.data;
    },
  });
}
