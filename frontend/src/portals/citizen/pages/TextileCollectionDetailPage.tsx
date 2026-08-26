import { useState, type JSX } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IconArrowLeft, IconCalendar, IconMapPin, IconPackage } from '@tabler/icons-react';
import { ErrorState, Spinner } from '../../../shared/ui';
import {
  useCancelTextileCollection,
  useCitizenTextileCollection,
  type TextileCollectionPhoto,
} from '../api/textileZones';

function formatVolume(bags: number | null, weightKg: number | null): string {
  const parts: string[] = [];
  if (bags !== null) parts.push(`${bags} bag${bags === 1 ? '' : 's'}`);
  if (weightKg !== null) parts.push(`${weightKg} kg`);
  return parts.length > 0 ? parts.join(' · ') : 'To be confirmed at pickup';
}

const STEPS = ['pending_review', 'ready_to_group', 'scheduled', 'picked_up'];
const LABELS: Record<string, string> = {
  pending_review: 'Dr. Linen is reviewing your request',
  ready_to_group: 'Approved and waiting to be grouped by area',
  scheduled: 'Pickup has been scheduled',
  picked_up: 'Textiles collected',
  missed: 'Pickup was missed',
  rejected: 'Request was not accepted',
  cancelled: 'Request cancelled',
};

export default function TextileCollectionDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const query = useCitizenTextileCollection(id);
  const cancel = useCancelTextileCollection(id);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState('');

  if (query.isLoading)
    return (
      <div className="py-20">
        <Spinner label="Loading pickup request" />
      </div>
    );
  if (!query.data || query.isError)
    return (
      <ErrorState
        title="Pickup request not available"
        description="Return to your textile pickups and try again."
      />
    );
  const item = query.data;
  const step = STEPS.indexOf(item.status);
  const canCancel = !['picked_up', 'cancelled', 'rejected'].includes(item.status);

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-5">
      <Link
        to="/citizen/textile-collections"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--color-text-secondary)]"
      >
        <IconArrowLeft className="h-4 w-4" /> Textile pickups
      </Link>
      <header className="rounded-2xl border border-black/10 bg-white p-5 sm:p-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
          {item.reference}
        </p>
        <h1 className="mt-2 break-words text-2xl font-normal tracking-[-0.025em]">{item.title}</h1>
        <p className="mt-3 text-sm font-medium">{LABELS[item.status] ?? item.status}</p>
        {step >= 0 ? (
          <div className="mt-5 grid grid-cols-4 gap-1" aria-label="Collection progress">
            {STEPS.map((status, index) => (
              <span
                key={status}
                className={`h-1.5 rounded-full ${index <= step ? 'bg-[var(--color-ink)]' : 'bg-[#dfddd7]'}`}
              />
            ))}
          </div>
        ) : null}
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <Detail icon={IconMapPin} label="Pickup address" value={item.pickup_address} />
        <Detail
          icon={IconPackage}
          label="Estimated collection"
          value={formatVolume(item.estimated_bags, item.estimated_weight_kg)}
        />
        <Detail
          icon={IconCalendar}
          label="Pickup date"
          value={item.scheduled_date ?? 'Not scheduled yet'}
        />
        <Detail
          icon={IconPackage}
          label="Collection method"
          value={item.collection_method === 'premises' ? 'Pickup from address' : 'Drop-off'}
        />
      </section>

      {item.notes ? (
        <section className="rounded-xl border border-black/10 bg-white p-5">
          <h2 className="text-sm font-medium">Collection notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-secondary)]">
            {item.notes}
          </p>
        </section>
      ) : null}

      <PhotoTrustView photos={item.photos} />

      {canCancel ? (
        <section className="rounded-xl border border-black/10 bg-white p-5">
          {showCancel ? (
            <div className="space-y-3">
              <label htmlFor="cancel-reason" className="text-sm font-medium">
                Why are you cancelling?
              </label>
              <textarea
                id="cancel-reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="block w-full rounded-lg border border-[#d8d6cf] p-3"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={reason.trim().length < 5 || cancel.isPending}
                  onClick={() => void cancel.mutateAsync(reason.trim())}
                  className="min-h-11 rounded-full border border-red-300 px-5 text-sm text-red-700 disabled:opacity-40"
                >
                  Confirm cancellation
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancel(false)}
                  className="min-h-11 px-4 text-sm"
                >
                  Keep request
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCancel(true)}
              className="min-h-11 text-sm text-red-700"
            >
              Cancel this pickup request
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof IconMapPin;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="min-w-0 rounded-xl border border-black/10 bg-white p-4">
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="mt-2 break-words text-sm leading-5">{value}</p>
    </div>
  );
}

function PhotoTrustView({ photos }: { photos?: TextileCollectionPhoto[] }): JSX.Element | null {
  if (!photos || photos.length === 0) return null;

  const evidence = photos.find((p) => p.role === 'evidence');
  const proof = photos.find((p) => p.role === 'proof');

  // If only the citizen's photo exists, show it alone with a note.
  if (evidence && !proof) {
    return (
      <section className="rounded-xl border border-black/10 bg-white p-5">
        <h2 className="text-sm font-medium">Photos</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <PhotoCard heading="Your photo" url={evidence.url} alt="Photo of your bags" />
          <div className="flex items-center justify-center rounded-lg border border-dashed border-black/15 bg-[var(--color-bg-faint,#f9f8f6)] p-5">
            <p className="text-center text-xs text-[var(--color-text-secondary)]">
              Collection proof will appear here after pickup.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // If both (or only proof) exist, render the available cards.
  if (evidence || proof) {
    return (
      <section className="rounded-xl border border-black/10 bg-white p-5">
        <h2 className="text-sm font-medium">Photos</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {evidence ? (
            <PhotoCard heading="Your photo" url={evidence.url} alt="Photo of your bags" />
          ) : null}
          {proof ? (
            <PhotoCard heading="Collection proof" url={proof.url} alt="Crew collection proof" />
          ) : null}
        </div>
      </section>
    );
  }

  return null;
}

function PhotoCard({
  heading,
  url,
  alt,
}: {
  heading: string;
  url: string;
  alt: string;
}): JSX.Element {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">{heading}</h3>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img
          src={url}
          alt={alt}
          loading="lazy"
          className="h-48 w-full rounded-lg border border-black/10 object-cover"
        />
      </a>
    </div>
  );
}
