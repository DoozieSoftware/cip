import { getToken } from '../../auth/api';
import { handleUnauthorized } from '../../auth/storage';
import { ApiError } from './errors';

const API_BASE = (import.meta.env['VITE_API_BASE'] as string | undefined) ?? '/api/v1';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(API_BASE + path, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const token = getToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts.headers ?? {}),
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path, opts.query), {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : null,
    signal: opts.signal ?? null,
    credentials: 'same-origin',
  });

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload: unknown = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    if (res.status === 401) {
      handleUnauthorized();
    }
    const errorEnv = payload as { message?: string; errors?: unknown; code?: string; trace_id?: string };
    throw new ApiError(
      res.status,
      errorEnv.code ?? `HTTP_${res.status}`,
      errorEnv.message ?? `Request failed: ${res.status}`,
      errorEnv.errors ?? null,
      errorEnv.trace_id ?? 'unknown',
    );
  }

  return payload as T;
}
