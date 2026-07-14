import { useEffect, useState } from 'react';
import { reverseGeocode } from './reverseGeocode';

/**
 * A bare "lat, lng" string (e.g. "12.9233, 77.4923") is not a
 * human-readable place. The backend stores such a coordinate string in
 * `location.address` when the citizen leaves the landmark field blank, so
 * we must not treat it as a usable label — geocode instead.
 */
function usableLabel(label?: string | null): string | null {
  if (!label) return null;
  const trimmed = label.trim();
  if (!trimmed) return null;
  if (/^-?\d{1,3}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Resolve a coordinate to a human-readable place name (e.g. "Kengeri,
 * Bengaluru") via reverse geocoding. Returns an empty string until a
 * lookup resolves, so callers can render a coordinate fallback in the
 * meantime. Pass a real landmark `label` to short-circuit the lookup; a
 * blank or coordinate-only label is ignored and geocoded. Non-finite
 * coordinates (e.g. before a location is captured) yield an empty label
 * with no network call.
 */
export function useReverseGeocode(
  latitude: number,
  longitude: number,
  label?: string | null,
): string {
  const [placeLabel, setPlaceLabel] = useState<string>(() => usableLabel(label) ?? '');

  useEffect(() => {
    const provided = usableLabel(label);
    if (provided) {
      setPlaceLabel(provided);
      return;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setPlaceLabel('');
      return;
    }
    const controller = new AbortController();
    let active = true;
    void reverseGeocode(latitude, longitude, controller.signal).then((res) => {
      if (active) setPlaceLabel(res.label);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [latitude, longitude, label]);

  return placeLabel;
}
