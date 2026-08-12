import { useQuery } from '@tanstack/react-query';
import { request } from '../../../shared/api/client';

export interface PublicStats {
  total_reports: number;
  ai_classified_percent: number;
  median_assign_seconds: number | null;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  count: number;
}

export interface DepartmentPerformance {
  id: string;
  name: string;
  code: string;
  total_reports: number;
  resolved_reports: number;
  resolution_rate_percent: number;
  median_resolution_hours: number | null;
}

const FIVE_MINUTES = 5 * 60_000;

/**
 * Every hook here hits an unauthenticated `/public/*` endpoint —
 * no bearer token is attached (or needed). `staleTime` matches the
 * backend's own 5-minute cache window so the SPA doesn't poll faster
 * than the data can actually change.
 */
export function usePublicStats() {
  return useQuery({
    queryKey: ['public', 'stats'],
    queryFn: async () => {
      return request<PublicStats>('/public/stats');
    },
    staleTime: FIVE_MINUTES,
  });
}

export function usePublicHeatmap() {
  return useQuery({
    queryKey: ['public', 'heatmap'],
    queryFn: async () => {
      const data = await request<{ points: HeatmapPoint[] }>('/public/heatmap');
      return data.points;
    },
    staleTime: FIVE_MINUTES,
  });
}

export function usePublicDepartmentPerformance() {
  return useQuery({
    queryKey: ['public', 'departments', 'performance'],
    queryFn: async () => {
      const data = await request<{ departments: DepartmentPerformance[] }>(
        '/public/departments/performance',
      );
      return data.departments;
    },
    staleTime: FIVE_MINUTES,
  });
}
