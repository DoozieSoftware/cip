import { useMemo, useState, type JSX } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCalendar,
  IconCamera,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconCopy,
  IconExternalLink,
  IconLock,
  IconMail,
  IconMapPin,
  IconNavigation,
  IconPackage,
  IconPhone,
  IconTruck,
  IconX,
} from '@tabler/icons-react';
import { ApiError } from '../../../../shared/api/errors';
import { readSession } from '../../../../auth/storage';
import { ConfirmActionDialog } from '../../components/ConfirmActionDialog';
import {
  collectTextileWithProof,
  fetchTextileDetail,
  recordTextileOutcome,
  type TextileCollectionListItem,
} from '../../api/textileApi';
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
import {
  CATEGORY_LABELS,
  DeskPage,
  DeskStates,
  RescheduleDetail,
  RescheduleOverrideNotice,
  STATUS_LABELS,
  TripProgressBar,
  UnavailableBadge,
  getTripProgress,
  isRescheduleFrozen,
  useDesk,
  useTextileQueue,
  formatVolume,
} from './shared';
import { StopRecordForm } from './components/StopRecordForm';
import StopRouteMap from './components/StopRouteMap';
import {
  STOP_BTN as BTN,
  formatTripDate,
  isNetworkFailure,
  isOfflineError,
  mapsHref,
  newIdempotencyKey,
  telHref,
} from './stopWorkUtils';

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

/* Secondary collection actions — Mark missed + Override. Rendered inline on
 * desktop, inside the "More actions" disclosure on mobile. */
function SecondaryStopActions({
  item,
  busy,
  showOverride,
  onMissed,
  onOverride,
}: {
  item: TextileCollectionListItem;
  busy: boolean;
  showOverride: boolean;
  onMissed: (target: TextileCollectionListItem) => void;
  onOverride: (target: TextileCollectionListItem) => void;
}): JSX.Element {
  return (
    <>
      <button type="button" disabled={busy} onClick={() => onMissed(item)} className={BTN.danger}>
        <IconX className="h-4 w-4" stroke={2} aria-hidden="true" />
        Mark missed
      </button>
      {showOverride ? (
        <button
          type="button"
          onClick={() => onOverride(item)}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-4 text-[14px] font-semibold text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
          aria-label={`Override reschedule for ${item.reference}`}
        >
          <IconLock className="h-4 w-4" stroke={2} aria-hidden="true" />
          Override
        </button>
      ) : null}
    </>
  );
}

