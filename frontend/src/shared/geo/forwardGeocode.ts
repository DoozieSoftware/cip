import { request } from '../api/client';

export interface ForwardGeocodeResult {
  label: string;
  latitude: number | null;
  longitude: number | null;
  geocoded: boolean;
}

/** Resolve a staff-entered centre address through the backend geocoder proxy. */
export function forwardGeocode(address: string): Promise<ForwardGeocodeResult> {
  return request<ForwardGeocodeResult>('/public/geocode', {
    query: { q: address.trim() },
  });
}
