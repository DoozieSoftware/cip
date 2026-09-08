import { useMemo, useState, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  LayoutList,
  Lock,
  MapPin,
  Maximize2,
  Package,
  Printer,
  Scale,
  Truck,
  User,
  Users,
  X,
} from 'lucide-react';
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

const TRIP_STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  planned: {
    label: 'Planned',
    cls: 'border-[var(--color-border-subtle)] bg-zinc-50 text-zinc-700',
    dot: 'bg-zinc-400',
  },
  scheduled: {
    label: 'Planned',
    cls: 'border-[var(--color-border-subtle)] bg-zinc-50 text-zinc-700',
    dot: 'bg-zinc-400',
  },
  assigned: {
    label: 'Assigned',
    cls: 'border-sky-200 bg-sky-50 text-sky-800',
    dot: 'bg-sky-500',
  },
  in_progress: {
    label: 'In progress',
    cls: 'border-sky-200 bg-sky-50 text-sky-800',
    dot: 'bg-sky-500 animate-pulse',
  },
  completed: {
    label: 'Completed',
    cls: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    dot: 'bg-emerald-600',
  },
  cancelled: {
    label: 'Cancelled',
    cls: 'border-neutral-200 bg-neutral-100 text-neutral-600',
    dot: 'bg-neutral-400',
  },
};

