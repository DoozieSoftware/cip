import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestRaw as apiRequest } from '../../../shared/api/client';
import type { ApiEnvelope } from '../../../shared/api/envelope';

export interface Setting {
  id: string;
  key: string;
  value: unknown;
  type: 'string' | 'int' | 'bool' | 'json' | 'datetime';
  description?: string | null;
  is_public: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export function useSettings(q?: string) {
  return useQuery({
    queryKey: ['admin', 'settings', q],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<Setting[]>>('/admin/settings', {
        query: { q, per_page: 100 },
      });
      return res.data;
    },
  });
}

export function useCreateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Setting>) =>
      apiRequest<ApiEnvelope<Setting>>('/admin/settings', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, ...patch }: Partial<Setting> & { key: string }) =>
      apiRequest<ApiEnvelope<Setting>>(`/admin/settings/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: patch,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  });
}

export function useDeleteSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) =>
      apiRequest<unknown>(`/admin/settings/${encodeURIComponent(key)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  });
}

export type RetentionHoldEntityType =
  | 'media'
  | 'security_event'
  | 'notification'
  | 'ai_job'
  | 'ai_result'
  | 'ai_label';

export interface RetentionHold {
  id: string;
  entity_type: RetentionHoldEntityType;
  entity_id: string;
  reason: string;
  held_by?: string | null;
  expires_at?: string | null;
  released_at?: string | null;
  released_by?: string | null;
  release_reason?: string | null;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RetentionHoldInput {
  entity_type: RetentionHoldEntityType;
  entity_id: string;
  reason: string;
  expires_at?: string | null;
}

export function useRetentionHolds(active = true) {
  return useQuery({
    queryKey: ['admin', 'retention-holds', active],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<RetentionHold[]>>('/admin/retention-holds', {
        query: { active, per_page: 100 },
      });
      return res.data;
    },
  });
}

export function useCreateRetentionHold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RetentionHoldInput) =>
      apiRequest<ApiEnvelope<RetentionHold>>('/admin/retention-holds', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'retention-holds'] }),
  });
}

export function useReleaseRetentionHold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, release_reason }: { id: string; release_reason: string }) =>
      apiRequest<ApiEnvelope<RetentionHold>>(
        `/admin/retention-holds/${encodeURIComponent(id)}/release`,
        { method: 'POST', body: { release_reason } },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'retention-holds'] }),
  });
}
