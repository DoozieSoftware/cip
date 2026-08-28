import { request, requestPaginated, upload, type UploadOptions } from '../../../shared/api/client';

export interface TextileCollectionListItem {
  id: string;
  reference: string;
  title: string;
  notes: string | null;
  status: string;
  requester_type: string;
  requester_name: string;
  rwa_name: string | null;
  contact_email: string;
  contact_phone: string;
  pickup_address: string;
  collection_method: string;
  estimated_bags: number;
  estimated_weight_kg: number;
  actual_bags: number | null;
  actual_weight_kg: number | null;
  scheduled_date: string | null;
  scheduled_window_start: string | null;
  scheduled_window_end: string | null;
  readiness_instructions: string | null;
  rejection_reason: string | null;
  missed_pickup_reason: string | null;
  picked_up_at: string | null;
  // Phase 3 — reschedule / availability (optional until backend ships)
  reschedule_reason?: string | null;
  rescheduled_at?: string | null;
  previous_scheduled_date?: string | null;
  previous_window_start?: string | null;
  previous_window_end?: string | null;
  rescheduled_from_batch_id?: string | null;
  unavailable_reason?: string | null;
  unavailable_until?: string | null;
  override_required?: boolean | null;
  cancellation_reason?: string | null;
  service_zone: {
    id: string;
    code: string;
    name: string;
    dropoff_name: string | null;
    dropoff_address: string | null;
    centre_status?: string | null;
    centre_closed_note?: string | null;
  } | null;
  batch: {
    id: string;
    reference: string;
    collection_date: string;
    status: string;
    trip_reference?: string | null;
    driver_name?: string | null;
    team_name?: string | null;
    vehicle_label?: string | null;
    instructions?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    progress?: { collected: number; missed: number; pending: number; total: number } | null;
  } | null;
  submitted_at: string | null;
  photos?: Array<{ id: string; role: 'evidence' | 'proof'; url: string }>;
  category: string;
  partner: { id: string; name: string } | null;
}

export interface TextileServiceZone {
  id: string;
  code: string;
  name: string;
  methods: Array<'dropoff' | 'premises'>;
}

export interface TextileBatchResult {
  id: string;
  reference: string;
  collection_date: string;
  status: string;
  request_count: number;
}

export function fetchTextileQueue(params: {
  status?: string;
  service_zone_id?: string;
  category?: string;
  collection_method?: string;
  search?: string;
  per_page?: number;
  page?: number;
  department_id?: string;
}) {
  return requestPaginated<TextileCollectionListItem>('/department/textile-collections', {
    query: params,
  });
}

export function fetchTextileDetail(collectionId: string, departmentId?: string) {
  return request<TextileCollectionListItem>(`/department/textile-collections/${collectionId}`, {
    query: departmentId ? { department_id: departmentId } : {},
  });
}

export function fetchTextileZones() {
  return request<TextileServiceZone[]>('/textile-collection/zones');
}

export function scheduleTextileBatch(payload: {
  service_zone_id: string;
  collection_request_ids: string[];
  collection_date: string;
  window_start?: string;
  window_end?: string;
  trip_reference?: string;
  instructions?: string;
  department_id?: string;
}) {
  const { department_id, ...body } = payload;
  return request<TextileBatchResult>('/department/textile-collections/schedule', {
    method: 'POST',
    body,
    query: department_id ? { department_id } : {},
  });
}

export function recordTextileOutcome(
  collectionId: string,
  payload: {
    outcome: 'collected' | 'missed' | 'rejected' | 'cancelled';
    actual_bags?: number;
    actual_weight_kg?: number;
    reason?: string;
    department_id?: string;
    idempotencyKey?: string;
  },
) {
  const { department_id, idempotencyKey, ...body } = payload;
  return request<TextileCollectionListItem>(
    `/department/textile-collections/${collectionId}/outcome`,
    {
      method: 'POST',
      body,
      query: department_id ? { department_id } : {},
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    },
  );
}

export function approveTextileCollection(collectionId: string, departmentId?: string) {
  return request<TextileCollectionListItem>(
    `/department/textile-collections/${collectionId}/approve`,
    {
      method: 'POST',
      body: departmentId ? { department_id: departmentId } : {},
      query: departmentId ? { department_id: departmentId } : {},
    },
  );
}

export function fetchTextileReport(params: {
  year: number;
  month?: number;
  department_id?: string;
}) {
  return request<{
    period: { year: number; month: number | null; start: string; end: string };
    requesters_served: number;
    total_volume_kg: number;
    collection_trips: number;
    status_breakdown: Record<string, number>;
    zone_breakdown: Record<string, number>;
  }>('/department/textile-collections/report', { query: params });
}

export interface TextileProofPhoto {
  photo: { id: string; role: 'proof'; url: string };
}

/** Phase 1 — centre counter receipt. Distinct from driver pickup outcomes:
 *  authorization is `textile.record_receipt` and the lane must not be able
 *  to complete a doorstep pickup (and vice versa). */
