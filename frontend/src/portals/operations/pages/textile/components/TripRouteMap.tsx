import { useEffect, useMemo, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, WifiOff } from 'lucide-react';
import type { TextileCollectionListItem } from '../../../api/textileApi';
import { stopPageHref } from '../stopWorkUtils';
import { buildTripRoute, type RoutePinTone } from './tripRouteMapUtils';

/**
 * Literal fills matching src/shared/ui/tokens.css. Leaflet renders pins
 * and polylines via inline styles / SVG attributes, where `var(...)`
 * does not resolve, so the token hex values are repeated here.
 * --color-warning #b45309 · --color-success #226b46
 * --color-danger #a42f29 · --color-ink #1d1d1b
 */
const PIN_FILL: Record<RoutePinTone, string> = {
  next: '#b45309',
  done: '#226b46',
  missed: '#a42f29',
  todo: '#1d1d1b',
};

const ROUTE_LINE = '#1d1d1b';

function stopPinIcon(sequence: number, tone: RoutePinTone, isNext: boolean): L.DivIcon {
  const size = isNext ? 32 : 28;
  return L.divIcon({
    className: 'cip-route-pin',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${PIN_FILL[tone]};color:#fff;font-size:${isNext ? 13 : 12}px;font-weight:700;font-family:ui-monospace,monospace;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);${isNext ? 'outline:3px solid #fcd34d;outline-offset:1px;' : ''}">${sequence}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitRouteBounds({ path }: { path: Array<[number, number]> }): null {
  const map = useMap();
  useEffect(() => {
    if (path.length > 1) {
      map.fitBounds(L.latLngBounds(path.map(([lat, lng]) => L.latLng(lat, lng))), {
        padding: [24, 24],
      });
    } else if (path.length === 1) {
      map.setView(path[0], 15);
    }
  }, [map, path]);
  return null;
}

/**
 * Read-only Leaflet + OpenStreetMap view of a trip manifest.
 *
 * Numbered pins follow manifest order with a polyline connecting them;
 * the next pending stop pin is highlighted distinctly. Stops without
 * usable coordinates are listed beneath the map in sequence. The map
 * needs network tiles — the itinerary stop list remains the source
 * of truth offline, and this component changes no trip state.
 */
export default function TripRouteMap({
  items,
  tripId,
}: {
  items: TextileCollectionListItem[];
  tripId: string;
}): JSX.Element | null {
  const route = useMemo(() => buildTripRoute(items), [items]);

  if (route.totalCount === 0) return null;

  return (
    <section aria-label="Route map" className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-ink)]">
          <MapPin className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" aria-hidden="true" />
          Route map
        </span>
        <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">
          {route.mappedCount} of {route.totalCount} stops mapped
        </span>
      </div>

      {route.center ? (
        <div
          role="img"
          aria-label={`Route map with ${route.mappedCount} numbered stops in visit order${route.nextSequence ? `, next stop ${route.nextSequence}` : ''}`}
          className="h-56 w-full overflow-hidden rounded-xl border border-[var(--color-border-subtle)] sm:h-64"
        >
          <MapContainer
            center={route.center}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitRouteBounds path={route.path} />
            {route.path.length > 1 ? (
              <Polyline
                positions={route.path}
                pathOptions={{ color: ROUTE_LINE, weight: 3, opacity: 0.7 }}
              />
            ) : null}
            {route.points.map((point) => (
              <Marker
                key={point.stopId}
                position={[point.lat, point.lng]}
                icon={stopPinIcon(point.sequence, point.tone, point.isNext)}
              >
                <Popup>
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-[var(--color-ink)]">
                      Stop {point.sequence}: {point.requesterName}
                      {point.isNext ? ' · Next stop' : ''}
                    </p>
                    <p className="text-[var(--color-text-secondary)]">{point.pickupAddress}</p>
                    <Link
                      to={stopPageHref(tripId, point.stopId)}
                      className="font-semibold text-sky-800 hover:underline"
                    >
                      Open stop
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 px-4 py-3 text-xs text-[var(--color-text-secondary)]">
          No stops on this route have map coordinates yet — the itinerary below is the full
          sequence.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-[var(--color-text-secondary)]">
        <span className="inline-flex items-center gap-1">
          <i
            aria-hidden="true"
            className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-white"
            style={{ background: PIN_FILL.next }}
          >
            N
          </i>
          Next stop
        </span>
        <span className="inline-flex items-center gap-1">
          <i
            aria-hidden="true"
            className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-white"
            style={{ background: PIN_FILL.todo }}
          >
            1
          </i>
          Stop order
        </span>
        <span className="inline-flex items-center gap-1">
          <i
            aria-hidden="true"
            className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-white"
            style={{ background: PIN_FILL.done }}
          >
            2
          </i>
          Collected
        </span>
        <span className="inline-flex items-center gap-1">
          <i
            aria-hidden="true"
            className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-white"
            style={{ background: PIN_FILL.missed }}
          >
            3
          </i>
          Missed
        </span>
      </div>

      {route.unmapped.length > 0 ? (
        <div className="rounded-xl border border-[var(--color-border-subtle)] bg-white">
          <p className="border-b border-[var(--color-border-subtle)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Stops without map coordinates ({route.unmapped.length})
          </p>
          <ol className="divide-y divide-[var(--color-border-subtle)]">
            {route.unmapped.map((stop) => (
              <li key={stop.stopId} className="flex items-start gap-2.5 px-3 py-2">
                <span
                  aria-hidden="true"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-zinc-100 font-mono text-[11px] font-bold text-zinc-800"
                >
                  {stop.sequence}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-[var(--color-ink)]">
                    Stop {stop.sequence}: {stop.requesterName}
                  </span>
                  <span className="block truncate text-[11px] text-[var(--color-text-secondary)]">
                    {stop.pickupAddress}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <p className="flex items-start gap-1.5 px-1 text-[11px] text-[var(--color-text-tertiary)]">
        <WifiOff className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        Map tiles need a network connection. The itinerary stop list remains the source of truth
        offline.
      </p>
    </section>
  );
}
