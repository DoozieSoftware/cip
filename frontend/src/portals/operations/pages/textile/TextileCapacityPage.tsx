import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { type JSX } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconBuildingCommunity,
  IconChartPie,
  IconGitFork,
  IconMapPin,
  IconTrendingUp,
  IconTruck,
} from '@tabler/icons-react';
import {
  downloadTextileReportingExport,
  fetchStaffTextileZones,
  fetchTextileLiveSnapshot,
  fetchTextileReportingDashboard,
  type TextileCapacityDashboard,
  type TextileServiceZone,
} from '../../api/textileApi';
import {
  DeskPage,
  DeskStates,
  OPERATIONS_QUEUE_REFRESH_MS,
  STATUS_LABELS,
  useDesk,
} from './shared';

type DashboardReport = TextileCapacityDashboard & {
  timeseries?: Array<{
    period: string;
    requests: number;
    actual_bags: number;
    estimated_bags: number;
  }>;
};

const TRIP_STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  assigned: 'Assigned',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_DESTINATIONS: Record<string, string> = {
  pending_review: '/operations/textile-collections/review',
  ready_to_group: '/operations/textile-collections/schedule',
  scheduled: '/operations/textile-collections/collections',
  picked_up: '/operations/textile-collections/completed',
  received_at_centre: '/operations/textile-collections/completed',
  dropoff_awaiting_drop: '/operations/textile-collections/pickup-requests',
  missed: '/operations/textile-collections/completed',
  rejected: '/operations/textile-collections/completed',
  cancelled: '/operations/textile-collections/completed',
};

function destinationForStatus(statusKey: string): string {
  return STATUS_DESTINATIONS[statusKey] ?? '/operations/textile-collections/completed';
}

function labelForStatus(statusKey: string): string {
  return STATUS_LABELS[statusKey] ?? statusKey.replaceAll('_', ' ');
}

function labelFor(map: Record<string, string>, key: string): string {
  return map[key] ?? key.replaceAll('_', ' ');
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
}

