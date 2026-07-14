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
}

export interface AdminUserInput {
  name?: string | null;
  mobile: string;
  email?: string | null;
  password?: string | null;
  status?: string;
  anonymous_enabled?: boolean;
  roles?: string[];
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

export interface AdminDepartment {
  id: string;
  name: string;
  code: string;
  parent_id?: string | null;
  jurisdiction?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  default_sla_minutes?: number | null;
  active: boolean;
}

export type AdminDepartmentInput = Omit<AdminDepartment, 'id'>;

export interface AdminOrganization {
  id: string;
  code: string;
  name: string;
  legal_name?: string | null;
  domain?: string | null;
  storage_quota_mb: number;
  active: boolean;
}

export type AdminOrganizationInput = Omit<AdminOrganization, 'id'>;

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
  user_name?: string | null;
  roles: string[];
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

export function useAdminDepartments() {
  return useQuery({
    queryKey: ['admin', 'departments'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AdminDepartment[]>>('/admin/departments', { query: { per_page: 100 } });
      return res.data;
    },
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminDepartmentInput) => apiRequest<ApiEnvelope<AdminDepartment>>('/admin/departments', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'departments'] }),
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: AdminDepartmentInput & { id: string }) => apiRequest<ApiEnvelope<AdminDepartment>>(`/admin/departments/${encodeURIComponent(id)}`, { method: 'PUT', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'departments'] }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<unknown>(`/admin/departments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'departments'] }),
  });
}

export function useAdminOrganizations() {
  return useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AdminOrganization[]>>('/admin/organizations', { query: { per_page: 100 } });
      return res.data;
    },
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminOrganizationInput) => apiRequest<ApiEnvelope<AdminOrganization>>('/admin/organizations', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'organizations'] }),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: AdminOrganizationInput & { id: string }) => apiRequest<ApiEnvelope<AdminOrganization>>(`/admin/organizations/${encodeURIComponent(id)}`, { method: 'PUT', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'organizations'] }),
  });
}

export function useDeleteOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<unknown>(`/admin/organizations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'organizations'] }),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminUserInput) =>
      apiRequest<ApiEnvelope<AdminUser>>('/admin/users', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<AdminUserInput> & { id: string }) =>
      apiRequest<ApiEnvelope<AdminUser>>(`/admin/users/${encodeURIComponent(id)}`, { method: 'PUT', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiRequest<unknown>(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
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

export interface AdminRoleInput {
  name: string;
  guard_name?: string;
  permissions?: string[];
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminRoleInput) =>
      apiRequest<ApiEnvelope<AdminRole>>('/admin/roles', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: AdminRoleInput & { id: string }) =>
      apiRequest<ApiEnvelope<AdminRole>>(`/admin/roles/${encodeURIComponent(id)}`, { method: 'PUT', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  });
}

export function useSyncRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, permissions }: { id: string; permissions: string[] }) =>
      apiRequest<ApiEnvelope<AdminRole>>(`/admin/roles/${encodeURIComponent(id)}/permissions/sync`, {
        method: 'POST',
        body: { permissions },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  });
}

export interface AdminReportTypeInput {
  name: string;
  code: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  requires_video?: boolean;
  requires_photo?: boolean;
  min_photos?: number;
  max_photos?: number;
  active?: boolean;
}

export function useCreateReportType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminReportTypeInput) =>
      apiRequest<ApiEnvelope<AdminReportType>>('/admin/report-types', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'report-types'] }),
  });
}

export function useUpdateReportType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: AdminReportTypeInput & { id: string }) =>
      apiRequest<ApiEnvelope<AdminReportType>>(`/admin/report-types/${encodeURIComponent(id)}`, { method: 'PUT', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'report-types'] }),
  });
}

