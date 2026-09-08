import { useMemo, useState, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { IconCheck, IconChevronDown, IconChevronRight, IconLock } from '@tabler/icons-react';
import { readSession } from '../../../../auth/storage';
import { evaluateBatchCapacity, type TextileCollectionListItem } from '../../api/textileApi';
import { CapacityWarningBanner } from '../../components/CapacityWarningBanner';
import { SuggestedStopsHint } from '../../components/SuggestedStopsHint';
import { TextileFieldOfflineBanner } from '../../components/TextileFieldOfflineBanner';
import { OfflineBanner } from '../../offline/OfflineBanner';
import { useOpsQueue } from '../../offline/useOpsQueue';
import { useOfflineQueue } from './hooks/useOfflineQueue';
import {
  DeskPage,
  DeskStates,
  Pager,
  SearchBox,
  STATUS_LABELS,
  TripProgressBar,
  getTripProgress,
  isRescheduleFrozen,
  useDesk,
  useTextileQueue,
  ZoneFilter,
  CategoryFilter,
  formatVolume,
} from './shared';
import { formatTripDate, stopPageHref } from './stopWorkUtils';

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TRIP_STATUS_META: Record<string, { label: string; cls: string }> = {
  planned: {
    label: 'Planned',
    cls: 'border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)]',
  },
  scheduled: {
    label: 'Planned',
    cls: 'border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)]',
  },
  assigned: { label: 'Assigned', cls: 'border-sky-200 bg-sky-50 text-sky-800' },
  in_progress: { label: 'In progress', cls: 'border-sky-200 bg-sky-50 text-sky-800' },
  completed: { label: 'Completed', cls: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  cancelled: { label: 'Cancelled', cls: 'border-neutral-200 bg-neutral-100 text-neutral-600' },
};

function BatchCapacityNotice({
  batchId,
  departmentId,
  items,
}: {
  batchId: string;
  departmentId?: string;
  items: TextileCollectionListItem[];
}): JSX.Element | null {
  const evaluation = useQuery({
    queryKey: ['textile', 'batch-capacity', batchId, departmentId],
    queryFn: () => evaluateBatchCapacity(batchId, departmentId),
    enabled: !!departmentId && !!batchId && batchId !== 'unassigned',
    staleTime: 30_000,
    retry: false,
  });

  if (batchId === 'unassigned' || !departmentId) return null;

  const data = evaluation.data;
  const hasCapacityData = !!data && (data.blockers.length > 0 || data.warnings.length > 0);
  const showHint = !!data && data.suggested_order.length > 1 && items.length > 1;

  if (!hasCapacityData && !showHint && !evaluation.isLoading && !evaluation.isError) return null;

  return (
    <div className="space-y-1.5">
      {hasCapacityData ? (
        <CapacityWarningBanner
          evaluation={data ?? undefined}
          isLoading={evaluation.isLoading}
          isError={evaluation.isError}
          errorMessage={evaluation.error instanceof Error ? evaluation.error.message : undefined}
          onRetry={() => void evaluation.refetch()}
        />
      ) : null}
      {showHint && data ? (
        <SuggestedStopsHint
          suggestedOrder={data.suggested_order}
          currentOrder={items.map((it) => it.id)}
          items={items}
          note="Suggested stop order groups nearby addresses to shorten the route. Advisory only — confirm before driving."
        />
      ) : null}
    </div>
  );
}

function BoardFilters({
  dateFilter,
  zoneId,
  categoryId,
  onDateFilter,
  onZoneId,
  onCategoryId,
}: {
  dateFilter: string;
  zoneId: string;
  categoryId: string;
  onDateFilter: (next: string) => void;
  onZoneId: (next: string) => void;
  onCategoryId: (next: string) => void;
}): JSX.Element {
  return (
    <>
      <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
        Date
        <input
          type="date"
          value={dateFilter === 'all' ? '' : dateFilter}
          onChange={(e) => onDateFilter(e.target.value || 'all')}
          aria-label="Filter trips by date"
          className="h-9 rounded-lg border border-[var(--color-border)] bg-white px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
        />
      </label>
      {dateFilter !== 'all' ? (
        <button
          type="button"
          onClick={() => onDateFilter('all')}
          className="inline-flex h-9 items-center rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)]"
        >
          All dates
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onDateFilter(toISODate(new Date()))}
          className="inline-flex h-9 items-center rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)]"
        >
          Today
        </button>
      )}
      <ZoneFilter value={zoneId} onChange={onZoneId} />
      <CategoryFilter value={categoryId} onChange={onCategoryId} />
    </>
  );
}

export default function TextileDispatchPage(): JSX.Element {
  const desk = useDesk();
  const [search, setSearch] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState('all');
  const opsQueue = useOpsQueue();
  function handleDateFilter(next: string): void {
    setDateFilter(next);
    setPage(1);
  }
  function handleZoneId(next: string): void {
    setZoneId(next);
    setPage(1);
  }
  function handleCategoryId(next: string): void {
    setCategoryId(next);
    setPage(1);
  }

  const queue = useTextileQueue({
    status: 'scheduled',
    search,
    page,
    zoneId: zoneId || undefined,
    categoryId: categoryId || undefined,
    collectionMethod: 'premises',
    // Large page so trip groups never split across pages and counts stay whole.
    perPage: 200,
    autoRefresh: true,
    enabled: desk.ready && desk.isDrLinen,
    departmentId: desk.departmentId,
  });
  const rows = useMemo(() => queue.data?.data ?? [], [queue.data?.data]);
  const userId = readSession()?.user?.id;
  const offline = useOfflineQueue(userId, desk.departmentId);

  const trips = useMemo(() => {
    const map = new Map<
      string,
      { label: string; id: string; items: TextileCollectionListItem[]; ref: string; date: string }
    >();
    for (const row of rows) {
      // Date filter defaults to today: server has no trip-date param, so the
      // board loads the scheduled queue and scopes client-side. 'All dates'
      // clears it for audits.
      const tripDate = row.batch?.collection_date ?? '';
      if (dateFilter !== 'all' && tripDate !== dateFilter) continue;
      const key = row.batch?.id ?? 'unassigned';
      const entry = map.get(key) ?? {
        label: row.batch
          ? `${row.batch.reference} · ${row.batch.collection_date}`
          : 'Unassigned trip',
        id: row.batch?.id ?? key,
        items: [],
        ref: row.batch?.reference ?? 'Unassigned',
        date: row.batch?.collection_date ?? '',
      };
      entry.items.push(row);
      // keep first reference/date
      if (!entry.ref || entry.ref === 'Unassigned') {
        entry.ref = row.batch?.reference ?? entry.ref;
        entry.date = row.batch?.collection_date ?? entry.date;
      }
      map.set(key, entry);
    }
    return [...map.values()];
  }, [rows, dateFilter]);

  // Summary strip — derived metrics only
  const summary = useMemo(() => {
    if (trips.length === 0 || rows.length === 0) return null;
    let collected = 0;
    let missed = 0;
    for (const t of trips) {
      const p = t.items[0]?.batch?.progress ?? getTripProgress(t.items);
      collected += p.collected;
      missed += p.missed;
    }
    const total = rows.length;
    const remaining = Math.max(0, total - collected - missed);
    return { trips: trips.length, total, remaining, collected, missed };
  }, [trips, rows.length]);

  const [collapsedTrips, setCollapsedTrips] = useState<Record<string, boolean>>({});

  function toggleTrip(tripId: string) {
    setCollapsedTrips((prev) => ({
      ...prev,
      [tripId]: !prev[tripId],
    }));
  }

  const allTripsCollapsed = trips.length > 0 && trips.every((t) => !!collapsedTrips[t.id]);

  function toggleAllTrips() {
    if (allTripsCollapsed) {
      setCollapsedTrips({});
    } else {
      const next: Record<string, boolean> = {};
      for (const t of trips) {
        next[t.id] = true;
      }
      setCollapsedTrips(next);
    }
  }

  return (
    <DeskPage
      desk={desk}
      title="Dispatch Board"
      description="Today's trips, stops and outcomes."
      toolbar={
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-white px-2.5 py-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1">
            <SearchBox
              value={search}
              onChange={(n) => {
                setSearch(n);
                setPage(1);
              }}
            />
          </div>
          <div className="hidden flex-wrap items-center gap-2 sm:flex sm:shrink-0">
            <BoardFilters
              dateFilter={dateFilter}
              zoneId={zoneId}
              categoryId={categoryId}
              onDateFilter={handleDateFilter}
              onZoneId={handleZoneId}
              onCategoryId={handleCategoryId}
            />
          </div>
          <details className="sm:hidden">
            <summary className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-medium hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1">
              Filters
            </summary>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <BoardFilters
                dateFilter={dateFilter}
                zoneId={zoneId}
                categoryId={categoryId}
                onDateFilter={handleDateFilter}
                onZoneId={handleZoneId}
                onCategoryId={handleCategoryId}
              />
            </div>
          </details>
        </div>
      }
    >
      <OfflineBanner />
      <div className="space-y-2">
        <TextileFieldOfflineBanner />
        {opsQueue.pending.length > 0 ? (
          <p
            aria-label={`${opsQueue.pending.length} pending uploads`}
            className="rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs leading-4 text-sky-800"
          >
            {opsQueue.pending.length} pending upload{opsQueue.pending.length === 1 ? '' : 's'} —
            auto-retry.
          </p>
        ) : null}
      </div>

      {/* Summary — compact ledger strip */}
      {summary ? (
        <div
          aria-label="Dispatch summary"
          className="grid grid-cols-5 divide-x divide-[var(--color-border-subtle)] overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-white shadow-sm"
        >
          {[
            { label: 'Trips', value: summary.trips, cls: 'text-[var(--color-ink)]' },
            { label: 'Stops', value: summary.total, cls: 'text-[var(--color-ink)]' },
            { label: 'Left', value: summary.remaining, cls: 'text-amber-700' },
            { label: 'Collected', value: summary.collected, cls: 'text-[var(--color-success)]' },
            { label: 'Missed', value: summary.missed, cls: 'text-[var(--color-danger)]' },
          ].map((m) => (
            <div
              key={m.label}
              className="flex min-w-0 flex-col justify-center gap-0.5 px-2 py-2 sm:px-3"
            >
              <p className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
                {m.label}
              </p>
              <p
                className={`text-[16px] font-bold leading-none tracking-tight tabular-nums ${m.cls}`}
              >
                {m.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <DeskStates
        loading={queue.isLoading}
        error={queue.isError}
        onRetry={() => void queue.refetch()}
        hasRows={trips.length > 0}
        emptyTitle={dateFilter === 'all' ? 'No scheduled pickups' : `No trips on ${dateFilter}`}
        emptyBody="Schedule a trip and it will appear here."
      >
        <div className="space-y-3">
          {trips.length > 1 ? (
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                {trips.length} scheduled trip{trips.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={toggleAllTrips}
                className="text-[11px] font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-ink)]"
              >
                {allTripsCollapsed ? 'Expand all trips' : 'Collapse all trips'}
              </button>
            </div>
          ) : null}
          {trips.map((trip) => {
            const isTripCollapsed = !!collapsedTrips[trip.id];
            const batchStatus = trip.items[0]?.batch?.status ?? 'planned';
            const progress = trip.items[0]?.batch?.progress ?? getTripProgress(trip.items);
            const frozen = isRescheduleFrozen(batchStatus);
            const hasRescheduledStops = trip.items.some(
              (i) => !!i.reschedule_reason || !!i.previous_scheduled_date,
            );
            const hasUnavailableStops = trip.items.some((i) => !!i.unavailable_reason);
            const statusMeta = TRIP_STATUS_META[batchStatus] ?? {
              label: batchStatus.replaceAll('_', ' '),
              cls: 'border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)]',
            };
            const formattedDate = trip.date ? formatTripDate(trip.date) : '';
            const tripRef = trip.ref !== 'Unassigned' ? trip.ref : trip.label;
            const crew = [
              trip.items[0]?.batch?.driver_name,
              trip.items[0]?.batch?.team_name,
              trip.items[0]?.batch?.vehicle_label,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <section
                key={trip.id}
                className="overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-white shadow-sm"
              >
                {/* Trip header — ref first, then date/count; progress is the primary action anchor */}
                <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 sm:px-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <button
                      type="button"
                      onClick={() => toggleTrip(trip.id)}
                      aria-label={`${isTripCollapsed ? 'Expand' : 'Collapse'} trip ${tripRef}`}
                      aria-expanded={!isTripCollapsed}
                      className="inline-flex items-center gap-1 rounded p-0.5 text-left transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)]"
                    >
                      <IconChevronDown
                        className={`h-3.5 w-3.5 text-[var(--color-text-tertiary)] transition-transform duration-150 ${isTripCollapsed ? '-rotate-90' : ''}`}
                        aria-hidden="true"
                      />
                      <h2 className="font-mono text-[13px] font-bold tracking-tight text-[var(--color-ink)]">
                        {tripRef}
                      </h2>
                    </button>
                    {formattedDate ? (
                      <span className="text-[13px] leading-none text-[var(--color-text-secondary)]">
                        {formattedDate}
                      </span>
                    ) : null}
                    <span className="text-[12px] leading-none text-[var(--color-text-tertiary)]">
                      · {trip.items.length} stop{trip.items.length === 1 ? '' : 's'}
                    </span>
                    {frozen ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium leading-none text-amber-800">
                        <IconLock className="h-3.5 w-3.5" stroke={1.65} aria-hidden="true" /> Locked
                      </span>
                    ) : null}
                    <div className="ml-auto flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                      <div className="flex min-w-[140px] max-w-[220px] flex-1 items-center">
                        <TripProgressBar
                          batchStatus={batchStatus}
                          collected={progress.collected}
                          missed={progress.missed}
                          pending={progress.pending}
                          total={progress.total}
                        />
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none ${statusMeta.cls}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                  </div>

                  {/* crew — values only; field staff know the order */}
                  {crew ? (
                    <p className="mt-1.5 text-xs leading-4 text-[var(--color-text-secondary)]">
                      {crew}
                    </p>
                  ) : null}

                  {(hasRescheduledStops || hasUnavailableStops) && (
                    <p className="mt-1.5 text-[11px] leading-4 text-[var(--color-text-secondary)]">
                      {hasRescheduledStops ? 'Rescheduled: prior slot on stop page. ' : ''}
                      {hasUnavailableStops ? 'Unavailable reasons on stop page.' : ''}
                    </p>
                  )}

                  {/* capacity + route advisory — compact inside header */}
                  <div className="mt-1.5">
                    <BatchCapacityNotice
                      batchId={trip.id}
                      departmentId={desk.departmentId}
                      items={trip.items}
                    />
                  </div>
                </header>

                {/* Stops — navigation rows; tap opens the dedicated stop-work page */}
                {!isTripCollapsed ? (
                  <ul className="divide-y divide-[var(--color-border-subtle)]">
                    {trip.items.map((item, idx) => {
                      const queued = offline.items.find(
                        (q) => q.collectionId === item.id && q.status !== 'completed',
                      );
                      const isNext = idx === 0 && item.status === 'scheduled';
                      const isCollected = item.status === 'picked_up';
                      const isMissed = item.status === 'missed';
                      const statusDotCls = isCollected
                        ? 'bg-[var(--color-success)]'
                        : isMissed
                          ? 'bg-[var(--color-danger)]'
                          : queued
                            ? queued.status === 'failed'
                              ? 'bg-[var(--color-danger)]'
                              : 'bg-amber-500'
                            : isNext
                              ? 'bg-amber-500'
                              : 'bg-neutral-300';
                      const statusLabel = isCollected
                        ? 'Collected'
                        : isMissed
                          ? 'Missed'
                          : queued
                            ? queued.status === 'failed'
                              ? 'Upload failed'
                              : 'Pending upload'
                            : (STATUS_LABELS[item.status] ?? item.status);
                      return (
                        <li key={item.id} className={isNext ? 'bg-amber-50/50' : 'bg-white'}>
                          {/* One-line stop row: number dot, name, truncated address, estimate chip, status dot */}
                          <Link
                            to={stopPageHref(trip.id, item.id)}
                            aria-label={`Stop ${idx + 1}: ${item.requester_name}, ${item.pickup_address}`}
                            className="flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ink)] sm:px-4"
                          >
                            <span
                              aria-hidden="true"
                              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold leading-none ${
                                isNext
                                  ? 'bg-amber-500 text-white'
                                  : isCollected
                                    ? 'bg-[var(--color-success)] text-white'
                                    : isMissed
                                      ? 'border border-rose-400 bg-white text-[var(--color-danger)]'
                                      : 'border border-[var(--color-border-strong)] bg-white text-[var(--color-text-secondary)]'
                              }`}
                            >
                              {isCollected ? (
                                <IconCheck className="h-3 w-3" stroke={3} aria-hidden="true" />
                              ) : (
                                idx + 1
                              )}
                            </span>
                            <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                              <span className="max-w-[42%] shrink-0 truncate text-[14px] font-semibold tracking-tight text-[var(--color-ink)]">
                                {item.requester_name}
                              </span>
                              <span
                                className="min-w-0 flex-1 truncate text-xs leading-4 text-[var(--color-text-secondary)]"
                                title={item.pickup_address}
                              >
                                {item.pickup_address}
                              </span>
                            </span>
                            <span className="inline-flex shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2 py-0.5 text-[11px] font-semibold leading-4 text-[var(--color-ink)]">
                              {formatVolume(item.estimated_bags, item.estimated_weight_kg)}
                            </span>
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${statusDotCls}`}
                              title={statusLabel}
                              aria-hidden="true"
                            />
                            <span className="sr-only">{statusLabel}</span>
                            <IconChevronRight
                              className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]"
                              stroke={2}
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      </DeskStates>
      <Pager meta={queue.data?.meta} onPage={setPage} />
    </DeskPage>
  );
}