const MONTHS: Array<{ value: string; label: string }> = [
  { value: '01', label: 'Jan' },
  { value: '02', label: 'Feb' },
  { value: '03', label: 'Mar' },
  { value: '04', label: 'Apr' },
  { value: '05', label: 'May' },
  { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' },
  { value: '08', label: 'Aug' },
  { value: '09', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
];

function yearOptions(): string[] {
  const current = new Date().getFullYear();
  const years: string[] = [];
  for (let y = current; y >= 2020; y -= 1) years.push(String(y));
  return years;
}

export default function TextileCapacityPage(): JSX.Element {
  const desk = useDesk();
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [selectedZone, setSelectedZone] = useState('');

  const zonesQuery = useQuery({
    queryKey: ['operations', 'textile', 'zones', desk.departmentId],
    queryFn: () => fetchStaffTextileZones(desk.departmentId),
    enabled: desk.ready && desk.isDrLinen,
    staleTime: 60_000,
  });
  const zones: TextileServiceZone[] = zonesQuery.data ?? [];

  const periodParams: {
    department_id: string | undefined;
    year?: string;
    month?: string;
    service_zone_id?: string;
    granularity: 'day' | 'month';
  } = {
    department_id: desk.departmentId,
    ...(year ? { year } : {}),
    ...(month ? { month } : {}),
    ...(selectedZone ? { service_zone_id: selectedZone } : {}),
    granularity: month ? 'day' : 'month',
  };
  const dashboard = useQuery({
    queryKey: ['textile', 'reporting', desk.departmentId, year, month, selectedZone],
    queryFn: () => fetchTextileReportingDashboard(periodParams),
    enabled: desk.ready && desk.isDrLinen,
    // Keep the previous period visible while the next one loads so the
    // period controls never unmount mid-switch.
    placeholderData: (previous) => previous,
  });
  const report: DashboardReport | undefined = dashboard.data;
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport(): Promise<void> {
    setExportBusy(true);
    setExportError(null);
    try {
      await downloadTextileReportingExport({
        department_id: desk.departmentId,
        ...(year ? { year } : {}),
        ...(month ? { month } : {}),
        ...(selectedZone ? { service_zone_id: selectedZone } : {}),
      });
    } catch {
      setExportError('Export failed. Check your session and try again.');
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <DeskPage
      desk={desk}
      title="Operations dashboard"
      description="Live field position, fleet overview, and period performance analytics."
    >
      <LiveStrip departmentId={desk.departmentId} enabled={desk.ready && desk.isDrLinen} />

      <DeskStates
        loading={dashboard.isLoading}
        error={dashboard.isError}
        onRetry={() => {
          void dashboard.refetch();
        }}
        hasRows={true}
        emptyTitle="No dashboard data"
        emptyBody="Collection performance reporting will appear here."
      >
        <section aria-label="Period analytics" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                Year
                <select
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  aria-label="Analytics year"
                  className="ml-1.5 h-9 rounded-lg border border-[var(--color-border)] bg-white px-2 text-xs font-medium text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                >
                  <option value="">Last 12 months</option>
                  {yearOptions().map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                Month
                <select
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  aria-label="Analytics month"
                  className="ml-1.5 h-9 rounded-lg border border-[var(--color-border)] bg-white px-2 text-xs font-medium text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                >
                  <option value="">All months</option>
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                Zone
                <select
                  value={selectedZone}
                  onChange={(event) => setSelectedZone(event.target.value)}
                  aria-label="Analytics zone"
                  className="ml-1.5 h-9 rounded-lg border border-[var(--color-border)] bg-white px-2 text-xs font-medium text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                >
                  <option value="">All zones</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </label>
              {year || month || selectedZone ? (
                <button
                  type="button"
                  onClick={() => {
                    setYear('');
                    setMonth('');
                    setSelectedZone('');
                  }}
                  className="h-9 px-2 text-xs font-medium text-slate-500 hover:text-slate-800 underline"
                >
                  Reset
                </button>
              ) : null}
            </div>
            {report ? (
              <div className="flex flex-col items-end gap-1">
                <button
                  type="button"
                  disabled={exportBusy}
                  onClick={() => void handleExport()}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)] disabled:opacity-40"
                >
                  {exportBusy ? 'Exporting…' : 'Export CSV'}
                </button>
                {exportError ? (
                  <p role="alert" className="text-xs text-[var(--color-danger)]">
                    {exportError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {report ? (
            <>
              <div
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
                aria-label="Collection performance summary"
              >
                <Metric
                  label="Requests"
                  value={report.totals.requests}
                  note={`${report.period.start} to ${report.period.end}`}
                />
                <Metric
                  label="Collected bags"
                  value={report.totals.actual_bags}
                  note={`Est. ${report.totals.estimated_bags}${
                    report.totals.variance_bags !== null
                      ? ` · ${report.totals.variance_bags >= 0 ? `+${report.totals.variance_bags}%` : `${report.totals.variance_bags}%`}`
                      : ''
                  }`}
                />
                <Metric
                  label="Weight collected"
                  value={`${report.totals.actual_weight_kg} kg`}
                  note={`Est. ${report.totals.estimated_weight_kg} kg${
                    report.totals.variance_weight_kg !== null
                      ? ` · ${report.totals.variance_weight_kg >= 0 ? `+${report.totals.variance_weight_kg}%` : `${report.totals.variance_weight_kg}%`}`
                      : ''
                  }`}
                />
                <Metric
                  label="Fulfillment rate"
                  value={`${Math.max(0, Math.round((100 - report.rates.missed_rate_pct) * 10) / 10)}%`}
                  note={`${report.rates.missed_count} missed (${report.rates.missed_rate_pct}%)`}
                />
                <Metric
                  label="Reschedule rate"
                  value={`${report.rates.reschedule_rate_pct}%`}
                  note={`${report.rates.rescheduled_count} rescheduled`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                  <span className="font-bold text-slate-900">{report.totals.trips}</span> trips
                </span>
                {report.totals.actual_bags > 0 ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                    title="Average weight per collected bag"
                  >
                    Avg bag density{' '}
                    <span className="font-bold text-slate-900">
                      {(report.totals.actual_weight_kg / report.totals.actual_bags).toFixed(1)}{' '}
                      kg/bag
                    </span>
                  </span>
                ) : null}
                {report.totals.trips > 0 ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                    title="Average requests per trip"
                  >
                    Pickup density{' '}
                    <span className="font-bold text-slate-900">
                      {(report.totals.requests / report.totals.trips).toFixed(1)} req/trip
                    </span>
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                  Drop-off{' '}
                  <span className="font-bold text-slate-900">{report.volumes.dropoff}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                  Pickup <span className="font-bold text-slate-900">{report.volumes.premises}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                  Exceptions{' '}
                  <span className="font-bold text-slate-900">{report.rates.exception_count}</span> (
                  {report.rates.exception_rate_pct}%)
                </span>
                {report.timing.avg_hours_booking_to_update !== null ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                    Avg turnaround{' '}
                    <span className="font-bold text-slate-900">
                      {report.timing.avg_hours_booking_to_update}h
                    </span>
                  </span>
                ) : null}
                <span className="text-[11px] text-slate-500">
                  Totals match the CSV export for this period.
                </span>
              </div>

              <p className="rounded-lg border border-sky-200/60 bg-sky-50/50 px-3 py-2 text-xs text-sky-950">
                Data quality: {report.data_quality.note}{' '}
                {report.data_quality.missing_estimates > 0
                  ? `${report.data_quality.missing_estimates} request(s) are missing estimates.`
                  : ''}
              </p>

              <CollapsibleSection
                title="Operations Analytics & Performance Charts"
                hint={`${report.timeseries?.length ?? 0} periods · ${Object.keys(report.breakdowns.zone).length} zones`}
              >
                <OperationsChartsGrid report={report} />
              </CollapsibleSection>
            </>
          ) : null}
        </section>
      </DeskStates>
    </DeskPage>
  );
}

/**
 * Live strip: today's trips/stops plus what needs action. Loads independently
 * of period analytics so a reporting failure never hides the field position.
 */
function LiveStrip({
  departmentId,
  enabled,
}: {
  departmentId: string | undefined;
  enabled: boolean;
}): JSX.Element {
  const live = useQuery({
    queryKey: ['textile', 'live', departmentId],
    queryFn: () => fetchTextileLiveSnapshot(departmentId),
    enabled,
    refetchInterval: OPERATIONS_QUEUE_REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  if (live.isLoading) {
    return (
      <section aria-label="Live position today" aria-busy="true" className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
          Live · today
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[86px] animate-pulse rounded-xl border border-[var(--color-border-subtle)] bg-white"
            />
          ))}
        </div>
      </section>
    );
  }

  if (live.isError) {
    return (
      <section aria-label="Live position today" className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
          Live · today
        </p>
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-danger)]/20 bg-rose-50 px-3 py-2.5 text-xs text-[var(--color-danger)]"
        >
          <span>Could not load today&apos;s live position.</span>
          <button
            type="button"
            onClick={() => void live.refetch()}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)]"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  const snapshot = live.data;
  if (!snapshot) return <></>;

  const tripStatusNote =
    Object.entries(snapshot.trips.by_status)
      .map(
        ([status, count]) =>
          `${toCount(count)} ${labelFor(TRIP_STATUS_LABELS, status).toLowerCase()}`,
      )
      .join(' · ') || 'No trips scheduled';
  const attention = snapshot.failed_uploads > 0;

  const totalStops = toCount(snapshot.stops.total);
  const collectedStops = toCount(snapshot.stops.collected);
  const pendingStops = toCount(snapshot.stops.pending);
  const missedStops = toCount(snapshot.stops.missed);
  const percentCollected = totalStops > 0 ? Math.round((collectedStops / totalStops) * 100) : 0;

  return (
    <section aria-label="Live position today" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
          Live · <span className="tabular-nums">{snapshot.date}</span>
        </p>
        {totalStops > 0 ? (
          <span className="text-[11px] font-medium text-slate-600">
            Today’s Route Completion:{' '}
            <span className="font-bold text-slate-900">
              {collectedStops}/{totalStops}
            </span>{' '}
            ({percentCollected}%)
            {pendingStops > 0 ? ` · ${pendingStops} pending` : ''}
            {missedStops > 0 ? ` · ${missedStops} missed` : ''}
          </span>
        ) : null}
      </div>

      {totalStops > 0 ? (
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-500"
            style={{ width: `${Math.max(percentCollected, 2)}%` }}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <LiveCard
          to="/operations/textile-collections/collections"
          label="Trips today"
          value={String(snapshot.trips.total)}
          note={tripStatusNote}
          icon={<IconTruck className="h-4 w-4" stroke={1.75} aria-hidden="true" />}
        />
        <LiveCard
          to="/operations/textile-collections/collections"
          label="Pickups today"
          value={String(snapshot.stops.total)}
          note={`${snapshot.stops.pending} pending · ${snapshot.stops.collected} collected · ${snapshot.stops.missed} missed`}
          icon={<IconMapPin className="h-4 w-4" stroke={1.75} aria-hidden="true" />}
        />
        <LiveCard
          to="/operations/textile-collections/pickup-requests"
          label="Pending receipts"
          value={String(snapshot.pending_receipts)}
          note={
            snapshot.pending_receipts === 0
              ? 'Centre queue clear'
              : 'Drop-offs awaiting centre receipt'
          }
          icon={<IconBuildingCommunity className="h-4 w-4" stroke={1.75} aria-hidden="true" />}
          highlight={snapshot.pending_receipts > 0}
        />
        <LiveCard
          to="/operations/textile-collections/offline-recovery"
          label="Failed uploads"
          value={String(snapshot.failed_uploads)}
          note={attention ? 'Needs action' : 'Nothing waiting'}
          icon={<IconAlertTriangle className="h-4 w-4" stroke={1.75} aria-hidden="true" />}
          highlight={attention}
        />
      </div>
    </section>
  );
}

function LiveCard({
  to,
  label,
  value,
  note,
  icon,
  highlight = false,
}: {
  to: string;
  label: string;
  value: string;
  note: string;
  icon: JSX.Element;
  highlight?: boolean;
}): JSX.Element {
  return (
    <Link
      to={to}
      aria-label={`${label}: ${value}. ${note}`}
      className={`group flex min-h-[86px] flex-col justify-between rounded-xl border bg-white p-3.5 shadow-sm transition hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 ${
        highlight
          ? 'border-amber-300 bg-amber-50/40 hover:border-amber-400'
          : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border)]'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
          {label}
        </span>
        <span
          className={highlight ? 'text-amber-700' : 'text-[var(--color-text-tertiary)]'}
          aria-hidden="true"
        >
          {icon}
        </span>
      </span>
      <span className="mt-1 text-xl font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
        {value}
      </span>
      <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--color-text-secondary)] group-hover:text-[var(--color-ink)]">
        {note}
      </span>
    </Link>
  );
}

/**
 * Progressive disclosure per ui-density: secondary analytics blocks collapse
 * into accordions on small viewports (open by default on desktop where ops
 * staff work dense), keeping the glanceable summary visible either way.
 */
function CollapsibleSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    return window.matchMedia('(min-width: 640px)').matches;
  });
  return (
    <section className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 sm:p-5 shadow-sm">
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 [&::-webkit-details-marker]:hidden">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            {title}
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-text-secondary)]">
            {hint}
          </span>
        </summary>
        <div className="pt-3">{children}</div>
      </details>
    </section>
  );
}

function OperationsChartsGrid({ report }: { report: DashboardReport }): JSX.Element {
  const methodEntries = Object.entries(report.breakdowns.collection_method);
  const totalMethod = methodEntries.reduce((acc, [, c]) => acc + toCount(c), 0);
  const pickupCount = toCount(report.breakdowns.collection_method.premises ?? 0);
  const dropoffCount = toCount(report.breakdowns.collection_method.dropoff ?? 0);
  const pickupPct = totalMethod > 0 ? Math.round((pickupCount / totalMethod) * 100) : 0;
  const dropoffPct = totalMethod > 0 ? 100 - pickupPct : 0;

  const zoneEntries = Object.entries(report.breakdowns.zone).sort(
    (a, b) => toCount(b[1]) - toCount(a[1]),
  );
  const totalZone = zoneEntries.reduce((acc, [, c]) => acc + toCount(c), 0);

  const timeseries = report.timeseries ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* CHART 1: Monthly Volume Progression Bar & Line Chart */}
      <MonthlyVolumeCard timeseries={timeseries} />

      {/* CHART 2: Lifecycle Stage Distribution Bar Chart */}
      <LifecycleStageCard report={report} />

      {/* CHART 3: Collection Method Split Donut Chart */}
      <CollectionMethodCard
        pickupCount={pickupCount}
        dropoffCount={dropoffCount}
        pickupPct={pickupPct}
        dropoffPct={dropoffPct}
        totalMethod={totalMethod}
      />

      {/* CHART 4: Top Service Zones Bar Chart */}
      <TopZonesCard zoneEntries={zoneEntries} totalZone={totalZone} />
    </div>
  );
}

function LifecycleStageCard({ report }: { report: DashboardReport }): JSX.Element {
  const status = report.breakdowns.status;
  const total = report.totals.requests || 1;

  const countOf = (key: string) => toCount(status[key]);

  const pendingReview = countOf('pending_review');
  const awaitingDrop = countOf('dropoff_awaiting_drop');
  const readyToSchedule = countOf('ready_to_group');
  const rejected = countOf('rejected') + countOf('cancelled');
  const scheduled = countOf('scheduled');
  const pickedUp = countOf('picked_up');
  const receivedAtCentre = countOf('received_at_centre');
  const missed = countOf('missed');

  const pipelineStages = [
    {
      key: 'pending_review',
      name: labelForStatus('pending_review'),
      value: pendingReview,
      color: '#f59e0b',
      queue: destinationForStatus('pending_review'),
    },
    {
      key: 'dropoff_awaiting_drop',
      name: labelForStatus('dropoff_awaiting_drop'),
      value: awaitingDrop,
      color: '#0ea5e9',
      queue: destinationForStatus('dropoff_awaiting_drop'),
    },
    {
      key: 'ready_to_group',
      name: labelForStatus('ready_to_group'),
      value: readyToSchedule,
      color: '#6366f1',
      queue: destinationForStatus('ready_to_group'),
    },
    {
      key: 'scheduled',
      name: labelForStatus('scheduled'),
      value: scheduled,
      color: '#2563eb',
      queue: destinationForStatus('scheduled'),
    },
    {
      key: 'picked_up',
      name: labelForStatus('picked_up'),
      value: pickedUp,
      color: '#059669',
      queue: destinationForStatus('picked_up'),
    },
    {
      key: 'received_at_centre',
      name: labelForStatus('received_at_centre'),
      value: receivedAtCentre,
      color: '#0d9488',
      queue: destinationForStatus('received_at_centre'),
    },
    {
      key: 'missed',
      name: labelForStatus('missed'),
      value: missed,
      color: '#f43f5e',
      queue: destinationForStatus('missed'),
    },
    ...(rejected > 0
      ? [
          {
            key: 'rejected',
            name: labelForStatus('rejected'),
            value: rejected,
            color: '#94a3b8',
            queue: destinationForStatus('rejected'),
          },
        ]
      : []),
  ];

  const stageOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const list = Array.isArray(params) ? params : [params];
        const item = (list[0] ?? {}) as { name?: string; value?: number };
        const val = typeof item.value === 'number' ? item.value : 0;
        const pct = Math.round((val / total) * 100);
        return `${item.name ?? ''}: <strong>${val}</strong> requests (${pct}%)`;
      },
    },
    grid: { left: 130, right: 35, top: 12, bottom: 16 },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    yAxis: {
      type: 'category',
      data: pipelineStages.map((s) => s.name).reverse(),
      axisLabel: { color: '#334155', fontSize: 10, fontWeight: 500 },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [
      {
        type: 'bar',
        data: pipelineStages
          .map((s) => ({
            value: s.value,
            itemStyle: { color: s.color, borderRadius: [0, 4, 4, 0] },
          }))
          .reverse(),
        label: {
          show: true,
          position: 'right',
          color: '#64748b',
          fontSize: 10,
          formatter: (p: { value: number }) => `${p.value}`,
        },
        barMaxWidth: 16,
      },
    ],
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
            <IconGitFork className="h-4 w-4" stroke={1.75} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Lifecycle Stage Distribution</h3>
            <p className="text-xs text-slate-500">Volume throughput across operational statuses</p>
          </div>
        </div>
        <span className="font-mono text-xs font-semibold text-slate-700">
          {report.totals.requests} requests
        </span>
      </div>

      <div className="mt-3">
        <ReactECharts
          option={stageOption}
          style={{ height: 260 }}
          aria-label="Lifecycle Stage Distribution Chart"
        />
      </div>

      {/* Quick Queue Navigation & Accessible Breakdown */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Stage Breakdown & Queue Links
        </h4>
        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
          {pipelineStages.map((stage) => {
            const pct = Math.round((stage.value / total) * 100);
            return (
              <Link
                key={stage.key}
                to={stage.queue}
                title={`Open ${stage.name} queue`}
                className="group flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1 text-xs hover:bg-slate-100 transition"
              >
                <span className="flex items-center gap-2 font-medium text-slate-700 group-hover:text-indigo-600">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: stage.color }}
                    aria-hidden="true"
                  />
                  {stage.name}
                  <IconArrowUpRight className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {stage.value}{' '}
                  <span className="font-normal text-slate-400 text-[10px]">({pct}%)</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthlyVolumeCard({
  timeseries,
}: {
  timeseries: Array<{
    period: string;
    requests: number;
    actual_bags: number;
    estimated_bags: number;
  }>;
}): JSX.Element {
  if (timeseries.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <IconTrendingUp className="h-4 w-4" stroke={1.75} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Monthly Volume Progression</h3>
            <p className="text-xs text-slate-500">Requests vs collected & estimated bags</p>
          </div>
        </div>
        <p className="py-12 text-center text-xs text-slate-400">No activity in this period.</p>
      </div>
    );
  }

  const periods = timeseries.map((t) => t.period);
  const requestData = timeseries.map((t) => toCount(t.requests));
  const actualBagsData = timeseries.map((t) => toCount(t.actual_bags));
  const estimatedBagsData = timeseries.map((t) => toCount(t.estimated_bags));

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: {
      bottom: 0,
      textStyle: { color: '#64748b', fontSize: 11 },
    },
    grid: { left: 45, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: periods,
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    series: [
      {
        name: 'Requests',
        type: 'bar',
        data: requestData,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: '#334155' },
        barMaxWidth: 24,
      },
      {
        name: 'Collected bags',
        type: 'bar',
        data: actualBagsData,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: '#4f46e5' },
        barMaxWidth: 24,
      },
      {
        name: 'Estimated bags',
        type: 'line',
        data: estimatedBagsData,
        smooth: true,
        lineStyle: { color: '#0ea5e9', width: 2, type: 'dashed' },
        itemStyle: { color: '#0ea5e9' },
      },
    ],
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <IconTrendingUp className="h-4 w-4" stroke={1.75} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Monthly Volume Progression</h3>
            <p className="text-xs text-slate-500">Requests vs collected & estimated bags</p>
          </div>
        </div>
        <span className="font-mono text-xs font-semibold text-slate-700">
          {timeseries.length} periods
        </span>
      </div>

      <div className="mt-3">
        <ReactECharts
          option={option}
          style={{ height: 260 }}
          aria-label="Monthly Volume Progression Chart"
        />
      </div>

      {/* Accessible Companion Table */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Period Breakdown Summary
        </h4>
        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
          {timeseries.map((pt) => (
            <div
              key={pt.period}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1 text-xs"
            >
              <span className="font-mono font-bold text-slate-900">{pt.period}</span>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span className="text-slate-700">
                  <strong className="text-slate-900">{toCount(pt.requests)}</strong> req
                </span>
                <span className="text-indigo-700">
                  <strong className="text-indigo-900">{toCount(pt.actual_bags)}</strong> bags
                </span>
                <span className="text-sky-600">est. {toCount(pt.estimated_bags)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CollectionMethodCard({
  pickupCount,
  dropoffCount,
  pickupPct,
  dropoffPct,
  totalMethod,
}: {
  pickupCount: number;
  dropoffCount: number;
  pickupPct: number;
  dropoffPct: number;
  totalMethod: number;
}): JSX.Element {
  const methodData = [
    { name: 'Home Pickup', value: pickupCount, itemStyle: { color: '#0284c7' } },
    { name: 'Drop-off Centre', value: dropoffCount, itemStyle: { color: '#059669' } },
  ];

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: <strong>{c}</strong> ({d}%)',
    },
    legend: {
      bottom: 0,
      textStyle: { color: '#64748b', fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '72%'],
        center: ['50%', '46%'],
        data: methodData,
        label: {
          color: '#1e293b',
          fontSize: 11,
          formatter: (p: { name: string; percent: number }) => `${p.name}: ${p.percent}%`,
        },
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
      },
    ],
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
            <IconChartPie className="h-4 w-4" stroke={1.75} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Collection Method Split</h3>
            <p className="text-xs text-slate-500">Doorstep pickup vs drop-off centre volume</p>
          </div>
        </div>
        <span className="font-mono text-xs font-semibold text-slate-700">{totalMethod} total</span>
      </div>

      <div className="mt-3">
        <ReactECharts
          option={option}
          style={{ height: 260 }}
          aria-label="Collection Method Split Donut Chart"
        />
      </div>

      <div className="mt-4 flex items-center justify-around border-t border-slate-100 pt-3 text-xs">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 font-medium text-sky-800">
            <span className="h-2 w-2 rounded-full bg-sky-600" aria-hidden="true" />
            Home Pickup
          </span>
          <p className="mt-0.5 font-mono text-base font-bold text-slate-900">
            {pickupCount} <span className="text-xs font-normal text-slate-500">({pickupPct}%)</span>
          </p>
        </div>
        <div className="h-8 w-px bg-slate-100" />
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />
            Drop-off Centre
          </span>
          <p className="mt-0.5 font-mono text-base font-bold text-slate-900">
            {dropoffCount}{' '}
            <span className="text-xs font-normal text-slate-500">({dropoffPct}%)</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function TopZonesCard({
  zoneEntries,
  totalZone,
}: {
  zoneEntries: Array<[string, unknown]>;
  totalZone: number;
}): JSX.Element {
  const zoneNames = zoneEntries
    .slice(0, 8)
    .map(([z]) => z)
    .reverse();
  const zoneValues = zoneEntries
    .slice(0, 8)
    .map(([, c]) => toCount(c))
    .reverse();

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 90, right: 35, top: 10, bottom: 20 },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    yAxis: {
      type: 'category',
      data: zoneNames,
      axisLabel: { color: '#334155', fontSize: 11, fontWeight: 500 },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [
      {
        type: 'bar',
        data: zoneValues,
        itemStyle: { borderRadius: [0, 4, 4, 0], color: '#6366f1' },
        label: { show: true, position: 'right', color: '#64748b', fontSize: 10 },
        barMaxWidth: 18,
      },
    ],
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
            <IconMapPin className="h-4 w-4" stroke={1.75} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Top Service Zones</h3>
            <p className="text-xs text-slate-500">Volume distribution by area</p>
          </div>
        </div>
        <span className="font-mono text-xs font-semibold text-slate-700">
          {zoneEntries.length} zones
        </span>
      </div>

      <div className="mt-3">
        <ReactECharts
          option={option}
          style={{ height: 260 }}
          aria-label="Top Service Zones Bar Chart"
        />
      </div>

      {/* Accessible Companion List */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Zone Volume Breakdown
        </h4>
        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
          {zoneEntries.map(([zoneName, count]) => {
            const val = toCount(count);
            const pct = totalZone > 0 ? Math.round((val / totalZone) * 100) : 0;
            return (
              <div
                key={zoneName}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1 text-xs"
              >
                <span className="font-semibold text-slate-800">{zoneName}</span>
                <span className="font-mono font-bold text-slate-900">
                  {val} <span className="font-normal text-slate-400 text-[10px]">({pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-3.5 sm:p-4 shadow-sm">
      <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">{note}</p>
    </div>
  );
}
