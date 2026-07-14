import { type JSX } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useReverseGeocode } from '../utils/useReverseGeocode';

/**
 * Offline-friendly pin: an inline-SVG `divIcon` instead of Leaflet's
 * default PNG marker, so the pin renders even when an external marker
 * image CDN is blocked (e.g. phones over a restricted network).
 */
const PIN = L.divIcon({
  className: 'cip-citizen-pin',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38" aria-hidden="true">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 24 14 24s14-14.5 14-24C28 6.27 21.73 0 14 0z" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>
    <circle cx="14" cy="14" r="5" fill="#ffffff"/>
  </svg>`,
  iconSize: [28, 38],
  iconAnchor: [14, 38],
  popupAnchor: [0, -34],
});

export interface LocationMapProps {
  latitude: number;
  longitude: number;
  /** Optional override label; otherwise reverse-geocoded from the coords. */
  label?: string | null;
  /** Height of the map in pixels. */
  height?: number;
}

/**
 * Shows a report's location as a pin on a small interactive map plus a
 * human-readable place name (reverse-geocoded). Falls back to raw
 * coordinates if geocoding is unavailable so the location is never blank.
 */
export default function LocationMap({
  latitude,
  longitude,
  label,
  height = 200,
}: LocationMapProps): JSX.Element {
  const placeLabel = useReverseGeocode(latitude, longitude, label);

  return (
    <div className="space-y-2">
      <div
        className="overflow-hidden rounded-lg border border-slate-200"
        style={{ height }}
        aria-label={`Map showing the report location at ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}
      >
        <MapContainer
          center={[latitude, longitude]}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[latitude, longitude]} icon={PIN}>
            <Popup>{placeLabel || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}</Popup>
          </Marker>
        </MapContainer>
      </div>
      <p className="flex items-start gap-1.5 text-sm text-slate-700">
        <span aria-hidden className="mt-0.5 text-blue-600">
          📍
        </span>
        <span>{placeLabel || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}</span>
      </p>
    </div>
  );
}

export interface LocationChipProps {
  latitude: number;
  longitude: number;
  /** Optional override label; otherwise reverse-geocoded from the coords. */
  label?: string | null;
}

/**
 * Compact, text-only location label used in list cards. Shows a pin + a
 * human-readable place name (reverse-geocoded), falling back to raw
 * coordinates when geocoding is unavailable.
 */
export function LocationChip({ latitude, longitude, label }: LocationChipProps): JSX.Element {
  const placeLabel = useReverseGeocode(latitude, longitude, label);

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600">
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
      <span>{placeLabel || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}</span>
    </span>
  );
}
