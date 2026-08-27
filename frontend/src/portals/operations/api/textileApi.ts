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
  service_zone: {
    id: string;
    code: string;
    name: string;
    dropoff_name: string | null;
    dropoff_address: string | null;
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
  },
) {
  const { department_id, ...body } = payload;
  return request<TextileCollectionListItem>(
    `/department/textile-collections/${collectionId}/outcome`,
    {
      method: 'POST',
      body,
      query: department_id ? { department_id } : {},
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

export function uploadTextileProofPhoto(
  collectionId: string,
  file: File,
  departmentId?: string,
  signal?: AbortSignal,
) {
  const formData = new FormData();
  formData.append('photo', file);
  const opts: UploadOptions = {
    query: departmentId ? { department_id: departmentId } : {},
    signal,
  };
  return upload<TextileProofPhoto>(
    `/department/textile-collections/${collectionId}/proof`,
    formData,
    opts,
  );
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
