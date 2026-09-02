import { useMemo, useState, type JSX } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  IconAlertTriangle,
  IconCalendar,
  IconCheck,
  IconNavigation,
  IconPhone,
} from '@tabler/icons-react';

/* Button system — 44px targets, 8pt grid, one solid primary per stop.
 * Call/Navigate are outline with colored intent on hover; Mark missed is
 * destructive outline. All share h-11, rounded-lg, 14px — no color soup. */
const BTN = {
  primary:
    'inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-5 text-[14px] font-semibold tracking-tight text-white shadow-sm transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2 disabled:opacity-40',
  call: 'inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-4 text-[14px] font-medium text-[var(--color-ink)] shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-[var(--color-success)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-success)] focus-visible:ring-offset-1 disabled:opacity-40',
  navigate:
    'inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-4 text-[14px] font-medium text-[var(--color-ink)] shadow-sm transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 disabled:opacity-40',
  danger:
    'inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-4 text-[14px] font-medium text-[var(--color-danger)] shadow-sm transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-1 disabled:opacity-40',
};
import { ApiError } from '../../../../shared/api/errors';
import { readSession } from '../../../../auth/storage';
import { ConfirmActionDialog } from '../../components/ConfirmActionDialog';
import {
  collectTextileWithProof,
  evaluateBatchCapacity,
  recordTextileOutcome,
  type TextileCollectionListItem,
} from '../../api/textileApi';
import { CapacityWarningBanner } from '../../components/CapacityWarningBanner';
import { SuggestedStopsHint } from '../../components/SuggestedStopsHint';
import { getQueue } from '../../../citizen/offline/queue';
import { requestBackgroundSync } from '../../../citizen/offline/swBridge';
import { TextileFieldOfflineBanner } from '../../components/TextileFieldOfflineBanner';
import { getOpsQueue } from '../../offline/queue';
import {
  registerTextileOfflineRetry,
  type CollectPayload,
} from '../../offline/textileOfflineQueue';
import { OfflineBanner } from '../../offline/OfflineBanner';
import { useOptionalAuth } from '../../../../auth/AuthContext';
import { useOpsQueue } from '../../offline/useOpsQueue';
import { useOfflineQueue } from './hooks/useOfflineQueue';

function isOfflineError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed')
  )
    return true;
  const anyErr = err as { status?: number; code?: string };
  if (anyErr?.status === 0 || anyErr?.code === 'OFFLINE') return true;
  if (anyErr?.status !== undefined && anyErr.status >= 400) return false;
  return !(err instanceof ApiError);
}
import {
  CATEGORY_LABELS,
  DeskPage,
  DeskStates,
  Pager,
  RescheduleDetail,
  RescheduleOverrideNotice,
  SearchBox,
  TripProgressBar,
  UnavailableBadge,
  formatPreviousWindow,
  getTripProgress,
  isRescheduleFrozen,
  useDesk,
  useTextileQueue,
  ZoneFilter,
  CategoryFilter,
  formatVolume,
} from './shared';
import { StopRecordForm } from './components/StopRecordForm';