export function useDeleteReportType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiRequest<ApiEnvelope<AdminReportType>>(`/admin/report-types/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'report-types'] }),
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
      const res = await apiRequest<ApiEnvelope<AuditLog[]>>('/admin/audit-logs', {
        query: { ...filters, per_page: filters.per_page ?? '500' },
      });
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
  command: string;
  expression: string;
  next_due_at?: string | null;
  timezone?: string | null;
  without_overlapping?: boolean;
  paused: boolean;
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

export interface MediaStorage {
  id: string;
  key: string;
  disk: string;
  region?: string | null;
  bucket?: string | null;
  endpoint?: string | null;
  retention_days: number;
  encryption_at_rest: boolean;
  max_photo_bytes: number;
  max_video_bytes: number;
  max_document_bytes: number;
  updated_at?: string | null;
}

export interface MediaStorageInput {
  disk: string;
  region?: string | null;
  bucket?: string | null;
  endpoint?: string | null;
  retention_days: number;
  encryption_at_rest: boolean;
  max_photo_bytes: number;
  max_video_bytes: number;
  max_document_bytes: number;
}

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
      const res = await apiRequest<ApiEnvelope<MediaStorage>>('/admin/media/storage');
      return res.data;
    },
  });
}

export function useUpdateMediaStorage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MediaStorageInput) =>
      apiRequest<ApiEnvelope<MediaStorage>>('/admin/media/storage', { method: 'PUT', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'media-storage'] }),
  });
}

export function useProbeMediaStorage() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest<ApiEnvelope<{ reachable: boolean; detail: string }>>('/admin/media/storage/probe', { method: 'POST' });
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

/* ---------------------------------------------------------------------- *
 *  T-M12-006 / T-M12-021 — AI providers + prompts
 * ---------------------------------------------------------------------- */

export type AiProviderDriver = 'qwen_vl' | 'openai_compatible';

export interface AiProvider {
  id: string;
  code: string;
  driver: AiProviderDriver;
  name: string;
  base_url?: string | null;
  auth_type: 'bearer' | 'api_key' | 'none';
  model: string;
  temperature: number;
  timeout_ms: number;
  retry_count: number;
  priority: number;
  is_fallback: boolean;
  active: boolean;
  has_secret: boolean;
  extra_headers?: Record<string, string>;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Write-only payload for create/update — `credentials` is never read back. */
export interface AiProviderInput {
  code: string;
  driver: AiProviderDriver;
  name: string;
  base_url: string;
  auth_type: 'bearer' | 'api_key' | 'none';
  credentials?: { api_key?: string };
  extra_headers?: Record<string, string>;
  model: string;
  temperature: number;
  timeout_ms: number;
  retry_count: number;
  priority: number;
  is_fallback: boolean;
  active: boolean;
}

export interface PromptVersion {
  id: string;
  name: string;
  version: number;
  status: 'draft' | 'approved' | 'deprecated';
  purpose?: string | null;
  provider_code?: string | null;
  prompt_text: string;
  expected_json_schema?: unknown;
  approved_at?: string | null;
  approved_by?: string | null;
  created_at?: string | null;
}

export function useAiProviders(active?: boolean) {
  return useQuery({
    queryKey: ['admin', 'ai', 'providers', active],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AiProvider[]>>('/admin/ai/providers', { query: { active, per_page: 50 } });
      return res.data;
    },
  });
}

export function useAiPrompts(name?: string, status?: string) {
  return useQuery({
    queryKey: ['admin', 'ai', 'prompts', name, status],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<PromptVersion[]>>('/admin/ai/prompts', { query: { name, status, per_page: 50 } });
      return res.data;
    },
  });
}

export function useCreateAiProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AiProviderInput) =>
      apiRequest<ApiEnvelope<AiProvider>>('/admin/ai/providers', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai', 'providers'] }),
  });
}

export function useUpdateAiProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<AiProviderInput> & { id: string }) =>
      apiRequest<ApiEnvelope<AiProvider>>(`/admin/ai/providers/${encodeURIComponent(id)}`, { method: 'PUT', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai', 'providers'] }),
  });
}

export function useTestAiProvider() {
  return useMutation({
    mutationFn: async (id: string) =>
      apiRequest<{ healthy: boolean; error?: string }>(`/admin/ai/providers/${encodeURIComponent(id)}/test`, { method: 'POST' }),
  });
}

export function useActivateAiProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiRequest<unknown>(`/admin/ai/providers/${encodeURIComponent(id)}/activate`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai', 'providers'] }),
  });
}

export function useCreatePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PromptVersion>) =>
      apiRequest<ApiEnvelope<PromptVersion>>('/admin/ai/prompts', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai', 'prompts'] }),
  });
}

export function useApprovePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiRequest<unknown>(`/admin/ai/prompts/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai', 'prompts'] }),
  });
}

