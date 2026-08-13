import { request, upload, download } from '../../../shared/api/client';
import { ApiError } from '../../../shared/api/errors';

export { ApiError };

export const api = {
  get: <T>(path: string, query?: Record<string, unknown>) =>
    request<T>(path, {
      method: 'GET',
      query: query as Record<string, string | number | boolean | undefined | null>,
    }),
  post: <T>(path: string, body?: unknown, query?: Record<string, unknown>) =>
    request<T>(path, {
      method: 'POST',
      body,
      query: query as Record<string, string | number | boolean | undefined | null>,
    }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload,
  download,
};
