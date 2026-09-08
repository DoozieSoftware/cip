import { useMemo, useState, type JSX } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowLeft,
  IconArrowUp,
  IconCalendarPlus,
  IconClock,
  IconX,
} from '@tabler/icons-react';
import { assignTextileTrip, fetchCapacityRules, scheduleTextileBatch } from '../../api/textileApi';
import { CapacityWarningBanner } from '../../components/CapacityWarningBanner';
import { SuggestedStopsHint } from '../../components/SuggestedStopsHint';
import {
  DeskPage,
  DeskStates,
  RescheduleOverrideNotice,
  formatVolume,
  isRescheduleFrozen,
  useDesk,
  useTextileQueue,
} from './shared';
import {
  FIELD_INPUT,
  FIELD_TEXTAREA,
  SCHEDULE_PATH,
  WINDOW_PRESETS,
  buildProspectiveEvaluation,
  readTripLocationState,
} from './scheduleTripUtils';

/**
 * Dedicated new-trip page (single-column flow). Receives the selected request
 * IDs + manifest order via router state from the Trips queue; deep-links land
 * on an empty state that links back to Trips.
 */
export default function TextileTripNewPage(): JSX.Element {
  const desk = useDesk();
  const location = useLocation();
  const navigate = useNavigate();
  const incoming = useMemo(() => readTripLocationState(location.state), [location.state]);

  const [stopIds, setStopIds] = useState<string[]>(() => incoming?.selectedIds ?? []);
  const [manifestOrder, setManifestOrder] = useState<string[]>(() => incoming?.manifestOrder ?? []);
  const [date, setDate] = useState('');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [scheduleError, setScheduleError] = useState(false);
  const [tripReference, setTripReference] = useState('');
  const [driverName, setDriverName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [vehicleLabel, setVehicleLabel] = useState('');
  const [instructions, setInstructions] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const queue = useTextileQueue({
    status: 'ready_to_group,missed',
    search: '',
    page: 1,
    collectionMethod: 'premises',
    perPage: 200,
    autoRefresh: false,
    enabled: desk.ready && desk.isDrLinen,
    departmentId: desk.departmentId,
  });
  const byId = useMemo(
    () => new Map((queue.data?.data ?? []).map((r) => [r.id, r])),
    [queue.data?.data],
  );
  const selectedItems = useMemo(
    () => stopIds.map((id) => byId.get(id)).filter((r) => r !== undefined),
    [stopIds, byId],
  );
  const missingCount = stopIds.length - selectedItems.length;
  const orderedSelected = useMemo(
    () =>
      manifestOrder
        .filter((id) => stopIds.includes(id))
        .concat(stopIds.filter((id) => !manifestOrder.includes(id))),
    [manifestOrder, stopIds],
  );

  const selectedZoneIds = new Set(selectedItems.map((r) => r.service_zone?.id).filter(Boolean));
  const lockedZoneId = selectedZoneIds.size === 1 ? ([...selectedZoneIds][0] ?? null) : null;

  const capacityRulesQuery = useQuery({
    queryKey: ['textile', 'capacity-rules', desk.departmentId],
    queryFn: () => fetchCapacityRules(desk.departmentId),
    enabled: desk.ready && desk.isDrLinen && selectedItems.length > 0 && !!lockedZoneId,
    staleTime: 60_000,
  });

  const prospectiveEvaluation = useMemo(() => {
    if (!lockedZoneId || selectedItems.length === 0) return null;
    if (capacityRulesQuery.isLoading || capacityRulesQuery.isError) return null;
    const rules = capacityRulesQuery.data ?? [];
    const ruleForZone =
      rules
        .filter((r) => r.service_zone_id === lockedZoneId)
        .sort((a, b) => {
          const ta = a.service_zone?.name ?? '';
          const tb = b.service_zone?.name ?? '';
          return tb.localeCompare(ta);
        })[0] ?? null;
    return buildProspectiveEvaluation(selectedItems, ruleForZone);
  }, [
    lockedZoneId,
    selectedItems,
    capacityRulesQuery.data,
    capacityRulesQuery.isLoading,
    capacityRulesQuery.isError,
  ]);

  const suggestedOrderForSelection = useMemo(() => {
    if (selectedItems.length < 2) return [];
    return [...selectedItems]
      .sort((a, b) => a.pickup_address.localeCompare(b.pickup_address))
      .map((r) => r.id);
  }, [selectedItems]);

  const showSuggestedHint = stopIds.length >= 2 && suggestedOrderForSelection.length > 1;

  const unavailableDates = useMemo(() => {
    const dates = new Set<string>();
    for (const r of selectedItems) {
      if (r.unavailable_until) dates.add(r.unavailable_until);
      if (r.unavailable_reason && r.scheduled_date) dates.add(r.scheduled_date);
    }
    return [...dates].sort();
  }, [selectedItems]);
  const frozen = selectedItems.some((r) => isRescheduleFrozen(r.batch?.status));
  const hasCapacityBlockers = (prospectiveEvaluation?.blockers.length ?? 0) > 0;
  const hasCapacityWarnings = (prospectiveEvaluation?.warnings.length ?? 0) > 0;
  const canSchedule =
    stopIds.length > 0 &&
    selectedItems.length > 0 &&
    selectedZoneIds.size === 1 &&
    date !== '' &&
    (!frozen || overrideReason.trim().length >= 5) &&
    !hasCapacityBlockers;
  const canScheduleDespiteWarnings =
    stopIds.length > 0 &&
    selectedZoneIds.size === 1 &&
    date !== '' &&
    hasCapacityWarnings &&
    !hasCapacityBlockers;
  const requestedSlotUnavailable = date !== '' && unavailableDates.includes(date);

  const schedule = useMutation({
    mutationFn: async () => {
      const batch = await scheduleTextileBatch({
        department_id: desk.departmentId,
        service_zone_id: lockedZoneId ?? '',
        collection_request_ids: orderedSelected.length ? orderedSelected : stopIds,
        collection_date: date,
        window_start: windowStart || undefined,
        window_end: windowEnd || undefined,
        trip_reference: tripReference || undefined,
        instructions: instructions || undefined,
      });
      if (driverName || teamName || vehicleLabel) {
        try {
          await assignTextileTrip(batch.id, {
            driver_name: driverName || undefined,
            team_name: teamName || undefined,
            vehicle_label: vehicleLabel || undefined,
            trip_reference: tripReference || undefined,
            instructions: instructions || undefined,
            stop_order: orderedSelected.length ? orderedSelected : undefined,
            department_id: desk.departmentId,
          });
        } catch {
          // assignment is best-effort frontend-only if backend not yet deployed; keep batch
        }
      }
      return batch;
    },
    onSuccess: () => {
      void navigate(SCHEDULE_PATH);
    },
    onError: () => setScheduleError(true),
  });

  function goBack(): void {
    void navigate(SCHEDULE_PATH, {
      state: { selectedIds: stopIds, manifestOrder: orderedSelected },
    });
  }

  function clearAll(): void {
    setStopIds([]);
    setManifestOrder([]);
    setDate('');
    setWindowStart('');
    setWindowEnd('');
    setTripReference('');
    setDriverName('');
    setTeamName('');
    setVehicleLabel('');
    setInstructions('');
    setOverrideReason('');
    setScheduleError(false);
  }

  function removeStop(id: string): void {
    setStopIds((current) => current.filter((stop) => stop !== id));
    setManifestOrder((current) => current.filter((stop) => stop !== id));
  }

  function moveStop(id: string, direction: -1 | 1): void {
    setManifestOrder(() => {
      const order = orderedSelected.length ? [...orderedSelected] : [...stopIds];
      const idx = order.indexOf(id);
      const next = idx + direction;
      if (idx < 0 || next < 0 || next >= order.length) return order;
      const t = order[idx];
      order[idx] = order[next];
      order[next] = t;
      return order;
    });
  }

  const totalBags = selectedItems.reduce((s, r) => s + (r.estimated_bags ?? 0), 0);
  const totalWeight = selectedItems.reduce((s, r) => s + (r.estimated_weight_kg ?? 0), 0);

  return (
    <DeskPage
      desk={desk}
      title="New trip"
      description="Confirm stops, set date and window, then schedule."
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back to Trips"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-4 text-[14px] font-medium text-[var(--color-ink)] shadow-sm transition-colors hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
          >
            <IconArrowLeft className="h-4 w-4" stroke={2} aria-hidden="true" />
            Back
          </button>
        </div>
      }
    >
      {stopIds.length === 0 ? (
        <section
          aria-label="No requests selected"
          className="mx-auto max-w-xl rounded-xl border border-[var(--color-border-subtle)] bg-white px-6 py-10 text-center shadow-sm"
        >
          <h2 className="text-base font-semibold tracking-tight text-[var(--color-ink)]">
            No requests selected
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Pick requests on the Trips page to start a new trip.
          </p>
          <Link
            to={SCHEDULE_PATH}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2"
          >
            <IconArrowLeft className="h-4 w-4" stroke={2} aria-hidden="true" />
            Back to Trips
          </Link>
        </section>
      ) : (
        <DeskStates
          loading={queue.isLoading}
          error={queue.isError}
          onRetry={() => void queue.refetch()}
          hasRows={selectedItems.length > 0}
          emptyTitle="Selected requests unavailable"
          emptyBody="They moved to another trip or left the queue. Pick requests again on the Trips page."
        >
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-24">
            {/* 1. Confirm stops */}
            <section
              aria-label="Confirm stops"
              className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-[var(--color-ink)]">
                  1. Confirm stops
                </h2>
                <span className="rounded-full bg-[var(--color-ink)] px-2 py-0.5 text-[11px] font-semibold text-white">
                  {stopIds.length} stop{stopIds.length === 1 ? '' : 's'}
                </span>
                <span className="rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-ink)]">
                  {totalBags} bags · {totalWeight.toFixed(1)} kg
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Zone: {selectedItems[0]?.service_zone?.name ?? '—'}
              </p>
              {missingCount > 0 ? (
                <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
                  {missingCount} selected request{missingCount === 1 ? '' : 's'} no longer in the
                  queue.
                </p>
              ) : null}
              {selectedZoneIds.size > 1 ? (
                <p
                  role="alert"
                  className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[var(--color-danger)]"
                >
                  <IconAlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Multiple zones selected — go back and keep one zone.
                </p>
              ) : null}
              <ol className="mt-2 space-y-1">
                {orderedSelected.map((id, idx) => {
                  const item = selectedItems.find((r) => r.id === id);
                  if (!item) return null;
                  return (
                    <li key={id} className="flex items-center gap-2 text-sm">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-[11px] font-semibold text-white">
                        {idx + 1}
                      </span>
                      <span className="font-mono text-xs font-medium">{item.reference}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-text-secondary)]">
                        {item.pickup_address} ·{' '}
                        {formatVolume(item.estimated_bags, item.estimated_weight_kg)}
                      </span>
                      <button
                        type="button"
                        disabled={idx === 0}
                        aria-label={`Move ${item.reference} up`}
                        onClick={() => moveStop(id, -1)}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-white px-2 py-1 text-xs hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 disabled:opacity-30"
                      >
                        <IconArrowUp className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        disabled={idx === orderedSelected.length - 1}
                        aria-label={`Move ${item.reference} down`}
                        onClick={() => moveStop(id, 1)}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-white px-2 py-1 text-xs hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 disabled:opacity-30"
                      >
                        <IconArrowDown className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${item.reference}`}
                        onClick={() => removeStop(id)}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-white px-2 py-1 text-xs hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                      >
                        <IconX className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>

            {/* 2. Date & window */}
            <section
              aria-label="Date and window"
              className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm"
            >
              <h2 className="text-sm font-semibold tracking-tight text-[var(--color-ink)]">
                2. Date &amp; window
              </h2>
              <div className="mt-2 min-w-0">
                <label
                  htmlFor="textile-trip-date"
                  className="text-xs font-medium text-[var(--color-ink)]"
                >
                  Pickup date
                </label>
                <div className="mt-1 flex max-w-md items-stretch">
                  <input
                    id="textile-trip-date"
                    type="date"
                    value={date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setDate(event.target.value)}
                    aria-label="Pickup date"
                    className="block min-h-11 w-full min-w-0 flex-1 rounded-l-lg rounded-r-none border border-[var(--color-border)] bg-white px-3 text-sm focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 focus-visible:border-[var(--color-border-strong)]"
                  />
                  <div role="group" aria-label="Quick date" className="flex shrink-0">
                    <button
                      type="button"
                      onClick={() => setDate(new Date().toISOString().slice(0, 10))}
                      className="-ml-px inline-flex min-h-11 shrink-0 items-center border border-[var(--color-border)] bg-white px-3 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-alt)] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        setDate(tomorrow.toISOString().slice(0, 10));
                      }}
                      className="-ml-px inline-flex min-h-11 shrink-0 items-center rounded-l-none rounded-r-lg border border-[var(--color-border)] bg-white px-3 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-alt)] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                    >
                      Tomorrow
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-3 min-w-0">
                <span
                  id="window-presets-label"
                  className="text-[11px] font-medium text-[var(--color-text-secondary)]"
                >
                  Quick windows
                </span>
                <div
                  role="group"
                  aria-labelledby="window-presets-label"
                  className="mt-2 flex flex-wrap justify-start gap-2"
                >
                  {WINDOW_PRESETS.map((preset) => {
                    const active = windowStart === preset.start && windowEnd === preset.end;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setWindowStart(preset.start);
                          setWindowEnd(preset.end);
                        }}
                        className={
                          active
                            ? 'inline-flex min-h-11 items-center rounded-full border border-transparent bg-[var(--color-ink)] px-3.5 text-xs font-medium text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1'
                            : 'inline-flex min-h-11 items-center rounded-full border border-[var(--color-border)] bg-white px-3.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1'
                        }
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block min-w-0 text-xs font-medium">
                  <span className="inline-flex items-center gap-1">
                    <IconClock
                      className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]"
                      aria-hidden
                    />
                    Window start
                  </span>
                  <input
                    type="time"
                    value={windowStart}
                    onChange={(event) => setWindowStart(event.target.value)}
                    aria-label="Window start"
                    className={FIELD_INPUT}
                  />
                </label>
                <label className="block min-w-0 text-xs font-medium">
                  <span className="inline-flex items-center gap-1">
                    <IconClock
                      className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]"
                      aria-hidden
                    />
                    Window end
                  </span>
                  <input
                    type="time"
                    value={windowEnd}
                    onChange={(event) => setWindowEnd(event.target.value)}
                    aria-label="Window end"
                    className={FIELD_INPUT}
                  />
                </label>
              </div>
            </section>

            {/* Capacity evaluation before partner confirms a batch */}
            <div className="space-y-3 empty:hidden">
              {capacityRulesQuery.isLoading ? (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-white px-4 py-3 text-xs text-[var(--color-text-secondary)]"
                >
                  Checking capacity…
                </div>
              ) : null}
              {capacityRulesQuery.isError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"
                >
                  Could not load capacity rules — trip checks are unavailable.{' '}
                  <button
                    type="button"
                    onClick={() => void capacityRulesQuery.refetch()}
                    className="ml-2 inline-flex min-h-7 items-center rounded-full border border-amber-300 bg-white px-3 text-[11px] font-medium text-amber-800 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-warning)] focus-visible:ring-offset-1"
                  >
                    Retry
                  </button>
                </div>
              ) : null}
              {prospectiveEvaluation ? (
                <CapacityWarningBanner evaluation={prospectiveEvaluation} />
              ) : null}
              {hasCapacityBlockers ? (
                <p
                  role="alert"
                  className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-danger)]"
                >
                  <IconAlertTriangle className="h-3.5 w-3.5" />
                  Scheduling is blocked by capacity limits above. Reduce the load before confirming.
                </p>
              ) : canScheduleDespiteWarnings ? (
                <p role="status" className="text-xs text-[var(--color-warning)]">
                  Warnings above require review, but you may still schedule.
                </p>
              ) : null}
              {showSuggestedHint ? (
                <SuggestedStopsHint
                  suggestedOrder={suggestedOrderForSelection}
                  currentOrder={orderedSelected.length ? orderedSelected : stopIds}
                  items={selectedItems}
                  note="Suggested grouping keeps the same zone together; ordering sorts by address to shorten driving. Apply and then confirm the manifest order."
                  onApply={() => setManifestOrder(suggestedOrderForSelection)}
                />
              ) : null}
            </div>

            {frozen ? (
              <RescheduleOverrideNotice
                frozen={frozen}
                reason={overrideReason}
                onReasonChange={setOverrideReason}
              />
            ) : null}
            {requestedSlotUnavailable ? (
              <p
                role="alert"
                className="flex items-center gap-1.5 text-xs text-[var(--color-danger)]"
              >
                <IconAlertTriangle className="h-3.5 w-3.5" />
                Requested date {date} is unavailable. Next available slots are outside{' '}
                {unavailableDates.join(', ')} — choose a different date or add an override reason.
              </p>
            ) : null}

            {/* 3. Crew & vehicle (secondary — collapsed) */}
            <details className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 shadow-sm">
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold tracking-tight text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1">
                3. Crew &amp; vehicle (optional)
              </summary>
              <div className="grid gap-3 py-2 sm:grid-cols-2">
                <label className="block min-w-0 text-xs font-medium">
                  Driver / team
                  <input
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Driver name"
                    className={FIELD_INPUT}
                  />
                </label>
                <label className="block min-w-0 text-xs font-medium">
                  Team
                  <input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Team (optional)"
                    className={FIELD_INPUT}
                  />
                </label>
                <label className="block min-w-0 text-xs font-medium">
                  Vehicle
                  <input
                    value={vehicleLabel}
                    onChange={(e) => setVehicleLabel(e.target.value)}
                    placeholder="Vehicle reg / label"
                    className={FIELD_INPUT}
                  />
                </label>
                <label className="block min-w-0 text-xs font-medium">
                  Trip ref
                  <input
                    value={tripReference}
                    onChange={(e) => setTripReference(e.target.value)}
                    placeholder="DRL-… (optional)"
                    className={FIELD_INPUT}
                  />
                </label>
              </div>
            </details>

            {/* 4. Instructions */}
            <section
              aria-label="Instructions"
              className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm"
            >
              <label className="block min-w-0 text-sm font-semibold tracking-tight text-[var(--color-ink)]">
                4. Instructions
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Collection instructions for crew"
                  rows={2}
                  className={FIELD_TEXTAREA}
                />
              </label>
            </section>

            {scheduleError ? (
              <p role="alert" className="text-xs text-red-700">
                Could not schedule the trip. Check the date and try again.
              </p>
            ) : null}
          </div>
        </DeskStates>
      )}

      {/* 5. Sticky action bar — one unmissable primary action */}
      {stopIds.length > 0 ? (
        <div className="sticky bottom-0 z-10 -mx-1 border-t border-[var(--color-border-subtle)] bg-white/95 px-3 py-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
            <button
              type="button"
              disabled={!canSchedule || schedule.isPending}
              onClick={() => void schedule.mutateAsync()}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2 disabled:opacity-40"
            >
              <IconCalendarPlus className="h-4 w-4" stroke={1.75} aria-hidden />
              {schedule.isPending ? 'Scheduling…' : 'Schedule trip'}
            </button>
            <button
              type="button"
              onClick={goBack}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-white px-4 text-sm font-medium hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
            >
              Back
            </button>
            <button
              type="button"
              onClick={clearAll}
              aria-label="Clear trip"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white px-4 text-sm font-medium hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
            >
              <IconX className="h-4 w-4" aria-hidden />
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </DeskPage>
  );
}
