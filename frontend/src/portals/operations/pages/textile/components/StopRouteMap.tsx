import { useEffect, useMemo, useState, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, WifiOff } from 'lucide-react';
import { buildTripRoute, type RouteMapStop } from './tripRouteMapUtils';
import { fetchRoadRoute, type LatLng } from './roadRoute';
import { mapsHref, stopPageHref } from '../stopWorkUtils';

/**
 * Literal fills matching src/shared/ui/tokens.css (same note as
 * TripRouteMap: Leaflet inline styles cannot resolve var(...)).
 */
const DONE_LINE = '#226b46';
const TODO_LINE = '#1d1d1b';

const PIN_FILL: Record<string, string> = {
  next: '#b45309',
  done: '#226b46',
  missed: '#a42f29',
  todo: '#1d1d1b',
};

function collectionPinIcon(sequence: number, tone: string, isCurrent: boolean): L.DivIcon {
  const size = isCurrent ? 32 : 28;
  return L.divIcon({
    className: 'cip-collection-pin',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${PIN_FILL[tone] ?? PIN_FILL.todo};color:#fff;font-size:${isCurrent ? 13 : 12}px;font-weight:700;font-family:ui-monospace,monospace;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);${isCurrent ? 'outline:3px solid #fcd34d;outline-offset:1px;' : ''}">${sequence}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitBounds({ path }: { path: LatLng[] }): null {
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

function InvalidateOnShow({ show }: { show: boolean }): null {
  const map = useMap();
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [map, show]);
  return null;
}

/**
 * Road-following route map and Stop-to-Stop Geolocation Navigation for the collection work page.
 *
 * Provides instant 1-tap GPS turn-by-turn driving navigation from stop to stop
 * via Google Maps and Apple Maps, plus a collapsible road overview map.
 */
export default function StopRouteMap({
  items,
  currentId,
  batchId,
}: {
  items: RouteMapStop[];
  currentId: string;
  batchId: string;
}): JSX.Element | null {
  const route = useMemo(() => buildTripRoute(items), [items]);
  const currentSequence =
    route.points.find((p) => p.stopId === currentId)?.sequence ?? route.nextSequence ?? 1;

  const travelledPins = useMemo(
    () =>
      route.points.filter((p) => p.sequence <= currentSequence).map((p): LatLng => [p.lat, p.lng]),
    [route.points, currentSequence],
  );
  const remainingPins = useMemo(
    () =>
      route.points.filter((p) => p.sequence >= currentSequence).map((p): LatLng => [p.lat, p.lng]),
    [route.points, currentSequence],
  );

  const [roads, setRoads] = useState<{ travelled: LatLng[] | null; remaining: LatLng[] | null }>({
    travelled: null,
    remaining: null,
  });

  const cacheKey = useMemo(
    () => `${currentId}:${items.map((i) => `${i.id}:${i.latitude}:${i.longitude}`).join(',')}`,
    [currentId, items],
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setRoads({ travelled: null, remaining: null });
    void Promise.all([
      fetchRoadRoute(travelledPins, controller.signal),
      fetchRoadRoute(remainingPins, controller.signal),
    ]).then(([travelled, remaining]) => {
      if (active) setRoads({ travelled, remaining });
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [cacheKey, travelledPins, remainingPins]);

  const [showMap, setShowMap] = useState(false);

  if (route.totalCount === 0) return null;

  const travelledPath = roads.travelled ?? travelledPins;
  const remainingPath = roads.remaining ?? remainingPins;
  const boundsPath = [...travelledPath, ...remainingPath];

  return (
    <section aria-label="Collection route map" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-ink)]">
            <Navigation className="h-4 w-4" aria-hidden="true" />
            Today’s collection route
          </span>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            Tap a collection to switch pickups, or tap Nav to start GPS turn-by-turn navigation.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowMap((prev) => !prev)}
            aria-label={showMap ? 'Hide map' : 'View road map'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <span>{showMap ? 'Hide map' : 'View road map'}</span>
          </button>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700">
            {currentSequence} / {route.totalCount}
          </span>
        </div>
      </div>

      {/* Stop Sequence Strip with 1-Tap Geolocation Navigation */}
      {routeStrip(items, currentId, batchId)}

      <div className={showMap ? 'space-y-3' : 'hidden'}>
        {route.center ? (
          <div
            role="img"
            aria-label={`Road route map with ${route.mappedCount} numbered collections in visit order`}
            className="h-72 w-full overflow-hidden rounded-xl border border-[var(--color-border-subtle)] shadow-inner sm:h-80"
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
              <FitBounds path={boundsPath} />
              <InvalidateOnShow show={showMap} />
              {travelledPath.length > 1 ? (
                <Polyline
                  positions={travelledPath}
                  pathOptions={{ color: DONE_LINE, weight: 4, opacity: 0.85 }}
                />
              ) : null}
              {remainingPath.length > 1 ? (
                <Polyline
                  positions={remainingPath}
                  pathOptions={{ color: TODO_LINE, weight: 3, opacity: 0.7 }}
                />
              ) : null}
              {route.points.map((point) => {
                const isCurrent = point.stopId === currentId;
                return (
                  <Marker
                    key={point.stopId}
                    position={[point.lat, point.lng]}
                    icon={collectionPinIcon(point.sequence, point.tone, isCurrent)}
                  >
                    <Popup>
                      <div className="space-y-1 text-xs">
                        <p className="font-bold text-[var(--color-ink)]">
                          {point.sequence}: {point.requesterName}
                          {isCurrent ? ' · Current' : ''}
                        </p>
                        <p className="text-[var(--color-text-secondary)]">{point.pickupAddress}</p>
                        <p className="flex gap-3">
                          <a
                            href={mapsHref(point.pickupAddress, point.lat, point.lng)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-sky-800 hover:underline"
                          >
                            Navigate
                          </a>
                          <Link
                            to={stopPageHref(batchId, point.stopId)}
                            className="font-semibold text-sky-800 hover:underline"
                          >
                            Open collection
                          </Link>
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        ) : (
          <div className="grid h-64 place-items-center rounded-xl border border-amber-200 bg-amber-50 px-6 text-center">
            <div className="max-w-sm">
              <Navigation className="mx-auto h-6 w-6 text-amber-800" aria-hidden="true" />
              <p className="mt-2 text-sm font-bold text-amber-950">Route map is not ready</p>
              <p className="mt-1 text-xs leading-5 text-amber-900">
                These older bookings need their pickup addresses converted to map locations.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-[var(--color-text-secondary)]">
          <span className="inline-flex items-center gap-1">
            <i
              aria-hidden="true"
              className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-white"
              style={{ background: DONE_LINE }}
            >
              ✓
            </i>
            Travelled
          </span>
          <span className="inline-flex items-center gap-1">
            <i
              aria-hidden="true"
              className="h-1 w-4 rounded-full"
              style={{ background: TODO_LINE }}
            />
            Remaining road route
          </span>
        </div>

        {route.unmapped.length > 0 && route.mappedCount > 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            {route.unmapped.length} collection{route.unmapped.length === 1 ? '' : 's'} cannot be
            placed on the map yet. Navigation still uses the saved address.
          </p>
        ) : null}

        <p className="flex items-start gap-1.5 px-1 text-[11px] text-[var(--color-text-tertiary)]">
          <WifiOff className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          Map tiles and road routing need a network connection. The list below remains the source of
          truth offline.
        </p>
      </div>
    </section>
  );
}

/** Slim offline-safe status strip: numbered chips linking to each collection with 1-tap GPS nav. */
function routeStrip(items: RouteMapStop[], currentId: string, batchId: string): JSX.Element | null {
  if (items.length < 2) return null;
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto pb-1"
      aria-label="Collections in visit order"
    >
      {items.map((stop, idx) => {
        const isCurrent = stop.id === currentId;
        const done = stop.status === 'picked_up';
        const missed = stop.status === 'missed';
        return (
          <div
            key={stop.id}
            className={`flex shrink-0 items-center rounded-full border transition ${
              isCurrent
                ? 'border-slate-900 bg-slate-900 font-semibold text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Link
              to={stopPageHref(batchId, stop.id)}
              aria-current={isCurrent ? 'true' : undefined}
              className={`flex items-center gap-2 py-1.5 pl-3 pr-2 text-xs transition ${
                isCurrent ? 'text-white' : 'text-slate-700'
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
                  done
                    ? 'bg-emerald-100 text-emerald-800'
                    : missed
                      ? 'bg-rose-100 text-rose-800'
                      : isCurrent
                        ? 'bg-white text-slate-900'
                        : 'bg-slate-200 text-slate-700'
                }`}
              >
                {done ? '✓' : missed ? '!' : idx + 1}
              </span>
              <span className="max-w-[120px] truncate font-medium">{stop.requester_name}</span>
            </Link>

            <span
              className={`h-3.5 w-px ${isCurrent ? 'bg-slate-700' : 'bg-slate-200'}`}
              aria-hidden="true"
            />

            <a
              href={mapsHref(stop.pickup_address, stop.latitude, stop.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Navigate with GPS"
              title="Navigate with GPS"
              className={`flex items-center gap-0.5 py-1.5 pl-1.5 pr-3 text-[11px] font-semibold transition rounded-r-full ${
                isCurrent ? 'text-sky-300 hover:text-sky-200' : 'text-sky-700 hover:text-sky-900'
              }`}
            >
              <Navigation className="h-3 w-3" aria-hidden="true" />
              <span>Nav</span>
            </a>
          </div>
        );
      })}
    </div>
  );
}