export function recordDropoffReceipt(
  zoneId: string,
  payload: {
    collection_request_id: string;
    actual_bags?: number;
    actual_weight_kg?: number;
    proof_media_id?: string;
    exception_code?: string;
    exception_reason?: string;
    idempotencyKey: string;
    department_id?: string;
  },
) {
  const { department_id, idempotencyKey, ...body } = payload;
  return request<{ id: string; collection_request_id: string }>(
    `/department/dropoff-centres/${zoneId}/receipts`,
    {
      method: 'POST',
      body,
      query: department_id ? { department_id } : {},
      headers: { 'Idempotency-Key': idempotencyKey },
    },
  );
}

export function uploadTextileProofPhoto(
  collectionId: string,
  file: File,
  departmentId?: string,
  signal?: AbortSignal,
  idempotencyKey?: string,
) {
  const formData = new FormData();
  formData.append('photo', file);
  const opts: UploadOptions = {
    query: departmentId ? { department_id: departmentId } : {},
    signal,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  };
  return upload<TextileProofPhoto>(
    `/department/textile-collections/${collectionId}/proof`,
    formData,
    opts,
  );
}

export function collectTextileWithProof(
  collectionId: string,
  payload: {
    actual_bags: number;
    actual_weight_kg: number;
    photo: File;
    reason?: string;
    idempotencyKey: string;
  },
  departmentId?: string,
) {
  const formData = new FormData();
  formData.append('actual_bags', String(payload.actual_bags));
  formData.append('actual_weight_kg', String(payload.actual_weight_kg));
  if (payload.reason) formData.append('reason', payload.reason);
  formData.append('photo', payload.photo);
  return upload<TextileCollectionListItem>(
    `/department/textile-collections/${collectionId}/collect`,
    formData,
    {
      query: departmentId ? { department_id: departmentId } : {},
      headers: { 'Idempotency-Key': payload.idempotencyKey },
    },
  );
}

/** Phase 4 — offline-safe: report a permanently failed upload for recovery view. */
export function reportOfflineFailure(
  collectionId: string,
  payload: {
    idempotency_key?: string;
    failure_reason?: string;
    payload_snapshot?: Record<string, unknown>;
    department_id?: string;
  },
) {
  const { department_id, ...body } = payload;
  return request<{ id: string; status: string }>(
    `/department/textile-collections/${collectionId}/offline-failure`,
    {
      method: 'POST',
      body,
      query: department_id ? { department_id } : {},
    },
  );
}

export function fetchOfflineRecovery(params: { department_id?: string; status?: string }) {
  return request<Array<Record<string, unknown>>>(
    '/department/textile-collections/offline-recovery',
    {
      query: params,
    },
  );
}

export function resolveOfflineRecovery(recoveryId: string, departmentId?: string) {
  return request<{ id: string; status: string }>(
    `/department/textile-collections/offline-recovery/${recoveryId}/resolve`,
    {
      method: 'POST',
      query: departmentId ? { department_id: departmentId } : {},
    },
  );
}

export interface TextileCapacityRule {
  id: string;
  service_zone_id: string;
  department_id: string;
  max_bags: number | null;
  max_weight_kg: number | null;
  max_stops: number | null;
  min_bags: number | null;
  min_weight_kg: number | null;
  guidance_text: string | null;
  category_allowlist: string[] | null;
  service_zone: { id: string; name: string } | null;
}

export interface TextileCapacityDashboard {
  period: { start: string; end: string };
  totals: {
    requests: number;
    trips: number;
    estimated_bags: number;
    actual_bags: number;
    estimated_weight_kg: number;
    actual_weight_kg: number;
    variance_bags: number | null;
    variance_weight_kg: number | null;
  };
  breakdowns: {
    status: Record<string, number>;
    collection_method: Record<string, number>;
    zone: Record<string, number>;
    category: Record<string, number>;
  };
  volumes: { dropoff: number; premises: number };
  rates: {
    missed_count: number;
    missed_rate_pct: number;
    rescheduled_count: number;
    reschedule_rate_pct: number;
    exception_count: number;
    exception_approved: number;
    exception_rate_pct: number;
  };
  timing: { avg_hours_booking_to_update: number | null };
  data_quality: { missing_estimates: number; has_baseline: boolean; note: string };
  definitions: Record<string, string>;
  timeseries: Array<{
    period: string;
    requests: number;
    actual_bags: number;
    estimated_bags: number;
  }>;
}

export function fetchCapacityRules(departmentId?: string) {
  return request<TextileCapacityRule[]>('/department/textile-capacity/rules', {
    query: departmentId ? { department_id: departmentId } : {},
  });
}

export function createCapacityRule(
  payload: Omit<TextileCapacityRule, 'id' | 'department_id' | 'service_zone'> & {
    department_id?: string;
  },
) {
  const { department_id, ...body } = payload;
  return request<TextileCapacityRule>('/department/textile-capacity/rules', {
    method: 'POST',
    body,
    query: department_id ? { department_id } : {},
  });
}

export function deleteCapacityRule(ruleId: string, departmentId?: string) {
  return request<void>(`/department/textile-capacity/rules/${ruleId}`, {
    method: 'DELETE',
    query: departmentId ? { department_id: departmentId } : {},
  });
}

