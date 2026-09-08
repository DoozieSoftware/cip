import { useMemo, useState, type JSX } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCamera,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconLock,
  IconNavigation,
  IconPhone,
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

/* Secondary stop actions — Mark missed + Override. Rendered inline on
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
  const opsQueue = useOpsQueue();

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
    const inTrip =
      batchId === 'unassigned'
        ? all.filter((r) => !r.batch)
        : all.filter((r) => r.batch?.id === batchId);
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
      title="Collection stop"
      description="Call, navigate, record or mark missed."
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/operations/textile-collections/dispatch"
            aria-label="Back to dispatch board"
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
        emptyTitle="Stop not found"
        emptyBody="Moved to another trip or removed."
      >
        {item ? (
          <div className="space-y-3">
            {/* Trip context header */}
            <section
              aria-label="Trip context"
              className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 sm:px-4"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h2 className="font-mono text-[13px] font-bold tracking-tight text-[var(--color-ink)]">
                  {tripRef}
                </h2>
                {formattedDate ? (
                  <span className="text-[13px] leading-none text-[var(--color-text-secondary)]">
                    {formattedDate}
                  </span>
                ) : null}
                {stopIndex >= 0 && siblings.length > 0 ? (
                  <span className="text-[12px] leading-none text-[var(--color-text-tertiary)]">
                    · Stop {stopIndex + 1} of {siblings.length}
                  </span>
                ) : null}
                {frozen ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium leading-none text-amber-800">
                    <IconLock className="h-3.5 w-3.5" stroke={1.65} aria-hidden="true" /> Locked
                  </span>
                ) : null}
                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none ${statusMeta.cls}`}
                >
                  {statusMeta.label}
                </span>
              </div>
              {crew ? (
                <p className="mt-1.5 text-xs leading-4 text-[var(--color-text-secondary)]">
                  {crew}
                </p>
              ) : null}
              {progress ? (
                <div className="mt-2 flex min-w-[140px] max-w-[320px] items-center">
                  <TripProgressBar
                    batchStatus={batchStatus}
                    collected={progress.collected}
                    missed={progress.missed}
                    pending={progress.pending}
                    total={progress.total}
                  />
                </div>
              ) : null}
              <nav
                aria-label="Stop navigation"
                className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--color-border-subtle)] pt-2"
              >
                {prevStop ? (
                  <Link
                    to={`/operations/textile-collections/dispatch/${batchId}/stops/${prevStop.id}`}
                    aria-label="Previous stop"
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white px-4 text-[14px] font-medium hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                  >
                    <IconChevronLeft className="h-4 w-4" stroke={2} aria-hidden="true" />
                    Prev
                  </Link>
                ) : (
                  <span className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] px-4 text-[14px] text-[var(--color-text-tertiary)] opacity-60">
                    <IconChevronLeft className="h-4 w-4" stroke={2} aria-hidden="true" />
                    Prev
                  </span>
                )}
                {nextStop ? (
                  <Link
                    to={`/operations/textile-collections/dispatch/${batchId}/stops/${nextStop.id}`}
                    aria-label="Next stop"
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white px-4 text-[14px] font-medium hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                  >
                    Next
                    <IconChevronRight className="h-4 w-4" stroke={2} aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] px-4 text-[14px] text-[var(--color-text-tertiary)] opacity-60">
                    Next
                    <IconChevronRight className="h-4 w-4" stroke={2} aria-hidden="true" />
                  </span>
                )}
              </nav>
            </section>

            {/* Stop work card */}
            <section
              aria-label={`Stop work for ${item.requester_name}`}
              className="overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-white shadow-sm"
            >
              <div className="px-4 py-4 sm:px-5">
                <div className="flex gap-3">
                  {evidencePhoto ? (
                    <img
                      src={evidencePhoto.url}
                      alt="citizen evidence"
                      className="mt-0.5 hidden h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-black/5 sm:block"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
                        {item.reference}
                      </span>
                      {isCollected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold leading-none text-emerald-800 ring-1 ring-inset ring-emerald-200">
                          <IconCheck className="h-3.5 w-3.5" stroke={2.5} aria-hidden="true" />{' '}
                          Collected
                        </span>
                      ) : isMissed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold leading-none text-rose-800 ring-1 ring-inset ring-rose-200">
                          <IconX className="h-3.5 w-3.5" stroke={2.5} aria-hidden="true" /> Missed
                        </span>
                      ) : queued ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold leading-none ring-1 ring-inset ${queued.status === 'failed' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}`}
                        >
                          {queued.status === 'failed' ? (
                            <IconAlertTriangle
                              className="h-3.5 w-3.5"
                              stroke={2}
                              aria-hidden="true"
                            />
                          ) : (
                            <IconClock className="h-3.5 w-3.5" stroke={2} aria-hidden="true" />
                          )}{' '}
                          {queued.status === 'failed' ? 'Upload failed' : 'Pending upload'}
                        </span>
                      ) : (
                        <span className="sr-only">{statusLabel}</span>
                      )}
                      {itemFrozen && !isTerminal ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium leading-none text-amber-800 ring-1 ring-inset ring-amber-200">
                          <IconLock className="h-3.5 w-3.5" stroke={2} aria-hidden="true" /> Locked
                        </span>
                      ) : null}
                      {item.unavailable_reason ? (
                        <UnavailableBadge reason={item.unavailable_reason} />
                      ) : null}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <p className="text-[20px] font-bold leading-7 tracking-tight text-[var(--color-ink)]">
                        {item.requester_name}
                      </p>
                      {isNext ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                          Up next
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[14px] leading-6 text-[var(--color-text-secondary)]">
                      {item.pickup_address}
                    </p>

                    {evidencePhoto ? (
                      <figure className="mt-3 max-w-md">
                        <img
                          src={evidencePhoto.url}
                          alt="citizen evidence"
                          className="w-full rounded-lg object-cover ring-1 ring-black/5"
                          loading="lazy"
                        />
                        <figcaption className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          Evidence
                        </figcaption>
                      </figure>
                    ) : null}

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </span>
                      <span className="text-[var(--color-border-strong)]" aria-hidden="true">
                        ·
                      </span>
                      {isCollected && item.actual_bags !== null ? (
                        <span className="inline-flex flex-wrap items-center gap-1.5 text-[13px] leading-5">
                          <span className="text-[var(--color-text-secondary)]">
                            est. {formatVolume(item.estimated_bags, item.estimated_weight_kg)}
                          </span>
                          <span className="text-[var(--color-border-strong)]" aria-hidden="true">
                            →
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-ink)]">
                            <IconCheck
                              className="h-3.5 w-3.5 text-[var(--color-success)]"
                              stroke={2.5}
                              aria-hidden="true"
                            />
                            {formatVolume(item.actual_bags, item.actual_weight_kg)}
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
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium leading-5 text-rose-700">
                          <IconX className="h-4 w-4 shrink-0" stroke={2} aria-hidden="true" />
                          {item.missed_pickup_reason
                            ? `Missed · ${item.missed_pickup_reason}`
                            : 'Missed'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-1.5 text-[13px] font-semibold leading-none text-[var(--color-ink)]">
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-amber-500"
                            aria-hidden="true"
                          />
                          est. {formatVolume(item.estimated_bags, item.estimated_weight_kg)}
                        </span>
                      )}
                    </div>

                    <RescheduleDetail item={item} />
                    {item.readiness_instructions ? (
                      <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-800">
                        <IconAlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0"
                          stroke={1.75}
                          aria-hidden="true"
                        />
                        <span>{item.readiness_instructions}</span>
                      </p>
                    ) : null}

                    {!isTerminal ? (
                      <>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            aria-label="Record this stop"
                            disabled={outcome.isPending}
                            onClick={() => setRecordOpen((v) => !v)}
                            className={BTN.primary}
                          >
                            <IconCamera className="h-4 w-4" stroke={1.75} aria-hidden="true" />
                            {recordOpen ? 'Close' : 'Record collection'}
                          </button>
                          <a href={telHref(item.contact_phone)} className={BTN.call}>
                            <IconPhone
                              className="h-4 w-4 text-emerald-700"
                              stroke={1.75}
                              aria-hidden="true"
                            />{' '}
                            Call
                          </a>
                          <a
                            href={mapsHref(item.pickup_address)}
                            target="_blank"
                            rel="noreferrer"
                            className={BTN.navigate}
                          >
                            <IconNavigation
                              className="h-4 w-4 text-sky-700"
                              stroke={1.75}
                              aria-hidden="true"
                            />{' '}
                            Navigate
                          </a>
                          <span className="hidden flex-wrap gap-2 sm:flex">
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
                          </span>
                        </div>
                        <details className="mt-2 sm:hidden">
                          <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-[var(--color-border)] bg-white px-4 text-[14px] font-medium hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1">
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
                      </>
                    ) : null}
                  </div>
                </div>

                {!isTerminal && recordOpen ? (
                  <div className="-mx-4 mt-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] px-4 py-3 sm:-mx-5 sm:px-5">
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
                ) : null}
              </div>
            </section>

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
