import { useMemo, useState, type JSX } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconCalendarPlus,
  IconClock,
  IconMapPin,
  IconPackage,
  IconRoute,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import {
  assignTextileTrip,
  fetchCapacityRules,
  scheduleTextileBatch,
  type TextileCapacityEvaluation,
  type TextileCapacityRule,
  type TextileCollectionListItem,
} from '../../api/textileApi';
import { CapacityWarningBanner } from '../../components/CapacityWarningBanner';
import { SuggestedStopsHint } from '../../components/SuggestedStopsHint';
import {
  CategoryBadge,
  CategoryFilter,
  DeskPage,
  DeskStates,
  Pager,
  RescheduleDetail,
  RescheduleOverrideNotice,
  SearchBox,
  StatusBadge,
  UnavailableBanner,
  UnavailableBadge,
  RescheduleBadge,
  formatPreviousWindow,
  isRescheduleFrozen,
  useDesk,
  useTextileQueue,
  ZoneFilter,
  formatVolume,
} from './shared';

// Quick pickup windows (24h values for the API). Tapping a chip fills both time
// fields; the native time inputs below stay as the custom override.
const WINDOW_PRESETS = [
  { label: '09:00–12:00', start: '09:00', end: '12:00' },
  { label: '12:00–15:00', start: '12:00', end: '15:00' },
  { label: '15:00–18:00', start: '15:00', end: '18:00' },
] as const;

// Shared field input — single source for date/time + driver/team/vehicle/ref/instructions
// (rounded-lg per spec, token border, focus ring). Keeps ops desk consistent.
const FIELD_INPUT =
  'mt-1 block min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 focus-visible:border-[var(--color-border-strong)]';
const FIELD_TEXTAREA =
  'mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 focus-visible:border-[var(--color-border-strong)]';

function buildProspectiveEvaluation(
  items: TextileCollectionListItem[],
  rule: TextileCapacityRule | null,
): TextileCapacityEvaluation {
  const totalBags = items.reduce((s, r) => s + (r.estimated_bags ?? 0), 0);
  const totalWeight = items.reduce((s, r) => s + (r.estimated_weight_kg ?? 0), 0);
  const stops = items.length;
  const categories = new Set(items.map((r) => r.category).filter(Boolean));

  const warnings: TextileCapacityEvaluation['warnings'] = [];
  const blockers: TextileCapacityEvaluation['blockers'] = [];

  if (rule) {
    if (rule.max_bags !== null && totalBags > rule.max_bags) {
      blockers.push({
        code: 'exceeds_max_bags',
        message: `Trip has ${totalBags} bags but zone limit is ${rule.max_bags} bags for this day. Remove stops or split the trip.`,
      });
    } else if (rule.max_bags !== null && totalBags >= Math.ceil(rule.max_bags * 0.85)) {
      warnings.push({
        code: 'near_max_bags',
        message: `Trip has ${totalBags} bags — near the zone limit of ${rule.max_bags} bags (${Math.round((totalBags / rule.max_bags) * 100)}% of capacity).`,
        severity: 'amber',
      });
    }

    if (rule.max_weight_kg !== null && totalWeight > rule.max_weight_kg) {
      blockers.push({
        code: 'exceeds_max_weight',
        message: `Trip weight ${totalWeight.toFixed(1)} kg exceeds zone limit ${rule.max_weight_kg} kg. Adjust the load or split the trip.`,
      });
    } else if (rule.max_weight_kg !== null && totalWeight >= rule.max_weight_kg * 0.85) {
      warnings.push({
        code: 'near_max_weight',
        message: `Trip weight ${totalWeight.toFixed(1)} kg is near the zone limit ${rule.max_weight_kg} kg.`,
        severity: 'amber',
      });
    }

    if (rule.max_stops !== null && stops > rule.max_stops) {
      blockers.push({
        code: 'exceeds_max_stops',
        message: `Trip has ${stops} stops but limit is ${rule.max_stops}. Split the trip.`,
      });
    }

    if (Array.isArray(rule.category_allowlist) && rule.category_allowlist.length > 0) {
      const allowed = rule.category_allowlist.filter((c): c is string => typeof c === 'string');
      const incompatible = [...categories].filter((cat) => !allowed.includes(cat));
      if (incompatible.length > 0) {
        blockers.push({
          code: 'incompatible_category',
          message: `Trip mixes categories not allowed together for this zone: ${incompatible.join(', ')}. Review vehicle/material requirements.`,
        });
      }
    }

    const hasBagEstimate = items.some((item) => item.estimated_bags !== null);
    const hasWeightEstimate = items.some((item) => item.estimated_weight_kg !== null);
    const minimumChecks = [
      rule.min_bags !== null && hasBagEstimate ? totalBags >= rule.min_bags : null,
      rule.min_weight_kg !== null && hasWeightEstimate ? totalWeight >= rule.min_weight_kg : null,
    ].filter((check): check is boolean => check !== null);
    if (minimumChecks.length > 0 && !minimumChecks.some(Boolean)) {
      const parts: string[] = [];
      if (rule.min_bags !== null && hasBagEstimate)
        parts.push(`${totalBags} bags below minimum ${rule.min_bags}`);
      if (rule.min_weight_kg !== null && hasWeightEstimate)
        parts.push(`${totalWeight.toFixed(1)} kg below minimum ${rule.min_weight_kg} kg`);
      const guidance = rule.guidance_text ? ` ${rule.guidance_text}` : '';
      blockers.push({
        code: 'below_minimum',
        message: `Trip is ${parts.join(' and ')}.${guidance}`,
      });
    }
  }

  return {
    ok: blockers.length === 0,
    warnings,
    blockers,
    totals: { bags: totalBags, weight_kg: Number(totalWeight.toFixed(2)), stops },
    effective_rule: rule
      ? {
          id: rule.id,
          max_bags: rule.max_bags,
          max_weight_kg: rule.max_weight_kg,
          max_stops: rule.max_stops,
          min_bags: rule.min_bags,
          min_weight_kg: rule.min_weight_kg,
          guidance_text: rule.guidance_text,
          category_allowlist: rule.category_allowlist,
        }
      : null,
    suggested_order: [],
  };
}