export function useRollbackPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiRequest<unknown>(`/admin/ai/prompts/${encodeURIComponent(id)}/rollback`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai', 'prompts'] }),
  });
}

/* ---------------------------------------------------------------------- *
 *  T-M12-005 / T-M12-004 / T-M12-020 / T-M12-019 — Routing + Workflow
 * ---------------------------------------------------------------------- */

export interface RoutingRule {
  id: string;
  name: string;
  description?: string | null;
  conditions: Record<string, unknown>;
  // Required by StoreRoutingRuleRequest/UpdateRoutingRuleRequest — not
  // optional despite `?`, which only reflects that a new rule being
  // drafted client-side may not have them filled in yet.
  destination_department_id?: string | null;
  destination_department?: { id: string; code: string; name: string } | null;
  default_officer_id?: string | null;
  default_priority_id?: string | null;
  default_priority?: { id: string; code: string; name: string } | null;
  default_sla_minutes?: number | null;
  priority: number;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RoutingFormOptions {
  departments: Array<{ id: string; code: string; name: string }>;
  priorities: Array<{ id: string; code: string; name: string; sla_minutes: number }>;
}

export interface WorkflowState {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  is_initial: boolean;
  is_terminal: boolean;
  sort_order: number;
  color?: string | null;
  active: boolean;
}

export interface WorkflowTransition {
  id: string;
  from_state_id: string;
  to_state_id: string;
  event: string;
  required_role?: string | null;
  required_permission?: string | null;
  conditions?: Record<string, unknown> | null;
  sla_minutes?: number | null;
  notify_before_minutes?: number | null;
  priority: number;
  active: boolean;
}

export interface WorkflowDefinition {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export function useRoutingRules(params: { q?: string; active?: boolean } = {}) {
  return useQuery({
    queryKey: ['admin', 'routing-rules', params],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<RoutingRule[]>>('/admin/routing-rules', {
        query: { ...params, per_page: 100 },
      });
      return res.data;
    },
  });
}

export function useRoutingFormOptions() {
  return useQuery({
    queryKey: ['admin', 'routing-rules', 'options'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<RoutingFormOptions>>('/admin/routing-rules/options');
      return res.data;
    },
  });
}

export function useCreateRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RoutingRule>) =>
      apiRequest<ApiEnvelope<RoutingRule>>('/admin/routing-rules', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'routing-rules'] }),
  });
}

export function useUpdateRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<RoutingRule> & { id: string }) =>
      apiRequest<ApiEnvelope<RoutingRule>>(`/admin/routing-rules/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: patch,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'routing-rules'] }),
  });
}

export function useDeleteRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiRequest<unknown>(`/admin/routing-rules/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'routing-rules'] }),
  });
}

export function useReorderRoutingRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (order: string[]) =>
      apiRequest<unknown>('/admin/routing-rules/reorder', { method: 'POST', body: { order } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'routing-rules'] }),
  });
}

export function useWorkflows() {
  return useQuery({
    queryKey: ['admin', 'workflows'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<WorkflowDefinition[]>>('/admin/workflows', { query: { per_page: 100 } });
      return res.data;
    },
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<WorkflowDefinition>) =>
      apiRequest<ApiEnvelope<WorkflowDefinition>>('/admin/workflows', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'workflows'] }),
  });
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<WorkflowDefinition> & { id: string }) =>
      apiRequest<ApiEnvelope<WorkflowDefinition>>(`/admin/workflows/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: patch,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'workflows'] }),
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiRequest<unknown>(`/admin/workflows/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'workflows'] }),
  });
}

/* ---------------------------------------------------------------------- *
 *  T-M12-027 / T-M12-028 — Settings (retention + system config)
 * ---------------------------------------------------------------------- */

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
      const res = await apiRequest<ApiEnvelope<Setting[]>>('/admin/settings', { query: { q, per_page: 100 } });
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
      apiRequest<ApiEnvelope<Setting>>(`/admin/settings/${encodeURIComponent(key)}`, { method: 'PUT', body: patch }),
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
