import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestRaw as apiRequest } from '../../../shared/api/client';
import type { ApiEnvelope } from '../../../shared/api/envelope';

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
      const res = await apiRequest<ApiEnvelope<AiProvider[]>>('/admin/ai/providers', {
        query: { active, per_page: 50 },
      });
      return res.data;
    },
  });
}

export function useAiPrompts(name?: string, status?: string) {
  return useQuery({
    queryKey: ['admin', 'ai', 'prompts', name, status],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<PromptVersion[]>>('/admin/ai/prompts', {
        query: { name, status, per_page: 50 },
      });
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
      apiRequest<ApiEnvelope<AiProvider>>(`/admin/ai/providers/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: patch,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai', 'providers'] }),
  });
}

export function useTestAiProvider() {
  return useMutation({
    mutationFn: async (id: string) =>
      apiRequest<{ healthy: boolean; error?: string }>(
        `/admin/ai/providers/${encodeURIComponent(id)}/test`,
        { method: 'POST' },
      ),
  });
}

export function useActivateAiProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiRequest<unknown>(`/admin/ai/providers/${encodeURIComponent(id)}/activate`, {
        method: 'POST',
      }),
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
      apiRequest<unknown>(`/admin/ai/prompts/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai', 'prompts'] }),
  });
}

export function useRollbackPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiRequest<unknown>(`/admin/ai/prompts/${encodeURIComponent(id)}/rollback`, {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai', 'prompts'] }),
  });
}