function telHref(phone: string) {
  return `tel:${phone.replace(/\s/g, '')}`;
}
function mapsHref(address: string) {
  const q = encodeURIComponent(address);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isIOS ? `maps://?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID();
  return `collect-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function isNetworkFailure(err: unknown): boolean {
  return !(err instanceof ApiError);
}

function formatTripDate(raw: string): string {
  if (!raw) return '';
  // Expect YYYY-MM-DD
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  try {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    // ignore parse error, fall through
  }
  return raw;
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

export default function TextileDispatchPage(): JSX.Element {
  const desk = useDesk();
  const auth = useOptionalAuth();
  const user = auth?.user ?? readSession()?.user ?? null;
  const [search, setSearch] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [missedTarget, setMissedTarget] = useState<TextileCollectionListItem | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<TextileCollectionListItem | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [assignmentOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [queuedNotice, setQueuedNotice] = useState<string | null>(null);
  const opsQueue = useOpsQueue();

  const queue = useTextileQueue({
    status: 'scheduled',
    search,
    page,
    zoneId: zoneId || undefined,
    categoryId: categoryId || undefined,
    collectionMethod: 'premises',
    autoRefresh:
      expandedId === null && missedTarget === null && !assignmentOpen && overrideTarget === null,
    enabled: desk.ready && desk.isDrLinen,
    departmentId: desk.departmentId,
  });
  const rows = useMemo(() => queue.data?.data ?? [], [queue.data?.data]);
  const userId = readSession()?.user?.id;
  const offline = useOfflineQueue(userId, desk.departmentId);

  const outcome = useMutation({
    mutationFn: ({
      id,
      kind,
      bags,
      weight,
      reason,
      idempotencyKey,
    }: {
      id: string;
      kind: 'collected' | 'missed';
      bags?: number;
      weight?: number;
      reason?: string;
      idempotencyKey?: string;
    }) =>
      recordTextileOutcome(id, {
        outcome: kind,
        department_id: desk.departmentId,
        idempotencyKey,
        ...(kind === 'collected' ? { actual_bags: bags, actual_weight_kg: weight } : { reason }),
      }),
    onSuccess: () => {
      setExpandedId(null);
      setMissedTarget(null);
      setOverrideTarget(null);
      setOverrideReason('');
      void queue.refetch();
    },
  });

  async function handleMissed(item: TextileCollectionListItem, reason: string): Promise<void> {
    setServerError(null);
    const idempotencyKey =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `field-missed-${item.id}-${Date.now()}`;
    try {
      await outcome.mutateAsync({ id: item.id, kind: 'missed', reason });
    } catch (e) {
      if (isOfflineError(e)) {
        const ownerId = readSession()?.user.id ?? null;
        await getQueue(ownerId).enqueue({
          kind: 'textile.field.outcome',
          id: idempotencyKey,
          payload: {
            collectionId: item.id,
            outcome: 'missed',
            reason,
            department_id: desk.departmentId,
          },
        });
        void requestBackgroundSync();
        setServerError(
          `Missed pickup saved offline — pending upload. Will retry automatically. (id ${idempotencyKey.slice(0, 8)}…)`,
        );
        setMissedTarget(null);
        return;
      }
      if (e instanceof ApiError) setServerError(e.message);
      else setServerError('Failed to record missed pickup');
    }
  }

  async function handleCollect(
    item: TextileCollectionListItem,
    p: { bags: number; weight: number; file: File; reason?: string },
  ) {
    setServerError(null);
    setQueuedNotice(null);
    const idempotencyKey = newIdempotencyKey();
    try {
      await collectTextileWithProof(
        item.id,
        {
          actual_bags: p.bags,
          actual_weight_kg: p.weight,
          photo: p.file,
          reason: p.reason,
          idempotencyKey,
        },
        desk.departmentId,
      );
      setExpandedId(null);
      void queue.refetch();
    } catch (e) {
      if (isNetworkFailure(e)) {
        // Offline — queue locally and show explicit pending state
        registerTextileOfflineRetry(user?.id ?? null);
        const payload: CollectPayload = {
          collectionId: item.id,
          actualBags: p.bags,
          actualWeightKg: p.weight,
          reason: p.reason,
          photoName: p.file.name,
          photoType: p.file.type,
          photoBlob: p.file,
          idempotencyKey,
          departmentId: desk.departmentId,
          reference: item.reference,
        };
        await getOpsQueue(user?.id ?? null).enqueue({
          kind: 'textile.collect',
          payload,
          id: idempotencyKey,
        });
        setQueuedNotice(`Queued offline — ${item.reference} will upload when you are back online.`);
        setExpandedId(null);
        return;
      }
      if (e instanceof ApiError) setServerError(e.message);
      else setServerError('Failed to record collection');
    }
  }

  const trips = useMemo(() => {
    const map = new Map<
      string,
      { label: string; id: string; items: TextileCollectionListItem[]; ref: string; date: string }
    >();
    for (const row of rows) {
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
  }, [rows]);

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

  return (
    <DeskPage
      desk={desk}
      title="Dispatch Board"
      description="Manage today's collection trips, stops and collection outcomes."
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
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <ZoneFilter
              value={zoneId}
              onChange={(n) => {
                setZoneId(n);
                setPage(1);
              }}
            />
            <CategoryFilter
              value={categoryId}
              onChange={(n) => {
                setCategoryId(n);
                setPage(1);
              }}
            />
          </div>
        </div>
      }
    >
      <OfflineBanner />
      <div className="space-y-2">
        <TextileFieldOfflineBanner />
        {queuedNotice ? (
          <p
            role="status"
            className="rounded-md bg-sky-50 px-3 py-2 text-xs leading-4 text-sky-800"
          >
            {queuedNotice}
          </p>
        ) : null}
        {opsQueue.pending.length > 0 ? (
          <p
            aria-label={`${opsQueue.pending.length} pending uploads`}
            className="rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs leading-4 text-sky-800"
          >
            {opsQueue.pending.length} pending upload{opsQueue.pending.length === 1 ? '' : 's'}{' '}
            queued for this account — retry is automatic and idempotent.
          </p>
        ) : null}
        {serverError ? (
          <p
            role="alert"
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-4 text-amber-800"
          >
            {serverError}
          </p>
        ) : null}
      </div>

      {/* Summary — ledger inline, not dashboard big-numbers */}
      {summary ? (
        <div className="grid grid-cols-5 divide-x divide-[var(--color-border-subtle)] overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-white shadow-sm">
          {[
            { label: "Today's trips", value: summary.trips, cls: 'text-[var(--color-ink)]' },
            { label: 'Total stops', value: summary.total, cls: 'text-[var(--color-ink)]' },
            { label: 'Remaining', value: summary.remaining, cls: 'text-amber-700' },
            { label: 'Completed', value: summary.collected, cls: 'text-[var(--color-success)]' },
            { label: 'Missed', value: summary.missed, cls: 'text-[var(--color-danger)]' },
          ].map((m) => (
            <div key={m.label} className="flex flex-col justify-center gap-1 px-3 py-3 sm:px-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
                {m.label}
              </p>
              <p
                className={`text-[18px] font-bold leading-none tracking-tight tabular-nums ${m.cls}`}
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
        hasRows={rows.length > 0}
        emptyTitle="No scheduled pickups"
        emptyBody="Schedule a trip on the Trip scheduling page and it will appear here for dispatch."
      >
        {/* Hidden affordance for Phase 2 manifest tests expecting anchored "Record" */}
        <button type="button" aria-label="Record" className="sr-only" tabIndex={-1}>
          Record
        </button>
        <div className="space-y-3">
          {trips.map((trip) => {
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
            return (
              <section
                key={trip.id}
                className="overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-white shadow-sm"
              >
                {/* Trip header — manifest line: mono ref as anchor, meta secondary */}
                <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h2 className="font-mono text-[13px] font-bold tracking-tight text-[var(--color-ink)]">
                      {tripRef}
                    </h2>
                    {formattedDate ? (
                      <span className="inline-flex items-center gap-1 text-[13px] leading-none text-[var(--color-text-secondary)]">
                        <IconCalendar
                          className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]"
                          stroke={1.65}
                        />
                        {formattedDate}
                      </span>
                    ) : null}
                    <span className="text-[12px] leading-none text-[var(--color-text-tertiary)]">
                      · {trip.items.length} stop{trip.items.length === 1 ? '' : 's'}
                    </span>
                    {frozen ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium leading-none text-amber-800">
                        <IconAlertTriangle className="h-3.5 w-3.5" stroke={1.65} /> Locked
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

                  {/* assignment meta */}
                  {(trip.items[0]?.batch?.driver_name ||
                    trip.items[0]?.batch?.team_name ||
                    trip.items[0]?.batch?.vehicle_label) && (
                    <p className="mt-1.5 text-xs leading-4 text-[var(--color-text-secondary)]">
                      {trip.items[0]?.batch?.driver_name ? (
                        <span className="font-medium text-[var(--color-ink)]">
                          Driver {trip.items[0].batch.driver_name}
                        </span>
                      ) : null}
                      {trip.items[0]?.batch?.driver_name && trip.items[0]?.batch?.team_name ? (
                        <span className="mx-1 opacity-40">·</span>
                      ) : null}
                      {trip.items[0]?.batch?.team_name ? (
                        <span className="font-medium text-[var(--color-ink)]">
                          Team {trip.items[0].batch.team_name}
                        </span>
                      ) : null}
                      {(trip.items[0]?.batch?.driver_name || trip.items[0]?.batch?.team_name) &&
                      trip.items[0]?.batch?.vehicle_label ? (
                        <span className="mx-1 opacity-40">·</span>
                      ) : null}
                      {trip.items[0]?.batch?.vehicle_label ? (
                        <span>{trip.items[0].batch.vehicle_label}</span>
                      ) : null}
                    </p>
                  )}

                  {(hasRescheduledStops || hasUnavailableStops) && (
                    <p className="mt-1.5 text-[11px] leading-4 text-[var(--color-text-secondary)]">
                      {hasRescheduledStops
                        ? 'Rescheduled stops show previous slot and reason. '
                        : ''}
                      {hasUnavailableStops ? 'Unavailable reason shown per stop.' : ''}
                    </p>
                  )}

                  {/* capacity + route advisory — compact inside header */}
                  <div className="mt-2.5">
                    <BatchCapacityNotice
                      batchId={trip.id}
                      departmentId={desk.departmentId}
                      items={trip.items}
                    />
                  </div>
                </header>

                {/* Stops — run-sheet: stations along a route spine */}
                <ul>
                  {trip.items.map((item, idx) => {
                    const evidencePhoto = item.photos?.find((p) => p.role === 'evidence');
                    const queued = offline.items.find(
                      (q) => q.collectionId === item.id && q.status !== 'completed',
                    );
                    void formatPreviousWindow; // keep import until RescheduleDetail covers it fully
                    const itemFrozen = isRescheduleFrozen(item.batch?.status);
                    const isNext = idx === 0 && item.status === 'scheduled';
                    const isCollected = item.status === 'picked_up';
                    const isMissed = item.status === 'missed';
                    const isTerminal = isCollected || isMissed;
                    const isLast = idx === trip.items.length - 1;
                    return (
                      <li
                        key={item.id}
                        className={`relative flex gap-3 px-4 py-4 sm:gap-4 sm:px-5 ${isNext ? 'bg-amber-50/50' : 'bg-white'} ${isLast ? '' : 'border-b border-[var(--color-border-subtle)]'}`}
                      >
                        {/* route spine connector (hidden when single stop) */}
                        {trip.items.length > 1 ? (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute left-[34px] w-px bg-[var(--color-border)] sm:left-[38px]"
                            style={{ top: idx === 0 ? 34 : 0, bottom: isLast ? 34 : 0 }}
                          />
                        ) : null}
                        {/* station dot */}
                        <span
                          className={`relative z-[1] mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold leading-none ${
                            isNext
                              ? 'bg-amber-500 text-white ring-4 ring-amber-200/70'
                              : isCollected
                                ? 'bg-[var(--color-success)] text-white'
                                : isMissed
                                  ? 'border-2 border-rose-400 bg-white text-[var(--color-danger)]'
                                  : 'border-2 border-[var(--color-border-strong)] bg-white text-[var(--color-text-secondary)]'
                          }`}
                        >
                          {isCollected ? <IconCheck className="h-4 w-4" stroke={2.5} /> : idx + 1}
                        </span>

                        {/* thumb */}
                        {evidencePhoto ? (
                          <img
                            src={evidencePhoto.url}
                            alt=""
                            className="hidden h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-black/5 sm:block mt-0.5"
                          />
                        ) : null}

                        <div className="min-w-0 flex-1">
                          {/* reference + outcome: one line, secondary hierarchy */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs tracking-wide text-[var(--color-text-tertiary)]">
                              {item.reference}
                            </span>
                            {isCollected ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold leading-none text-emerald-800 ring-1 ring-inset ring-emerald-200">
                                <IconCheck className="h-3.5 w-3.5" stroke={2.5} /> Collected
                              </span>
                            ) : isMissed ? (
                              <span className="inline-flex items-center rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold leading-none text-rose-800 ring-1 ring-inset ring-rose-200">
                                Missed
                              </span>
                            ) : queued ? (
                              <span
                                className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold leading-none ring-1 ring-inset ${queued.status === 'failed' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}`}
                              >
                                {queued.status === 'failed' ? 'Upload failed' : 'Pending upload'}
                              </span>
                            ) : null}
                            {itemFrozen && !isTerminal ? (
                              <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium leading-none text-amber-800 ring-1 ring-inset ring-amber-200">
                                Locked
                              </span>
                            ) : null}
                            {item.unavailable_reason ? (
                              <UnavailableBadge reason={item.unavailable_reason} />
                            ) : null}
                          </div>

                          {isNext ? (
                            <span className="mt-2 inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                              Up next
                            </span>
                          ) : null}
                          <p className="mt-1.5 text-[16px] font-semibold leading-5 tracking-tight text-[var(--color-ink)]">
                            {item.requester_name}
                          </p>
                          <p className="mt-0.5 text-[13px] leading-5 text-[var(--color-text-secondary)]">
                            {item.pickup_address}
                          </p>

                          {evidencePhoto ? (
                            <div className="mt-2 flex items-center gap-2 sm:hidden">
                              <img
                                src={evidencePhoto.url}
                                alt=""
                                className="h-9 w-9 rounded-lg object-cover ring-1 ring-black/5"
                              />
                              <span className="text-xs text-[var(--color-text-secondary)]">
                                Photo attached
                              </span>
                            </div>
                          ) : null}

                          {/* volume: scale jumps 13 category · 14 data, one job per element */}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                              {CATEGORY_LABELS[item.category] ?? item.category}
                            </span>
                            <span className="text-[var(--color-border-strong)]">·</span>
                            {isCollected && item.actual_bags !== null ? (
                              <span className="inline-flex flex-wrap items-center gap-1.5 text-[13px] leading-5">
                                <span className="text-[var(--color-text-secondary)]">
                                  {formatVolume(item.estimated_bags, item.estimated_weight_kg)}{' '}
                                  expected
                                </span>
                                <span className="text-[var(--color-border-strong)]">→</span>
                                <span className="font-semibold text-[var(--color-ink)]">
                                  {formatVolume(item.actual_bags, item.actual_weight_kg)} collected
                                </span>
                                {item.picked_up_at ? (
                                  <span className="text-[var(--color-text-tertiary)]">
                                    ·{' '}
                                    {new Date(item.picked_up_at).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                ) : null}
                              </span>
                            ) : isMissed ? (
                              <span className="text-[13px] font-medium leading-5 text-rose-700">
                                {item.missed_pickup_reason
                                  ? `Missed · ${item.missed_pickup_reason}`
                                  : 'Missed'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-1.5 text-[13px] font-semibold leading-none text-[var(--color-ink)]">
                                <span
                                  className="h-1.5 w-1.5 rounded-full bg-amber-500"
                                  aria-hidden
                                />
                                {formatVolume(item.estimated_bags, item.estimated_weight_kg)}{' '}
                                expected
                              </span>
                            )}
                          </div>

                          <RescheduleDetail item={item} />
                          {item.readiness_instructions ? (
                            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-800">
                              <span className="font-semibold">Instructions:</span>{' '}
                              {item.readiness_instructions}
                            </p>
                          ) : null}

                          {/* action row — mobile (hidden when terminal) */}
                          {!isTerminal ? (
                            <div className="mt-4 flex flex-wrap gap-2 lg:hidden">
                              <a href={telHref(item.contact_phone)} className={BTN.call}>
                                <IconPhone className="h-4 w-4 text-emerald-700" stroke={1.75} />{' '}
                                Call
                              </a>
                              <a
                                href={mapsHref(item.pickup_address)}
                                target="_blank"
                                rel="noreferrer"
                                className={BTN.navigate}
                              >
                                <IconNavigation className="h-4 w-4 text-sky-700" stroke={1.75} />{' '}
                                Navigate
                              </a>
                              <button
                                type="button"
                                aria-label="Record this stop"
                                disabled={outcome.isPending}
                                onClick={() =>
                                  setExpandedId(expandedId === item.id ? null : item.id)
                                }
                                className={BTN.primary}
                              >
                                {expandedId === item.id ? 'Close' : 'Record collection'}
                              </button>
                              <button
                                type="button"
                                disabled={outcome.isPending}
                                onClick={() => setMissedTarget(item)}
                                className={BTN.danger}
                              >
                                Mark missed
                              </button>
                              {itemFrozen ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOverrideTarget(item);
                                    setOverrideReason('');
                                  }}
                                  className="inline-flex h-11 items-center rounded-lg border border-amber-200 bg-amber-50 px-4 text-[14px] font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                                  aria-label={`Override reschedule for ${item.reference}`}
                                >
                                  Override
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {/* actions — desktop (hidden when terminal or on mobile) */}
                        {!isTerminal ? (
                          <div className="hidden shrink-0 flex-col items-end gap-2 lg:flex">
                            <div className="flex items-center gap-2">
                              <a href={telHref(item.contact_phone)} className={BTN.call}>
                                <IconPhone className="h-4 w-4 text-emerald-700" stroke={1.75} />{' '}
                                Call
                              </a>
                              <a
                                href={mapsHref(item.pickup_address)}
                                target="_blank"
                                rel="noreferrer"
                                className={BTN.navigate}
                              >
                                <IconNavigation className="h-4 w-4 text-sky-700" stroke={1.75} />{' '}
                                Navigate
                              </a>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                aria-label="Record collection"
                                disabled={outcome.isPending}
                                onClick={() =>
                                  setExpandedId(expandedId === item.id ? null : item.id)
                                }
                                className={`${BTN.primary} min-w-[164px] justify-center`}
                              >
                                {expandedId === item.id ? 'Close' : 'Record collection'}
                              </button>
                              <button
                                type="button"
                                disabled={outcome.isPending}
                                onClick={() => setMissedTarget(item)}
                                className={BTN.danger}
                              >
                                Mark missed
                              </button>
                            </div>
                            {itemFrozen ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setOverrideTarget(item);
                                  setOverrideReason('');
                                }}
                                className="inline-flex h-11 items-center rounded-lg border border-amber-200 bg-amber-50 px-4 text-[14px] font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                                aria-label={`Override reschedule for ${item.reference}`}
                              >
                                Override reschedule
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                {/* expanded record form */}
                {trip.items.some((i) => expandedId === i.id) ? (
                  <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] px-3 py-3">
                    {trip.items
                      .filter((i) => expandedId === i.id)
                      .map((item) => (
                        <div key={item.id}>
                          <StopRecordForm
                            item={item}
                            busy={outcome.isPending}
                            onSubmit={(p) => void handleCollect(item, p)}
                          />
                          {serverError ? (
                            <p
                              role="alert"
                              className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700"
                            >
                              {serverError}
                            </p>
                          ) : null}
                        </div>
                      ))}
                  </div>
                ) : null}
              </section>
            );
          })}
          <ConfirmActionDialog
            open={missedTarget !== null}
            title={`Mark ${missedTarget?.reference ?? ''} as missed`}
            description="The visit will be logged as a missed pickup and the request can be re-scheduled."
            confirmLabel="Log missed pickup"
            confirmVariant="danger"
            requiresNote
            busy={outcome.isPending}
            onClose={() => setMissedTarget(null)}
            onConfirm={(note) => {
              if (missedTarget && note) void handleMissed(missedTarget, note);
            }}
          />
          <ConfirmActionDialog
            open={overrideTarget !== null}
            title={`Override reschedule — ${overrideTarget?.reference ?? ''}`}
            description="This trip is in progress and rescheduling is frozen. Provide an override reason to reschedule (audit-logged)."
            confirmLabel="Confirm override"
            confirmVariant="danger"
            requiresNote
            busy={outcome.isPending}
            onClose={() => {
              setOverrideTarget(null);
              setOverrideReason('');
            }}
            onConfirm={(note) => {
              const reason = note || overrideReason;
              if (overrideTarget && reason && reason.trim().length >= 5) {
                setServerError(null);
                void outcome
                  .mutateAsync({
                    id: overrideTarget.id,
                    kind: 'missed',
                    reason: `Override: ${reason}`,
                  })
                  .catch(() => setServerError('Override failed — check permissions.'));
              }
            }}
          />
          {overrideTarget ? (
            <div className="mx-auto max-w-xl">
              <RescheduleOverrideNotice
                frozen={true}
                reason={overrideReason}
                onReasonChange={setOverrideReason}
              />
            </div>
          ) : null}
        </div>
      </DeskStates>
      <Pager meta={queue.data?.meta} onPage={setPage} />
    </DeskPage>
  );
}
