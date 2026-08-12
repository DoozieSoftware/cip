import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestRaw as apiRequest } from '../../../shared/api/client';
import type { ApiEnvelope } from '../../../shared/api/envelope';

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

export interface AdminRoleInput {
  name: string;
  guard_name?: string;
  permissions?: string[];
}

export function useAdminRoles() {
  return useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AdminRole[]>>('/admin/roles', {
        query: { per_page: 100 },
      });
      return res.data;
    },
  });
}

export function useAdminPermissions() {
  return useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AdminPermission[]>>('/admin/permissions', {
        query: { per_page: 200 },
      });
      return res.data;
    },
  });
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
      apiRequest<ApiEnvelope<AdminRole>>(`/admin/roles/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: patch,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  });
}

export function useSyncRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, permissions }: { id: string; permissions: string[] }) =>
      apiRequest<ApiEnvelope<AdminRole>>(
        `/admin/roles/${encodeURIComponent(id)}/permissions/sync`,
        {
          method: 'POST',
          body: { permissions },
        },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  });
}
