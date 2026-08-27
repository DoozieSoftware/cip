import { type JSX } from 'react';
import { Link } from 'react-router-dom';
import { IconChevronRight, IconPlus, IconRecycle } from '@tabler/icons-react';
import { EmptyState, ErrorState, Spinner } from '../../../shared/ui';
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

export default function TextileCollectionsPage(): JSX.Element {
  const query = useCitizenTextileCollections();

  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border-faint)] pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
            Dr. Linen service
          </p>
          <h1 className="mt-2 text-3xl font-normal tracking-[-0.035em]">Textile pickups</h1>
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

      {query.isLoading ? (
        <div className="py-16">
          <Spinner label="Loading textile pickups" />
        </div>
      ) : null}
      {query.isError ? (
        <ErrorState
          title="Could not load textile pickups"
          description="Please retry in a moment."
          action={
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="rounded-full border border-black/15 px-4 py-2 text-sm"
            >
              Retry
            </button>
          }
        />
      ) : null}
      {query.data?.length === 0 ? (
        <EmptyState
          title="No textile pickup requests"
          description="Send a request when you have clothes or household textiles ready for collection."
          action={
            <Link
              to="/citizen/textile-collections/new"
              className="rounded-full bg-[var(--color-ink)] px-5 py-3 text-sm text-white"
            >
              Request a pickup
            </Link>
          }
        />
      ) : null}

      <div className="space-y-3">
        {query.data?.map((item) => (
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
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                {LABELS[item.status] ?? item.status}
              </p>
            </div>
            <IconChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
          </Link>
        ))}
      </div>
    </div>
  );
}
