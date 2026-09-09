import { useMemo, type JSX } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TextileDropoffCentreInfo } from '../api/textileZones';
import { googleMapsUrl } from './mapUrls';

export interface TextileCentreSelectProps {
  /** Centres embedded on the selected zone (may be missing on older API responses). */
  centres?: TextileDropoffCentreInfo[] | null;
  value: string;
  onChange: (centreId: string) => void;
  disabled?: boolean;
  error?: string;
}

function pinIcon(selected: boolean): L.DivIcon {
  return L.divIcon({
    className: selected ? 'cip-centre-pin-selected' : 'cip-centre-pin',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38" aria-hidden="true"><path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 24 14 24s14-14.5 14-24C28 6.27 21.73 0 14 0z" fill="${selected ? '#dc2626' : '#15803d'}" stroke="#ffffff" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="#ffffff"/></svg>`,
    iconSize: [28, 38],
    iconAnchor: [14, 38],
  });
}

const SELECTED_PIN = pinIcon(true);
const DEFAULT_PIN = pinIcon(false);

function hasCoords(c: TextileDropoffCentreInfo): c is TextileDropoffCentreInfo & {
  latitude: number;
  longitude: number;
} {
  return c.latitude !== null && c.longitude !== null;
}

/**
 * Drop-off centre picker for the citizen booking flow (issue #11).
 *
 * A dropdown driven by the selected zone's open centres, plus a tap-the-pin
 * map when staff have pinned centre locations. The dropdown list is the
 * source of truth offline (map tiles need network); centres without pinned
 * coordinates are still choosable from the dropdown.
 */
export function TextileCentreSelect({
  centres,
  value,
  onChange,
  disabled = false,
  error,
}: TextileCentreSelectProps): JSX.Element | null {
  const open = useMemo(
    () => (centres ?? []).filter((c) => c.active && c.status === 'open'),
    [centres],
  );
  const pinned = useMemo(() => open.filter(hasCoords), [open]);
  const selected = open.find((c) => c.id === value) ?? null;
  const mapCenter: [number, number] =
    selected !== null && hasCoords(selected)
      ? [selected.latitude, selected.longitude]
      : pinned[0] !== undefined
        ? [pinned[0].latitude, pinned[0].longitude]
        : [12.9716, 77.5946];

  if (open.length === 0) {
    return (
      <p className="rounded-lg bg-[var(--color-surface-alt)] p-3 text-sm text-[var(--color-text-secondary)]">
        No separate drop-off centre is listed for this zone yet — the collection team will confirm
        the drop-off point after you submit.
      </p>
    );
  }

  return (
    <div>
      <label htmlFor="textile-centre" className="block text-sm font-medium text-[var(--color-ink)]">
        Drop-off centre
      </label>
      <select
        id="textile-centre"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'textile-centre-err' : undefined}
        className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
      >
        <option value="">Choose a centre…</option>
        {open.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {error ? (
        <p id="textile-centre-err" role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
      {pinned.length > 0 ? (
        <div
          role="img"
          aria-label={`Map showing ${pinned.length} drop-off ${pinned.length === 1 ? 'centre' : 'centres'}. Tap a pin to choose it.`}
          className="mt-2 overflow-hidden rounded-lg border border-[var(--color-border)]"
          style={{ height: 190 }}
        >
          <MapContainer
            center={mapCenter}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {pinned.map((c) => (
              <Marker
                key={c.id}
                position={[c.latitude, c.longitude]}
                icon={c.id === value ? SELECTED_PIN : DEFAULT_PIN}
                eventHandlers={{ click: () => onChange(c.id) }}
              />
            ))}
          </MapContainer>
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
          Map pins coming soon for these centres — the list above has every open centre in this
          zone.
        </p>
      )}
      {selected ? (
        <div className="mt-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] p-3 text-sm">
          <p className="font-medium text-[var(--color-ink)]">{selected.name}</p>
          {selected.address ? (
            <p className="mt-0.5 text-xs leading-5 text-[var(--color-text-secondary)]">
              {selected.address}
              {selected.public_phone ? ` · ${selected.public_phone}` : ''}
            </p>
          ) : null}
          <a
            href={googleMapsUrl({
              name: selected.name,
              address: selected.address ?? '',
              center: hasCoords(selected)
                ? { latitude: selected.latitude, longitude: selected.longitude }
                : null,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs font-medium text-[var(--color-ink)] underline"
          >
            Directions
          </a>
        </div>
      ) : null}
    </div>
  );
}