export default function TextileStopPage(): JSX.Element {
  const desk = useDesk();
  const auth = useOptionalAuth();
  const user = auth?.user ?? readSession()?.user ?? null;
  const { batchId = '', stopId = '' } = useParams<{ batchId: string; stopId: string }>();
  const [recordOpen, setRecordOpen] = useState(true);
  const [missedTarget, setMissedTarget] = useState<TextileCollectionListItem | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<TextileCollectionListItem | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [queuedNotice, setQueuedNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const opsQueue = useOpsQueue();

  function handleCopy(text: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const detail = useQuery({
    queryKey: ['operations', 'textile', 'detail', stopId, desk.departmentId],
    queryFn: () => fetchTextileDetail(stopId, desk.departmentId),
    enabled: desk.ready && desk.isDrLinen && !!stopId,
    retry: false,
  });

  const siblingsQuery = useTextileQueue({
    status: '',
    search: '',
    page: 1,
    collectionMethod: 'premises',
    perPage: 200,
    autoRefresh: missedTarget === null && overrideTarget === null,
    enabled: desk.ready && desk.isDrLinen,
    departmentId: desk.departmentId,
  });

  const item = detail.data ?? null;

  const siblings = useMemo(() => {
    const all = siblingsQuery.data?.data ?? [];
    const inTrip = (
      batchId === 'unassigned'
        ? all.filter((r) => !r.batch)
        : all.filter((r) => r.batch?.id === batchId)
    ).sort((a, b) => {
      if (batchId === 'unassigned') return 0;
      return (a.stop_order ?? Number.MAX_SAFE_INTEGER) - (b.stop_order ?? Number.MAX_SAFE_INTEGER);
    });
    if (item && !inTrip.some((r) => r.id === item.id)) {
      const itemBatchId = item.batch?.id ?? 'unassigned';
      if (itemBatchId === batchId || inTrip.length === 0) return [item, ...inTrip];
    }
    if (inTrip.length > 0) return inTrip;
    return item ? [item] : [];
  }, [siblingsQuery.data?.data, batchId, item]);

  const stopIndex = useMemo(
    () => siblings.findIndex((r) => r.id === (item?.id ?? stopId)),
    [siblings, item?.id, stopId],
  );
  const prevStop = stopIndex > 0 ? siblings[stopIndex - 1] : null;
  const nextStop =
    stopIndex >= 0 && stopIndex < siblings.length - 1 ? siblings[stopIndex + 1] : null;

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
      setMissedTarget(null);
      setOverrideTarget(null);
      setOverrideReason('');
      void detail.refetch();
      void siblingsQuery.refetch();
    },
  });

  async function handleMissed(target: TextileCollectionListItem, reason: string): Promise<void> {
    setServerError(null);
    const idempotencyKey =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `field-missed-${target.id}-${Date.now()}`;
    try {
      await outcome.mutateAsync({ id: target.id, kind: 'missed', reason });
    } catch (e) {
      if (isOfflineError(e)) {
        const ownerId = readSession()?.user.id ?? null;
        await getQueue(ownerId).enqueue({
          kind: 'textile.field.outcome',
          id: idempotencyKey,
          payload: {
            collectionId: target.id,
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
    target: TextileCollectionListItem,
    p: { bags: number; weight: number; file: File; reason?: string },
  ) {
    setServerError(null);
    setQueuedNotice(null);
    const idempotencyKey = newIdempotencyKey();
    try {
      await collectTextileWithProof(
        target.id,
        {
          actual_bags: p.bags,
          actual_weight_kg: p.weight,
          photo: p.file,
          reason: p.reason,
          idempotencyKey,
        },
        desk.departmentId,
      );
      setRecordOpen(false);
      void detail.refetch();
      void siblingsQuery.refetch();
    } catch (e) {
      if (isNetworkFailure(e)) {
        registerTextileOfflineRetry(user?.id ?? null);
        const payload: CollectPayload = {
          collectionId: target.id,
          actualBags: p.bags,
          actualWeightKg: p.weight,
          reason: p.reason,
          photoName: p.file.name,
          photoType: p.file.type,
          photoBlob: p.file,
          idempotencyKey,
          departmentId: desk.departmentId,
          reference: target.reference,
        };
        await getOpsQueue(user?.id ?? null).enqueue({
          kind: 'textile.collect',
          payload,
          id: idempotencyKey,
        });
        setQueuedNotice(
          `Queued offline — ${target.reference} will upload when you are back online.`,
        );
        setRecordOpen(false);
        return;
      }
      if (e instanceof ApiError) setServerError(e.message);
      else setServerError('Failed to record collection');
    }
  }

  const batchStatus = item?.batch?.status ?? siblings[0]?.batch?.status ?? 'planned';
  const progress =
    item?.batch?.progress ?? (siblings.length > 0 ? getTripProgress(siblings) : null);
  const frozen = isRescheduleFrozen(batchStatus);
  const statusMeta = TRIP_STATUS_META[batchStatus] ?? {
    label: batchStatus.replaceAll('_', ' '),
    cls: 'border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)]',
  };
  const tripRef = item?.batch?.reference ?? (batchId === 'unassigned' ? 'Unassigned' : batchId);
  const tripDate = item?.batch?.collection_date ?? siblings[0]?.batch?.collection_date ?? '';
  const formattedDate = tripDate ? formatTripDate(tripDate) : '';
  const crew = [item?.batch?.driver_name, item?.batch?.team_name, item?.batch?.vehicle_label]
    .filter(Boolean)
    .join(' · ');

  const evidencePhoto = item?.photos?.find((p) => p.role === 'evidence');
  const queued = item
    ? offline.items.find((q) => q.collectionId === item.id && q.status !== 'completed')
    : undefined;
  const itemFrozen = isRescheduleFrozen(item?.batch?.status);
  const isCollected = item?.status === 'picked_up';
  const isMissed = item?.status === 'missed';
  const isTerminal = isCollected || isMissed;
  const isNext = stopIndex === 0 && item?.status === 'scheduled';
  const statusLabel = !item
    ? ''
    : isCollected
      ? 'Collected'
      : isMissed
        ? 'Missed'
        : queued
          ? queued.status === 'failed'
            ? 'Upload failed'
            : 'Pending upload'
          : (STATUS_LABELS[item.status] ?? item.status);

  return (
    <DeskPage
      desk={desk}
      title="Collections"
      description="Call, navigate, record or mark missed."
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/operations/textile-collections/collections"
            aria-label="Back to collections"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-4 text-[14px] font-medium text-[var(--color-ink)] shadow-sm transition-colors hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
          >
            <IconArrowLeft className="h-4 w-4" stroke={2} aria-hidden="true" />
            Back
          </Link>
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
            {opsQueue.pending.length} pending upload{opsQueue.pending.length === 1 ? '' : 's'} —
            auto-retry.
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

      <DeskStates
        loading={detail.isLoading}
        error={detail.isError}
        onRetry={() => void detail.refetch()}
        hasRows={!!item}
        emptyTitle="Collection not found"
        emptyBody="Moved to another trip or removed."
      >
        {item ? (
          <div className="space-y-4">
            {/* Trip context header & route sequence */}
            <section
              aria-label="Trip context"
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white">
                      {tripRef}
                    </span>
                    {formattedDate ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                        <IconCalendar className="h-3.5 w-3.5" />
                        {formattedDate}
                      </span>
                    ) : null}
                    {stopIndex >= 0 && siblings.length > 0 ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        Collection {stopIndex + 1} of {siblings.length}
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none ${statusMeta.cls}`}
                    >
                      {statusMeta.label}
                    </span>
                    {frozen ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                        <IconLock className="h-3.5 w-3.5" stroke={1.65} aria-hidden="true" /> Locked
                      </span>
                    ) : null}
                  </div>

                  {crew ? (
                    <div className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-600">
                      <IconTruck className="h-3.5 w-3.5 text-slate-400" />
                      <span>{crew}</span>
                    </div>
                  ) : null}
                </div>

                {/* Prev / Next Collection Navigation */}
                <nav aria-label="Collection navigation" className="flex items-center gap-2">
                  {prevStop ? (
                    <Link
                      to={`/operations/textile-collections/collections/${batchId}/stops/${prevStop.id}`}
                      aria-label="Previous collection"
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                    >
                      <IconChevronLeft className="h-4 w-4" stroke={2} aria-hidden="true" />
                      Prev
                    </Link>
                  ) : (
                    <span className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-1.5 text-xs text-slate-400 opacity-60">
                      <IconChevronLeft className="h-4 w-4" stroke={2} aria-hidden="true" />
                      Prev
                    </span>
                  )}
                  {nextStop ? (
                    <Link
                      to={`/operations/textile-collections/collections/${batchId}/stops/${nextStop.id}`}
                      aria-label="Next collection"
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                    >
                      Next
                      <IconChevronRight className="h-4 w-4" stroke={2} aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-1.5 text-xs text-slate-400 opacity-60">
                      Next
                      <IconChevronRight className="h-4 w-4" stroke={2} aria-hidden="true" />
                    </span>
                  )}
                </nav>
              </div>

              {progress ? (
                <div className="mt-3.5 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                    <span className="font-semibold">Route Execution Progress</span>
                  </div>
                  <TripProgressBar
                    batchStatus={batchStatus}
                    collected={progress.collected}
                    missed={progress.missed}
                    pending={progress.pending}
                    total={progress.total}
                    showCounts={false}
                  />
                </div>
              ) : null}

              {/* Road route map with slim offline-safe status strip */}
              <div className="mt-4 border-t border-slate-100 pt-3">
                <StopRouteMap items={siblings} currentId={item?.id ?? stopId} batchId={batchId} />
              </div>
            </section>

            {/* Two-Column Responsive Collection Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* LEFT COLUMN: Collection Information, Customer & Location (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                {/* Card 1: Collection Hero & Customer Details */}
                <section
                  aria-label={`Collection work for ${item.requester_name}`}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {item.reference}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(item.reference)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 transition"
                        title="Copy reference"
                      >
                        <IconCopy className="h-3.5 w-3.5" />
                        <span>{copied ? 'Copied!' : 'Copy'}</span>
                      </button>
                      {stopIndex >= 0 && siblings.length > 0 ? (
                        <span className="text-xs font-semibold text-slate-500">
                          #{stopIndex + 1}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isCollected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                          <IconCheck className="h-3.5 w-3.5" stroke={2.5} aria-hidden="true" />{' '}
                          Collected
                        </span>
                      ) : isMissed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-800 border border-rose-200">
                          <IconX className="h-3.5 w-3.5" stroke={2.5} aria-hidden="true" /> Missed
                        </span>
                      ) : queued ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                            queued.status === 'failed'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {queued.status === 'failed' ? (
                            <IconAlertTriangle
                              className="h-3.5 w-3.5"
                              stroke={2}
                              aria-hidden="true"
                            />
                          ) : (
                            <IconClock className="h-3.5 w-3.5" stroke={2} aria-hidden="true" />
                          )}
                          {queued.status === 'failed' ? 'Upload failed' : 'Pending upload'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800 border border-sky-200">
                          Scheduled
                        </span>
                      )}
                      <span className="sr-only">{statusLabel}</span>
                      {isNext ? (
                        <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                          Up next
                        </span>
                      ) : null}
                      {itemFrozen && !isTerminal ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 border border-amber-200">
                          <IconLock className="h-3.5 w-3.5" stroke={2} aria-hidden="true" /> Locked
                        </span>
                      ) : null}
                      {item.unavailable_reason ? (
                        <UnavailableBadge reason={item.unavailable_reason} />
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        {item.requester_name}
                      </h1>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 uppercase">
                        {item.requester_type ?? 'Individual citizen'}
                      </span>
                    </div>

                    {/* Quick Contact & Action Bar */}
                    <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                      <a href={telHref(item.contact_phone)} aria-label="Call" className={BTN.call}>
                        <IconPhone
                          className="h-4 w-4 text-emerald-700"
                          stroke={2}
                          aria-hidden="true"
                        />
                        <span>Call</span>
                      </a>

                      <a
                        href={mapsHref(item.pickup_address, item.latitude, item.longitude)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Navigate"
                        className={BTN.navigate}
                      >
                        <IconNavigation
                          className="h-4 w-4 text-sky-700"
                          stroke={2}
                          aria-hidden="true"
                        />
                        <span>Navigate</span>
                        <IconExternalLink className="h-3.5 w-3.5 text-sky-500" />
                      </a>

                      {item.contact_phone ? (
                        <span className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-mono font-semibold text-slate-700">
                          {item.contact_phone}
                        </span>
                      ) : null}

                      {item.contact_email ? (
                        <a
                          href={`mailto:${item.contact_email}`}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-white transition"
                        >
                          <IconMail className="h-3.5 w-3.5 text-slate-500" />
                          <span className="truncate max-w-[160px]">{item.contact_email}</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                </section>

                {/* Card 2: Location & Directions */}
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center gap-2 text-slate-500 mb-2">
                    <IconMapPin className="h-4 w-4 text-slate-700" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Pickup Address
                    </h2>
                  </div>
                  <p className="text-sm font-semibold leading-relaxed text-slate-900">
                    {item.pickup_address}
                  </p>
                  {item.service_zone ? (
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        Zone: {item.service_zone.name}
                      </span>
                    </div>
                  ) : null}
                </section>

                {/* Card 3: Materials & Volume Summary */}
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center gap-2 text-slate-500 mb-3">
                    <IconPackage className="h-4 w-4 text-slate-700" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Textile Category & Volume
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                      <span className="text-[11px] font-semibold uppercase text-slate-500">
                        Category
                      </span>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                      <span className="text-[11px] font-semibold uppercase text-slate-500">
                        Estimated Volume
                      </span>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {item.estimated_bags ?? '—'} bags · {item.estimated_weight_kg ?? '—'} kg
                      </p>
                    </div>
                  </div>

                  {isCollected && item.actual_bags !== null ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                        Verified Actuals Collected
                      </span>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-bold text-emerald-950">
                        <IconCheck className="h-4 w-4 text-emerald-600" stroke={2.5} />
                        <span>{formatVolume(item.actual_bags, item.actual_weight_kg)}</span>
                        {item.picked_up_at ? (
                          <span className="text-xs font-normal text-emerald-700">
                            · Collected at{' '}
                            {new Date(item.picked_up_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {isMissed ? (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/70 p-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                        <IconX className="h-4 w-4" stroke={2.5} />
                        <span>Missed Pickup Recorded</span>
                      </div>
                      <p className="mt-1 text-xs text-rose-900 font-medium">
                        {item.missed_pickup_reason ??
                          'Customer was unreachable or gate was locked.'}
                      </p>
                    </div>
                  ) : null}
                </section>

                {/* Card 4: Citizen Instructions & Evidence */}
                {item.readiness_instructions || item.notes || evidencePhoto ? (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Citizen Notes & Instructions
                    </h2>

                    {item.readiness_instructions ? (
                      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs font-medium text-amber-900">
                        <IconAlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                          stroke={2}
                          aria-hidden="true"
                        />
                        <div>
                          <span className="font-bold block text-amber-950">
                            Gate & Handover Instructions:
                          </span>
                          <p className="mt-0.5">{item.readiness_instructions}</p>
                        </div>
                      </div>
                    ) : null}

                    {item.notes ? (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
                        <span className="font-bold text-slate-900 block mb-0.5">
                          Booking Notes:
                        </span>
                        <p>{item.notes}</p>
                      </div>
                    ) : null}

                    {evidencePhoto ? (
                      <figure className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-3">
                        <figcaption className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                          <IconCamera className="h-3.5 w-3.5 text-slate-500" />
                          Citizen evidence photo
                        </figcaption>
                        <img
                          src={evidencePhoto.url}
                          alt="citizen evidence"
                          className="max-h-72 w-full rounded-lg object-cover ring-1 ring-slate-200"
                          loading="lazy"
                        />
                      </figure>
                    ) : null}
                  </section>
                ) : null}

                <RescheduleDetail item={item} />
              </div>

              {/* RIGHT COLUMN: Execution & Action Console (5 cols) */}
              <div className="lg:col-span-5 lg:sticky lg:top-4 space-y-4">
                {!isTerminal ? (
                  <>
                    {/* Record Collection Console */}
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold">
                            <IconCamera className="h-4 w-4" />
                          </div>
                          <div>
                            <h2 className="text-sm font-bold text-slate-900">Record Collection</h2>
                            <p className="text-[11px] text-slate-500">Weigh bags & capture proof</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          aria-label="Record this collection"
                          disabled={outcome.isPending}
                          onClick={() => setRecordOpen((v) => !v)}
                          className={BTN.primary}
                        >
                          <IconCamera className="h-4 w-4" stroke={1.75} aria-hidden="true" />
                          {recordOpen ? 'Close' : 'Record collection'}
                        </button>
                      </div>

                      {recordOpen ? (
                        <StopRecordForm
                          item={item}
                          busy={outcome.isPending}
                          onSubmit={(p) => void handleCollect(item, p)}
                        />
                      ) : (
                        <p className="text-xs text-slate-500 py-4 text-center">
                          Click &quot;Record collection&quot; above to open the collection
                          verification form.
                        </p>
                      )}

                      {serverError ? (
                        <p
                          role="alert"
                          className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700"
                        >
                          {serverError}
                        </p>
                      ) : null}
                    </section>

                    {/* Alternative Actions */}
                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                        Alternative Actions
                      </h3>

                      <div className="flex flex-wrap gap-2">
                        <SecondaryStopActions
                          item={item}
                          busy={outcome.isPending}
                          showOverride={itemFrozen}
                          onMissed={(t) => setMissedTarget(t)}
                          onOverride={(t) => {
                            setOverrideTarget(t);
                            setOverrideReason('');
                          }}
                        />
                      </div>

                      {/* Mobile More actions disclosure */}
                      <details className="mt-2 sm:hidden">
                        <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-4 text-[14px] font-medium hover:bg-slate-50 focus-visible:outline-none">
                          More actions
                        </summary>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <SecondaryStopActions
                            item={item}
                            busy={outcome.isPending}
                            showOverride={itemFrozen}
                            onMissed={(t) => setMissedTarget(t)}
                            onOverride={(t) => {
                              setOverrideTarget(t);
                              setOverrideReason('');
                            }}
                          />
                        </div>
                      </details>
                    </section>
                  </>
                ) : isCollected ? (
                  /* Collected State */
                  <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-xs text-center space-y-4">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-8 ring-emerald-50">
                      <IconCheck className="h-7 w-7" stroke={3} />
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        {(item.requester_name ?? '').trim()
                          ? item.requester_name.trim()
                          : item.reference}{' '}
                        collected
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Verified actuals: {item.actual_bags} bags · {item.actual_weight_kg} kg
                      </p>
                    </div>

                    {nextStop ? (
                      <Link
                        to={`/operations/textile-collections/collections/${batchId}/stops/${nextStop.id}`}
                        className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white shadow-sm hover:bg-black transition"
                      >
                        <span>Proceed to next collection ({nextStop.requester_name})</span>
                        <IconChevronRight className="h-4 w-4" stroke={2} />
                      </Link>
                    ) : (
                      <Link
                        to="/operations/textile-collections/collections"
                        className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 shadow-2xs hover:bg-slate-50 transition"
                      >
                        <IconArrowLeft className="h-4 w-4" />
                        <span>Return to Collections</span>
                      </Link>
                    )}
                  </section>
                ) : (
                  /* Missed State */
                  <section className="rounded-2xl border border-rose-200 bg-white p-6 shadow-xs text-center space-y-4">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-700 ring-8 ring-rose-50">
                      <IconX className="h-7 w-7" stroke={3} />
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Pickup Logged as Missed</h2>
                      <p className="text-xs text-rose-700 mt-1 font-medium">
                        {item.missed_pickup_reason ?? 'Citizen was unavailable'}
                      </p>
                    </div>

                    {nextStop ? (
                      <Link
                        to={`/operations/textile-collections/collections/${batchId}/stops/${nextStop.id}`}
                        className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white shadow-sm hover:bg-black transition"
                      >
                        <span>Continue Route (Next: {nextStop.requester_name})</span>
                        <IconChevronRight className="h-4 w-4" stroke={2} />
                      </Link>
                    ) : (
                      <Link
                        to="/operations/textile-collections/collections"
                        className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 shadow-2xs hover:bg-slate-50 transition"
                      >
                        <IconArrowLeft className="h-4 w-4" />
                        <span>Return to Collections</span>
                      </Link>
                    )}
                  </section>
                )}
              </div>
            </div>

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
        ) : null}
      </DeskStates>
    </DeskPage>
  );
}
