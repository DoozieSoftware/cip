import { useState, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { IconCheck, IconRefresh } from '@tabler/icons-react';
import { ConfirmActionDialog } from '../../components/ConfirmActionDialog';
import { approveTextileCollection } from '../../api/textileApi';
import {
  CategoryBadge,
  CategoryFilter,
  DeskPage,
  DeskStates,
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
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [approveTarget, setApproveTarget] = useState<string[] | null>(null);

  const queue = useTextileQueue({
    status: 'pending_review',
    search,
    page,
    zoneId: zoneId || undefined,
    categoryId: categoryId || undefined,
    enabled: desk.ready && desk.isDrLinen,
    departmentId: desk.departmentId,
  });
  const rows = queue.data?.data ?? [];
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
  const selectedBags = rows
    .filter((r) => selected.includes(r.id))
    .reduce((sum, r) => sum + (r.estimated_bags ?? 0), 0);

  return (
    <DeskPage
      desk={desk}
      title="Pickup reviews"
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
          <CategoryFilter
            value={categoryId}
            onChange={(next) => {
              setCategoryId(next);
              setPage(1);
            }}
          />
          <button
            type="button"
            onClick={() => void queue.refetch()}
            className="inline-flex min-h-10 items-center gap-2 self-start rounded-full border border-black/15 bg-white px-4 text-sm font-medium"
          >
            <IconRefresh className="h-4 w-4" /> Refresh
          </button>
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
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-[#f1efe8] px-4 py-3">
              <p className="text-sm font-medium">
                {selected.length} selected · {selectedBags} bags
              </p>
              <button
                type="button"
                disabled={approve.isPending}
                onClick={() => setApproveTarget(selected)}
                className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 text-sm font-medium text-white disabled:opacity-40"
              >
                <IconCheck className="h-4 w-4" />
                Approve selected ({selected.length})
              </button>
              <button
                type="button"
                onClick={() => setSelected([])}
                className="text-sm text-[var(--color-text-secondary)] underline-offset-2 hover:underline"
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
                className={`hover:bg-[var(--color-surface-alt)] ${selected.includes(item.id) ? 'bg-blue-50/50' : ''}`}
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
                  <div className="mt-0.5">
                    <CategoryBadge category={item.category} />
                  </div>
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
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-black/15 px-3.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-alt)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ink)]"
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

      <Pager meta={queue.data?.meta} onPage={setPage} />

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
