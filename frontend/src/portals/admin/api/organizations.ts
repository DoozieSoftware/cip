import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestRaw as apiRequest } from '../../../shared/api/client';
import type { ApiEnvelope } from '../../../shared/api/envelope';

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

export function useAdminOrganizations() {
  return useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AdminOrganization[]>>('/admin/organizations', {
        query: { per_page: 100 },
      });
      return res.data;
    },
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminOrganizationInput) =>
      apiRequest<ApiEnvelope<AdminOrganization>>('/admin/organizations', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'organizations'] }),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: AdminOrganizationInput & { id: string }) =>
      apiRequest<ApiEnvelope<AdminOrganization>>(`/admin/organizations/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'organizations'] }),
  });
}

export function useDeleteOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<unknown>(`/admin/organizations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'organizations'] }),
  });
}
