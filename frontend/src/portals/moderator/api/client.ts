/**
 * Fetch wrapper for the moderator REST surface.
 *
 * Uses `import.meta.env.VITE_API_BASE_URL` to find the backend; defaults to
 * the Vite dev proxy at `/api/v1`. Attaches the Sanctum bearer token from
 * `localStorage` when present so a logged-in moderator can call the API.
 */

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';

function authHeader(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  const t = localStorage.getItem('cip_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const url = new URL(BASE.replace(/\/$/, '') + path, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

async function parse(res: Response): Promise<unknown> {
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  query?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(buildUrl(path, query), {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': body ? 'application/json' : 'application/json',
      ...authHeader(),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  const payload = await parse(res);
  if (!res.ok) {
    const message =
      (typeof payload === 'object' && payload !== null && 'message' in payload
        ? String((payload).message)
        : null) ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, payload);
  }
  // Every backend response uses the standard ApiResponse envelope
  // (`{success, message, data, ...}` — docs/03 §20). This client used
  // to return the raw envelope cast as if it were the payload itself,
  // so every caller's `data.someField` was actually
  // `envelope.someField` (undefined). Unwrap it here, once.
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: Record<string, unknown>) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
};
