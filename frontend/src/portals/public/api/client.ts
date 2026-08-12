import { useQuery } from '@tanstack/react-query';
import { request, requestEnvelope } from '../../../shared/api/client';

export interface PublicStats {
  total_reports: number;
  ai_classified_percent: number;
  median_assign_seconds: number | null;
  generated_at?: string;
  definitions?: Record<string, string>;
  cache_ttl_seconds?: number;
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
      const envelope = await requestEnvelope<PublicStats>('/public/stats');
      return {
        ...envelope.data,
        generated_at:
          typeof envelope.meta?.generated_at === 'string' ? envelope.meta.generated_at : undefined,
        definitions:
          envelope.meta?.definitions && typeof envelope.meta.definitions === 'object'
            ? (envelope.meta.definitions as Record<string, string>)
            : undefined,
        cache_ttl_seconds:
          typeof envelope.meta?.cache_ttl_seconds === 'number'
            ? envelope.meta.cache_ttl_seconds
            : undefined,
      };
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
