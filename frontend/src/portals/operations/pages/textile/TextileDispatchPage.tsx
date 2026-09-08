import { useMemo, useState, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Check,
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
  Search,
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
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'routes' | 'console'>('routes');
  const [routeQuery, setRouteQuery] = useState('');
  const [routeStatusTab, setRouteStatusTab] = useState<
    'all' | 'planned' | 'in_progress' | 'completed'
  >('all');
  const [rosterDensity, setRosterDensity] = useState<'cards' | 'compact'>('cards');
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

  // Filtered trips for route roster
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      if (routeStatusTab !== 'all') {
        const batchStatus = trip.items[0]?.batch?.status ?? 'planned';
        if (routeStatusTab === 'in_progress' && batchStatus !== 'in_progress') return false;
        if (
          routeStatusTab === 'planned' &&
          batchStatus !== 'planned' &&
          batchStatus !== 'scheduled'
        )
          return false;
        if (routeStatusTab === 'completed' && batchStatus !== 'completed') return false;
      }
      if (routeQuery.trim()) {
        const q = routeQuery.toLowerCase();
        const tripRef = (trip.ref !== 'Unassigned' ? trip.ref : trip.label).toLowerCase();
        const driver = (trip.items[0]?.batch?.driver_name ?? '').toLowerCase();
        const vehicle = (trip.items[0]?.batch?.vehicle_label ?? '').toLowerCase();
        const matchStop = trip.items.some(
          (i) =>
            i.requester_name.toLowerCase().includes(q) ||
            i.reference.toLowerCase().includes(q) ||
            i.pickup_address.toLowerCase().includes(q),
        );
        if (!tripRef.includes(q) && !driver.includes(q) && !vehicle.includes(q) && !matchStop) {
          return false;
        }
      }
      return true;
    });
  }, [trips, routeStatusTab, routeQuery]);

  // Active selected trip for command console
  const activeTrip = useMemo(() => {
    if (trips.length === 0) return null;
    const found =
      filteredTrips.find((t) => t.id === selectedTripId) ??
      trips.find((t) => t.id === selectedTripId);
    return found ?? filteredTrips[0] ?? trips[0];
  }, [trips, filteredTrips, selectedTripId]);

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

      {/* Clean 4-Stat Metric Summary */}
      {summary ? (
        <div aria-label="Dispatch summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Active Vans */}
          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span className="font-medium">Active Vans</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
                Online
              </span>
            </div>
            <p className="mt-1 font-mono text-2xl font-bold text-[var(--color-ink)] tabular-nums">
              {summary.trips}
            </p>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
              Active fleet deployment
            </p>
          </div>

          {/* Route Progress */}
          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span className="font-medium">Route Progress</span>
              <span className="font-mono font-semibold text-[var(--color-ink)]">
                {summary.total > 0 ? Math.round((summary.collected / summary.total) * 100) : 0}%
              </span>
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-alt)]">
              <div
                className="h-full rounded-full bg-[var(--color-ink)] transition-all duration-500"
                style={{
                  width: `${summary.total > 0 ? Math.round((summary.collected / summary.total) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
              {summary.collected} of {summary.total} completed
            </p>
          </div>

          {/* Recovery Cargo */}
          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span className="font-medium">Recovery Cargo</span>
              <Scale className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
            </div>
            <p className="mt-1 font-mono text-2xl font-bold text-[var(--color-ink)] tabular-nums">
              {summary.totalWeight}{' '}
              <span className="text-xs font-normal text-[var(--color-text-secondary)]">kg</span>
            </p>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
              Est. {summary.totalBags} collection bags
            </p>
          </div>

          {/* Remaining Stops */}
          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span className="font-medium">Remaining Stops</span>
              <Clock className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
            </div>
            <p className="mt-1 font-mono text-2xl font-bold text-[var(--color-ink)] tabular-nums">
              {summary.remaining}
            </p>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
              Pending completion
            </p>
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
          {/* MATRIX VIEW */}
          {viewMode === 'matrix' ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
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
                <tbody className="divide-y divide-slate-100">
                  {trips.map((trip) => {
                    const batchStatus = trip.items[0]?.batch?.status ?? 'planned';
                    const progress = trip.items[0]?.batch?.progress ?? getTripProgress(trip.items);
                    const statusMeta = TRIP_STATUS_META[batchStatus] ?? {
                      label: batchStatus.replaceAll('_', ' '),
                      cls: 'border-slate-200 bg-slate-50 text-slate-700',
                      dot: 'bg-slate-400',
                    };
                    const formattedDate = trip.date ? formatTripDate(trip.date) : 'Unscheduled';
                    const tripRef = trip.ref !== 'Unassigned' ? trip.ref : trip.label;
                    const driver = trip.items[0]?.batch?.driver_name;
                    const vehicle = trip.items[0]?.batch?.vehicle_label;
                    const nextPending = trip.items.find((i) => i.status === 'scheduled');

                    return (
                      <tr key={trip.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{tripRef}</td>
                        <td className="px-4 py-3 text-slate-600">{formattedDate}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusMeta.cls}`}
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
                            <span className="font-semibold text-slate-900">
                              {driver ?? 'Unassigned'}
                            </span>
                            {vehicle ? (
                              <span className="font-mono text-[10px] text-slate-500">
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
                            <span className="truncate max-w-[180px] inline-block font-medium text-slate-800">
                              {nextPending.requester_name}
                            </span>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedTripSheet(trip)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-xs transition hover:bg-slate-50"
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
            /* STITCH MASTER-DETAIL FLEET DISPATCH CONSOLE */
            <div>
              {/* Mobile View Switcher (Tabs) */}
              {trips.length > 1 ? (
                <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-2.5 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileTab('routes')}
                    className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition ${
                      mobileTab === 'routes'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Routes ({trips.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileTab('console')}
                    className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition ${
                      mobileTab === 'console'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Route Console
                  </button>
                </div>
              ) : null}

              {/* Grid Layout */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
                {/* LEFT COLUMN: Fleet Route Cards Selector (lg:col-span-5) */}
                {trips.length > 1 ? (
                  <div
                    className={`space-y-2.5 lg:col-span-5 ${
                      mobileTab === 'routes' ? 'block' : 'hidden lg:block'
                    }`}
                  >
                    {/* Header bar with count and density toggle */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-semibold text-[var(--color-ink)]">Routes</h3>
                        <span className="rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 font-mono text-[11px] font-medium text-[var(--color-text-secondary)]">
                          {filteredTrips.length === trips.length
                            ? trips.length
                            : `${filteredTrips.length} of ${trips.length}`}
                        </span>
                      </div>
                      <div className="inline-flex items-center rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] p-0.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setRosterDensity('cards')}
                          className={`rounded px-2 py-0.5 transition ${
                            rosterDensity === 'cards'
                              ? 'bg-white font-semibold text-[var(--color-ink)] shadow-2xs'
                              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-ink)]'
                          }`}
                        >
                          Cards
                        </button>
                        <button
                          type="button"
                          onClick={() => setRosterDensity('compact')}
                          className={`rounded px-2 py-0.5 transition ${
                            rosterDensity === 'compact'
                              ? 'bg-white font-semibold text-[var(--color-ink)] shadow-2xs'
                              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-ink)]'
                          }`}
                        >
                          Compact
                        </button>
                      </div>
                    </div>

                    {/* In-Roster Fast Search and Status Filter */}
                    <div className="space-y-2 rounded-xl border border-[var(--color-border-subtle)] bg-white p-2.5 shadow-2xs">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
                        <input
                          type="text"
                          value={routeQuery}
                          onChange={(e) => setRouteQuery(e.target.value)}
                          placeholder="Filter routes, driver, stop..."
                          className="w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] py-1.5 pl-8 pr-7 text-xs text-[var(--color-ink)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-ink)] focus:bg-white focus:outline-none"
                        />
                        {routeQuery ? (
                          <button
                            type="button"
                            onClick={() => setRouteQuery('')}
                            className="absolute right-2.5 top-2 text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-ink)]"
                            aria-label="Clear route search"
                          >
                            &times;
                          </button>
                        ) : null}
                      </div>

                      {/* Status quick tabs */}
                      <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
                        {(
                          [
                            { id: 'all', label: 'All' },
                            { id: 'planned', label: 'Planned' },
                            { id: 'in_progress', label: 'Active' },
                            { id: 'completed', label: 'Done' },
                          ] as const
                        ).map((tab) => {
                          const count = trips.filter((t) => {
                            if (tab.id === 'all') return true;
                            const s = t.items[0]?.batch?.status ?? 'planned';
                            if (tab.id === 'planned') return s === 'planned' || s === 'scheduled';
                            if (tab.id === 'in_progress') return s === 'in_progress';
                            if (tab.id === 'completed') return s === 'completed';
                            return false;
                          }).length;

                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setRouteStatusTab(tab.id)}
                              className={`rounded-md px-2 py-0.5 transition ${
                                routeStatusTab === tab.id
                                  ? 'bg-[var(--color-ink)] font-semibold text-white'
                                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]'
                              }`}
                            >
                              {tab.label} ({count})
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Scrollable List Container (Independent scroll: max-h-[calc(100vh-310px)]) */}
                    <div className="space-y-2 lg:max-h-[calc(100vh-310px)] lg:overflow-y-auto lg:pr-1">
                      {filteredTrips.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[var(--color-border-subtle)] p-6 text-center text-xs text-[var(--color-text-secondary)]">
                          No routes match current filter.
                        </div>
                      ) : (
                        filteredTrips.map((trip) => {
                          const isSelected = activeTrip?.id === trip.id;
                          const batchStatus = trip.items[0]?.batch?.status ?? 'planned';
                          const progress =
                            trip.items[0]?.batch?.progress ?? getTripProgress(trip.items);
                          const statusMeta = TRIP_STATUS_META[batchStatus] ?? {
                            label: batchStatus.replaceAll('_', ' '),
                            cls: 'border-[var(--color-border-subtle)] bg-zinc-50 text-zinc-700',
                            dot: 'bg-zinc-400',
                          };
                          const formattedDate = trip.date ? formatTripDate(trip.date) : '';
                          const tripRef = trip.ref !== 'Unassigned' ? trip.ref : trip.label;
                          const driver = trip.items[0]?.batch?.driver_name;
                          const vehicle = trip.items[0]?.batch?.vehicle_label;
                          const totalBags = trip.items.reduce(
                            (acc, it) => acc + (it.actual_bags ?? it.estimated_bags ?? 0),
                            0,
                          );
                          const totalWeight = trip.items.reduce(
                            (acc, it) => acc + (it.actual_weight_kg ?? it.estimated_weight_kg ?? 0),
                            0,
                          );

                          if (rosterDensity === 'compact') {
                            return (
                              <div
                                key={trip.id}
                                onClick={() => {
                                  setSelectedTripId(trip.id);
                                  setMobileTab('console');
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label={`Select route ${tripRef}`}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    setSelectedTripId(trip.id);
                                    setMobileTab('console');
                                  }
                                }}
                                className={`group flex items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-2 border-[var(--color-ink)] bg-white shadow-xs'
                                    : 'border border-[var(--color-border-subtle)] bg-white hover:border-[var(--color-border)] hover:bg-slate-50/50'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono text-xs font-bold text-[var(--color-ink)] truncate">
                                    {tripRef}
                                  </span>
                                  <span className="text-xs text-[var(--color-text-secondary)] truncate">
                                    · {driver ?? 'Unassigned'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">
                                    {trip.items.length} stop{trip.items.length === 1 ? '' : 's'} ·{' '}
                                    {Math.round(totalWeight * 10) / 10}kg
                                  </span>
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${statusMeta.cls}`}
                                  >
                                    {statusMeta.label}
                                  </span>
                                  <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={trip.id}
                              onClick={() => {
                                setSelectedTripId(trip.id);
                                setMobileTab('console');
                              }}
                              role="button"
                              tabIndex={0}
                              aria-label={`Select route ${tripRef}`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  setSelectedTripId(trip.id);
                                  setMobileTab('console');
                                }
                              }}
                              className={`group relative rounded-xl p-3.5 text-left transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-2 border-[var(--color-ink)] bg-white shadow-xs'
                                  : 'border border-[var(--color-border-subtle)] bg-white hover:border-[var(--color-border)] hover:bg-slate-50/50'
                              }`}
                            >
                              {/* Route Ref & Status */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-[var(--color-ink)]">
                                    {tripRef}
                                  </span>
                                  {formattedDate ? (
                                    <span className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-text-secondary)]">
                                      <Calendar className="h-3 w-3 text-[var(--color-text-secondary)]" />
                                      {formattedDate}
                                    </span>
                                  ) : null}
                                </div>
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.cls}`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`}
                                    aria-hidden="true"
                                  />
                                  {statusMeta.label}
                                </span>
                              </div>

                              {/* Crew, Vehicle, and Load */}
                              <div className="mt-2.5 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700">
                                    {driver ? (
                                      driver.slice(0, 2).toUpperCase()
                                    ) : (
                                      <User className="h-3.5 w-3.5" />
                                    )}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="truncate font-semibold text-[var(--color-ink)]">
                                      {driver ?? 'Unassigned Driver'}
                                    </span>
                                    {vehicle ? (
                                      <span className="truncate font-mono text-[10px] text-[var(--color-text-secondary)]">
                                        {vehicle}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="shrink-0 flex items-center gap-1 rounded bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600">
                                  <span>
                                    {trip.items.length} stop{trip.items.length === 1 ? '' : 's'}
                                  </span>
                                  <span>·</span>
                                  <span>{Math.round(totalWeight * 10) / 10} kg</span>
                                </div>
                              </div>

                              {/* Mini Progress */}
                              <div className="mt-2.5">
                                <TripProgressBar
                                  batchStatus={batchStatus}
                                  collected={progress.collected}
                                  missed={progress.missed}
                                  pending={progress.pending}
                                  total={progress.total}
                                />
                              </div>

                              {/* Clean card footer */}
                              <div className="mt-2.5 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                                <span>{totalBags} bags est.</span>
                                <span className="flex items-center gap-1 font-medium text-[var(--color-ink)]">
                                  <span>{isSelected ? 'Viewing' : 'View route'}</span>
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : null}

                {/* RIGHT COLUMN: Active Route Dispatch Console */}
                <div
                  className={`${trips.length > 1 ? 'lg:col-span-7' : 'lg:col-span-12'} ${
                    mobileTab === 'console' || trips.length === 1 ? 'block' : 'hidden lg:block'
                  } lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto`}
                >
                  {activeTrip ? (
                    (() => {
                      const batchStatus = activeTrip.items[0]?.batch?.status ?? 'planned';
                      const progress =
                        activeTrip.items[0]?.batch?.progress ?? getTripProgress(activeTrip.items);
                      const frozen = isRescheduleFrozen(batchStatus);
                      const hasRescheduledStops = activeTrip.items.some(
                        (i) => !!i.reschedule_reason || !!i.previous_scheduled_date,
                      );
                      const hasUnavailableStops = activeTrip.items.some(
                        (i) => !!i.unavailable_reason,
                      );
                      const statusMeta = TRIP_STATUS_META[batchStatus] ?? {
                        label: batchStatus.replaceAll('_', ' '),
                        cls: 'border-slate-200 bg-slate-100 text-slate-700',
                        dot: 'bg-slate-400',
                      };
                      const formattedDate = activeTrip.date ? formatTripDate(activeTrip.date) : '';
                      const tripRef =
                        activeTrip.ref !== 'Unassigned' ? activeTrip.ref : activeTrip.label;
                      const driver = activeTrip.items[0]?.batch?.driver_name;
                      const team = activeTrip.items[0]?.batch?.team_name;
                      const vehicle = activeTrip.items[0]?.batch?.vehicle_label;

                      const activeNextStopIdx = activeTrip.items.findIndex(
                        (i) => i.status === 'scheduled',
                      );
                      const activeNextStop =
                        activeNextStopIdx >= 0 ? activeTrip.items[activeNextStopIdx] : null;

                      const totalBags = activeTrip.items.reduce(
                        (acc, it) => acc + (it.actual_bags ?? it.estimated_bags ?? 0),
                        0,
                      );
                      const totalWeight = activeTrip.items.reduce(
                        (acc, it) => acc + (it.actual_weight_kg ?? it.estimated_weight_kg ?? 0),
                        0,
                      );

                      return (
                        <section className="overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-white shadow-xs">
                          {/* Console Header */}
                          <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] p-4 sm:p-5 text-[var(--color-ink)]">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--color-border-subtle)] bg-white text-[var(--color-ink)] shadow-2xs">
                                  <Truck className="h-5 w-5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h2 className="font-mono text-base font-bold text-[var(--color-ink)] tracking-wide">
                                      Route {tripRef}
                                    </h2>
                                    <span
                                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.cls}`}
                                    >
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`}
                                        aria-hidden="true"
                                      />
                                      {statusMeta.label}
                                    </span>
                                    {frozen ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-900">
                                        <Lock className="h-3 w-3" />
                                        Locked
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                                    {formattedDate ? (
                                      <span className="inline-flex items-center gap-1 font-mono">
                                        <Calendar className="h-3 w-3 text-[var(--color-text-secondary)]" />
                                        {formattedDate}
                                      </span>
                                    ) : null}
                                    <span>·</span>
                                    <span>{activeTrip.items.length} stops</span>
                                    <span>·</span>
                                    <span>
                                      Est. {totalBags} bags ({Math.round(totalWeight * 10) / 10} kg)
                                    </span>
                                  </p>
                                </div>
                              </div>

                              {/* Action: Trip Sheet Modal Trigger */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedTripSheet(activeTrip)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] shadow-2xs transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
                                >
                                  <Maximize2 className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
                                  <span>Trip Sheet ({activeTrip.items.length})</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => window.print()}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] shadow-2xs transition hover:bg-slate-50 print:hidden"
                                >
                                  <Printer className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
                                  <span className="hidden sm:inline">Print</span>
                                </button>
                              </div>
                            </div>

                            {/* Crew info bar */}
                            <div className="mt-3.5 flex flex-wrap items-center gap-4 rounded-xl border border-[var(--color-border-subtle)] bg-white px-3.5 py-2 text-xs text-[var(--color-ink)] shadow-2xs">
                              <span className="inline-flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
                                <strong>{driver ?? 'Unassigned Driver'}</strong>
                              </span>
                              {vehicle ? (
                                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-ink)]">
                                  <Truck className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
                                  {vehicle}
                                </span>
                              ) : null}
                              {team ? (
                                <span className="inline-flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                                  <Users className="h-3.5 w-3.5" />
                                  {team}
                                </span>
                              ) : null}
                            </div>

                            {/* Route progress */}
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
                              <p className="mt-2 text-[11px] text-amber-800">
                                {frozen ? 'Trip is locked — rescheduling disabled. ' : ''}
                                {hasRescheduledStops
                                  ? 'Rescheduled stops present — prior slot on stop page. '
                                  : ''}
                                {hasUnavailableStops
                                  ? 'Unavailable reasons detailed on stop page.'
                                  : ''}
                              </p>
                            )}
                          </header>

                          {/* Console Body Workspace */}
                          <div className="space-y-4 bg-white p-4 sm:p-5">
                            {/* Capacity Notices */}
                            <BatchCapacityNotice
                              batchId={activeTrip.id}
                              departmentId={desk.departmentId}
                              items={activeTrip.items}
                            />

                            {/* Active Next Stop Callout */}
                            {activeNextStop ? (
                              <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-xs">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="shrink-0 rounded bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                                    Next Stop #{activeNextStopIdx + 1}
                                  </span>
                                  <span className="font-bold text-[var(--color-ink)] truncate">
                                    {activeNextStop.requester_name}
                                  </span>
                                  <span className="text-[var(--color-text-secondary)] font-mono text-[11px] hidden sm:inline">
                                    (
                                    {formatVolume(
                                      activeNextStop.estimated_bags,
                                      activeNextStop.estimated_weight_kg,
                                    )}
                                    )
                                  </span>
                                </div>
                                <Link
                                  to={stopPageHref(activeTrip.id, activeNextStop.id)}
                                  aria-label="Execute next stop"
                                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-[var(--color-ink)] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-black transition shadow-xs"
                                >
                                  <span>Execute stop</span>
                                  <span aria-hidden="true">&rarr;</span>
                                </Link>
                              </div>
                            ) : null}

                            {/* Sequential Route Timeline */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-semibold text-[var(--color-ink)]">
                                  Itinerary ({activeTrip.items.length} stops)
                                </span>
                                <span className="text-xs text-[var(--color-text-secondary)]">
                                  Sorted by sequence
                                </span>
                              </div>

                              <div className="relative max-h-[460px] overflow-y-auto pr-1">
                                {/* Continuous Trunk Line */}
                                <div
                                  aria-hidden="true"
                                  className="pointer-events-none absolute bottom-4 left-[23px] top-4 w-0.5 bg-[var(--color-border-subtle)]"
                                />

                                <ul className="space-y-2">
                                  {activeTrip.items.map((item, idx) => {
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
                                            ? 'bg-zinc-100 text-zinc-900 border-zinc-300 font-semibold'
                                            : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]';

                                    return (
                                      <li key={item.id} className="relative">
                                        <Link
                                          to={stopPageHref(activeTrip.id, item.id)}
                                          aria-label={`Stop ${idx + 1}: ${item.requester_name}, ${item.pickup_address}`}
                                          className={`group flex min-h-[52px] w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                                            isNext
                                              ? 'border-[var(--color-ink)] bg-[var(--color-surface-sunken)] shadow-2xs'
                                              : 'border-[var(--color-border-subtle)] bg-white hover:border-[var(--color-border)] hover:bg-[var(--color-surface-sunken)]/40 hover:shadow-2xs'
                                          }`}
                                        >
                                          {/* Step Node Marker */}
                                          <span
                                            aria-hidden="true"
                                            className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-mono font-bold leading-none shadow-2xs ring-4 ring-white ${
                                              isCollected
                                                ? 'bg-[var(--color-success)] text-white'
                                                : isMissed
                                                  ? 'border-2 border-rose-400 bg-white text-rose-600'
                                                  : isNext
                                                    ? 'border-2 border-[var(--color-ink)] bg-white text-[var(--color-ink)] ring-[var(--color-surface-alt)]'
                                                    : 'border border-[var(--color-border)] bg-white text-[var(--color-text-secondary)]'
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

                                          {/* Stop Content */}
                                          <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <span className="truncate text-xs font-bold text-[var(--color-ink)] group-hover:text-blue-700">
                                                {item.requester_name}
                                              </span>
                                              <span className="font-mono text-[10px] text-[var(--color-text-secondary)]">
                                                · {item.reference}
                                              </span>
                                              {item.service_zone?.name ? (
                                                <span className="rounded bg-[var(--color-surface-alt)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-secondary)]">
                                                  {item.service_zone.name}
                                                </span>
                                              ) : null}
                                            </div>

                                            <div className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                                              <MapPin className="h-3 w-3 shrink-0 text-[var(--color-text-secondary)]" />
                                              <span
                                                className="truncate"
                                                title={item.pickup_address}
                                              >
                                                {item.pickup_address}
                                              </span>
                                            </div>
                                          </div>

                                          {/* Volume Chip */}
                                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-[var(--color-ink)]">
                                            <Package className="h-3 w-3 text-[var(--color-text-secondary)]" />
                                            {formatVolume(
                                              item.estimated_bags,
                                              item.estimated_weight_kg,
                                            )}
                                          </span>

                                          {/* Status Badge */}
                                          <span
                                            className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium leading-none ${statusBadgeCls}`}
                                          >
                                            {statusLabel}
                                          </span>

                                          {/* Chevron */}
                                          <ChevronRight
                                            className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-ink)]"
                                            strokeWidth={2}
                                            aria-hidden="true"
                                          />
                                        </Link>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            </div>

                            {/* Itinerary footer count & Trip Sheet link */}
                            {activeTrip.items.length > 3 ? (
                              <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-3 text-xs text-[var(--color-text-secondary)]">
                                <span className="font-mono">
                                  Showing itinerary ({activeTrip.items.length} stop
                                  {activeTrip.items.length === 1 ? '' : 's'})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedTripSheet(activeTrip)}
                                  className="inline-flex items-center gap-1 font-mono font-bold text-[var(--color-ink)] hover:underline"
                                >
                                  Open Full Trip Sheet ({activeTrip.items.length}) &rarr;
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </section>
                      );
                    })()
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                      Select a route from the list to view itinerary and dispatch details.
                    </div>
                  )}
                </div>
              </div>
            </div>
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
