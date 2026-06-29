import { STORAGE_KEY } from './storage';

const API_BASE = (import.meta.env['VITE_API_BASE'] as string | undefined) ?? '/api/v1';

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  constructor(status: number, code: string, message: string, details: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function getToken(): string | null {
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
  const method = opts.method ?? 'GET';
  const token = getToken();

  const url = new URL(API_BASE + path, window.location.origin);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null || v === '') {
        continue;
      }
      url.searchParams.set(k, String(v));
    }
  }

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

  const res = await fetch(url.toString(), {
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
    const env = (payload ?? {}) as { code?: string; message?: string; data?: unknown };
    throw new ApiError(
      res.status,
      env.code ?? `HTTP_${res.status}`,
      env.message ?? `Request failed: ${res.status}`,
      env.data ?? null,
    );
  }

  return payload as T;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  code: string;
  trace_id: string;
}

export function unwrap<T>(envelope: ApiEnvelope<T>): T {
  return envelope.data;
}
