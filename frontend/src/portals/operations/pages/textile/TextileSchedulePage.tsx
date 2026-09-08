import { useMemo, useState, type JSX } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  IconAlertTriangle,
  IconCalendarPlus,
  IconMapPin,
  IconPackage,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import {
  CategoryBadge,
  CategoryFilter,
  DeskPage,
  DeskStates,
  Pager,
  RescheduleDetail,
  SearchBox,
  StatusBadge,
  UnavailableBanner,
  UnavailableBadge,
  RescheduleBadge,
  formatPreviousWindow,
  useDesk,
  useTextileQueue,
  ZoneFilter,
  formatVolume,
} from './shared';
import { TRIP_NEW_PATH, readTripLocationState } from './scheduleTripUtils';

export default function TextileSchedulePage(): JSX.Element {
  const desk = useDesk();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  // Restored when returning from the new-trip page so the pick is not lost.
  const [selected, setSelected] = useState<string[]>(
    () => readTripLocationState(location.state)?.selectedIds ?? [],
  );

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

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { zone: (typeof rows)[number]['service_zone']; items: typeof rows }
    >();
    for (const row of rows) {
      const key = row.service_zone?.id ?? 'none';
      const entry = map.get(key) ?? { zone: row.service_zone, items: [] };
      entry.items.push(row);
      map.set(key, entry);
    }
    return [...map.values()];
  }, [rows]);

  const selectedItems = rows.filter((r) => selected.includes(r.id));
  const selectedZoneIds = new Set(selectedItems.map((r) => r.service_zone?.id).filter(Boolean));
  const lockedZoneId = selectedZoneIds.size === 1 ? ([...selectedZoneIds][0] ?? null) : null;
  const selectedBags = selectedItems.reduce((s, r) => s + (r.estimated_bags ?? 0), 0);

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
      description="Approved and missed requests grouped by area. Select requests, then continue to schedule the trip."
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[200px] flex-1 sm:max-w-xs">
            <SearchBox
              value={search}
              onChange={(next) => {
                setSearch(next);
                setPage(1);
              }}
            />
          </div>
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
        emptyBody="Approve requests on the Pickup reviews page to make them schedulable. Missed pickups return here for re-attempt."
      >
        <div className="space-y-4 pb-24">
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
                <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] px-3.5 py-2.5 sm:px-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <IconMapPin
                      className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]"
                      stroke={1.75}
                      aria-hidden
                    />
                    <h2 className="text-xs font-semibold tracking-tight text-[var(--color-ink)]">
                      {zone?.name ?? 'No zone'}
                    </h2>
                    <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                      {items.length} request{items.length === 1 ? '' : 's'} · {zoneBags} bags
                      {zoneWeight > 0 ? ` · ${zoneWeight.toFixed(1)} kg` : ''}
                    </span>
                    {selectedInZone > 0 ? (
                      <span className="rounded bg-[var(--color-ink)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {selectedInZone} selected
                      </span>
                    ) : null}
                    {zoneLocked ? (
                      <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                        Locked — finish the current zone first
                      </span>
                    ) : null}
                    {zoneUnavailable ? (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 border border-rose-200">
                        <IconAlertTriangle className="h-3 w-3" aria-hidden /> Unavailable slots
                      </span>
                    ) : null}
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] focus-within:outline-none focus-within:ring-1 focus-within:ring-[var(--color-ink)] rounded px-1">
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
                      className="h-4 w-4 rounded accent-[var(--color-ink)]"
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
                        className={`px-3.5 py-2.5 text-sm sm:px-4 transition-colors ${isSelected ? 'bg-[var(--color-info)]/[0.07]' : 'bg-white'} hover:bg-[var(--color-surface-alt)]/60`}
                      >
                        <div className="flex items-start gap-2.5">
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
                            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[var(--color-ink)]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                              <span className="font-mono text-xs font-semibold tracking-wide text-[var(--color-ink)]">
                                {item.reference}
                              </span>
                              <StatusBadge status={item.status} />
                              {item.status === 'missed' ? (
                                <span className="rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-800">
                                  Re-attempt
                                </span>
                              ) : null}
                              <CategoryBadge category={item.category} />
                              <span className="inline-flex items-center gap-1 rounded bg-[var(--color-surface-alt)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-ink)]">
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
                            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 text-xs">
                              <span className="flex items-center gap-1 font-medium text-[var(--color-ink)]">
                                <IconUser
                                  className="h-3 w-3 shrink-0 text-[var(--color-text-tertiary)]"
                                  stroke={1.75}
                                  aria-hidden
                                />
                                <span className="truncate max-w-[180px]">
                                  {item.requester_name}
                                </span>
                              </span>
                              <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
                                <IconMapPin
                                  className="h-3 w-3 shrink-0 text-[var(--color-text-tertiary)]"
                                  stroke={1.75}
                                  aria-hidden
                                />
                                <span className="truncate max-w-sm" title={item.pickup_address}>
                                  {item.pickup_address}
                                </span>
                              </span>
                            </div>
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

      {/* Sleek Floating Dock: Linear/Stripe style, zero layout shifting */}
      {selected.length > 0 ? (
        <aside
          aria-label="Schedule actions"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full border border-black/10 bg-[#1d1d1b] px-4 py-2 text-white shadow-2xl backdrop-blur"
        >
          <button
            type="button"
            disabled={selectedZoneIds.size !== 1}
            onClick={() => {
              void navigate(TRIP_NEW_PATH, { state: { selectedIds: selected } });
            }}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-[#1d1d1b] transition hover:bg-neutral-200 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <IconCalendarPlus className="h-3.5 w-3.5" stroke={1.75} aria-hidden />
            {selected.length} selected · {selectedBags} bags · Schedule →
          </button>
          <button
            type="button"
            onClick={() => setSelected([])}
            aria-label="Clear selection"
            className="inline-flex h-8 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-medium text-neutral-400 hover:text-white transition focus-visible:outline-none"
          >
            <IconX className="h-3 w-3" aria-hidden />
            Clear selection
          </button>
        </aside>
      ) : null}

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
