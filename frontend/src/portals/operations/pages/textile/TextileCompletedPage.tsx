import { useState, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '../../../../shared/ui';
import type { TextileCollectionListItem } from '../../api/textileApi';
import {
  CategoryBadge,
  CategoryFilter,
  DeskPage,
  DeskStates,
  MethodBadge,
  Pager,
  SearchBox,
  StatusBadge,
  TableShell,
  useDesk,
  useTextileQueue,
  ZoneFilter,
  formatVolume,
} from './shared';

const HISTORY_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'picked_up,received_at_centre,missed,rejected,cancelled', label: 'All' },
  { value: 'picked_up', label: 'Collected' },
  { value: 'received_at_centre', label: 'Drop-off received' },
  { value: 'missed', label: 'Missed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function TextileCompletedPage(): JSX.Element {
  const desk = useDesk();
  const [search, setSearch] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [statusFilter, setStatusFilter] = useState(
    'picked_up,received_at_centre,missed,rejected,cancelled',
  );
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const queue = useTextileQueue({
    status: statusFilter,
    search,
    page,
    zoneId: zoneId || undefined,
    categoryId: categoryId || undefined,
    perPage,
    autoRefresh: true,
    enabled: desk.ready && desk.isDrLinen,
    departmentId: desk.departmentId,
  });
  const rows: TextileCollectionListItem[] = queue.data?.data ?? [];

  return (
    <DeskPage
      desk={desk}
      title="Pickup history"
      description="Completed, missed, rejected and cancelled pickup requests — the audit trail for reporting."
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
      <div
        className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
        aria-label="Filter by outcome"
      >
        {HISTORY_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => {
              setStatusFilter(filter.value);
              setPage(1);
            }}
            className={cx(
              'h-7 shrink-0 rounded-md px-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)]',
              statusFilter === filter.value
                ? 'bg-[var(--color-ink)] text-white'
                : 'border border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-ink)]',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <DeskStates
        loading={queue.isLoading}
        error={queue.isError}
        onRetry={() => void queue.refetch()}
        hasRows={rows.length > 0}
        emptyTitle="No completed requests yet"
        emptyBody="Collected, missed, rejected and cancelled requests will appear here."
      >
        <TableShell
          head={
            <>
              <th className="px-3 py-2">Reference &amp; Category</th>
              <th className="px-3 py-2">Requester</th>
              <th className="px-3 py-2">Zone</th>
              <th className="px-3 py-2">Est. Volume</th>
              <th className="px-3 py-2">Collected</th>
              <th className="px-3 py-2">Status</th>
            </>
          }
        >
          {rows.map((item) => (
            <tr key={item.id} className="transition-colors hover:bg-[var(--color-surface-alt)]">
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link
                    to={`/operations/textile-collections/${item.id}`}
                    className="font-mono text-xs font-semibold text-[var(--color-ink)] hover:underline"
                  >
                    {item.reference}
                  </Link>
                  <CategoryBadge category={item.category} />
                  <MethodBadge method={item.collection_method} />
                </div>
              </td>
              <td className="px-3 py-2 text-xs font-medium text-[var(--color-ink)]">
                {item.requester_name}
              </td>
              <td className="px-3 py-2 text-xs text-[var(--color-ink)]">
                {item.service_zone?.name ?? '—'}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-[var(--color-ink)]">
                {formatVolume(item.estimated_bags, item.estimated_weight_kg)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-[var(--color-ink)]">
                {item.actual_bags !== null
                  ? `${item.actual_bags} bags · ${item.actual_weight_kg} kg`
                  : '—'}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={item.status} />
                  {item.status === 'rejected' && item.rejection_reason ? (
                    <span
                      className="max-w-[160px] truncate text-[11px] text-[var(--color-text-secondary)]"
                      title={item.rejection_reason}
                    >
                      {item.rejection_reason}
                    </span>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
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
