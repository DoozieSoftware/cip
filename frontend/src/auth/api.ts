import { request, requestRaw, upload, download, buildApiUrl } from '../shared/api/client';
import { ApiError } from '../shared/api/errors';
import type { ApiEnvelope } from '../shared/api/envelope';
import { getToken, getRefreshToken, setTokens, handleUnauthorized } from './storage';

export type { ApiEnvelope };
export {
  ApiError,
  request,
  requestRaw,
  upload,
  download,
  buildApiUrl,
  getToken,
  getRefreshToken,
  setTokens,
  handleUnauthorized,
};

export const apiRequest = requestRaw;
