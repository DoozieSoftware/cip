import { useState, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { IconCheck } from '@tabler/icons-react';
import { ConfirmActionDialog } from '../../components/ConfirmActionDialog';
import { approveTextileCollection } from '../../api/textileApi';
import {
  CategoryBadge,
  CategoryFilter,
  DeskPage,
  DeskStates,
  MethodBadge,
  MethodFilter,
  Pager,
  SearchBox,
  TableShell,
  useDesk,
  useTextileQueue,
  ZoneFilter,
  formatVolume,
} from './shared';

export default function TextileReviewPage(): JSX.Element {
  const desk = useDesk();
  const [search, setSearch] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [selected, setSelected] = useState<string[]>([]);
  const [approveTarget, setApproveTarget] = useState<string[] | null>(null);

  const queue = useTextileQueue({
    status: 'pending_review',
    search,
    page,
    zoneId: zoneId || undefined,
    categoryId: categoryId || undefined,
    collectionMethod: method || undefined,
    perPage,
    autoRefresh: selected.length === 0 && approveTarget === null,
    enabled: desk.ready && desk.isDrLinen,
    departmentId: desk.departmentId,
  });
  const rows = queue.data?.data ?? [];
  const totalWaiting = queue.data?.meta?.total;
  const onChanged = () => {
    setSelected([]);
    void queue.refetch();
  };

  const approve = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => approveTextileCollection(id, desk.departmentId))),
    onSuccess: () => {
      setApproveTarget(null);
      onChanged();
    },
  });

  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const selectedItems = rows.filter((r) => selected.includes(r.id));
  const selectedBags = selectedItems.reduce((sum, r) => sum + (r.estimated_bags ?? 0), 0);
  const selectedWeight = selectedItems.reduce((sum, r) => sum + (r.estimated_weight_kg ?? 0), 0);

  return (
    <DeskPage
      desk={desk}
      title={
        <>
          <span>Pickup reviews</span>
          {totalWaiting !== undefined ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
              {totalWaiting} waiting
            </span>
          ) : null}
        </>
      }
      description="Select requests to approve in a batch, or open a row to decide individually. Rejecting always needs a reason the requester will see, so it lives in the detail view."
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
          <MethodFilter
            value={method}
            onChange={(next) => {
              setMethod(next);
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
        emptyTitle="No requests waiting for review"
        emptyBody="New citizen pickup requests will land here."
      >
        <div className="space-y-3">
          {selected.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-3">
              <p className="text-sm font-medium">
                {selected.length} selected · {selectedBags} bags
                {selectedWeight > 0 ? ` · ~${selectedWeight.toFixed(1)} kg` : ''}
              </p>
              <button
                type="button"
                disabled={approve.isPending}
                onClick={() => setApproveTarget(selected)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 text-sm font-medium text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2 disabled:opacity-40"
              >
                <IconCheck className="h-4 w-4" />
                Approve selected ({selected.length})
              </button>
              <button
                type="button"
                onClick={() => setSelected([])}
                className="inline-flex min-h-11 items-center rounded-full border border-[var(--color-border)] bg-white px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
              >
                Clear selection
              </button>
            </div>
          ) : null}

          <TableShell
            head={
              <>
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={allSelected}
                    onChange={(event) =>
                      setSelected(event.target.checked ? rows.map((r) => r.id) : [])
                    }
                    className="h-4 w-4 accent-[var(--color-ink)]"
                  />
                </th>
                <th className="px-3 py-2.5">Reference</th>
                <th className="px-3 py-2.5">Requester</th>
                <th className="px-3 py-2.5">Zone</th>
                <th className="px-3 py-2.5">Volume</th>
                <th className="px-3 py-2.5">Method</th>
                <th className="px-3 py-2.5">Submitted</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </>
            }
          >
            {rows.map((item) => (
              <tr
                key={item.id}
                className={`hover:bg-[var(--color-surface-alt)] ${selected.includes(item.id) ? 'bg-[var(--color-info)]/[0.06]' : ''}`}
              >
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.reference}`}
                    checked={selected.includes(item.id)}
                    onChange={() =>
                      setSelected((current) =>
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id],
                      )
                    }
                    className="h-4 w-4 accent-[var(--color-ink)]"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    to={`/operations/textile-collections/${item.id}`}
                    className="font-mono text-xs font-medium text-[var(--color-ink)] underline-offset-2 hover:underline"
                  >
                    {item.reference}
                  </Link>
                  <p className="mt-0.5 max-w-[220px] truncate text-xs text-[var(--color-text-secondary)]">
                    {item.title}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    <CategoryBadge category={item.category} />
                    <MethodBadge method={item.collection_method} />
                  </div>
                  {item.service_zone?.dropoff_name ? (
                    <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                      {item.service_zone.dropoff_name}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-medium">{item.requester_name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{item.contact_phone}</p>
                </td>
                <td className="px-3 py-2.5">{item.service_zone?.name ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {formatVolume(item.estimated_bags, item.estimated_weight_kg)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {item.collection_method === 'dropoff' ? 'Drop-off' : 'Pickup'}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-[var(--color-text-secondary)]">
                  {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end">
                    <Link
                      to={`/operations/textile-collections/${item.id}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white px-3.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                    >
                      View
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </TableShell>
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

      <ConfirmActionDialog
        open={approveTarget !== null}
        title={
          approveTarget && approveTarget.length > 1
            ? `Approve ${approveTarget.length} requests`
            : 'Approve request'
        }
        description="Approved requests become ready to group into a collection trip. The requester is told their request is accepted."
        confirmLabel={
          approveTarget && approveTarget.length > 1
            ? `Approve ${approveTarget.length} requests`
            : 'Approve'
        }
        confirmVariant="success"
        busy={approve.isPending}
        onClose={() => setApproveTarget(null)}
        onConfirm={() => {
          if (approveTarget) void approve.mutateAsync(approveTarget);
        }}
      />
    </DeskPage>
  );
}