export default function TextileSchedulePage(): JSX.Element {
  const desk = useDesk();
  const [search, setSearch] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [selected, setSelected] = useState<string[]>([]);
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
    // Backend scheduleBatch accepts ready_to_group + missed — keep missed
    // bookings in the queue so they can be re-tripped from here.
    status: 'ready_to_group,missed',
    search,
    page,
    zoneId: zoneId || undefined,
    categoryId: categoryId || undefined,
    collectionMethod: 'premises',
    perPage,
    autoRefresh: selected.length === 0,
    enabled: desk.ready && desk.isDrLinen,
    departmentId: desk.departmentId,
  });
  const allRows = queue.data?.data ?? [];
  // Hide drop-off rows that leak through without backend method filter; show note
  const rows = allRows.filter((r) => r.collection_method !== 'dropoff');
  const hiddenDropoffCount = allRows.length - rows.length;
  const [manifestOrder, setManifestOrder] = useState<string[]>([]);

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { zone: TextileCollectionListItem['service_zone']; items: TextileCollectionListItem[] }
    >();
    for (const row of rows) {
      const key = row.service_zone?.id ?? 'none';
      const entry = map.get(key) ?? { zone: row.service_zone, items: [] };
      entry.items.push(row);
      map.set(key, entry);
    }
    return [...map.values()];
  }, [rows]);
  const orderedSelected = manifestOrder
    .filter((id) => selected.includes(id))
    .concat(selected.filter((id) => !manifestOrder.includes(id)));

  const selectedItems = rows.filter((r) => selected.includes(r.id));
  const selectedZoneIds = new Set(selectedItems.map((r) => r.service_zone?.id).filter(Boolean));
  const lockedZoneId = selectedZoneIds.size === 1 ? ([...selectedZoneIds][0] ?? null) : null;

  const capacityRulesQuery = useQuery({
    queryKey: ['textile', 'capacity-rules', desk.departmentId],
    queryFn: () => fetchCapacityRules(desk.departmentId),
    enabled: desk.ready && desk.isDrLinen && selected.length > 0 && !!lockedZoneId,
    staleTime: 60_000,
  });

  const prospectiveEvaluation = useMemo(() => {
    if (!lockedZoneId || selectedItems.length === 0) return null;
    if (capacityRulesQuery.isLoading || capacityRulesQuery.isError) return null;
    const rules = capacityRulesQuery.data ?? [];
    // Effective rule: match zone; backend picks most recent covering date/day. Approximate with most recent updated rule for zone.
    const ruleForZone =
      rules
        .filter((r) => r.service_zone_id === lockedZoneId)
        .sort((a, b) => {
          const ta = a.service_zone?.name ?? '';
          const tb = b.service_zone?.name ?? '';
          return tb.localeCompare(ta);
        })[0] ?? null;
    // Prefer the first matching rule; if multiple, the backend would pick last updated_at desc, we approximate by first.
    // If no rule for zone, treat as no limits.
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
    // Suggest ordering by proximity heuristic: sort by pickup_address alphabetically as stable deterministic suggestion.
    // This mirrors the backend's distance-based suggestion fallback (no geo) which sorts by bags; we use address for readability.
    return [...selectedItems]
      .sort((a, b) => a.pickup_address.localeCompare(b.pickup_address))
      .map((r) => r.id);
  }, [selectedItems]);

  const showSuggestedHint = selected.length >= 2 && suggestedOrderForSelection.length > 1;

  // Phase 3: derive unavailable/rescheduled signals from scheduled queue + missed buffer
  const unavailableDates = useMemo(() => {
    const dates = new Set<string>();
    for (const r of rows) {
      if (r.unavailable_until) dates.add(r.unavailable_until);
      if (r.unavailable_reason && r.scheduled_date) dates.add(r.scheduled_date);
    }
    return [...dates].sort();
  }, [rows]);
  const hasUnavailableItems = rows.some((r) => !!r.unavailable_reason);
  const hasRescheduledItems = rows.some(
    (r) => !!r.reschedule_reason || !!r.previous_scheduled_date,
  );
  const frozen = selectedItems.some((r) => isRescheduleFrozen(r.batch?.status));
  const hasCapacityBlockers = (prospectiveEvaluation?.blockers.length ?? 0) > 0;
  const hasCapacityWarnings = (prospectiveEvaluation?.warnings.length ?? 0) > 0;
  const canSchedule =
    selected.length > 0 &&
    selectedZoneIds.size === 1 &&
    date !== '' &&
    (!frozen || overrideReason.trim().length >= 5) &&
    !hasCapacityBlockers;
  const canScheduleDespiteWarnings =
    selected.length > 0 &&
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
        collection_request_ids: orderedSelected.length ? orderedSelected : selected,
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
      setSelected([]);
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
      void queue.refetch();
    },
    onError: () => setScheduleError(true),
  });

  return (
    <DeskPage
      desk={desk}
      title={
        <>
          <span>Trip scheduling</span>
          {queue.data?.meta?.total !== undefined ? (
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800 border border-blue-200">
              {queue.data.meta.total} to schedule
            </span>
          ) : null}
        </>
      }
      description="Approved and missed requests grouped by area. Pick a zone, set a date and window, then schedule the trip."
      toolbar={
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-white px-2.5 py-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1">
            <SearchBox
              value={search}
              onChange={(next) => {
                setSearch(next);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <ZoneFilter
              value={zoneId}
              onChange={(next) => {
                setZoneId(next);
                setPage(1);
              }}
            />
            <CategoryFilter
              value={categoryId}
              onChange={(next) => {
                setCategoryId(next);
                setPage(1);
              }}
            />
          </div>
        </div>
      }
    >
      <DeskStates
        loading={queue.isLoading}
        error={queue.isError}
        onRetry={() => void queue.refetch()}
        hasRows={rows.length > 0}
        emptyTitle="Nothing ready to schedule"
        emptyBody="Approve requests on the Pickup reviews page to make them schedulable. Missed pickups return here for re-attempt."
      >
        <div className="space-y-4">
          {/* Phase 3: surface why slots are unavailable and why items were rescheduled */}
          {hasUnavailableItems || hasRescheduledItems || unavailableDates.length > 0 ? (
            <UnavailableBanner
              unavailableDates={unavailableDates}
              reason={
                hasUnavailableItems
                  ? 'Some requests show why their previous slot became unavailable — see badges below.'
                  : hasRescheduledItems
                    ? 'Rescheduled requests show previous date and reason inline.'
                    : null
              }
            />
          ) : null}

          {selected.length > 0 ? (
            <section
              aria-label="New trip"
              className="rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm"
            >
              <div className="flex max-w-3xl flex-col gap-4">
                {/* 1. Summary strip: badges row, zone line, notes directly under */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight text-[var(--color-ink)]">
                      <IconCalendarPlus
                        className="h-4 w-4 text-[var(--color-text-secondary)]"
                        stroke={1.75}
                        aria-hidden
                      />
                      New trip
                    </h2>
                    <span className="rounded-full bg-[var(--color-ink)] px-2 py-0.5 text-[11px] font-semibold text-white">
                      {selected.length} request{selected.length === 1 ? '' : 's'}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-ink)]">
                      <IconPackage className="h-3 w-3" stroke={1.75} aria-hidden />
                      {selectedItems.reduce((s, r) => s + (r.estimated_bags ?? 0), 0)} bags ·{' '}
                      {selectedItems
                        .reduce((s, r) => s + (r.estimated_weight_kg ?? 0), 0)
                        .toFixed(1)}{' '}
                      kg
                    </span>
                    <span className="rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                      {selected.length} stop{selected.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Zone: {selectedItems[0]?.service_zone?.name ?? '—'}
                    </p>
                    {selectedItems.some((r) => r.reschedule_reason || r.previous_scheduled_date) ? (
                      <p className="text-xs text-amber-800">
                        {
                          selectedItems.filter(
                            (r) => r.reschedule_reason || r.previous_scheduled_date,
                          ).length
                        }{' '}
                        rescheduled — previous slot shown per request below.
                      </p>
                    ) : null}
                    {selectedItems.some((r) => r.status === 'missed') ? (
                      <p className="text-xs text-orange-800">
                        {selectedItems.filter((r) => r.status === 'missed').length} missed —
                        re-attempt on the new date and window below.
                      </p>
                    ) : null}
                  </div>
                </div>
                {/* 2. Date & window: joined date control, chips directly under, start/end side by side */}
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="min-w-0">
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
                  <div className="min-w-0">
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
                  <div className="grid gap-3 sm:grid-cols-2">
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
                  <p className="text-[11px] text-[var(--color-text-tertiary)]">
                    Tap a preset or set a custom window.
                  </p>
                </div>

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
                      Scheduling is blocked by capacity limits above. Reduce the load before
                      confirming.
                    </p>
                  ) : canScheduleDespiteWarnings ? (
                    <p role="status" className="text-xs text-[var(--color-warning)]">
                      Warnings above require review, but you may still schedule.
                    </p>
                  ) : null}
                  {showSuggestedHint ? (
                    <SuggestedStopsHint
                      suggestedOrder={suggestedOrderForSelection}
                      currentOrder={orderedSelected.length ? orderedSelected : selected}
                      items={selectedItems}
                      note="Suggested grouping keeps the same zone together; ordering sorts by address to shorten driving. Apply and then confirm the manifest order."
                      onApply={() => setManifestOrder(suggestedOrderForSelection)}
                    />
                  ) : null}
                </div>

                {/* Phase 3: frozen reschedule override */}
                {frozen ? (
                  <div>
                    <RescheduleOverrideNotice
                      frozen={frozen}
                      reason={overrideReason}
                      onReasonChange={setOverrideReason}
                    />
                  </div>
                ) : null}
                {requestedSlotUnavailable ? (
                  <p
                    role="alert"
                    className="flex items-center gap-1.5 text-xs text-[var(--color-danger)]"
                  >
                    <IconAlertTriangle className="h-3.5 w-3.5" />
                    Requested date {date} is unavailable. Next available slots are outside{' '}
                    {unavailableDates.join(', ')} — choose a different date or add an override
                    reason.
                  </p>
                ) : null}
                {/* 3. Crew & vehicle: compact 2-col grid, no full-width stretching */}
                <div className="grid gap-3 sm:grid-cols-2">
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
                {/* 4. Instructions full width, then left-aligned action row */}
                <label className="block min-w-0 text-xs font-medium">
                  Instructions
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Collection instructions for crew"
                    rows={2}
                    className={FIELD_TEXTAREA}
                  />
                </label>
                {scheduleError ? (
                  <p role="alert" className="text-xs text-red-700">
                    Could not schedule the trip. Check the date and try again.
                  </p>
                ) : null}
                <div className="flex flex-wrap justify-start gap-2">
                  <button
                    type="button"
                    disabled={!canSchedule || schedule.isPending}
                    onClick={() => void schedule.mutateAsync()}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2 disabled:opacity-40"
                  >
                    <IconCalendarPlus className="h-4 w-4" stroke={1.75} aria-hidden />
                    {schedule.isPending ? 'Scheduling…' : 'Schedule trip'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected([]);
                      setManifestOrder([]);
                      setOverrideReason('');
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white px-4 text-sm font-medium hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                  >
                    <IconX className="h-4 w-4" aria-hidden />
                    Clear
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {groups.map(({ zone, items }) => {
            const zoneLocked = lockedZoneId !== null && zone?.id !== lockedZoneId;
            const allZoneSelected = items.every((r) => selected.includes(r.id));
            const zoneUnavailable = items.some((r) => !!r.unavailable_reason);
            const zoneBags = items.reduce((s, r) => s + (r.estimated_bags ?? 0), 0);
            const zoneWeight = items.reduce((s, r) => s + (r.estimated_weight_kg ?? 0), 0);
            const selectedInZone = items.filter((r) => selected.includes(r.id)).length;
            return (
              <section
                key={zone?.id ?? 'none'}
                aria-label={zone?.name ?? 'No zone'}
                className={`overflow-hidden rounded-xl border bg-white shadow-sm ${zoneLocked ? 'border-[var(--color-border-subtle)] opacity-60' : 'border-[var(--color-border-subtle)]'}`}
              >
                <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <IconMapPin
                      className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]"
                      stroke={1.75}
                      aria-hidden
                    />
                    <h2 className="text-sm font-semibold tracking-tight text-[var(--color-ink)]">
                      {zone?.name ?? 'No zone'}
                    </h2>
                    <span className="rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                      {items.length} request{items.length === 1 ? '' : 's'} · {zoneBags} bags
                      {zoneWeight > 0 ? ` · ${zoneWeight.toFixed(1)} kg` : ''}
                    </span>
                    {selectedInZone > 0 ? (
                      <span className="rounded-full bg-[var(--color-ink)] px-2 py-0.5 text-[11px] font-semibold text-white">
                        {selectedInZone} selected
                      </span>
                    ) : null}
                    {zoneLocked ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        Locked — finish the current zone first
                      </span>
                    ) : null}
                    {zoneUnavailable ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                        <IconAlertTriangle className="h-3 w-3" aria-hidden /> Unavailable slots in
                        zone
                      </span>
                    ) : null}
                  </div>
                  <label className="flex min-h-11 items-center gap-2 rounded-full px-1 text-xs font-medium text-[var(--color-text-secondary)] focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--color-ink)] focus-within:ring-offset-1">
                    <input
                      type="checkbox"
                      aria-label={`Select all in ${zone?.name ?? 'zone'}`}
                      disabled={zoneLocked}
                      checked={allZoneSelected}
                      onChange={(event) =>
                        setSelected((current) => {
                          const ids = items.map((r) => r.id);
                          return event.target.checked
                            ? [...new Set([...current, ...ids])]
                            : current.filter((id) => !ids.includes(id));
                        })
                      }
                      className="h-5 w-5 rounded accent-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                    />
                    Select all
                  </label>
                </header>
                <ul className="divide-y divide-[var(--color-border-subtle)]">
                  {items.map((item) => {
                    const prev = formatPreviousWindow(
                      item.previous_scheduled_date,
                      item.previous_window_start,
                      item.previous_window_end,
                    );
                    const isSelected = selected.includes(item.id);
                    return (
                      <li
                        key={item.id}
                        className={`px-4 py-3 text-sm sm:px-5 ${isSelected ? 'bg-[var(--color-info)]/[0.06]' : 'bg-white'} hover:bg-[var(--color-surface-alt)]/60`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${item.reference}`}
                            disabled={zoneLocked}
                            checked={isSelected}
                            onChange={() =>
                              setSelected((current) =>
                                current.includes(item.id)
                                  ? current.filter((id) => id !== item.id)
                                  : [...current, item.id],
                              )
                            }
                            className="mt-1 h-5 w-5 shrink-0 rounded accent-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                              <span className="font-mono text-xs font-semibold tracking-wide text-[var(--color-ink)]">
                                {item.reference}
                              </span>
                              <StatusBadge status={item.status} />
                              {item.status === 'missed' ? (
                                <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-medium text-orange-800">
                                  Re-attempt
                                </span>
                              ) : null}
                              <CategoryBadge category={item.category} />
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-ink)]">
                                <IconPackage
                                  className="h-3 w-3 text-[var(--color-text-secondary)]"
                                  stroke={1.75}
                                  aria-hidden
                                />
                                {formatVolume(item.estimated_bags, item.estimated_weight_kg)}
                              </span>
                              {item.reschedule_reason || prev ? (
                                <RescheduleBadge
                                  reason={item.reschedule_reason ?? null}
                                  previous={prev}
                                />
                              ) : null}
                              {item.unavailable_reason ? (
                                <UnavailableBadge reason={item.unavailable_reason} />
                              ) : null}
                            </div>
                            <p className="mt-1.5 flex items-center gap-1.5 text-[15px] font-semibold leading-5 tracking-tight text-[var(--color-ink)]">
                              <IconUser
                                className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]"
                                stroke={1.75}
                                aria-hidden
                              />
                              <span className="min-w-0 truncate">{item.requester_name}</span>
                            </p>
                            <p className="mt-0.5 flex items-start gap-1.5 text-[13px] leading-5 text-[var(--color-text-secondary)]">
                              <IconMapPin
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]"
                                stroke={1.75}
                                aria-hidden
                              />
                              <span className="min-w-0 break-words">{item.pickup_address}</span>
                            </p>
                            <RescheduleDetail item={item} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {hiddenDropoffCount > 0 ? (
            <p className="text-xs text-[var(--color-text-secondary)]">
              {hiddenDropoffCount} drop-off booking(s) hidden — use Centre receipt.
            </p>
          ) : null}
          {orderedSelected.length > 0 ? (
            <section
              aria-label="Manifest order"
              className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight text-[var(--color-ink)]">
                  <IconRoute
                    className="h-4 w-4 text-[var(--color-text-secondary)]"
                    stroke={1.75}
                    aria-hidden
                  />
                  Manifest order
                </h3>
                <span className="rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                  {orderedSelected.length} stop{orderedSelected.length === 1 ? '' : 's'}
                </span>
              </div>
              <ol className="mt-2 space-y-1">
                {orderedSelected.map((id, idx) => {
                  const it = selectedItems.find((r) => r.id === id)!;
                  return (
                    <li key={id} className="flex items-center gap-2 text-sm">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-[11px] font-semibold text-white">
                        {idx + 1}
                      </span>
                      <span className="font-mono text-xs font-medium">{it.reference}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-text-secondary)]">
                        {it.pickup_address}
                      </span>
                      <button
                        type="button"
                        disabled={idx === 0}
                        aria-label={`Move ${it.reference} up`}
                        onClick={() =>
                          setManifestOrder(() => {
                            const a = [...orderedSelected];
                            const t = a[idx];
                            a[idx] = a[idx - 1];
                            a[idx - 1] = t;
                            return a;
                          })
                        }
                        className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full border border-[var(--color-border)] bg-white px-2 py-1 text-xs hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 disabled:opacity-30"
                      >
                        <IconArrowUp className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        disabled={idx === orderedSelected.length - 1}
                        aria-label={`Move ${it.reference} down`}
                        onClick={() =>
                          setManifestOrder(() => {
                            const a = [...orderedSelected];
                            const t = a[idx];
                            a[idx] = a[idx + 1];
                            a[idx + 1] = t;
                            return a;
                          })
                        }
                        className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full border border-[var(--color-border)] bg-white px-2 py-1 text-xs hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 disabled:opacity-30"
                      >
                        <IconArrowDown className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
          {selectedZoneIds.size > 1 ? (
            <p
              role="alert"
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-danger)]"
            >
              <IconAlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Requests from multiple zones selected — deselect until one zone remains.
            </p>
          ) : null}
        </div>
      </DeskStates>

      <Pager
        meta={queue.data?.meta}
        onPage={setPage}
        perPage={perPage}
        onPerPageChange={(size) => {
          setPerPage(size);
          setPage(1);
        }}
      />
    </DeskPage>
  );
}
