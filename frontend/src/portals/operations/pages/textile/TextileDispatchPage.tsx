import { useMemo, useState, type JSX } from 'react';
import { useMutation } from '@tanstack/react-query';
import { IconCalendar, IconNavigation, IconPhone } from '@tabler/icons-react';
import { ApiError } from '../../../../shared/api/errors';
import { ConfirmActionDialog } from '../../components/ConfirmActionDialog';
import {
  recordTextileOutcome,
  uploadTextileProofPhoto,
  type TextileCollectionListItem,
} from '../../api/textileApi';
import {
  CategoryBadge,
  DeskPage,
  DeskStates,
  Pager,
  SearchBox,
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

export default function TextileDispatchPage(): JSX.Element {
  const desk = useDesk();
  const [search, setSearch] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [missedTarget, setMissedTarget] = useState<TextileCollectionListItem | null>(null);
  const [assignmentOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const queue = useTextileQueue({
    status: 'scheduled',
    search,
    page,
    zoneId: zoneId || undefined,
    categoryId: categoryId || undefined,
    collectionMethod: 'premises',
    autoRefresh: expandedId === null && missedTarget === null && !assignmentOpen,
    enabled: desk.ready && desk.isDrLinen,
    departmentId: desk.departmentId,
  });
  const rows = useMemo(() => queue.data?.data ?? [], [queue.data?.data]);

  const outcome = useMutation({
    mutationFn: ({
      id,
      kind,
      bags,
      weight,
      reason,
    }: {
      id: string;
      kind: 'collected' | 'missed';
      bags?: number;
      weight?: number;
      reason?: string;
    }) =>
      recordTextileOutcome(id, {
        outcome: kind,
        department_id: desk.departmentId,
        ...(kind === 'collected' ? { actual_bags: bags, actual_weight_kg: weight } : { reason }),
      }),
    onSuccess: () => {
      setExpandedId(null);
      setMissedTarget(null);
      void queue.refetch();
    },
  });

  async function handleCollect(
    item: TextileCollectionListItem,
    p: { bags: number; weight: number; file: File },
  ) {
    setServerError(null);
    try {
      await uploadTextileProofPhoto(item.id, p.file, desk.departmentId);
      await outcome.mutateAsync({ id: item.id, kind: 'collected', bags: p.bags, weight: p.weight });
    } catch (e) {
      if (e instanceof ApiError) setServerError(e.message);
      else setServerError('Failed to record collection');
    }
  }

  const trips = useMemo(() => {
    const map = new Map<
      string,
      { label: string; id: string; items: TextileCollectionListItem[] }
    >();
    for (const row of rows) {
      const key = row.batch?.id ?? 'unassigned';
      const entry = map.get(key) ?? {
        label: row.batch
          ? `${row.batch.reference} · ${row.batch.collection_date}`
          : 'Unassigned trip',
        id: row.batch?.id ?? key,
        items: [],
      };
      entry.items.push(row);
      map.set(key, entry);
    }
    return [...map.values()];
  }, [rows]);

  return (
    <DeskPage
      desk={desk}
      title="Dispatch board"
      description="Today's trips and their stops. Log what was actually collected, or mark a stop missed with the reason."
      toolbar={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchBox
            value={search}
            onChange={(n) => {
              setSearch(n);
              setPage(1);
            }}
          />
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
      }
    >
      <DeskStates
        loading={queue.isLoading}
        error={queue.isError}
        onRetry={() => void queue.refetch()}
        hasRows={rows.length > 0}
        emptyTitle="No scheduled pickups"
        emptyBody="Schedule a trip on the Trip scheduling page and it will appear here for dispatch."
      >
        <div className="space-y-4">
          {trips.map((trip) => (
            <section
              key={trip.id}
              className="overflow-hidden rounded-xl border border-black/10 bg-white"
            >
              <header className="flex flex-wrap items-center gap-2 border-b border-black/5 bg-[var(--color-surface-alt)] px-4 py-3">
                <IconCalendar className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                <h2 className="text-sm font-semibold">{trip.label}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium">
                  {trip.items.length} stops
                </span>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
                  {trip.items[0]?.batch?.status ?? 'planned'}
                </span>
                {trip.items[0]?.batch?.driver_name ? <span className="text-xs text-[var(--color-text-secondary)]">Driver: {trip.items[0].batch.driver_name}</span> : null}
                {trip.items[0]?.batch?.team_name ? <span className="text-xs text-[var(--color-text-secondary)]">Team: {trip.items[0].batch.team_name}</span> : null}
                {trip.items[0]?.batch?.vehicle_label ? <span className="text-xs text-[var(--color-text-secondary)]">Vehicle: {trip.items[0].batch.vehicle_label}</span> : null}
              </header>
              <ul className="divide-y divide-black/5">
                {trip.items.map((item, idx) => {
                  const evidencePhoto = item.photos?.find((p) => p.role === 'evidence');
                  return (
                    <li key={item.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-start gap-3 text-sm">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-[11px] text-white">
                          {idx + 1}
                        </span>
                        {evidencePhoto ? (
                          <img
                            src={evidencePhoto.url}
                            alt=""
                            className="h-12 w-12 rounded object-cover"
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px]">{item.reference}</span>
                            <CategoryBadge category={item.category} />
                            <span className="text-xs text-[var(--color-text-secondary)]">
                              Est. {formatVolume(item.estimated_bags, item.estimated_weight_kg)}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-text-secondary)]">
                            {item.requester_name} · {item.pickup_address} {idx === 0 ? <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800">Next stop</span> : null}
                          </p>
                          {item.readiness_instructions ? <p className="mt-1 text-xs italic text-[var(--color-text-secondary)]">{item.readiness_instructions}</p> : null}
                          <div className="mt-2 flex gap-2">
                            <a
                              href={telHref(item.contact_phone)}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-black/15 px-3.5 text-xs font-medium"
                            >
                              <IconPhone className="h-4 w-4" /> Call
                            </a>
                            <a
                              href={mapsHref(item.pickup_address)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-black/15 px-3.5 text-xs font-medium"
                            >
                              <IconNavigation className="h-4 w-4" /> Navigate
                            </a>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            aria-label="Record collection"
                            disabled={outcome.isPending}
                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            className="min-h-9 rounded-full bg-[var(--color-ink)] px-3.5 text-xs font-medium text-white disabled:opacity-40"
                          >
                            {expandedId === item.id ? 'Close' : 'Record collection'}
                          </button>
                          <button
                            type="button"
                            disabled={outcome.isPending}
                            onClick={() => setMissedTarget(item)}
                            className="min-h-9 rounded-full border border-black/15 px-3.5 text-xs disabled:opacity-40"
                          >
                            Mark missed
                          </button>
                        </div>
                      </div>
                      {expandedId === item.id ? (
                        <div className="mt-3">
                          <StopRecordForm
                            item={item}
                            busy={outcome.isPending}
                            onSubmit={(p) => void handleCollect(item, p)}
                          />
                          {serverError ? (
                            <p role="alert" className="mt-2 text-xs text-red-600">
                              {serverError}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
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
              if (missedTarget && note)
                void outcome.mutateAsync({ id: missedTarget.id, kind: 'missed', reason: note });
            }}
          />
        </div>
      </DeskStates>
      <Pager meta={queue.data?.meta} onPage={setPage} />
    </DeskPage>
  );
}
