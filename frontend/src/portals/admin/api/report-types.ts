import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestRaw as apiRequest } from '../../../shared/api/client';
import type { ApiEnvelope } from '../../../shared/api/envelope';

export interface AdminReportType {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  localizations?: Record<string, string> | null;
  aliases?: string[] | null;
  sort_order: number;
  requires_video: boolean;
  requires_photo: boolean;
  min_photos: number;
  max_photos: number;
  response_target_minutes: number | null;
  active: boolean;
  created_at?: string | null;
}

export interface AdminReportTypeInput {
  name: string;
  code: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  localizations?: Record<string, string> | null;
  aliases?: string[] | null;
  sort_order?: number;
  requires_video?: boolean;
  requires_photo?: boolean;
  min_photos?: number;
  max_photos?: number;
  response_target_minutes?: number | null;
  active?: boolean;
}

export function useAdminReportTypes() {
  return useQuery({
    queryKey: ['admin', 'report-types'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AdminReportType[]>>('/admin/report-types', {
        query: { per_page: 100 },
      });
      return res.data;
    },
  });
}

export function useCreateReportType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminReportTypeInput) =>
      apiRequest<ApiEnvelope<AdminReportType>>('/admin/report-types', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'report-types'] }),
  });
}

export function useUpdateReportType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: AdminReportTypeInput & { id: string }) =>
      apiRequest<ApiEnvelope<AdminReportType>>(`/admin/report-types/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: patch,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'report-types'] }),
  });
}

export function useDeleteReportType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiRequest<unknown>(`/admin/report-types/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'report-types'] }),
  });
}
