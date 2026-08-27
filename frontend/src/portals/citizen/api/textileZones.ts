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
  service_zone: { id: string; code: string; name: string } | null;
  partner: { id: string; name: string } | null;
  batch: { id: string; reference: string; collection_date: string; status: string } | null;
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
