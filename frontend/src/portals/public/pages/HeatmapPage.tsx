import { useMemo, type JSX } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { usePublicHeatmap } from '../api/client';
import { Spinner, EmptyState } from '../../moderator/design';

const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];

/**
 * Every point here is a `(round(lat, 2), round(lng, 2))` grid cell
 * count from `PublicHeatmapService` — never an individual report's
 * exact coordinates. A cell always represents an aggregate.
 */
export default function HeatmapPage(): JSX.Element {
  const heatmap = usePublicHeatmap();

  const points = heatmap.data ?? [];
  const maxCount = useMemo(() => Math.max(1, ...(heatmap.data ?? []).map((p) => p.count)), [heatmap.data]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Report density</h1>
        <p className="mt-1 text-sm text-slate-600">
          Reports grouped into a ~1.1 km grid — never an individual report&apos;s exact location.
        </p>
      </header>

      {heatmap.isLoading ? (
        <div className="flex items-center justify-center py-16"><Spinner label="Loading heat map" /></div>
      ) : heatmap.isError ? (
        <EmptyState title="Heat map unavailable" description="Please try again shortly." />
      ) : points.length === 0 ? (
        <EmptyState title="No reports yet" description="The heat map will populate as reports come in." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200" style={{ height: 480 }}>
          <MapContainer center={BENGALURU_CENTER} zoom={11} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map((p) => (
              <CircleMarker
                key={`${p.lat}-${p.lng}`}
                center={[p.lat, p.lng]}
                radius={6 + (p.count / maxCount) * 18}
                pathOptions={{ color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.5 }}
              >
                <Popup>{p.count} report{p.count === 1 ? '' : 's'} in this area</Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