interface TripEntry {
  label: string;
  id: string;
  items: TextileCollectionListItem[];
  ref: string;
  date: string;
}

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
  const today = toISODate(new Date());
  const tomorrow = toISODate(new Date(Date.now() + 86400000));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Quick date pills */}
      <div className="flex items-center rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] p-0.5">
        <button
          type="button"
          onClick={() => onDateFilter(today)}
          className={`h-7 rounded-md px-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)] ${
            dateFilter === today
              ? 'bg-white font-semibold text-[var(--color-ink)] shadow-xs'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-ink)]'
          }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => onDateFilter(tomorrow)}
          className={`h-7 rounded-md px-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)] ${
            dateFilter === tomorrow
              ? 'bg-white font-semibold text-[var(--color-ink)] shadow-xs'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-ink)]'
          }`}
        >
          Tomorrow
        </button>
        <button
          type="button"
          onClick={() => onDateFilter('all')}
          className={`h-7 rounded-md px-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)] ${
            dateFilter === 'all'
              ? 'bg-white font-semibold text-[var(--color-ink)] shadow-xs'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-ink)]'
          }`}
        >
          All dates
        </button>
      </div>

      <label className="inline-flex items-center">
        <input
          type="date"
          value={dateFilter === 'all' ? '' : dateFilter}
          onChange={(e) => onDateFilter(e.target.value || 'all')}
          aria-label="Filter trips by date"
          className="h-8 rounded-lg border border-[var(--color-border-subtle)] bg-white px-2.5 text-xs text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
        />
      </label>

      <ZoneFilter value={zoneId} onChange={onZoneId} />
      <CategoryFilter value={categoryId} onChange={onCategoryId} />
    </div>
  );
}

function TripSheetModal({ trip, onClose }: { trip: TripEntry; onClose: () => void }): JSX.Element {
  const driver = trip.items[0]?.batch?.driver_name;
  const vehicle = trip.items[0]?.batch?.vehicle_label;
  const team = trip.items[0]?.batch?.team_name;
  const progress = trip.items[0]?.batch?.progress ?? getTripProgress(trip.items);
  const formattedDate = trip.date ? formatTripDate(trip.date) : 'Unscheduled';

  const totalBags = trip.items.reduce(
    (acc, it) => acc + (it.actual_bags ?? it.estimated_bags ?? 0),
    0,
  );
  const totalWeight = trip.items.reduce(
    (acc, it) => acc + (it.actual_weight_kg ?? it.estimated_weight_kg ?? 0),
    0,
  );

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Trip sheet manifest for ${trip.ref}`}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-2xl focus:outline-none print:fixed print:inset-0 print:max-h-none print:w-screen print:border-none print:shadow-none"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-ink)] text-white shadow-xs">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-base font-bold text-[var(--color-ink)]">
                  {trip.ref}
                </h3>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  {trip.items.length} Stops Manifest
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Dr. Linen Route Manifest · Scheduled: {formattedDate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] shadow-xs transition hover:bg-[var(--color-surface-alt)]"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Route Sheet
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close manifest"
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-ink)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Subheader Details */}
        <div className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)]/50 px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4 text-[var(--color-text-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                <strong className="text-[var(--color-ink)]">{driver ?? 'Unassigned Driver'}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                <strong className="text-[var(--color-ink)]">
                  {vehicle ?? 'Unassigned Vehicle'}
                </strong>
              </span>
              {team ? (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                  <span>{team}</span>
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-subtle)] bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-ink)]">
                <Scale className="h-3 w-3 text-[var(--color-text-tertiary)]" />
                Est. Load: {totalBags} bags · {Math.round(totalWeight * 10) / 10} kg
              </span>
            </div>
            <div className="w-full sm:w-64 print:hidden">
              <TripProgressBar
                batchStatus={trip.items[0]?.batch?.status ?? 'planned'}
                collected={progress.collected}
                missed={progress.missed}
                pending={progress.pending}
                total={progress.total}
              />
            </div>
          </div>
        </div>

        {/* Full Stops List (all 8-15+ stops) */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Complete Route Itinerary ({trip.items.length} stops in sequence)
              </h4>
              <span className="text-[11px] text-[var(--color-text-tertiary)] print:hidden">
                Click stop to open execution detail
              </span>
            </div>
            <div className="divide-y divide-[var(--color-border-subtle)] overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-white shadow-xs">
              {trip.items.map((item, idx) => {
                const isCollected = item.status === 'picked_up';
                const isMissed = item.status === 'missed';
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 p-4 transition-colors hover:bg-[var(--color-surface-alt)]/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold shadow-xs ${
                          isCollected
                            ? 'bg-[var(--color-success)] text-white'
                            : isMissed
                              ? 'bg-rose-100 text-[var(--color-danger)]'
                              : 'bg-zinc-100 text-zinc-800'
                        }`}
                      >
                        {isCollected ? <Check className="h-4 w-4" strokeWidth={3} /> : idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--color-ink)]">
                            {item.requester_name}
                          </span>
                          <span className="font-mono text-[11px] text-[var(--color-text-tertiary)]">
                            · {item.reference}
                          </span>
                          {item.contact_phone ? (
                            <span className="font-mono text-[11px] text-sky-800">
                              {item.contact_phone}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                          {item.pickup_address}
                        </p>
                        {item.readiness_instructions ? (
                          <p className="mt-1 inline-block rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900">
                            Instructions: {item.readiness_instructions}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-center print:hidden">
                      <span className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--color-ink)]">
                        <Package className="h-3 w-3 text-[var(--color-text-tertiary)]" />
                        {formatVolume(item.estimated_bags, item.estimated_weight_kg)}
                      </span>
                      <Link
                        to={stopPageHref(trip.id, item.id)}
                        aria-label={`Open stop ${idx + 1}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--color-ink)] shadow-xs transition hover:bg-[var(--color-surface-alt)]"
                      >
                        <span>Open Stop</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-6 py-3 print:hidden">
          <span className="text-xs text-[var(--color-text-secondary)]">
            Total {trip.items.length} stop{trip.items.length === 1 ? '' : 's'} assigned to route
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[var(--color-ink)] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TextileDispatchPage(): JSX.Element {
  const desk = useDesk();
  const [search, setSearch] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'timeline' | 'matrix'>('timeline');
  const [selectedTripSheet, setSelectedTripSheet] = useState<TripEntry | null>(null);
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
    perPage: 200,
    autoRefresh: true,
    enabled: desk.ready && desk.isDrLinen,
    departmentId: desk.departmentId,
  });

  const rows = useMemo(() => queue.data?.data ?? [], [queue.data?.data]);
  const userId = readSession()?.user?.id;
  const offline = useOfflineQueue(userId, desk.departmentId);

  const trips = useMemo(() => {
    const map = new Map<string, TripEntry>();
    for (const row of rows) {
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
      if (!entry.ref || entry.ref === 'Unassigned') {
        entry.ref = row.batch?.reference ?? entry.ref;
        entry.date = row.batch?.collection_date ?? entry.date;
      }
      map.set(key, entry);
    }
    return [...map.values()];
  }, [rows, dateFilter]);

  const summary = useMemo(() => {
    if (trips.length === 0 || rows.length === 0) return null;
    let collected = 0;
    let missed = 0;
    let totalBags = 0;
    let totalWeight = 0;

    for (const t of trips) {
      const p = t.items[0]?.batch?.progress ?? getTripProgress(t.items);
      collected += p.collected;
      missed += p.missed;
      for (const item of t.items) {
        totalBags += item.actual_bags ?? item.estimated_bags ?? 0;
        totalWeight += item.actual_weight_kg ?? item.estimated_weight_kg ?? 0;
      }
    }
    const total = rows.length;
    const remaining = Math.max(0, total - collected - missed);
    return {
      trips: trips.length,
      total,
      remaining,
      collected,
      missed,
      totalBags,
      totalWeight: Math.round(totalWeight * 10) / 10,
    };
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
      description="Fleet dispatch, active route execution, and stop progress."
      toolbar={
        <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--color-border-subtle)] bg-white p-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1">
            <SearchBox
              value={search}
              onChange={(n) => {
                setSearch(n);
                setPage(1);
              }}
            />
          </div>

          {/* View mode toggle */}
          <div className="inline-flex items-center rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                viewMode === 'timeline'
                  ? 'bg-white font-semibold text-[var(--color-ink)] shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-ink)]'
              }`}
              title="Timeline View"
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Timeline</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                viewMode === 'matrix'
                  ? 'bg-white font-semibold text-[var(--color-ink)] shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-ink)]'
              }`}
              title="Fleet Matrix View"
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Matrix</span>
            </button>
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
            <summary className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-[var(--color-border-subtle)] bg-white px-3 text-xs font-medium hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]">
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
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium leading-4 text-sky-800"
          >
            {opsQueue.pending.length} pending upload{opsQueue.pending.length === 1 ? '' : 's'} —
            auto-retry.
          </p>
        ) : null}
      </div>

      {/* Fleet Command KPI Strip */}
      {summary ? (
        <div aria-label="Dispatch summary" className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6 sm:gap-3">
            {/* Trips / Routes */}
            <div className="flex flex-col justify-between rounded-xl border border-[var(--color-border-subtle)] bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between text-[var(--color-text-secondary)]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Routes
                </span>
                <Truck className="h-4 w-4 text-[var(--color-text-tertiary)]" strokeWidth={1.75} />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
                {summary.trips}
              </p>
              <span className="text-[11px] text-[var(--color-text-tertiary)]">
                active delivery vans
              </span>
            </div>

            {/* Total Stops */}
            <div className="flex flex-col justify-between rounded-xl border border-[var(--color-border-subtle)] bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between text-[var(--color-text-secondary)]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Stops
                </span>
                <MapPin className="h-4 w-4 text-[var(--color-text-tertiary)]" strokeWidth={1.75} />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
                {summary.total}
              </p>
              <span className="text-[11px] text-[var(--color-text-tertiary)]">
                total route stops
              </span>
            </div>

            {/* Recovery Load */}
            <div className="flex flex-col justify-between rounded-xl border border-[var(--color-border-subtle)] bg-white p-3 shadow-xs">
              <div className="flex items-center justify-between text-[var(--color-text-secondary)]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Volume Load
                </span>
                <Scale className="h-4 w-4 text-[var(--color-text-tertiary)]" strokeWidth={1.75} />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
                {summary.totalWeight}{' '}
                <span className="text-xs font-normal text-[var(--color-text-secondary)]">kg</span>
              </p>
              <span className="text-[11px] text-[var(--color-text-tertiary)]">
                {summary.totalBags} bags est.
              </span>
            </div>

            {/* Remaining / Left */}
            <div className="flex flex-col justify-between rounded-xl border border-amber-200/70 bg-amber-50/40 p-3 shadow-xs">
              <div className="flex items-center justify-between text-amber-900">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                  Remaining
                </span>
                <Clock className="h-4 w-4 text-amber-700" strokeWidth={1.75} />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-amber-900 tabular-nums">
                {summary.remaining}
              </p>
              <span className="text-[11px] text-amber-700/80">pending completion</span>
            </div>

            {/* Collected */}
            <div className="flex flex-col justify-between rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-3 shadow-xs">
              <div className="flex items-center justify-between text-emerald-800">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                  Collected
                </span>
                <Check className="h-4 w-4 text-emerald-600" strokeWidth={2.2} />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-success)] tabular-nums">
                {summary.collected}
              </p>
              <span className="text-[11px] text-emerald-700/80">completed pickups</span>
            </div>

            {/* Missed */}
            <div className="flex flex-col justify-between rounded-xl border border-rose-200/70 bg-rose-50/40 p-3 shadow-xs">
              <div className="flex items-center justify-between text-rose-800">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">
                  Missed
                </span>
                <AlertCircle className="h-4 w-4 text-rose-600" strokeWidth={1.75} />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-danger)] tabular-nums">
                {summary.missed}
              </p>
              <span className="text-[11px] text-rose-700/80">exceptions logged</span>
            </div>
          </div>

          {/* Fleet Progress Bar */}
          <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border-subtle)] bg-white px-3.5 py-2 shadow-xs">
            <span className="shrink-0 text-xs font-semibold text-[var(--color-text-secondary)]">
              Fleet Progress
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-alt)]">
              <div
                className="h-full rounded-full bg-[var(--color-success)] transition-all"
                style={{
                  width: `${summary.total > 0 ? Math.round((summary.collected / summary.total) * 100) : 0}%`,
                }}
              />
            </div>
            <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-[var(--color-ink)]">
              {summary.total > 0 ? Math.round((summary.collected / summary.total) * 100) : 0}% (
              {summary.collected}/{summary.total})
            </span>
          </div>
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
        <div className="space-y-4">
          {trips.length > 1 ? (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                {trips.length} scheduled route{trips.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={toggleAllTrips}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-ink)]"
              >
                {allTripsCollapsed ? 'Expand all trips' : 'Collapse all trips'}
              </button>
            </div>
          ) : null}

          {/* MATRIX VIEW */}
          {viewMode === 'matrix' ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border-subtle)] bg-white shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  <tr>
                    <th className="px-4 py-3">Route Reference</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Driver / Vehicle</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3">Next Stop</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]/60">
                  {trips.map((trip) => {
                    const batchStatus = trip.items[0]?.batch?.status ?? 'planned';
                    const progress = trip.items[0]?.batch?.progress ?? getTripProgress(trip.items);
                    const statusMeta = TRIP_STATUS_META[batchStatus] ?? {
                      label: batchStatus.replaceAll('_', ' '),
                      cls: 'border-[var(--color-border-subtle)] bg-zinc-50 text-zinc-700',
                      dot: 'bg-zinc-400',
                    };
                    const formattedDate = trip.date ? formatTripDate(trip.date) : 'Unscheduled';
                    const tripRef = trip.ref !== 'Unassigned' ? trip.ref : trip.label;
                    const driver = trip.items[0]?.batch?.driver_name;
                    const vehicle = trip.items[0]?.batch?.vehicle_label;
                    const nextPending = trip.items.find((i) => i.status === 'scheduled');

                    return (
                      <tr
                        key={trip.id}
                        className="transition-colors hover:bg-[var(--color-surface-alt)]/40"
                      >
                        <td className="px-4 py-3 font-mono font-bold text-[var(--color-ink)]">
                          {tripRef}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                          {formattedDate}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusMeta.cls}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`}
                              aria-hidden="true"
                            />
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-[var(--color-ink)]">
                              {driver ?? 'Unassigned'}
                            </span>
                            {vehicle ? (
                              <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
                                {vehicle}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-36">
                            <TripProgressBar
                              batchStatus={batchStatus}
                              collected={progress.collected}
                              missed={progress.missed}
                              pending={progress.pending}
                              total={progress.total}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {nextPending ? (
                            <span className="truncate max-w-[180px] inline-block font-medium text-[var(--color-ink)]">
                              {nextPending.requester_name}
                            </span>
                          ) : (
                            <span className="text-[var(--color-text-tertiary)]">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedTripSheet(trip)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-ink)] shadow-xs transition hover:bg-[var(--color-surface-alt)]"
                          >
                            <span>Trip Sheet ({trip.items.length})</span>
                            <Maximize2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* TIMELINE VIEW */
            trips.map((trip) => {
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
                cls: 'border-[var(--color-border-subtle)] bg-zinc-50 text-zinc-700',
                dot: 'bg-zinc-400',
              };
              const formattedDate = trip.date ? formatTripDate(trip.date) : '';
              const tripRef = trip.ref !== 'Unassigned' ? trip.ref : trip.label;
              const driver = trip.items[0]?.batch?.driver_name;
              const team = trip.items[0]?.batch?.team_name;
              const vehicle = trip.items[0]?.batch?.vehicle_label;

              // Find active next stop
              const activeNextStopIdx = trip.items.findIndex((i) => i.status === 'scheduled');
              const activeNextStop = activeNextStopIdx >= 0 ? trip.items[activeNextStopIdx] : null;

              return (
                <section
                  key={trip.id}
                  className="overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-white shadow-xs transition-all hover:border-[var(--color-border)] hover:shadow-sm"
                >
                  {/* Trip Card Header */}
                  <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-3.5 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <button
                          type="button"
                          onClick={() => toggleTrip(trip.id)}
                          aria-label={`${isTripCollapsed ? 'Expand' : 'Collapse'} trip ${tripRef}`}
                          aria-expanded={!isTripCollapsed}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform duration-150 ${isTripCollapsed ? '-rotate-90' : ''}`}
                            aria-hidden="true"
                          />
                        </button>

                        <h2 className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--color-ink)]">
                          {tripRef}
                        </h2>

                        {formattedDate ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)]">
                            <Calendar className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                            {formattedDate}
                          </span>
                        ) : null}

                        <span className="rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-text-secondary)]">
                          {trip.items.length} stop{trip.items.length === 1 ? '' : 's'}
                        </span>

                        {frozen ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                            <Lock
                              className="h-3.5 w-3.5 text-amber-700"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            Locked
                          </span>
                        ) : null}

                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusMeta.cls}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`}
                            aria-hidden="true"
                          />
                          {statusMeta.label}
                        </span>

                        {driver ? (
                          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                            <User className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                            <span className="font-semibold text-[var(--color-ink)]">{driver}</span>
                          </span>
                        ) : null}

                        {vehicle ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--color-text-tertiary)]">
                            <Truck className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                            {vehicle}
                          </span>
                        ) : null}

                        {team ? (
                          <span className="hidden items-center gap-1 text-xs text-[var(--color-text-tertiary)] sm:inline-flex">
                            <Users className="h-3.5 w-3.5" />
                            {team}
                          </span>
                        ) : null}
                      </div>

                      {/* Right actions: Trip Sheet Modal Trigger */}
                      <button
                        type="button"
                        onClick={() => setSelectedTripSheet(trip)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-ink)] shadow-xs transition hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
                      >
                        <Maximize2 className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
                        <span>Trip Sheet ({trip.items.length})</span>
                      </button>
                    </div>

                    <div className="mt-3">
                      <TripProgressBar
                        batchStatus={batchStatus}
                        collected={progress.collected}
                        missed={progress.missed}
                        pending={progress.pending}
                        total={progress.total}
                      />
                    </div>

                    {(frozen || hasRescheduledStops || hasUnavailableStops) && (
                      <p className="mt-2 text-[11px] text-amber-800/90">
                        {frozen ? 'Trip is locked — rescheduling disabled. ' : ''}
                        {hasRescheduledStops
                          ? 'Rescheduled stops present — prior slot on stop page. '
                          : ''}
                        {hasUnavailableStops ? 'Unavailable reasons detailed on stop page.' : ''}
                      </p>
                    )}

                    <div className="mt-2">
                      <BatchCapacityNotice
                        batchId={trip.id}
                        departmentId={desk.departmentId}
                        items={trip.items}
                      />
                    </div>
                  </header>

                  {/* Stop Itinerary Route Timeline */}
                  {!isTripCollapsed ? (
                    <div>
                      {/* Active Next Stop Hero Callout */}
                      {activeNextStop ? (
                        <div className="flex items-center justify-between border-b border-amber-200/80 bg-amber-50/70 px-3.5 py-2 sm:px-4">
                          <div className="flex min-w-0 items-center gap-2 text-xs">
                            <span className="shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                              Next Stop #{activeNextStopIdx + 1}
                            </span>
                            <span className="truncate font-semibold text-amber-950">
                              {activeNextStop.requester_name}
                            </span>
                            <span className="shrink-0 font-mono text-[11px] text-amber-800/80">
                              ({activeNextStop.reference})
                            </span>
                          </div>
                          <Link
                            to={stopPageHref(trip.id, activeNextStop.id)}
                            aria-label="Execute next stop"
                            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-700"
                          >
                            Execute stop &rarr;
                          </Link>
                        </div>
                      ) : null}

                      {/* Capped scrollable stops container: handles 8 to 15+ stops smoothly */}
                      <div className="relative max-h-80 overflow-y-auto">
                        {/* Visual route connector line connecting all stops */}
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute bottom-4 left-[27px] top-4 w-0.5 bg-[var(--color-border-subtle)] sm:left-[31px]"
                        />

                        <ul className="divide-y divide-[var(--color-border-subtle)]/60">
                          {trip.items.map((item, idx) => {
                            const queued = offline.items.find(
                              (q) => q.collectionId === item.id && q.status !== 'completed',
                            );
                            const isNext = idx === activeNextStopIdx;
                            const isCollected = item.status === 'picked_up';
                            const isMissed = item.status === 'missed';
                            const statusLabel = isCollected
                              ? 'Collected'
                              : isMissed
                                ? 'Missed'
                                : queued
                                  ? queued.status === 'failed'
                                    ? 'Upload failed'
                                    : 'Pending upload'
                                  : (STATUS_LABELS[item.status] ?? item.status);

                            const statusBadgeCls = isCollected
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isMissed
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : queued
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : isNext
                                    ? 'bg-amber-50 text-amber-900 border-amber-300 font-semibold'
                                    : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]';

                            return (
                              <li
                                key={item.id}
                                className={`group relative transition-colors ${isNext ? 'bg-amber-50/30' : 'bg-white hover:bg-[var(--color-surface-alt)]/50'}`}
                              >
                                <Link
                                  to={stopPageHref(trip.id, item.id)}
                                  aria-label={`Stop ${idx + 1}: ${item.requester_name}, ${item.pickup_address}`}
                                  className="flex min-h-[48px] w-full items-center gap-3 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ink)] sm:gap-4 sm:px-4"
                                >
                                  {/* Step Node along the Timeline */}
                                  <span
                                    aria-hidden="true"
                                    className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold leading-none shadow-xs ring-4 ring-white ${
                                      isCollected
                                        ? 'bg-[var(--color-success)] text-white'
                                        : isMissed
                                          ? 'border-2 border-rose-400 bg-white text-[var(--color-danger)]'
                                          : isNext
                                            ? 'animate-pulse bg-amber-500 text-white'
                                            : 'border-2 border-[var(--color-border-strong)] bg-white text-[var(--color-ink)]'
                                    }`}
                                  >
                                    {isCollected ? (
                                      <Check
                                        className="h-3.5 w-3.5"
                                        strokeWidth={3}
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      idx + 1
                                    )}
                                  </span>

                                  {/* Stop Itinerary Content */}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="truncate text-xs font-semibold text-[var(--color-ink)] group-hover:text-black">
                                        {item.requester_name}
                                      </span>
                                      <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
                                        · {item.reference}
                                      </span>
                                      {item.service_zone?.name ? (
                                        <span className="rounded bg-[var(--color-surface-alt)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-secondary)]">
                                          {item.service_zone.name}
                                        </span>
                                      ) : null}
                                    </div>

                                    <div className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
                                      <span className="truncate" title={item.pickup_address}>
                                        {item.pickup_address}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Volume badge */}
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--color-ink)]">
                                    <Package className="h-3 w-3 text-[var(--color-text-tertiary)]" />
                                    {formatVolume(item.estimated_bags, item.estimated_weight_kg)}
                                  </span>

                                  {/* Status Badge */}
                                  <span
                                    className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none ${statusBadgeCls}`}
                                  >
                                    {statusLabel}
                                  </span>

                                  {/* Navigation Chevron */}
                                  <ChevronRight
                                    className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-ink)]"
                                    strokeWidth={2}
                                    aria-hidden="true"
                                  />
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      {/* Footer hint if trip has multiple stops */}
                      {trip.items.length > 3 ? (
                        <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)]/50 px-4 py-2 text-xs text-[var(--color-text-secondary)]">
                          <span>
                            Showing itinerary ({trip.items.length} stop
                            {trip.items.length === 1 ? '' : 's'})
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedTripSheet(trip)}
                            className="inline-flex items-center gap-1 font-semibold text-[var(--color-ink)] hover:underline"
                          >
                            Open Full Trip Sheet ({trip.items.length}) &rarr;
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              );
            })
          )}
        </div>
      </DeskStates>

      {/* TRIP SHEET MANIFEST MODAL */}
      {selectedTripSheet ? (
        <TripSheetModal trip={selectedTripSheet} onClose={() => setSelectedTripSheet(null)} />
      ) : null}

      <Pager meta={queue.data?.meta} onPage={setPage} />
    </DeskPage>
  );
}
