import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
  Select,
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

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'verified', label: 'Verified' },
  { value: 'closed', label: 'Closed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'merged', label: 'Merged' },
  { value: 'escalated', label: 'Escalated' },
];

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

function statusTone(
  code: string | null | undefined,
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (code) {
    case 'assigned':
    case 'accepted':
    case 'in_progress':
      return 'info';
    case 'resolved':
    case 'verified':
      return 'success';
    case 'closed':
      return 'neutral';
    case 'rejected':
    case 'merged':
      return 'warning';
    case 'escalated':
      return 'danger';
    default:
      return 'neutral';
  }
}

function priorityTone(code: string | null | undefined): 'warning' | 'danger' | 'neutral' {
  switch (code) {
    case 'high':
      return 'danger';
    case 'medium':
      return 'warning';
    default:
      return 'neutral';
  }
}

export default function GisMapPage() {
  const [filters, setFilters] = useState<ReportListFilters>({
    status: '',
    per_page: 500,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      .filter(
        (p): p is { report: DepartmentReportListItem; lat: number; lng: number } => p !== null,
      );
  }, [data]);

  const selected = useMemo(
    () => points.find((p) => p.report.id === selectedId)?.report ?? null,
    [points, selectedId],
  );

  useEffect(() => {
    setSelectedId(null);
  }, [filters]);

  // Compute a sensible initial center: average of points,
  // or Bengaluru (BBMP) if no points.
  const center: [number, number] = useMemo(() => {
    if (points.length === 0) return [12.9716, 77.5946];
    const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), {
      lat: 0,
      lng: 0,
    });
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
            onClick={() => {
              void refetch();
            }}
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
        <p className="text-sm text-slate-500">
          {points.length} report{points.length === 1 ? '' : 's'} on the map
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select
            label="Status"
            name="status"
            value={filters.status ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            options={STATUS_OPTIONS}
          />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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
                  <Marker
                    key={report.id}
                    position={[lat, lng]}
                    eventHandlers={{ click: () => setSelectedId(report.id) }}
                  >
                    <Popup>
                      <div className="space-y-1 text-xs">
                        <p className="font-mono font-semibold">{report.tracking_number}</p>
                        <p className="font-medium">{report.title}</p>
                        <p>
                          <Badge tone={statusTone(report.current_status_code)}>
                            {report.current_status_code ?? '—'}
                          </Badge>
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

        {selected && (
          <aside
            aria-label="Selected report details"
            className="fixed inset-x-0 bottom-0 z-10 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white p-4 shadow-xl lg:static lg:z-auto lg:col-span-1 lg:max-h-none lg:rounded-none lg:border lg:p-5 lg:shadow-sm"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className="font-mono text-xs text-slate-500">{selected.tracking_number}</p>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close report details"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <span aria-hidden className="text-sm">
                  ×
                </span>
              </button>
            </div>
            <h2 className="text-base font-semibold text-slate-900">{selected.title}</h2>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(selected.current_status_code)}>
                  {selected.current_status_code ?? '—'}
                </Badge>
                <Badge tone={priorityTone(selected.priority?.code ?? null)}>
                  {selected.priority?.name ?? selected.priority?.code ?? '—'} priority
                </Badge>
              </div>
              <p>
                <span className="block text-xs uppercase tracking-wide text-slate-500">
                  Category
                </span>
                {selected.report_type?.name ?? selected.report_type?.code ?? '—'}
              </p>
              <p>
                <span className="block text-xs uppercase tracking-wide text-slate-500">
                  Address
                </span>
                {selected.location?.address ?? '—'}
              </p>
              <p>
                <span className="block text-xs uppercase tracking-wide text-slate-500">
                  Coordinates
                </span>
                <span className="font-mono text-xs">
                  {points.find((p) => p.report.id === selected.id)?.lat.toFixed(5)},{' '}
                  {points.find((p) => p.report.id === selected.id)?.lng.toFixed(5)}
                </span>
              </p>
              <p>
                <span className="block text-xs uppercase tracking-wide text-slate-500">
                  Reference
                </span>
                <span className="font-mono text-xs">{selected.tracking_number}</span>
              </p>
            </div>
            <Link
              to={`/operations/reports/${selected.id}`}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Open report
            </Link>
          </aside>
        )}
      </div>

      {points.length === 0 && (
        <EmptyState
          title="No reports on the map"
          description="Try clearing the status filter or check that your reports have a location."
        />
      )}
    </div>
  );
}
