import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Spinner,
  EmptyState,
  Input,
  Badge,
} from '../design';
import { departmentApi, type ReportListFilters } from '../api/operations';
import type { DepartmentReportListItem } from '../types';

// Default Leaflet marker icons are not bundled by
// react-leaflet out of the box; substitute with the
// CDN-hosted PNGs so markers appear on the map.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function statusColor(code: string | null | undefined): string {
  switch (code) {
    case 'assigned':
      return '#2563eb'; // blue-600
    case 'accepted':
      return '#0d9488'; // teal-600
    case 'in_progress':
      return '#7c3aed'; // violet-600
    case 'resolved':
      return '#16a34a'; // green-600
    case 'verified':
      return '#15803d';
    case 'closed':
      return '#64748b'; // slate-500
    case 'rejected':
      return '#dc2626';
    default:
      return '#0f172a';
  }
}

export default function GisMapPage() {
  const [filters, setFilters] = useState<ReportListFilters>({
    status: '',
    per_page: 500,
  });

  const { data, isLoading, error, refetch } = useQuery<{ data: DepartmentReportListItem[] }>({
    queryKey: ['operations', 'reports', 'gis', filters],
    queryFn: () =>
      departmentApi
        .listReports(filters)
        .then((p) => ({ data: (p as { data: DepartmentReportListItem[] }).data })),
  });

  const points = useMemo(() => {
    return (data?.data ?? [])
      .map((r) => {
        const loc = r.location;
        if (!loc) return null;
        const lat = loc.lat;
        const lng = loc.lng;
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        return { report: r, lat, lng };
      })
      .filter((p): p is { report: DepartmentReportListItem; lat: number; lng: number } => p !== null);
  }, [data]);

  // Compute a sensible initial center: average of points,
  // or Bengaluru (BBMP) if no points.
  const center: [number, number] = useMemo(() => {
    if (points.length === 0) return [12.9716, 77.5946];
    const sum = points.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 },
    );
    return [sum.lat / points.length, sum.lng / points.length];
  }, [points]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading map data" />
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState
        title="Could not load reports"
        description="The reports endpoint did not respond."
        action={
          <button
            type="button"
            onClick={() => { void refetch(); }}
            className="text-sm font-medium text-emerald-600 hover:underline"
          >
            Retry
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">GIS map</h1>
        <p className="text-sm text-slate-500">{points.length} report{points.length === 1 ? '' : 's'} on the map</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            label="Status"
            placeholder="assigned, accepted, in_progress…"
            value={filters.status ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <div className="h-[520px] w-full overflow-hidden rounded-b-md">
            <MapContainer
              center={center}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
              aria-label="Department reports on a map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {points.map(({ report, lat, lng }) => (
                <Marker key={report.id} position={[lat, lng]}>
                  <Popup>
                    <div className="space-y-1 text-xs">
                      <p className="font-mono font-semibold">{report.tracking_number}</p>
                      <p className="font-medium">{report.title}</p>
                      <p>
                        <Badge tone="info">{report.current_status_code ?? '—'}</Badge>
                      </p>
                      <p>{report.report_type?.name ?? report.report_type?.code ?? '—'}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {/* Heatmap-style circles: larger and translucent
                  around clustered reports so the user can see
                  density at a glance. */}
              {points.map(({ report, lat, lng }) => (
                <CircleMarker
                  key={`heat-${report.id}`}
                  center={[lat, lng]}
                  radius={28}
                  pathOptions={{
                    color: statusColor(report.current_status_code),
                    fillColor: statusColor(report.current_status_code),
                    fillOpacity: 0.15,
                    weight: 0,
                  }}
                />
              ))}
            </MapContainer>
          </div>
        </CardBody>
      </Card>

      {points.length === 0 && (
        <EmptyState
          title="No reports on the map"
          description="Try clearing the status filter or check that your reports have a location."
        />
      )}
    </div>
  );
}
