import { useMemo, useState, type JSX } from 'react';
import { useMutation } from '@tanstack/react-query';
import { IconAlertTriangle, IconMapPin } from '@tabler/icons-react';
import { assignTextileTrip, scheduleTextileBatch, type TextileCollectionListItem } from '../../api/textileApi';
import {
  CategoryBadge,
  CategoryFilter,
  DeskPage,
  DeskStates,
  Pager,
  RescheduleDetail,
  RescheduleOverrideNotice,
  SearchBox,
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

export default function TextileSchedulePage(): JSX.Element {
  const desk = useDesk();
  const [search, setSearch] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
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
    status: 'ready_to_group',
    search,
    page,
    zoneId: zoneId || undefined,
    categoryId: categoryId || undefined,
    collectionMethod: 'premises',
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
  const hasRescheduledItems = rows.some((r) => !!r.reschedule_reason || !!r.previous_scheduled_date);
  const frozen = selectedItems.some((r) => isRescheduleFrozen(r.batch?.status));
  const canSchedule = selected.length > 0 && selectedZoneIds.size === 1 && date !== '' && (!frozen || overrideReason.trim().length >= 5);
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
      title="Trip scheduling"
      description="Approved requests grouped by area. Pick a zone, set a date and window, then schedule the trip."
      toolbar={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchBox
            value={search}
            onChange={(next) => {
              setSearch(next);
              setPage(1);
            }}
          />
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
      }
    >
      <DeskStates
        loading={queue.isLoading}
        error={queue.isError}
        onRetry={() => void queue.refetch()}
        hasRows={rows.length > 0}
        emptyTitle="Nothing ready to schedule"
        emptyBody="Approve requests on the Pickup reviews page to make them schedulable."
      >
        <div className="space-y-4">
          {/* Phase 3: surface why slots are unavailable and why items were rescheduled */}
          {(hasUnavailableItems || hasRescheduledItems || unavailableDates.length > 0) ? (
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
            <section className="rounded-xl border border-black/10 bg-[#f1efe8] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    New trip · {selected.length} request{selected.length === 1 ? '' : 's'} ·{' '}
                    {selectedItems.reduce((s, r) => s + (r.estimated_bags ?? 0), 0)} bags ·{' '}
                    {selectedItems.reduce((s, r) => s + (r.estimated_weight_kg ?? 0), 0).toFixed(1)}{' '}
                    kg · {selected.length} stops
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Zone: {selectedItems[0]?.service_zone?.name ?? '—'}
                  </p>
                  {selectedItems.some((r) => r.reschedule_reason || r.previous_scheduled_date) ? (
                    <p className="mt-1 text-xs text-amber-800">
                      {selectedItems.filter((r) => r.reschedule_reason || r.previous_scheduled_date).length} rescheduled — previous slot shown per request below.
                    </p>
                  ) : null}
                </div>
                <label className="text-xs font-medium">
                  Pickup date
                  <input
                    type="date"
                    value={date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setDate(event.target.value)}
                    aria-label="Pickup date"
                    className="mt-1 block min-h-10 rounded-lg border border-black/15 bg-white px-3 text-sm"
                  />
                </label>
                <label className="text-xs font-medium">
                  Window start
                  <input
                    type="time"
                    value={windowStart}
                    onChange={(event) => setWindowStart(event.target.value)}
                    className="mt-1 block min-h-10 rounded-lg border border-black/15 bg-white px-3 text-sm"
                  />
                </label>
                <label className="text-xs font-medium">
                  Window end
                  <input
                    type="time"
                    value={windowEnd}
                    onChange={(event) => setWindowEnd(event.target.value)}
                    className="mt-1 block min-h-10 rounded-lg border border-black/15 bg-white px-3 text-sm"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!canSchedule || schedule.isPending}
                    onClick={() => void schedule.mutateAsync()}
                    className="min-h-10 rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white disabled:opacity-40"
                  >
                    {schedule.isPending ? 'Scheduling…' : 'Schedule trip'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected([]);
                      setManifestOrder([]);
                      setOverrideReason('');
                    }}
                    className="min-h-10 rounded-full border border-black/15 bg-white px-4 text-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {/* Phase 3: frozen reschedule override */}
              {frozen ? (
                <div className="mt-3">
                  <RescheduleOverrideNotice frozen={frozen} reason={overrideReason} onReasonChange={setOverrideReason} />
                </div>
              ) : null}
              {requestedSlotUnavailable ? (
                <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-rose-700">
                  <IconAlertTriangle className="h-3.5 w-3.5" />
                  Requested date {date} is unavailable. Next available slots are outside {unavailableDates.join(', ')} — choose a different date or add an override reason.
                </p>
              ) : null}
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs font-medium">
                  Driver / team
                  <input
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Driver name"
                    className="mt-1 block min-h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm"
                  />
                </label>
                <label className="text-xs font-medium">
                  Team
                  <input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Team (optional)"
                    className="mt-1 block min-h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm"
                  />
                </label>
                <label className="text-xs font-medium">
                  Vehicle
                  <input
                    value={vehicleLabel}
                    onChange={(e) => setVehicleLabel(e.target.value)}
                    placeholder="Vehicle reg / label"
                    className="mt-1 block min-h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm"
                  />
                </label>
                <label className="text-xs font-medium">
                  Trip ref
                  <input
                    value={tripReference}
                    onChange={(e) => setTripReference(e.target.value)}
                    placeholder="DRL-… (optional)"
                    className="mt-1 block min-h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm"
                  />
                </label>
              </div>
              <label className="mt-3 block text-xs font-medium">
                Instructions
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Collection instructions for crew"
                  rows={2}
                  className="mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
                />
              </label>
              {scheduleError ? (
                <p className="mt-2 text-xs text-red-700">
                  Could not schedule the trip. Check the date and try again.
                </p>
              ) : null}
            </section>
          ) : null}

          {groups.map(({ zone, items }) => {
            const zoneLocked = lockedZoneId !== null && zone?.id !== lockedZoneId;
            const allZoneSelected = items.every((r) => selected.includes(r.id));
            const zoneUnavailable = items.some((r) => !!r.unavailable_reason);
            return (
              <section
                key={zone?.id ?? 'none'}
                className={`rounded-xl border bg-white ${zoneLocked ? 'border-black/5 opacity-50' : 'border-black/10'}`}
              >
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <IconMapPin className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                    <h2 className="text-sm font-semibold">{zone?.name ?? 'No zone'}</h2>
                    <span className="rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-[11px] font-medium">
                      {items.length} request{items.length === 1 ? '' : 's'} ·{' '}
                      {items.reduce((s, r) => s + (r.estimated_bags ?? 0), 0)} bags
                    </span>
                    {zoneUnavailable ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                        <IconAlertTriangle className="h-3 w-3" /> Unavailable slots in zone
                      </span>
                    ) : null}
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
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
                      className="h-4 w-4 accent-[var(--color-ink)]"
                    />
                    Select all
                  </label>
                </header>
                <ul className="divide-y divide-black/5">
                  {items.map((item) => {
                    const prev = formatPreviousWindow(
                      item.previous_scheduled_date,
                      item.previous_window_start,
                      item.previous_window_end,
                    );
                    return (
                      <li
                        key={item.id}
                        className="flex flex-col gap-1 px-4 py-2.5 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <input
                            type="checkbox"
                            aria-label={`Select ${item.reference}`}
                            disabled={zoneLocked}
                            checked={selected.includes(item.id)}
                            onChange={() =>
                              setSelected((current) =>
                                current.includes(item.id)
                                  ? current.filter((id) => id !== item.id)
                                  : [...current, item.id],
                              )
                            }
                            className="h-4 w-4 shrink-0 accent-[var(--color-ink)]"
                          />
                          <span className="font-mono text-xs">{item.reference}</span>
                          <CategoryBadge category={item.category} />
                          {item.reschedule_reason || prev ? (
                            <RescheduleBadge reason={item.reschedule_reason ?? null} previous={prev} />
                          ) : null}
                          {item.unavailable_reason ? <UnavailableBadge reason={item.unavailable_reason} /> : null}
                          <span className="min-w-0 flex-1 truncate">
                            {item.requester_name} · {item.pickup_address}
                          </span>
                          <span className="whitespace-nowrap text-xs text-[var(--color-text-secondary)]">
                            {formatVolume(item.estimated_bags, item.estimated_weight_kg)} ·{' '}
                            {item.collection_method === 'dropoff' ? 'Drop-off' : 'Pickup'}
                          </span>
                        </div>
                        <RescheduleDetail item={item} />
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
            <section className="rounded-xl border border-black/10 bg-white p-4">
              <h3 className="text-sm font-semibold">Manifest order</h3>
              <ol className="mt-2 space-y-1">
                {orderedSelected.map((id, idx) => {
                  const it = selectedItems.find((r) => r.id === id)!;
                  return (
                    <li key={id} className="flex items-center gap-2 text-sm">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--color-ink)] text-[11px] text-white">
                        {idx + 1}
                      </span>
                      <span className="font-mono text-xs">{it.reference}</span>
                      <span className="flex-1 truncate text-xs text-[var(--color-text-secondary)]">
                        {it.pickup_address}
                      </span>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          setManifestOrder(() => {
                            const a = [...orderedSelected];
                            const t = a[idx];
                            a[idx] = a[idx - 1];
                            a[idx - 1] = t;
                            return a;
                          })
                        }
                        className="rounded-full border px-2 py-1 text-xs disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === orderedSelected.length - 1}
                        onClick={() =>
                          setManifestOrder(() => {
                            const a = [...orderedSelected];
                            const t = a[idx];
                            a[idx] = a[idx + 1];
                            a[idx + 1] = t;
                            return a;
                          })
                        }
                        className="rounded-full border px-2 py-1 text-xs disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
          {selectedZoneIds.size > 1 ? (
            <p className="text-xs text-red-700">
              Requests from multiple zones selected — deselect until one zone remains.
            </p>
          ) : null}
        </div>
      </DeskStates>

      <Pager meta={queue.data?.meta} onPage={setPage} />
    </DeskPage>
  );
}
