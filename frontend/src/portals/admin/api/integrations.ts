import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestRaw as apiRequest } from '../../../shared/api/client';
import type { ApiEnvelope } from '../../../shared/api/envelope';

export interface Integration {
  id: string;
  code: string;
  display_name: string;
  provider: string;
  status: 'active' | 'degraded' | 'disabled' | 'pending';
  base_url?: string | null;
  credentials: Record<string, unknown>;
  settings: Record<string, unknown>;
  last_check_at?: string | null;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export function useIntegrations(params: { q?: string; status?: string; provider?: string }) {
  return useQuery({
    queryKey: ['admin', 'integrations', params],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<Integration[]>>('/admin/integrations', {
        query: { ...params, per_page: 100 },
      });
      return res.data;
    },
  });
}

export function useCreateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Integration>) =>
      apiRequest<ApiEnvelope<Integration>>('/admin/integrations', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'integrations'] }),
  });
}

export function useUpdateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Integration> & { id: string }) =>
      apiRequest<ApiEnvelope<Integration>>(`/admin/integrations/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: patch,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'integrations'] }),
  });
}

export function useDeleteIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiRequest<unknown>(`/admin/integrations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'integrations'] }),
  });
}

export function useProbeIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiRequest<unknown>(`/admin/integrations/${encodeURIComponent(id)}/health`, {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'integrations'] }),
  });
}
