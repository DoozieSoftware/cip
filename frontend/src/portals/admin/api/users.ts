import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestRaw as apiRequest } from '../../../shared/api/client';
import type { ApiEnvelope } from '../../../shared/api/envelope';

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

export function useAdminUsers(q: string, role?: string) {
  return useQuery({
    queryKey: ['admin', 'users', q, role],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AdminUser[]>>('/admin/users', {
        query: { q, role, per_page: 100 },
      });
      return res.data;
    },
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
      apiRequest<ApiEnvelope<AdminUser>>(`/admin/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: patch,
      }),
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
