import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestRaw as apiRequest } from '../../../shared/api/client';
import type { ApiEnvelope } from '../../../shared/api/envelope';

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

export function useAdminDepartments() {
  return useQuery({
    queryKey: ['admin', 'departments'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AdminDepartment[]>>('/admin/departments', {
        query: { per_page: 100 },
      });
      return res.data;
    },
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminDepartmentInput) =>
      apiRequest<ApiEnvelope<AdminDepartment>>('/admin/departments', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'departments'] }),
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: AdminDepartmentInput & { id: string }) =>
      apiRequest<ApiEnvelope<AdminDepartment>>(`/admin/departments/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'departments'] }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<unknown>(`/admin/departments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'departments'] }),
  });
}
