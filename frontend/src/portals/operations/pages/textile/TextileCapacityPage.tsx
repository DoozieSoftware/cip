import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { type JSX } from 'react';
import {
  IconAlertTriangle,
  IconBuildingCommunity,
  IconMapPin,
  IconTruck,
} from '@tabler/icons-react';
import {
  downloadTextileReportingExport,
  fetchCapacityRules,
  fetchTextileLiveSnapshot,
  fetchTextileReportingDashboard,
  type TextileCapacityDashboard,
} from '../../api/textileApi';
import {
  CATEGORY_LABELS,
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

const METHOD_LABELS: Record<string, string> = {
  dropoff: 'Drop-off',
  premises: 'Pickup',
};

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
  const periodParams: {
    department_id: string | undefined;
    year?: string;
    month?: string;
    granularity: 'day' | 'month';
  } = {
    department_id: desk.departmentId,
    ...(year ? { year } : {}),
    ...(month ? { month } : {}),
    granularity: month ? 'day' : 'month',
  };
  const rules = useQuery({
    queryKey: ['textile', 'capacity-rules', desk.departmentId],
    queryFn: () => fetchCapacityRules(desk.departmentId),
    enabled: desk.ready && desk.isDrLinen,
  });
  const dashboard = useQuery({
    queryKey: ['textile', 'reporting', desk.departmentId, year, month],
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
      description="Live field position, period analytics, and zone capacity rules — partner-scoped."
    >
      <LiveStrip departmentId={desk.departmentId} enabled={desk.ready && desk.isDrLinen} />

      <DeskStates
        loading={rules.isLoading || dashboard.isLoading}
        error={rules.isError || dashboard.isError}
        onRetry={() => {
          void rules.refetch();
          void dashboard.refetch();
        }}
        hasRows={true}
        emptyTitle="No capacity data"
        emptyBody="Capacity policy and reporting will appear here."
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
                className="grid grid-cols-2 gap-3 lg:grid-cols-4"
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
                  note={`Estimate ${report.totals.estimated_bags}`}
                />
                <Metric
                  label="Missed rate"
                  value={`${report.rates.missed_rate_pct}%`}
                  note={`${report.rates.missed_count} missed`}
                />
                <Metric
                  label="Reschedule rate"
                  value={`${report.rates.reschedule_rate_pct}%`}
                  note={`${report.rates.rescheduled_count} rescheduled`}
                />
              </div>

              <p className="text-[11px] text-[var(--color-text-secondary)]">
                {report.totals.trips} trips · Drop-off {report.volumes.dropoff} · Pickup{' '}
                {report.volumes.premises} · Exceptions {report.rates.exception_count} (
                {report.rates.exception_rate_pct}%)
                {report.timing.avg_hours_booking_to_update !== null
                  ? ` · Avg booking to update ${report.timing.avg_hours_booking_to_update} h`
                  : ''}
                {' · '}Totals match the CSV export for this period.
              </p>

              <p className="rounded-lg border border-[var(--color-info)]/20 bg-[var(--color-info)]/[0.06] px-3 py-2 text-xs text-[var(--color-ink)]">
                Data quality: {report.data_quality.note}{' '}
                {report.data_quality.missing_estimates > 0
                  ? `${report.data_quality.missing_estimates} request(s) are missing estimates.`
                  : ''}
              </p>

              <CollapsibleSection
                title="Breakdowns"
                hint={`${Object.keys(report.breakdowns.zone).length} zones · ${Object.keys(report.breakdowns.category).length} categories`}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Breakdown
                    title="By status"
                    entries={report.breakdowns.status}
                    labels={STATUS_LABELS}
                  />
                  <Breakdown
                    title="By method"
                    entries={report.breakdowns.collection_method}
                    labels={METHOD_LABELS}
                  />
                  <Breakdown title="By zone" entries={report.breakdowns.zone} labels={{}} />
                  <Breakdown
                    title="By category"
                    entries={report.breakdowns.category}
                    labels={CATEGORY_LABELS}
                  />
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title="Trend"
                hint={
                  report.timeseries && report.timeseries.length > 0
                    ? `${report.timeseries.length} periods · latest ${report.timeseries[report.timeseries.length - 1]?.requests ?? 0} requests`
                    : 'No activity'
                }
              >
                {report.timeseries && report.timeseries.length > 0 ? (
                  <ol className="space-y-1.5">
                    {report.timeseries.map((point) => {
                      const max = Math.max(1, ...report.timeseries.map((p) => toCount(p.requests)));
                      const width = Math.round((toCount(point.requests) / max) * 100);
                      return (
                        <li
                          key={point.period}
                          className="flex items-center gap-2 text-xs tabular-nums"
                        >
                          <span className="w-20 shrink-0 font-mono text-[11px] text-[var(--color-text-secondary)]">
                            {point.period}
                          </span>
                          <span
                            aria-hidden="true"
                            className="h-2 min-w-1 rounded-full bg-[var(--color-ink)]/70"
                            style={{ width: `${Math.max(width, 2)}%` }}
                          />
                          <span className="shrink-0 text-[11px] text-[var(--color-text-secondary)]">
                            {toCount(point.requests)} requests · {toCount(point.actual_bags)} bags
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    No activity in this period.
                  </p>
                )}
              </CollapsibleSection>

              <CollapsibleSection
                title="Metric definitions"
                hint={`${Object.keys(report.definitions).length} metrics`}
              >
                <dl className="grid gap-2.5 text-xs sm:grid-cols-2">
                  {Object.entries(report.definitions)
                    .filter(([name]) => name !== 'exception_rate')
                    .map(([name, definition]) => (
                      <div key={name} className="rounded-lg bg-[var(--color-surface-alt)] p-2.5">
                        <dt className="font-semibold capitalize text-[var(--color-ink)]">
                          {name.replaceAll('_', ' ')}
                        </dt>
                        <dd className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                          {definition}
                        </dd>
                      </div>
                    ))}
                </dl>
              </CollapsibleSection>
            </>
          ) : null}
        </section>

        <CollapsibleSection
          title="Zone capacity rules"
          hint={
            rules.data && rules.data.length > 0
              ? `${rules.data.length} rule${rules.data.length === 1 ? '' : 's'}`
              : 'Defaults apply'
          }
        >
          <p className="text-xs text-[var(--color-text-secondary)]">
            Home pickups below the configured minimum cannot be submitted or scheduled. Drop-off
            accepts any amount.
          </p>
          {rules.data && rules.data.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border-subtle)] text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    <th className="px-2 py-2">Zone</th>
                    <th>Max bags</th>
                    <th>Max kg</th>
                    <th>Max stops</th>
                    <th>Minimum</th>
                    <th>Guidelines</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.data.map((rule) => (
                    <tr
                      key={rule.id}
                      className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-alt)]"
                    >
                      <td className="px-2 py-2 font-medium text-[var(--color-ink)]">
                        {rule.service_zone?.name ?? rule.service_zone_id}
                      </td>
                      <td>{rule.max_bags ?? 'No limit'}</td>
                      <td>{rule.max_weight_kg ?? 'No limit'}</td>
                      <td>{rule.max_stops ?? 'No limit'}</td>
                      <td>
                        {rule.min_bags ?? '—'} bags / {rule.min_weight_kg ?? '—'} kg
                      </td>
                      <td className="max-w-xs py-2 text-[var(--color-text-secondary)]">
                        {rule.guidance_text ?? 'No public guidance configured.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
              No capacity rules configured. Defaults apply until a partner creates a rule.
            </p>
          )}
        </CollapsibleSection>
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

  return (
    <section aria-label="Live position today" className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
        Live · <span className="tabular-nums">{snapshot.date}</span>
      </p>
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
          label="Stops today"
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

function Breakdown({
  title,
  entries,
  labels,
}: {
  title: string;
  entries: Record<string, number>;
  labels: Record<string, string>;
}): JSX.Element {
  const rows = Object.entries(entries);
  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] p-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">No activity.</p>
      ) : (
        <dl className="mt-2 space-y-1">
          {rows.map(([key, count]) => (
            <div key={key} className="flex items-baseline justify-between gap-2 text-xs">
              <dt className="min-w-0 truncate text-[var(--color-text-secondary)]">
                {labelFor(labels, key)}
              </dt>
              <dd className="shrink-0 font-semibold tabular-nums text-[var(--color-ink)]">
                {toCount(count)}
              </dd>
            </div>
          ))}
        </dl>
      )}
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