export interface TextileCapacityException {
  id: string;
  collection_request_id: string;
  status: 'pending' | 'approved' | 'rejected';
  reason_code: string | null;
  reason: string | null;
  collection: { id: string; reference: string; status: string } | null;
}

export function fetchCapacityExceptions(params: { department_id?: string; status?: string }) {
  return request<TextileCapacityException[]>('/department/textile-capacity/exceptions', {
    query: params,
  });
}

export function decideCapacityException(
  exceptionId: string,
  decision: 'approve' | 'reject',
  reason: string,
  departmentId?: string,
) {
  return request<TextileCapacityException>(
    `/department/textile-capacity/exceptions/${exceptionId}/decide`,
    {
      method: 'POST',
      body: { decision, reason },
      query: departmentId ? { department_id: departmentId } : {},
    },
  );
}

export interface TextileCapacityWarning {
  code: string;
  message: string;
  severity: string;
}

export interface TextileCapacityBlocker {
  code: string;
  message: string;
}

export interface TextileCapacityEvaluation {
  ok: boolean;
  warnings: TextileCapacityWarning[];
  blockers: TextileCapacityBlocker[];
  totals: { bags: number; weight_kg: number; stops: number };
  effective_rule: {
    id: string;
    max_bags: number | null;
    max_weight_kg: number | null;
    max_stops: number | null;
    min_bags: number | null;
    min_weight_kg: number | null;
    guidance_text: string | null;
    category_allowlist: string[] | null;
  } | null;
  suggested_order: string[];
}

export interface TextileSuggestStopsResponse {
  batch_id: string;
  current_order: string[];
  suggested_order: string[];
  note: string;
}

function newCapacityIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID();
  return `cap-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function evaluateBatchCapacity(batchId: string, departmentId?: string) {
  return request<TextileCapacityEvaluation>(
    `/department/textile-batches/${batchId}/evaluate-capacity`,
    {
      method: 'POST',
      query: departmentId ? { department_id: departmentId } : {},
    },
  );
}

export function suggestBatchStops(batchId: string, departmentId?: string) {
  return request<TextileSuggestStopsResponse>(
    `/department/textile-batches/${batchId}/suggest-stops`,
    {
      method: 'POST',
      query: departmentId ? { department_id: departmentId } : {},
    },
  );
}

export function requestCapacityException(payload: {
  collectionId: string;
  reason: string;
  reason_code?: string;
  department_id?: string;
  idempotencyKey?: string;
}) {
  const { collectionId, reason, reason_code, department_id, idempotencyKey } = payload;
  const key = idempotencyKey ?? newCapacityIdempotencyKey();
  return request<TextileCapacityException>(
    `/department/textile-collections/${collectionId}/capacity-exception`,
    {
      method: 'POST',
      body: {
        reason,
        ...(reason_code ? { reason_code } : {}),
      },
      query: department_id ? { department_id } : {},
      headers: { 'Idempotency-Key': key },
    },
  );
}

export function fetchTextileReportingDashboard(params: {
  department_id?: string;
  year?: string;
  month?: string;
}) {
  return request<TextileCapacityDashboard>('/department/textile-collections/report/dashboard', {
    query: params,
  });
}

export function textileReportingExportUrl(params: {
  department_id?: string;
  year?: string;
  month?: string;
}): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'string') search.set(key, value);
  });
  return `/api/v1/department/textile-collections/report/export?${search.toString()}`;
}

export function assignTextileTrip(
  batchId: string,
  payload: {
    driver_name?: string;
    team_name?: string;
    vehicle_label?: string;
    trip_reference?: string;
    instructions?: string;
    stop_order?: string[];
    department_id?: string;
  },
) {
  const { department_id, ...body } = payload;
  return request<TextileBatchResult>(`/department/textile-collections/batches/${batchId}/assign`, {
    method: 'POST',
    body,
    query: department_id ? { department_id } : {},
  });
}

export function updateTextileZoneDropoff(
  zoneId: string,
  data: { dropoff_name: string | null; dropoff_address: string | null },
  departmentId?: string,
) {
  return request<TextileServiceZone>(`/department/textile-zones/${zoneId}`, {
    method: 'PUT',
    body: data,
    query: departmentId ? { department_id: departmentId } : {},
  });
}

/** Phase 3 — citizen reschedule that ops may override. No-op if backend not deployed. */
export function rescheduleTextileCollection(
  collectionId: string,
  payload: {
    collection_date: string;
    window_start?: string;
    window_end?: string;
    reason?: string;
    override_reason?: string;
    department_id?: string;
  },
) {
  const { department_id, ...body } = payload;
  return request<TextileCollectionListItem>(
    `/department/textile-collections/${collectionId}/reschedule`,
    {
      method: 'POST',
      body,
      query: department_id ? { department_id } : {},
    },
  );
}

export function fetchTextileAvailability(params: {
  service_zone_id: string;
  department_id?: string;
}) {
  return request<{
    unavailable_dates: string[];
    unavailable_windows: Array<{ date: string; reason: string }>;
    reason?: string;
  }>('/department/textile-collections/availability', { query: params });
}
