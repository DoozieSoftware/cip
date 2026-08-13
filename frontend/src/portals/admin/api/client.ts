import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requestRaw as apiRequest } from '../../../shared/api/client';
import { ApiError } from '../../../shared/api/errors';
import type { ApiEnvelope } from '../../../shared/api/envelope';

export { useAdminUsers, useCreateUser, useUpdateUser, useDeleteUser } from './users';
export type { AdminUser, AdminUserInput } from './users';

export {
  useAdminRoles,
  useAdminPermissions,
  useCreateRole,
  useUpdateRole,
  useSyncRolePermissions,
} from './roles';
export type { AdminRole, AdminPermission, AdminRoleInput } from './roles';

export {
  useAdminDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from './departments';
export type { AdminDepartment, AdminDepartmentInput } from './departments';

export {
  useAdminOrganizations,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
} from './organizations';
export type { AdminOrganization, AdminOrganizationInput } from './organizations';

export { useAdminReports } from './reports';
export type {
  AdminReport,
  AdminReportAssignment,
  AdminReportFilters,
  AdminReportPagination,
} from './reports';

export {
  useAdminReportTypes,
  useCreateReportType,
  useUpdateReportType,
  useDeleteReportType,
} from './report-types';
export type { AdminReportType, AdminReportTypeInput } from './report-types';

export {
  useIntegrations,
  useCreateIntegration,
  useUpdateIntegration,
  useDeleteIntegration,
  useProbeIntegration,
} from './integrations';
export type { Integration } from './integrations';

export {
  useNotificationConfigs,
  useUpsertNotificationConfig,
  useDeleteNotificationConfig,
} from './notifications';
export type { NotificationConfig } from './notifications';

export {
  useAiProviders,
  useAiPrompts,
  useCreateAiProvider,
  useUpdateAiProvider,
  useTestAiProvider,
  useActivateAiProvider,
  useCreatePrompt,
  useApprovePrompt,
  useRollbackPrompt,
} from './ai';
export type { AiProviderDriver, AiProvider, AiProviderInput, PromptVersion } from './ai';

export {
  useSettings,
  useCreateSetting,
  useUpdateSetting,
  useDeleteSetting,
  useRetentionHolds,
  useCreateRetentionHold,
  useReleaseRetentionHold,
} from './settings';
export type {
  Setting,
  RetentionHoldEntityType,
  RetentionHold,
  RetentionHoldInput,
} from './settings';

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

export function useSecurityPolicies() {
  return useQuery({
    queryKey: ['admin', 'security-policies'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<SecurityPolicy[]>>('/admin/security-policies', {
        query: { per_page: 100 },
      });
      return res.data;
    },
  });
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['admin', 'app-configs'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AppConfigFlag[]>>('/admin/app-configs', {
        query: { per_page: 100 },
      });
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
    mutationFn: async (input: {
      key: string;
      value: Record<string, unknown>;
      type?: string;
      description?: string;
    }) => {
      try {
        return await apiRequest<ApiEnvelope<SecurityPolicy>>('/admin/security-policies', {
          method: 'POST',
          body: input,
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return await apiRequest<ApiEnvelope<SecurityPolicy>>(
            `/admin/security-policies/${encodeURIComponent(input.key)}`,
            {
              method: 'PUT',
              body: input,
            },
          );
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
      const res = await apiRequest<
        ApiEnvelope<{ components: Record<string, HealthComponent>; checked_at: string }>
      >('/admin/health/components');
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
      return apiRequest<unknown>(
        `/admin/scheduler/jobs/${encodeURIComponent(input.id)}/${input.action}`,
        {
          method: 'POST',
        },
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'scheduler'] }),
  });
}

/* ---------------------------------------------------------------------- *
 *  T-M12-007 / 008 / 009 — Integrations + Storage + Notification configs
 * ---------------------------------------------------------------------- */

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
      const res = await apiRequest<ApiEnvelope<{ reachable: boolean; detail: string }>>(
        '/admin/media/storage/probe',
        { method: 'POST' },
      );
      return res.data;
    },
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
      const res = await apiRequest<ApiEnvelope<WorkflowDefinition[]>>('/admin/workflows', {
        query: { per_page: 100 },
      });
      return res.data;
    },
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<WorkflowDefinition>) =>
      apiRequest<ApiEnvelope<WorkflowDefinition>>('/admin/workflows', {
        method: 'POST',
        body: input,
      }),
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
