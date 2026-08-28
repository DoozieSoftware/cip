import { getOpsQueue, type OpsQueueItem } from './queue';
import { ApiError } from '../../../shared/api/errors';

export interface CollectPayload {
  collectionId: string;
  actualBags: number;
  actualWeightKg: number;
  reason?: string;
  photoName: string;
  photoType: string;
  photoBlob: Blob;
  idempotencyKey: string;
  departmentId?: string;
  reference?: string;
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const base = (import.meta.env['VITE_API_BASE'] as string | undefined) ?? '/api/v1';
  const url = new URL(base + path, window.location.origin);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  return url.toString();
}

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('cip.auth.session');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; access_token?: string };
    return parsed.token ?? parsed.access_token ?? null;
  } catch { return null; }
}

/**
 * Delivery handler for offline-collected stops. Uses the atomic
 * POST /department/textile-collections/{id}/collect endpoint with
 * a stable Idempotency-Key so retry cannot create a second
 * outcome or proof chain.
 */
export async function deliverCollect(item: OpsQueueItem): Promise<void> {
  const payload = item.payload as CollectPayload;
  const token = getToken();
  const headers: Record<string, string> = { Accept: 'application/json', 'Idempotency-Key': payload.idempotencyKey };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const form = new FormData();
  form.append('actual_bags', String(payload.actualBags));
  form.append('actual_weight_kg', String(payload.actualWeightKg));
  if (payload.reason) form.append('reason', payload.reason);
  form.append('photo', payload.photoBlob, payload.photoName || 'proof.jpg');

  const query = payload.departmentId ? { department_id: payload.departmentId } : undefined;
  const url = buildUrl(`/department/textile-collections/${payload.collectionId}/collect`, query);

  const res = await fetch(url, { method: 'POST', headers, body: form, credentials: 'same-origin' });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (body as { message?: string; code?: string }).message ?? `Collect failed ${res.status}`;
    const code = (body as { code?: string }).code ?? '';
    throw new ApiError(res.status, code || `HTTP_${res.status}`, msg, (body as { errors?: unknown }).errors ?? null, (body as { trace_id?: string }).trace_id ?? 'unknown');
  }
}

/**
 * Wire the ops queue's retry handler. Idempotent — safe to call
 * from every mount of the operations app shell.
 */
export function registerTextileOfflineRetry(ownerId?: string | null): void {
  const queue = getOpsQueue(ownerId ?? undefined);
  queue.setRetryHandler(async (item: OpsQueueItem) => {
    if (item.kind === 'textile.collect') {
      await deliverCollect(item);
      return;
    }
    if (item.kind === 'textile.missed') {
      const p = item.payload as { collectionId: string; reason: string; departmentId?: string; idempotencyKey: string };
      const base = (import.meta.env['VITE_API_BASE'] as string | undefined) ?? '/api/v1';
      const url = new URL(base + `/department/textile-collections/${p.collectionId}/outcome`, window.location.origin);
      if (p.departmentId) url.searchParams.set('department_id', p.departmentId);
      const token = getToken();
      const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json', 'Idempotency-Key': p.idempotencyKey };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { method: 'POST', headers, body: JSON.stringify({ outcome: 'missed', reason: p.reason }), credentials: 'same-origin' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as { message?: string }).message ?? `Missed failed ${res.status}`;
        throw new Error(msg);
      }
      return;
    }
    throw new Error(`No delivery handler for ops queue kind "${item.kind}".`);
  });
}
