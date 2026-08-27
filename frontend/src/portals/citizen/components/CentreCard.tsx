import { type JSX } from 'react';
import { IconMapPin, IconClock, IconCopy } from '@tabler/icons-react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { googleMapsUrl } from './mapUrls';

const DROP_OFF_PIN = L.divIcon({
  className: 'cip-dropoff-pin',
  html: '<span aria-hidden="true" style="display:block;width:22px;height:22px;border-radius:50%;background:#1d6fb8;border:3px solid #fff;box-shadow:0 1px 5px #0008"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export interface CentreCardProps {
  name: string;
  address: string;
  hours?: string | null;
  center?: { latitude: number; longitude: number } | null;
  state?: 'active' | 'muted';
}

export function CentreCard({
  name,
  address,
  hours,
  center,
  state = 'active',
}: CentreCardProps): JSX.Element {
  const muted = state === 'muted';
  return (
    <div
      className={`rounded-lg border p-4 ${muted ? 'border-black/10 bg-[#faf9f6]' : 'border-blue-200 bg-blue-50'}`}
    >
      <p
        className={`text-xs font-medium ${muted ? 'text-[var(--color-text-secondary)]' : 'text-blue-800'}`}
      >
        📍 Drop-off centre
      </p>
      <h3
        className={`mt-0.5 text-base font-semibold ${muted ? 'text-[var(--color-ink)]' : 'text-blue-900'}`}
      >
        {name}
      </h3>
      <address className="mt-0.5 not-italic text-sm text-blue-700">{address}</address>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
        <IconClock className="h-4 w-4" stroke={1.6} />
        {hours ? hours : 'Hours not published'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={googleMapsUrl({ name, address, center: center ?? null })}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-blue-300 bg-white px-5 text-sm font-medium text-blue-700 hover:bg-blue-50"
        >
          <IconMapPin className="h-4 w-4" stroke={1.6} />
          Open in Google Maps
        </a>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(address)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-4 text-sm font-medium"
        >
          <IconCopy className="h-4 w-4" stroke={1.6} />
          Copy address
        </button>
      </div>
      {center ? (
        <div
          role="img"
          aria-label="Map showing the collection point area"
          className="mt-3 overflow-hidden rounded-lg border border-blue-200"
          style={{ height: 190 }}
        >
          <MapContainer
            center={[center.latitude, center.longitude]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
            attributionControl={false}
            dragging={false}
            doubleClickZoom={false}
            zoomControl={false}
            touchZoom={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[center.latitude, center.longitude]} icon={DROP_OFF_PIN} />
          </MapContainer>
        </div>
      ) : null}
    </div>
  );
}

export function CentreCardSkeleton(): JSX.Element {
  return (
    <div className="animate-pulse rounded-lg border border-black/10 bg-white p-4">
      <div className="h-3 w-24 rounded bg-black/10" />
      <div className="mt-2 h-4 w-40 rounded bg-black/10" />
      <div className="mt-1 h-3 w-64 rounded bg-black/10" />
    </div>
  );
}
