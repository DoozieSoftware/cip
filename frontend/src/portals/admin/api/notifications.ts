import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestRaw as apiRequest } from '../../../shared/api/client';
import type { ApiEnvelope } from '../../../shared/api/envelope';

export interface NotificationConfig {
  id: string;
  channel: 'mail' | 'sms' | 'push' | 'webhook';
  code: string;
  display_name: string;
  active: boolean;
  credentials: Record<string, unknown>;
  retry_policy: {
    tries: number;
    backoff: number[];
  };
  settings: Record<string, unknown>;
  per_locale_defaults: Record<string, unknown>;
  created_at?: string | null;
}

export function useNotificationConfigs(params: { channel?: string; active?: boolean }) {
  return useQuery({
    queryKey: ['admin', 'notification-configs', params],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<NotificationConfig[]>>(
        '/admin/notification-configs',
        {
          query: { ...params, per_page: 100 },
        },
      );
      return res.data;
    },
  });
}

export function useUpsertNotificationConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<NotificationConfig> & { id?: string }) => {
      if (input.id) {
        return apiRequest<ApiEnvelope<NotificationConfig>>(
          `/admin/notification-configs/${encodeURIComponent(input.id)}`,
          { method: 'PUT', body: input },
        );
      }
      return apiRequest<ApiEnvelope<NotificationConfig>>('/admin/notification-configs', {
        method: 'POST',
        body: input,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'notification-configs'] }),
  });
}

export function useDeleteNotificationConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiRequest<unknown>(`/admin/notification-configs/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'notification-configs'] }),
  });
}
