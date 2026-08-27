import { useState, type JSX } from 'react';
import { cx } from '../../../../shared/ui';
import type { TextileCollectionListItem } from '../../api/textileApi';
import {
  CategoryBadge,
  CategoryFilter,
  DeskPage,
  DeskStates,
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
  { value: 'picked_up,missed,rejected,cancelled', label: 'All' },
  { value: 'picked_up', label: 'Collected' },
  { value: 'missed', label: 'Missed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function TextileCompletedPage(): JSX.Element {
  const desk = useDesk();
  const [search, setSearch] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [statusFilter, setStatusFilter] = useState('picked_up,missed,rejected,cancelled');
  const [page, setPage] = useState(1);

  const queue = useTextileQueue({
    status: 'picked_up,missed,rejected,cancelled',
    search,
    page,
    zoneId: zoneId || undefined,
    categoryId: categoryId || undefined,
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
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter by outcome">
        {HISTORY_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => {
              setStatusFilter(filter.value);
              setPage(1);
            }}
            className={cx(
              'min-h-10 shrink-0 rounded-full px-4 text-sm font-medium transition',
              statusFilter === filter.value
                ? 'bg-[var(--color-ink)] text-white'
                : 'border border-black/15 bg-white hover:bg-[var(--color-surface-alt)]',
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
              <th className="px-3 py-2.5">Reference</th>
              <th className="px-3 py-2.5">Requester</th>
              <th className="px-3 py-2.5">Zone</th>
              <th className="px-3 py-2.5">Est. volume</th>
              <th className="px-3 py-2.5">Collected</th>
              <th className="px-3 py-2.5">Status</th>
            </>
          }
        >
          {rows.map((item) => (
            <tr key={item.id} className="hover:bg-[var(--color-surface-alt)]">
              <td className="px-3 py-2.5">
                <p className="font-mono text-xs font-medium">{item.reference}</p>
                <p className="mt-0.5 max-w-[200px] truncate text-xs text-[var(--color-text-secondary)]">
                  {item.title}
                </p>
                <div className="mt-0.5">
                  <CategoryBadge category={item.category} />
                </div>
              </td>
              <td className="px-3 py-2.5">{item.requester_name}</td>
              <td className="px-3 py-2.5">{item.service_zone?.name ?? '—'}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                {formatVolume(item.estimated_bags, item.estimated_weight_kg)}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                {item.actual_bags !== null
                  ? `${item.actual_bags} bags · ${item.actual_weight_kg} kg`
                  : '—'}
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge status={item.status} />
                {item.status === 'rejected' && item.rejection_reason ? (
                  <p
                    className="mt-1 max-w-[220px] truncate text-xs text-[var(--color-text-secondary)]"
                    title={item.rejection_reason}
                  >
                    {item.rejection_reason}
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </TableShell>
      </DeskStates>

      <Pager meta={queue.data?.meta} onPage={setPage} />
    </DeskPage>
  );
}
