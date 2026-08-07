import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  IconMap,
  IconMapPin,
  IconFilter,
  IconX,
  IconArrowRight,
  IconAlertCircle,
  IconCategory,
  IconCalendar,
} from '@tabler/icons-react';
import { Spinner, Select, Badge } from '../../../shared/ui';
import { departmentApi, type ReportListFilters } from '../api/operations';
import { useDepartmentSelection } from '../context/DepartmentSelectionContext';
import type { DepartmentReportListItem } from '../types';

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

const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];
const KARNATAKA_BOUNDS: [[number, number], [number, number]] = [
  [11.5, 74.0],
  [18.7, 78.9],
];

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

function looksLikeCoords(address: string): boolean {
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(address.trim());
}

function locationLabel(location: DepartmentReportListItem['location']): string {
  if (location?.address && !looksLikeCoords(location.address)) return location.address;
  return location ? 'Pinned map location' : '—';
}

function isInsideKarnataka(lat: number, lng: number): boolean {
  return (
    lat >= KARNATAKA_BOUNDS[0][0] &&
    lat <= KARNATAKA_BOUNDS[1][0] &&
    lng >= KARNATAKA_BOUNDS[0][1] &&
    lng <= KARNATAKA_BOUNDS[1][1]
  );
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

interface MapPoint {
  report: DepartmentReportListItem;
  lat: number;
  lng: number;
}

interface ReportCluster {
  id: string;
  lat: number;
  lng: number;
  reports: DepartmentReportListItem[];
}

const CLUSTER_CELL_DEGREES = 0.01;

function clusterPoints(points: MapPoint[]): ReportCluster[] {
  const groups = new Map<string, MapPoint[]>();

  for (const point of points) {
    const key = `${Math.floor(point.lat / CLUSTER_CELL_DEGREES)}:${Math.floor(point.lng / CLUSTER_CELL_DEGREES)}`;
    const group = groups.get(key) ?? [];
    group.push(point);
    groups.set(key, group);
  }

  return Array.from(groups.entries()).map(([id, group]) => ({
    id,
    lat: group.reduce((sum, point) => sum + point.lat, 0) / group.length,
    lng: group.reduce((sum, point) => sum + point.lng, 0) / group.length,
    reports: group.map((point) => point.report),
  }));
}

function clusterIcon(count: number): L.DivIcon {
  const size = Math.min(64, Math.max(34, 30 + Math.sqrt(count) * 12));
  const color = count >= 10 ? '#991b1b' : count >= 4 ? '#dc2626' : '#ef4444';

  return L.divIcon({
    className: 'cip-report-cluster',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:${color};border:3px solid rgba(255,255,255,.92);border-radius:9999px;color:#fff;font-size:14px;font-weight:700;box-shadow:0 2px 8px rgba(15,23,42,.25)">${count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function GisMapPage() {
  const [filters, setFilters] = useState<ReportListFilters>({
    status: '',
    per_page: 500,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { selectedId: deptId, ready, memberships } = useDepartmentSelection();

  const scopedFilters: ReportListFilters = { ...filters, department_id: deptId ?? undefined };

  const { data, isLoading, error, refetch } = useQuery<{ data: DepartmentReportListItem[] }>({
    queryKey: ['operations', 'reports', 'gis', scopedFilters],
    queryFn: () =>
      departmentApi
        .listReports(scopedFilters)
        .then((p) => ({ data: (p as { data: DepartmentReportListItem[] }).data })),
    enabled: ready && memberships.length > 0,
  });

  const points = useMemo(() => {
    return (data?.data ?? [])
      .map((r) => {
        const loc = r.location;
        if (!loc) return null;
        const lat = loc.lat;
        const lng = loc.lng;
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        if (!isInsideKarnataka(lat, lng)) return null;
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

  const clusters = useMemo(() => clusterPoints(points), [points]);

  useEffect(() => {
    setSelectedId(null);
  }, [filters]);

  const center: [number, number] = useMemo(() => {
    if (points.length === 0) return BENGALURU_CENTER;
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
      <div className="rounded-xl bg-white p-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <IconAlertCircle className="h-6 w-6 text-red-500" stroke={1.6} />
        </div>
        <h3 className="text-base font-semibold text-[#1d1d1b]">Could not load reports</h3>
        <p className="mt-1 text-sm text-[#6f6e69]">The reports endpoint did not respond.</p>
        <button
          type="button"
          onClick={() => {
            void refetch();
          }}
          className="mt-4 text-sm font-medium text-[#1d1d1b] underline underline-offset-2 hover:text-[#6f6e69]"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1d1d1b]">
            <IconMap className="h-5 w-5 text-white" stroke={1.6} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#1d1d1b]">GIS map</h1>
            <p className="text-xs text-[#85847f]">Geospatial view of department reports</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#6f6e69] shadow-sm ring-1 ring-black/5">
          <IconMapPin className="h-3.5 w-3.5" stroke={1.6} />
          {points.length} report{points.length === 1 ? '' : 's'} on map
        </div>
      </header>

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-2 mb-3">
          <IconFilter className="h-4 w-4 text-[#85847f]" stroke={1.6} />
          <span className="text-xs font-medium uppercase tracking-wide text-[#85847f]">
            Filters
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select
            label="Status"
            name="status"
            value={filters.status ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-white p-0 shadow-sm ring-1 ring-black/5 lg:col-span-2 overflow-hidden">
          <div className="h-[520px] w-full">
            <MapContainer
              center={center}
              zoom={12}
              minZoom={7}
              maxBounds={KARNATAKA_BOUNDS}
              maxBoundsViscosity={1}
              style={{ height: '100%', width: '100%' }}
              aria-label="Department reports on a map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {clusters.map((cluster) => (
                <Marker
                  key={cluster.id}
                  position={[cluster.lat, cluster.lng]}
                  icon={clusterIcon(cluster.reports.length)}
                  eventHandlers={{
                    click: () => {
                      if (cluster.reports.length === 1) {
                        setSelectedId(cluster.reports[0].id);
                      }
                    },
                  }}
                >
                  <Popup>
                    <div className="max-w-64 space-y-2 text-xs">
                      <p className="font-semibold text-[#1d1d1b]">
                        {cluster.reports.length} report
                        {cluster.reports.length === 1 ? '' : 's'} in this area
                      </p>
                      {cluster.reports.slice(0, 5).map((report) => (
                        <Link
                          key={report.id}
                          to={`/operations/reports/${report.id}`}
                          className="block rounded-md p-1 text-[#6f6e69] hover:bg-[#f3f2ed]"
                        >
                          <span className="block font-mono font-semibold text-[#1d1d1b]">
                            {report.tracking_number}
                          </span>
                          <span className="block truncate">{report.title}</span>
                        </Link>
                      ))}
                      {cluster.reports.length > 5 && (
                        <p className="text-[#85847f]">
                          + {cluster.reports.length - 5} more reports
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-black/5 px-4 py-2.5 text-[11px] text-[#6f6e69]">
            <span className="font-medium text-[#1d1d1b]">Reports by area</span>
            <span className="flex items-center gap-1.5">
              <i className="inline-grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                1
              </i>
              One report
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-grid h-5 min-w-5 place-items-center rounded-full bg-red-800 px-1 text-[9px] font-bold text-white">
                5+
              </i>
              More reports
            </span>
          </div>
        </div>

        {selected && (
          <aside
            aria-label="Selected report details"
            className="fixed inset-x-0 bottom-0 z-10 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl ring-1 ring-black/10 lg:static lg:z-auto lg:col-span-1 lg:max-h-none lg:rounded-xl lg:ring-1 lg:ring-black/5"
          >
            <div className="mb-4 flex items-start justify-between gap-2">
              <p className="font-mono text-xs text-[#85847f]">{selected.tracking_number}</p>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close report details"
                className="rounded-md p-1 text-[#85847f] hover:bg-[#f3f2ed] hover:text-[#1d1d1b]"
              >
                <IconX className="h-4 w-4" stroke={1.6} />
              </button>
            </div>
            <h2 className="text-base font-semibold text-[#1d1d1b]">{selected.title}</h2>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(selected.current_status_code)}>
                  {selected.current_status_code ?? '—'}
                </Badge>
                <Badge tone={priorityTone(selected.priority?.code ?? null)}>
                  {selected.priority?.name ?? selected.priority?.code ?? '—'} priority
                </Badge>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <IconCategory className="mt-0.5 h-4 w-4 shrink-0 text-[#85847f]" stroke={1.6} />
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-[#85847f]">
                      Category
                    </span>
                    <span className="text-[#1d1d1b]">
                      {selected.report_type?.name ?? selected.report_type?.code ?? '—'}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <IconMapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#85847f]" stroke={1.6} />
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-[#85847f]">
                      Location
                    </span>
                    <span className="text-[#1d1d1b]">{locationLabel(selected.location)}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <IconCalendar className="mt-0.5 h-4 w-4 shrink-0 text-[#85847f]" stroke={1.6} />
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-[#85847f]">
                      Reference
                    </span>
                    <span className="font-mono text-xs text-[#1d1d1b]">
                      {selected.tracking_number}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <Link
              to={`/operations/reports/${selected.id}`}
              className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1d1d1b] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#2d2d28]"
            >
              Open report
              <IconArrowRight className="h-4 w-4" stroke={1.6} />
            </Link>
          </aside>
        )}
      </div>

      {points.length === 0 && (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-black/5">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f3f2ed]">
            <IconMapPin className="h-6 w-6 text-[#85847f]" stroke={1.6} />
          </div>
          <h3 className="text-base font-semibold text-[#1d1d1b]">No reports on the map</h3>
          <p className="mt-1 text-sm text-[#6f6e69]">
            Try clearing the status filter or check that your reports have a location.
          </p>
        </div>
      )}
    </div>
  );
}
