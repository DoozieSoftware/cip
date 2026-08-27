import { type JSX } from 'react';
import { Link } from 'react-router-dom';
import { IconChevronRight, IconPlus, IconRecycle } from '@tabler/icons-react';
import { EmptyState, Spinner } from '../../../shared/ui';
import { useCitizenTextileCollections } from '../api/textileZones';

const LABELS: Record<string, string> = {
  pending_review: 'Awaiting Dr. Linen review',
  ready_to_group: 'Approved for collection',
  scheduled: 'Pickup scheduled',
  picked_up: 'Collected',
  missed: 'Pickup missed',
  rejected: 'Could not accept',
  cancelled: 'Cancelled',
};
const DROPOFF_LABELS: Record<string, string> = {
  ready_to_group: 'Ready to drop off',
  scheduled: 'Pass active',
  picked_up: 'Received at centre',
};

function MethodBadge({ method }: { method: string }): JSX.Element {
  const isDropoff = method === 'dropoff';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${isDropoff ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}
    >
      {isDropoff ? 'Drop-off' : 'Pickup'}
    </span>
  );
}

export default function TextileCollectionsPage(): JSX.Element {
  const query = useCitizenTextileCollections();
  if (query.isLoading)
    return (
      <div className="mx-auto max-w-4xl py-16">
        <Spinner label="Loading textile collections" />
      </div>
    );
  if (query.isError)
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="border-b border-[var(--color-border-faint)] pb-6">
          <h1 className="text-3xl">Textile collections</h1>
        </header>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load textile collections.{' '}
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="ml-2 rounded-full border border-red-300 px-4 py-1.5 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  const data = query.data ?? [];
  if (data.length === 0) {
    return (
      <div className="mx-auto min-w-0 max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border-faint)] pb-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
              Dr. Linen service
            </p>
            <h1 className="mt-2 text-3xl font-normal tracking-[-0.035em]">Textile collections</h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Track collection requests separately from your civic complaints.
            </p>
          </div>
          <Link
            to="/citizen/textile-collections/new"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 text-sm font-medium text-white"
          >
            <IconPlus className="h-4 w-4" /> New request
          </Link>
        </header>
        <EmptyState
          title="No collection requests yet"
          description="Send a request when you have clothes, scrap or e-waste ready — for pickup or drop-off."
          action={
            <Link
              to="/citizen/textile-collections/new"
              className="rounded-full bg-[var(--color-ink)] px-5 py-3 text-sm text-white"
            >
              New request
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border-faint)] pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
            Dr. Linen service
          </p>
          <h1 className="mt-2 text-3xl font-normal tracking-[-0.035em]">Textile collections</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Track collection requests separately from your civic complaints.
          </p>
        </div>
        <Link
          to="/citizen/textile-collections/new"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 text-sm font-medium text-white"
        >
          <IconPlus className="h-4 w-4" /> New request
        </Link>
      </header>
      <div className="space-y-3">
        {data.map((item) => {
          const isDropoff = item.collection_method === 'dropoff';
          const label =
            (isDropoff && DROPOFF_LABELS[item.status]) ?? LABELS[item.status] ?? item.status;
          return (
            <Link
              key={item.id}
              to={`/citizen/textile-collections/${item.id}`}
              className="flex min-w-0 items-center gap-4 rounded-xl border border-black/10 bg-white p-4 transition hover:border-black/20"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                <IconRecycle className="h-5 w-5" stroke={1.6} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                  {item.reference}
                </p>
                <p className="mt-2 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <MethodBadge method={item.collection_method} />
                  {label}
                </p>
              </div>
              <IconChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
