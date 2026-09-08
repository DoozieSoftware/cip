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
          {/* Linear/Stripe-style Floating Selection Dock: Zero layout shift */}
          {selected.length > 0 ? (
            <aside
              aria-label="Bulk actions"
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full border border-black/10 bg-[#1d1d1b] px-4 py-2 text-white shadow-2xl backdrop-blur"
            >
              <p className="text-xs font-medium whitespace-nowrap">
                <span className="font-semibold text-white">{selected.length}</span> selected ·{' '}
                {selectedBags} bags
                {selectedWeight > 0 ? ` · ~${selectedWeight.toFixed(1)} kg` : ''}
              </p>
              <button
                type="button"
                disabled={approve.isPending}
                onClick={() => setApproveTarget(selected)}
                className="inline-flex h-7 items-center gap-1 rounded-full bg-white px-3 text-xs font-semibold text-[#1d1d1b] transition hover:bg-neutral-200 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <IconCheck className="h-3.5 w-3.5" />
                Approve ({selected.length})
              </button>
              <button
                type="button"
                onClick={() => setSelected([])}
                className="inline-flex h-7 items-center rounded-full px-2 text-xs font-medium text-neutral-400 hover:text-white transition focus-visible:outline-none"
              >
                Clear
              </button>
            </aside>
          ) : null}

          <TableShell
            head={
              <>
                <th className="w-9 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={allSelected}
                    onChange={(event) =>
                      setSelected(event.target.checked ? rows.map((r) => r.id) : [])
                    }
                    className="h-3.5 w-3.5 rounded accent-[var(--color-ink)]"
                  />
                </th>
                <th className="px-3 py-2">Reference &amp; Category</th>
                <th className="px-3 py-2">Requester</th>
                <th className="px-3 py-2">Zone</th>
                <th className="px-3 py-2">Volume</th>
                <th className="px-3 py-2">Submitted</th>
                <th className="px-3 py-2 text-right">Action</th>
              </>
            }
          >
            {rows.map((item) => {
              const isSelected = selected.includes(item.id);
              const customTitle =
                item.title && item.title.trim().toLowerCase() !== 'textile pickup request'
                  ? item.title
                  : null;
              return (
                <tr
                  key={item.id}
                  className={`transition-colors hover:bg-[var(--color-surface-alt)] ${isSelected ? 'bg-[var(--color-info)]/[0.07]' : ''}`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.reference}`}
                      checked={isSelected}
                      onChange={() =>
                        setSelected((current) =>
                          current.includes(item.id)
                            ? current.filter((id) => id !== item.id)
                            : [...current, item.id],
                        )
                      }
                      className="h-3.5 w-3.5 rounded accent-[var(--color-ink)]"
                    />
                  </td>
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
                    {customTitle || item.service_zone?.dropoff_name ? (
                      <p className="mt-0.5 max-w-[260px] truncate text-[11px] text-[var(--color-text-secondary)]">
                        {customTitle ?? item.service_zone?.dropoff_name}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className="block text-xs font-medium text-[var(--color-ink)]">
                      {item.requester_name}
                    </span>
                    <span className="block font-mono text-[10px] text-[var(--color-text-tertiary)]">
                      {item.contact_phone ? `•••• ${item.contact_phone.slice(-4)}` : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--color-ink)]">
                    {item.service_zone?.name ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-[var(--color-ink)]">
                    {formatVolume(item.estimated_bags, item.estimated_weight_kg)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                    {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/operations/textile-collections/${item.id}`}
                      className="inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)]"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
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
