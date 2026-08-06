import { request } from '../shared/api/client';
import { ApiError } from '../shared/api/errors';
import type { ApiEnvelope } from '../shared/api/envelope';
import { STORAGE_KEY } from './storage';

export type { ApiEnvelope };
export { ApiError };

const API_BASE = (import.meta.env['VITE_API_BASE'] as string | undefined) ?? '/api/v1';

export function buildApiUrl(path: string): string {
  return new URL(API_BASE + path, window.location.origin).toString();
}

export function getToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return request<T>(path, opts);
}

export function unwrap<T>(envelope: ApiEnvelope<T>): T {
  return envelope.data;
}
