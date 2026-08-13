import {
  getToken,
  getRefreshToken,
  setTokens,
  handleUnauthorized as logout,
} from '../../auth/storage';
import { ApiError } from './errors';
import type { ApiEnvelope } from './envelope';

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
  next_cursor?: string | null;
  prev_cursor?: string | null;
}

export function normalizePaginationMeta(
  meta: Record<string, unknown> | undefined,
  fallbackPerPage = 25,
): PaginationMeta {
  return {
    page: typeof meta?.page === 'number' ? meta.page : 1,
    per_page: typeof meta?.per_page === 'number' ? meta.per_page : fallbackPerPage,
    total: typeof meta?.total === 'number' ? meta.total : 0,
    last_page: typeof meta?.last_page === 'number' ? meta.last_page : 1,
    next_cursor: typeof meta?.next_cursor === 'string' ? meta.next_cursor : null,
    prev_cursor: typeof meta?.prev_cursor === 'string' ? meta.prev_cursor : null,
  };
}

const API_BASE = (import.meta.env['VITE_API_BASE'] as string | undefined) ?? '/api/v1';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Internal retry guard: suppresses another 401 refresh cycle without dropping auth headers. */
  suppressAuthRefresh?: boolean;
}

export interface UploadOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const url = new URL(API_BASE + path, window.location.origin);
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

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export { getToken };

async function readPayload(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? await res.json() : await res.text();
}

function parseError(res: Response, payload: unknown): ApiError {
  const errorEnv = payload as {
    message?: string;
    errors?: unknown;
    code?: string;
    trace_id?: string;
  };
  return new ApiError(
    res.status,
    errorEnv.code ?? `HTTP_${res.status}`,
    errorEnv.message ?? `Request failed: ${res.status}`,
    errorEnv.errors ?? null,
    errorEnv.trace_id ?? 'unknown',
  );
}

// --- Token refresh dedupe ---------------------------------------------
// When multiple requests 401 concurrently, only one refresh request is
// issued; the rest wait on the same promise. The resolved boolean means
// "the access token was refreshed" — callers retry exactly once.

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }
  if (refreshPromise) {
    return refreshPromise;
  }
  refreshPromise = (async () => {
    try {
      const res = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
        credentials: 'same-origin',
      });
      if (!res.ok) {
        return false;
      }
      const payload = (await res.json()) as ApiEnvelope<{
        token: { access_token: string; type?: string; expires_at?: string };
        refresh_token: string;
        refresh_expires_at: string;
      }>;
      const data = payload.data;
      if (!data?.token?.access_token) {
        return false;
      }
      setTokens(data.token.access_token, data.refresh_token, data.refresh_expires_at);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/**
 * Shared 401 handling: attempt a single token refresh, then either retry
 * the caller's work or fall back to logout. `retry` is invoked at most
 * once; if it also 401s we skip the refresh cycle to avoid loops.
 */
async function handleUnauthorized<T>(
  res: Response,
  payload: unknown,
  retry: () => Promise<T>,
): Promise<T> {
  if (await refreshAccessToken()) {
    return retry();
  }
  logout();
  // logout() redirects, but if it returns (e.g. already on /login),
  // surface the original error so callers have a deterministic outcome.
  throw parseError(res, payload);
}

export async function requestEnvelope<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...authHeaders(),
    ...(opts.headers ?? {}),
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(buildUrl(path, opts.query), {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : null,
    signal: opts.signal ?? null,
    credentials: 'same-origin',
  });

  const payload = await readPayload(res);

  if (!res.ok) {
    if (res.status === 401 && !opts.suppressAuthRefresh) {
      return handleUnauthorized(res, payload, () =>
        requestEnvelope<T>(path, { ...opts, suppressAuthRefresh: true }),
      );
    }
    throw parseError(res, payload);
  }

  return payload as ApiEnvelope<T>;
}

/**
 * Raw-envelope compatibility for consumers that still need pagination metadata.
 * The request still uses the same shared authentication, refresh, and error handling.
 */
export async function requestRaw<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return requestEnvelope<unknown>(path, opts) as Promise<T>;
}

/**
 * JSON API request. Returns the unwrapped `data` field from the envelope.
 * Throws {@link ApiError} on non-2xx responses. Attempts a token refresh
 * on 401, then triggers logout if refresh fails.
 */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const envelope = await requestEnvelope<T>(path, opts);
  return envelope.data;
}

/**
 * Paginated JSON API request. Returns both `data` (array) and `meta` (pagination).
 * Throws {@link ApiError} on non-2xx responses. Attempts a token refresh
 * on 401, then triggers logout if refresh fails.
 */
export async function requestPaginated<T>(
  path: string,
  opts: RequestOptions = {},
  fallbackPerPage = 25,
): Promise<{ data: T[]; meta: PaginationMeta }> {
  const envelope = await requestEnvelope<T[]>(path, opts);
  return {
    data: envelope.data,
    meta: normalizePaginationMeta(envelope.meta, fallbackPerPage),
  };
}

/**
 * Multipart form-data upload. Returns the unwrapped `data` field from the envelope.
 * Does NOT set Content-Type so the browser can set the multipart boundary.
 * Throws {@link ApiError} on non-2xx responses. Attempts a token refresh
 * on 401, then triggers logout if refresh fails.
 */
export async function upload<T>(
  path: string,
  body: FormData,
  opts: UploadOptions = {},
): Promise<T> {
  const res = await fetch(buildUrl(path, opts.query), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...authHeaders(),
      ...(opts.headers ?? {}),
    },
    body,
    signal: opts.signal ?? null,
    credentials: 'same-origin',
  });

  const payload = await readPayload(res);

  if (!res.ok) {
    if (res.status === 401) {
      return handleUnauthorized(res, payload, () =>
        fetch(buildUrl(path, opts.query), {
          method: 'POST',
          headers: { Accept: 'application/json', ...authHeaders(), ...(opts.headers ?? {}) },
          body,
          signal: opts.signal ?? null,
          credentials: 'same-origin',
        }).then(async (r) => {
          const p = await readPayload(r);
          if (!r.ok) throw parseError(r, p);
          return (p as ApiEnvelope<T>).data;
        }),
      );
    }
    throw parseError(res, payload);
  }

  const envelope = payload as ApiEnvelope<T>;
  return envelope.data;
}

/**
 * File download as a blob. Triggers a browser download with the given filename.
 * Throws {@link ApiError} on non-2xx responses. Attempts a token refresh
 * on 401, then triggers logout if refresh fails.
 */
export async function download(
  path: string,
  query: Record<string, unknown> | undefined,
  filename: string,
): Promise<void> {
  return downloadAttempt(path, query, filename, true);
}

async function downloadAttempt(
  path: string,
  query: Record<string, unknown> | undefined,
  filename: string,
  allowAuthRefresh: boolean,
): Promise<void> {
  const res = await fetch(buildUrl(path, query), {
    headers: { ...authHeaders() },
    credentials: 'same-origin',
  });

  if (!res.ok) {
    const payload = await readPayload(res);
    if (res.status === 401 && allowAuthRefresh) {
      return handleUnauthorized(res, payload, () => downloadAttempt(path, query, filename, false));
    }
    throw parseError(res, payload);
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

/** Build a fully-qualified API URL without issuing a request. */
export function buildApiUrl(path: string, query?: Record<string, unknown>): string {
  return buildUrl(path, query);
}
