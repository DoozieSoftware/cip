import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, upload } from '../../../shared/api/client';

export type TextileCollectionMethod = 'dropoff' | 'premises';

export type TextileCollectionCategory = 'clothes_waste' | 'metal_scrap' | 'e_waste';

export interface TextileServiceZone {
  id: string;
  code: string;
  name: string;
  center: { latitude: number; longitude: number } | null;
  service_radius_km: number | null;
  methods: TextileCollectionMethod[];
  dropoff: { name: string; address: string } | null;
  dropoff_name: string | null;
  dropoff_address: string | null;
  dropoff_hours: string | null;
  readiness_instructions: string | null;
  partner: { id: string; name: string } | null;
}

export interface TextileCollectionPayload {
  service_zone_id: string;
  category: TextileCollectionCategory;
  requester_type: 'individual' | 'rwa';
  requester_name: string;
  rwa_name: string | null;
  contact_email: string;
  contact_phone: string;
  pickup_address: string;
  collection_method: TextileCollectionMethod;
  // Either estimate is enough — requesters often cannot weigh textiles.
  estimated_bags: number | null;
  estimated_weight_kg: number | null;
}

export interface TextileCollectionPhoto {
  id: string;
  role: 'evidence' | 'proof';
  url: string;
}

export interface TextileCollectionRequest extends TextileCollectionPayload {
  id: string;
  reference: string;
  title: string;
  notes: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  actual_bags: number | null;
  actual_weight_kg: number | null;
  scheduled_date: string | null;
  scheduled_window_start: string | null;
  scheduled_window_end: string | null;
  readiness_instructions: string | null;
  rejection_reason: string | null;
  cancellation_reason: string | null;
  missed_pickup_reason: string | null;
  picked_up_at: string | null;
  submitted_at: string | null;
  service_zone: {
    id: string;
    code: string;
    name: string;
    dropoff_name: string | null;
    dropoff_address: string | null;
    center: { latitude: number; longitude: number } | null;
  } | null;
  partner: { id: string; name: string } | null;
  batch: {
    id: string;
    reference: string;
    collection_date: string;
    status: string;
    window_start: string | null;
    window_end: string | null;
    trip_reference: string | null;
  } | null;
  photos?: TextileCollectionPhoto[];
}

export interface CreateTextileCollectionInput extends TextileCollectionPayload {
  title: string;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function useTextileServiceZones(category: string) {
  return useQuery({
    queryKey: ['textile-service-zones', category],
    queryFn: () =>
      request<TextileServiceZone[]>('/textile-collection/zones', {
        query: { category },
      }),
    staleTime: 5 * 60_000,
  });
}

export function useCitizenTextileCollections() {
  return useQuery({
    queryKey: ['citizen', 'textile-collections'],
    queryFn: () => request<TextileCollectionRequest[]>('/citizen/textile-collections'),
  });
}

export function useCitizenTextileCollection(id: string) {
  return useQuery({
    queryKey: ['citizen', 'textile-collections', id],
    queryFn: () => request<TextileCollectionRequest>(`/citizen/textile-collections/${id}`),
    enabled: id !== '',
  });
}

export function useCreateTextileCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTextileCollectionInput) =>
      request<TextileCollectionRequest>('/textile-collection/requests', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['citizen', 'textile-collections'] }),
  });
}

export function useCancelTextileCollection(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason: string) =>
      request<TextileCollectionRequest>(`/citizen/textile-collections/${id}/cancel`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['citizen', 'textile-collections'] });
    },
  });
}

export function isTextileNetworkFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) return true;
  const anyErr = err as { status?: number; code?: string };
  if (anyErr?.status === 0 || anyErr?.code === 'OFFLINE' || anyErr?.code === 'NETWORK_ERROR') return true;
  // Treat anything that is not a structured ApiError response as offline.
  // ApiError always has a numeric status >=400.
  if (anyErr?.status !== undefined && anyErr.status >= 400) return false;
  if (err instanceof Error && msg.includes('http_')) return false;
  return !(err instanceof Error && (err as unknown as { name?: string })?.name === 'ApiError');
}

export async function submitTextileRequestPayload(
  input: CreateTextileCollectionInput & { idempotency_key?: string; photo_file?: File | null },
): Promise<TextileCollectionRequest> {
  const idempotencyKey =
    input.idempotency_key ??
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `textile-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const { idempotency_key: _ignored, photo_file: _photo, ...body } = input as CreateTextileCollectionInput & {
    idempotency_key?: string;
    photo_file?: File | null;
  };
  const created = await request<TextileCollectionRequest>('/textile-collection/requests', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body,
  });
  if (_photo) {
    const fd = new FormData();
    fd.append('photo', _photo);
    await upload<{ photo: { id: string; role: string; url: string } }>(
      `/citizen/textile-collections/${created.id}/photo`,
      fd,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    ).catch(() => {
      // Photo failure is non-fatal — detail page offers "add photo later".
    });
  }
  return created;
}

export async function uploadTextileCollectionPhoto(
  collectionId: string,
  file: File,
  signal?: AbortSignal,
): Promise<{ photo: { id: string; role: string; url: string } }> {
  const formData = new FormData();
  formData.append('photo', file);
  return upload<{ photo: { id: string; role: string; url: string } }>(
    `/citizen/textile-collections/${collectionId}/photo`,
    formData,
    { signal },
  );
}

export interface TextileAvailability {
  service_zone_id: string;
  collection_method: TextileCollectionMethod;
  unavailable_dates: string[];
  next_available_date: string | null;
  cutoff_hours: number | null;
  reason: string | null;
  windows: { window_start: string; window_end: string; available: boolean }[];
}

export function useTextileAvailability(
  serviceZoneId: string | null,
  method: TextileCollectionMethod | null,
) {
  return useQuery({
    queryKey: ['textile-availability', serviceZoneId, method],
    queryFn: () =>
      request<TextileAvailability>('/textile-collection/availability', {
        query: {
          service_zone_id: serviceZoneId ?? '',
          collection_method: method ?? '',
        },
      }),
    enabled: Boolean(serviceZoneId && method === 'premises'),
    staleTime: 2 * 60_000,
    retry: false,
  });
}

export interface RescheduleTextileInput {
  requested_date: string;
  window_start?: string | null;
  window_end?: string | null;
  reason?: string | null;
}

export function useRescheduleTextileCollection(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RescheduleTextileInput) =>
      request<TextileCollectionRequest>(`/citizen/textile-collections/${id}/reschedule`, {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['citizen', 'textile-collections', id] });
      void queryClient.invalidateQueries({ queryKey: ['citizen', 'textile-collections'] });
    },
  });
}

export interface UpdateTextileInstructionsInput {
  readiness_instructions?: string | null;
  contact_phone?: string;
  contact_email?: string;
  pickup_address?: string;
}

export function useUpdateTextileInstructions(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTextileInstructionsInput) =>
      request<TextileCollectionRequest>(`/citizen/textile-collections/${id}/instructions`, {
        method: 'PATCH',
        body: payload,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['citizen', 'textile-collections', id] });
      void queryClient.invalidateQueries({ queryKey: ['citizen', 'textile-collections'] });
    },
  });
}
