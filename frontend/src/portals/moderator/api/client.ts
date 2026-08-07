import { request, type RequestOptions } from '../../../shared/api/client';
import { ApiError } from '../../../shared/api/errors';
import type { ApiEnvelope } from '../../../shared/api/envelope';

export { ApiError };

export const api = {
  get: <T>(path: string, query?: Record<string, unknown>) =>
    request<ApiEnvelope<T>>(path, { method: 'GET', query: query as RequestOptions['query'] }).then(
      (env) => env.data,
    ),
  post: <T>(path: string, body?: unknown) =>
    request<ApiEnvelope<T>>(path, { method: 'POST', body }).then((env) => env.data),
  put: <T>(path: string, body?: unknown) =>
    request<ApiEnvelope<T>>(path, { method: 'PUT', body }).then((env) => env.data),
  del: <T>(path: string) =>
    request<ApiEnvelope<T>>(path, { method: 'DELETE' }).then((env) => env.data),
};
