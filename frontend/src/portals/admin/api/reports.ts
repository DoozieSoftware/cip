import { useQuery } from '@tanstack/react-query';
import { requestRaw as apiRequest } from '../../../shared/api/client';
import type { ApiEnvelope } from '../../../shared/api/envelope';

export interface AdminReportAssignment {
  id: string;
  kind: 'primary' | 'secondary';
  is_primary: boolean;
  task_status: string;
  department: { id: string; code: string; name: string } | null;
  officer: { id: string; name: string | null } | null;
  assigned_at: string | null;
}

export interface AdminReport {
  id: string;
  tracking_number: string;
  title: string;
  description: string | null;
  current_status_code: string | null;
  submitted_at: string | null;
  report_type: { id: string; code: string; name: string } | null;
  department: { id: string; code: string; name: string } | null;
  assignments: AdminReportAssignment[];
}

export interface AdminReportFilters {
  department_id?: string;
  status?: string;
  category?: string;
  officer_id?: string;
  assignment_type?: string;
  date_from?: string;
  date_to?: string;
  q?: string;
  page?: number;
  per_page?: number;
}

export interface AdminReportPagination {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export function useAdminReports(filters: AdminReportFilters = {}) {
  return useQuery({
    queryKey: ['admin', 'reports', filters],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<AdminReport[]>>('/admin/reports', {
        query: { ...filters, per_page: filters.per_page ?? 25 },
      });
      return {
        reports: res.data,
        meta: res.meta as unknown as AdminReportPagination,
      };
    },
  });
}
