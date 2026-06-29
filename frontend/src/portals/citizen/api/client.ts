import { apiRequest, type ApiEnvelope } from '../../../auth/api';
import { useAuth } from '../../../auth/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ReportType {
  id: string;
  name: string;
  code: string;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  requires_video: boolean;
  requires_photo: boolean;
  min_photos: number;
  max_photos: number;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
}

export interface ReportSummary {
  id: string;
  title: string;
  description?: string | null;
  status: { code: string; name: string };
  type: { code: string; name: string; icon?: string | null };
  priority: { code: string; name: string };
  created_at?: string | null;
  updated_at?: string | null;
  assigned_department?: { id: string; name: string; code: string } | null;
  location?: { latitude: number; longitude: number; address?: string | null } | null;
  media_count?: number;
}

export interface ReportDetail extends ReportSummary {
  timeline: Array<{ at: string; actor?: string | null; event: string; note?: string | null }>;
  media: Array<{ id: string; kind: 'photo' | 'video'; url?: string; signed_url?: string; audit?: unknown }>;
  ai_summary?: {
    labels: Array<{ name: string; confidence: number }>;
    fraud_score: number;
    duplicate_of?: string | null;
    recommended_department?: { name: string; code: string } | null;
  } | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  channel: string;
  read_at?: string | null;
  created_at: string;
  data?: Record<string, unknown> | null;
}

export function useReportTypes() {
  return useQuery({
    queryKey: ['report-types'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<ReportType[]>>('/admin/report-types', { query: { per_page: 100 } });
      return res.data.filter((t) => t);
    },
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<Department[]>>('/departments', { query: { per_page: 100 } });
      return res.data;
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<NotificationItem[]>>('/notifications', { query: { per_page: 50 } });
      return res.data;
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
}

export function useCreateReport() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateReportInput) => {
      const create = await apiRequest<ApiEnvelope<{ id: string; status: string }>>('/reports', {
        method: 'POST',
        body: {
          report_type_id: input.report_type_id,
          title: input.title,
          description: input.description,
          latitude: input.latitude,
          longitude: input.longitude,
          address: input.address ?? null,
          accuracy_m: input.accuracy_m ?? null,
        },
      });
      const reportId = create.data.id;

      // Upload files (best-effort) using the bearer token directly via fetch.
      if (input.media_files && input.media_files.length > 0) {
        for (const file of input.media_files) {
          const isVideo = file.type.startsWith('video/');
          const url = isVideo
            ? `/api/v1/reports/${reportId}/video`
            : `/api/v1/reports/${reportId}/photos`;
          const fd = new FormData();
          if (isVideo) {
            fd.append('video', file);
          } else {
            fd.append('photos[]', file);
          }
          const res = await fetch(url, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: fd,
            credentials: 'same-origin',
          });
          if (!res.ok) {
            // continue on photo failures
             
            console.warn('media upload failed', file.name, res.status);
          }
        }
      }

      // Submit
      const submitted = await apiRequest<ApiEnvelope<{ id: string; status: string }>>(`/reports/${reportId}/submit`, {
        method: 'POST',
      });
      return submitted.data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });
}

export function useReportDetail(id: string | undefined) {
  return useQuery({
    enabled: id !== undefined,
    queryKey: ['report', id],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<ReportDetail>>(`/reports/${id}`);
      return res.data;
    },
  });
}

export function useReportTimeline(id: string | undefined) {
  return useQuery({
    enabled: id !== undefined,
    queryKey: ['report', id, 'timeline'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<ReportDetail['timeline']>>(`/reports/${id}/timeline`);
      return res.data;
    },
  });
}
