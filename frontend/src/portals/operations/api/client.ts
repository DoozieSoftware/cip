import { getToken } from '../../../auth/api';
import { request, type RequestOptions } from '../../../shared/api/client';
import { ApiError } from '../../../shared/api/errors';

export { ApiError };

export const api = {
  get: <T>(path: string, query?: Record<string, unknown>) =>
    request<T>(path, { method: 'GET', query: query as RequestOptions['query'] }),
  post: <T>(path: string, body?: unknown, query?: Record<string, unknown>) =>
    request<T>(path, { method: 'POST', body, query: query as RequestOptions['query'] }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  download,
  upload,
};

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';

function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const url = new URL(BASE.replace(/\/$/, '') + path, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

async function download(
  path: string,
  query: Record<string, unknown> | undefined,
  filename: string,
): Promise<void> {
  const res = await fetch(buildUrl(path, query), {
    headers: { ...authHeader() },
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    const payload: unknown = isJson ? await res.json() : await res.text();
    const errorEnv = payload as { message?: string; errors?: unknown; code?: string; trace_id?: string };
    throw new ApiError(
      res.status,
      errorEnv.code ?? `HTTP_${res.status}`,
      errorEnv.message ?? `Request failed: ${res.status}`,
      errorEnv.errors ?? null,
      errorEnv.trace_id ?? 'unknown',
    );
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

async function upload<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...authHeader(),
    },
    body,
    credentials: 'same-origin',
  });
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload: unknown = isJson ? await res.json() : await res.text();
  if (!res.ok) {
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
