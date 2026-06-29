import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, type ApiEnvelope, ApiError } from '../../../auth/api';

export interface AdminUser {
  id: string;
  name?: string | null;
  mobile: string;
  email?: string | null;
  status?: string | null;
  roles: string[];
  created_at?: string | null;
  deleted_at?: string | null;
}

export interface AdminRole {
  id: number | string;
  name: string;
  guard_name: string;
  protected?: boolean;
  permissions: string[];
  created_at?: string | null;
}

export interface AdminPermission {
  id: number | string;
  name: string;
  guard_name: string;
  created_at?: string | null;
}

export interface AdminReportType {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  requires_video: boolean;
  requires_photo: boolean;
  min_photos: number;
  max_photos: number;
  active: boolean;
  created_at?: string | null;
}

export interface SecurityPolicy {
  id: string;
  key: string;
  value: Record<string, unknown> | null;
  type: string;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AppConfigFlag {
  id: string;
  key: string;
  value: unknown;
  enabled: boolean;
  rollout_percentage: number;
  description?: string | null;
  created_at?: string | null;
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  role?: string | null;
  action: string;
  entity?: string | null;
  entity_id?: string | null;
  ip?: string | null;
  created_at: string;
}

export function useAdminUsers(q: string) {
  return useQuery({
    queryKey: ['admin', 'users', q],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AdminUser[]>>('/admin/users', { query: { q, per_page: 100 } });
      return res.data;
    },
  });
}

export function useAdminRoles() {
  return useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AdminRole[]>>('/admin/roles', { query: { per_page: 100 } });
      return res.data;
    },
  });
}

export function useAdminPermissions() {
  return useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AdminPermission[]>>('/admin/permissions', { query: { per_page: 200 } });
      return res.data;
    },
  });
}

export function useAdminReportTypes() {
  return useQuery({
    queryKey: ['admin', 'report-types'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AdminReportType[]>>('/admin/report-types', { query: { per_page: 100 } });
      return res.data;
    },
  });
}

export function useSecurityPolicies() {
  return useQuery({
    queryKey: ['admin', 'security-policies'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<SecurityPolicy[]>>('/admin/security-policies', { query: { per_page: 100 } });
      return res.data;
    },
  });
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['admin', 'app-configs'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AppConfigFlag[]>>('/admin/app-configs', { query: { per_page: 100 } });
      return res.data;
    },
  });
}

export function useAuditLogs(filters: Record<string, string | undefined>) {
  return useQuery({
    queryKey: ['admin', 'audit', filters],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AuditLog[]>>('/admin/audit-logs', { query: { ...filters, per_page: 100 } });
      return res.data;
    },
  });
}

export function useToggleFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      await apiRequest<unknown>(`/admin/app-configs/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: { key, enabled },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'app-configs'] }),
  });
}

export function useUpsertSecurityPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { key: string; value: Record<string, unknown>; type?: string; description?: string }) => {
      try {
        return await apiRequest<ApiEnvelope<SecurityPolicy>>('/admin/security-policies', {
          method: 'POST',
          body: input,
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return await apiRequest<ApiEnvelope<SecurityPolicy>>(`/admin/security-policies/${encodeURIComponent(input.key)}`, {
            method: 'PUT',
            body: input,
          });
        }
        throw err;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'security-policies'] }),
  });
}

/* ---------------------------------------------------------------------- *
 *  T-M12-015 + T-M12-012 — Platform health + Scheduler
 * ---------------------------------------------------------------------- */

export interface HealthComponent {
  status: 'ok' | 'degraded' | 'down';
  latency_ms: number;
  detail: string;
  checked_at: string;
  driver?: string;
  count?: number;
  disk?: string;
}

export interface PlatformHealth {
  status: 'ok' | 'degraded' | 'down';
  checked_at: string;
  components: Record<string, HealthComponent>;
}

export interface SchedulerJob {
  id: string;
  name: string;
  schedule: string;
  next_due?: string | null;
  last_run?: string | null;
  paused: boolean;
  description?: string;
  command?: string;
}

export function usePlatformHealth() {
  return useQuery({
    queryKey: ['admin', 'health'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<PlatformHealth>>('/admin/health');
      return res.data;
    },
    refetchInterval: 30_000,
  });
}

export function usePlatformHealthComponents() {
  return useQuery({
    queryKey: ['admin', 'health', 'components'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<{ components: Record<string, HealthComponent>; checked_at: string }>>(
        '/admin/health/components',
      );
      return res.data;
    },
    refetchInterval: 30_000,
  });
}

export function useSchedulerJobs() {
  return useQuery({
    queryKey: ['admin', 'scheduler', 'jobs'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<SchedulerJob[]>>('/admin/scheduler/jobs');
      return res.data;
    },
    refetchInterval: 30_000,
  });
}

export function useSchedulerAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; action: 'run-now' | 'pause' | 'resume' }) => {
      return apiRequest<unknown>(`/admin/scheduler/jobs/${encodeURIComponent(input.id)}/${input.action}`, {
        method: 'POST',
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'scheduler'] }),
  });
}

/* ---------------------------------------------------------------------- *
 *  T-M12-007 / 008 / 009 — Integrations + Storage + Notification configs
 * ---------------------------------------------------------------------- */

export interface Integration {
  id: string;
  code: string;
  name: string;
  provider: string;
  status: 'active' | 'degraded' | 'disabled' | 'pending';
  base_url?: string | null;
  credentials: Record<string, unknown>;
  settings: Record<string, unknown>;
  last_health_at?: string | null;
  last_health_status?: string | null;
  description?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
}

export interface MediaStorage {
  id: string;
  key: string;
  value: {
    disk: string;
    bucket?: string | null;
    endpoint?: string | null;
    region?: string | null;
    retention_days?: number;
    max_upload_mb?: number;
    public_url?: string | null;
  };
  updated_at?: string | null;
}

export interface NotificationConfig {
  id: string;
  channel: 'mail' | 'sms' | 'push' | 'webhook' | 'log';
  code: string;
  name: string;
  active: boolean;
  credentials: Record<string, unknown>;
  retry_policy: {
    max_attempts: number;
    backoff: number[];
  };
  locale?: string | null;
  description?: string | null;
  created_at?: string | null;
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
      apiRequest<unknown>(`/admin/integrations/${encodeURIComponent(id)}/health`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'integrations'] }),
  });
}

export function useMediaStorage() {
  return useQuery({
    queryKey: ['admin', 'media-storage'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<MediaStorage>>('/admin/media-storage');
      return res.data;
    },
  });
}

export function useUpdateMediaStorage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MediaStorage['value']) =>
      apiRequest<ApiEnvelope<MediaStorage>>('/admin/media-storage', { method: 'PUT', body: { value: input } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'media-storage'] }),
  });
}

export function useProbeMediaStorage() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest<ApiEnvelope<{ reachable: boolean; detail: string }>>('/admin/media-storage/probe', { method: 'POST' });
      return res.data;
    },
  });
}

export function useNotificationConfigs(params: { channel?: string; active?: boolean }) {
  return useQuery({
    queryKey: ['admin', 'notification-configs', params],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<NotificationConfig[]>>('/admin/notification-configs', {
        query: { ...params, per_page: 100 },
      });
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
      apiRequest<unknown>(`/admin/notification-configs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'notification-configs'] }),
  });
}
