import { useRef, useState, type JSX } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconCamera,
  IconCalendar,
  IconMapPin,
  IconPackage,
  IconX,
} from '@tabler/icons-react';
import { ErrorState, Spinner } from '../../../shared/ui';
import {
  useCancelTextileCollection,
  useCitizenTextileCollection,
  uploadTextileCollectionPhoto,
  type TextileCollectionPhoto,
} from '../api/textileZones';
import { CentreCard } from '../components/CentreCard';
import { ReferencePass } from '../components/ReferencePass';
import { CollectionProgress } from '../components/CollectionProgress';
import { ReceiptCard } from '../components/ReceiptCard';
import { statusHeading, nextStepCopy } from './textileStatusCopy';

function formatVolume(bags: number | null, weightKg: number | null, method: string): string {
  const parts: string[] = [];
  if (bags !== null) parts.push(`${bags} bag${bags === 1 ? '' : 's'}`);
  if (weightKg !== null) parts.push(`${weightKg} kg`);
  return parts.length > 0
    ? parts.join(' · ')
    : method === 'dropoff'
      ? 'To be confirmed at the centre'
      : 'To be confirmed at pickup';
}
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Not scheduled yet';
  try {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}
function formatWindow(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  return `Between ${start}–${end}`;
}
const PICKUP_STEPS = [
  { key: 'pending_review', label: 'Requested' },
  { key: 'ready_to_group', label: 'Approved' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'picked_up', label: 'Collected' },
];
const DROPOFF_STEPS = [
  { key: 'pending_review', label: 'Requested' },
  { key: 'ready_to_group', label: 'Ready to drop off' },
  { key: 'scheduled', label: 'Pass active' },
  { key: 'picked_up', label: 'Received' },
];

function ReplacePhotoButton({
  reportId,
  onReplaced,
}: {
  reportId: string;
  onReplaced: () => void;
}): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  async function handleChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPEG, PNG, or WebP images are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Photo must be under 10 MB.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await uploadTextileCollectionPhoto(reportId, file);
      onReplaced();
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-live="polite"
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-black/15 bg-white px-4 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-alt)] disabled:opacity-60"
      >
        <IconCamera className="h-4 w-4" stroke={1.6} />
        {busy ? 'Uploading…' : 'Replace photo'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={void handleChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
export default function TextileCollectionDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const query = useCitizenTextileCollection(id);
  const cancel = useCancelTextileCollection(id);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState('');
  if (query.isLoading)
    return (
      <div className="py-20">
        <Spinner label="Loading request" />
      </div>
    );
  if (!query.data || query.isError)
    return (
      <ErrorState
        title="Request not available"
        description="Return to your textile collections and try again."
        action={
          <Link
            to="/citizen/textile-collections"
            className="mt-3 inline-flex min-h-11 items-center rounded-full border border-black/15 px-4 text-sm"
          >
            Retry
          </Link>
        }
      />
    );
  const item = query.data;
  const method = item.collection_method === 'dropoff' ? 'dropoff' : 'premises';
  const isDropoff = method === 'dropoff';
  const steps = isDropoff ? DROPOFF_STEPS : PICKUP_STEPS;
  const stepIndex = steps.findIndex((s) => s.key === item.status);
  const currentIndex =
    stepIndex >= 0 ? stepIndex : item.status === 'missed' ? 2 : item.status === 'rejected' ? 0 : -1;
  const tone: 'ok' | 'warn' | 'bad' =
    item.status === 'rejected' ? 'bad' : item.status === 'missed' ? 'warn' : 'ok';
  const canCancel = !['picked_up', 'cancelled', 'rejected'].includes(item.status);
  const centreName =
    item.service_zone?.dropoff_name ?? item.service_zone?.name ?? 'Collection centre';
  const centreAddress =
    (item as unknown as { service_zone?: { dropoff_address?: string | null } }).service_zone
      ?.dropoff_address ?? '';
  const centreCenter = item.service_zone?.center ?? null;
  const actualStr = formatVolume(item.actual_bags, item.actual_weight_kg, method);
  const heading = statusHeading(item.status, method);
  const windowStr = formatWindow(item.scheduled_window_start, item.scheduled_window_end);
  const nextStep = nextStepCopy(item.status, method, {
    centre: centreName,
    reference: item.reference,
    address: item.pickup_address,
    window: windowStr ?? undefined,
    date: item.scheduled_date ?? item.batch?.collection_date ?? undefined,
    actual: actualStr,
  });
  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-5">
      <Link
        to="/citizen/textile-collections"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--color-text-secondary)]"
      >
        <IconArrowLeft className="h-4 w-4" /> Textile collections
      </Link>
      <header className="rounded-2xl border border-black/10 bg-white p-5 sm:p-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
          {item.reference}
        </p>
        <h1 className="mt-2 break-words text-2xl font-normal tracking-[-0.025em]">{item.title}</h1>
        <p className="mt-1 inline-flex rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-xs font-medium">
          {isDropoff ? 'Drop-off at a centre' : 'Pickup at your address'}
        </p>
        <p className="mt-3 text-sm font-medium">{heading}</p>
        {item.rejection_reason ? (
          <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {item.rejection_reason}
          </p>
        ) : null}
        {item.missed_pickup_reason ? (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            {item.missed_pickup_reason}
          </p>
        ) : null}
        {item.cancellation_reason ? (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {item.cancellation_reason}
          </p>
        ) : null}
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{nextStep}</p>
        <CollectionProgress
          steps={steps}
          currentIndex={currentIndex >= 0 ? currentIndex : 0}
          tone={currentIndex >= 0 ? tone : 'bad'}
        />
      </header>

      {isDropoff ? (
        <>
          <CentreCard
            name={centreName}
            address={centreAddress || item.pickup_address}
            hours={
              (item as unknown as { service_zone?: { dropoff_hours?: string } }).service_zone
                ?.dropoff_hours ?? null
            }
            center={centreCenter}
            state={item.status === 'picked_up' ? 'muted' : 'active'}
          />
          <ReferencePass reference={item.reference} />
        </>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <Detail
          icon={IconMapPin}
          label={isDropoff ? 'Your address' : 'Pickup address'}
          value={item.pickup_address}
          hint={isDropoff ? 'for contact and receipt only — not a pickup point' : undefined}
        />
        <Detail
          icon={IconPackage}
          label="Estimated collection"
          value={formatVolume(item.estimated_bags, item.estimated_weight_kg, method)}
        />
        <Detail
          icon={IconCalendar}
          label={isDropoff ? 'Pass valid until' : 'Pickup date'}
          value={(() => {
            const d = item.scheduled_date ?? item.batch?.collection_date ?? null;
            const base = formatDate(d);
            if (!isDropoff && windowStr) return `${base} · ${windowStr}`;
            return base;
          })()}
        />
        <Detail
          icon={IconPackage}
          label="Collection method"
          value={isDropoff ? 'Drop-off at a centre' : 'Pickup at your address'}
        />
      </section>

      {item.status === 'picked_up' ? (
        <ReceiptCard
          reference={item.reference}
          date={item.picked_up_at ? formatDate(item.picked_up_at) : formatDate(item.scheduled_date)}
          actual={actualStr}
          centre={centreName}
          proofUrl={item.photos?.find((p) => p.role === 'proof')?.url}
        />
      ) : null}

      {item.notes ? (
        <section className="rounded-xl border border-black/10 bg-white p-5">
          <h2 className="text-sm font-medium">Collection notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-secondary)]">
            {item.notes}
          </p>
        </section>
      ) : null}
      <PhotoTrustView
        photos={item.photos}
        reportId={id}
        onPhotoChanged={() => void query.refetch()}
        isDropoff={isDropoff}
      />
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
                placeholder="For example: I dropped the bags off at the collection point myself."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-describedby="cancel-reason-hint"
                className="block w-full rounded-lg border border-[#d8d6cf] p-3"
              />
              <p id="cancel-reason-hint" className="text-xs text-[var(--color-text-secondary)]">
                The collection partner sees this reason, so a short sentence is enough.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={reason.trim().length < 5 || cancel.isPending}
                  onClick={() => void cancel.mutateAsync(reason.trim())}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-red-600 bg-red-600 px-5 text-sm font-medium text-white disabled:opacity-40"
                >
                  <IconX className="h-4 w-4" stroke={1.6} />
                  {cancel.isPending ? 'Cancelling…' : 'Confirm cancellation'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancel(false)}
                  className="inline-flex min-h-11 items-center rounded-full border border-black/15 bg-white px-4 text-sm font-medium"
                >
                  Keep request
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-medium">
                  {isDropoff ? 'Need to cancel this drop-off?' : 'Need to cancel this pickup?'}
                </h2>
                <p className="mt-1 max-w-prose text-xs text-[var(--color-text-secondary)]">
                  We will tell the collection partner you no longer need this. A cancelled request
                  cannot be reopened.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCancel(true)}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-full border border-red-300 bg-white px-4 text-sm font-medium text-red-800 sm:self-auto"
              >
                <IconX className="h-4 w-4" stroke={1.6} />
                {isDropoff ? 'Cancel this drop-off plan' : 'Cancel this pickup request'}
              </button>
            </div>
          )}
        </section>
      ) : null}
      {item.status === 'missed' ? (
        <div className="flex gap-2">
          <Link
            to="/citizen/textile-collections/new"
            className="inline-flex min-h-11 items-center rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white"
          >
            Rebook
          </Link>
        </div>
      ) : null}
    </div>
  );
}
function Detail({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof IconMapPin;
  label: string;
  value: string;
  hint?: string;
}): JSX.Element {
  return (
    <div className="min-w-0 rounded-xl border border-black/10 bg-white p-4">
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
        <Icon className="h-4 w-4 shrink-0" />
        {label}
        {hint ? <span className="sr-only">({hint})</span> : null}
      </div>
      <p className="mt-2 break-words text-sm leading-5">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">{hint}</p> : null}
    </div>
  );
}
function PhotoTrustView({
  photos,
  reportId,
  onPhotoChanged,
  isDropoff,
}: {
  photos?: TextileCollectionPhoto[];
  reportId: string;
  onPhotoChanged: () => void;
  isDropoff: boolean;
}): JSX.Element | null {
  if (!photos || photos.length === 0) return null;
  const evidence = photos.find((p) => p.role === 'evidence');
  const proof = photos.find((p) => p.role === 'proof');
  if (evidence && !proof) {
    return (
      <section className="rounded-xl border border-black/10 bg-white p-5">
        <h2 className="text-sm font-medium">Photos</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <PhotoCard heading="Your photo" url={evidence.url} alt="Photo of your bags" />
            <ReplacePhotoButton reportId={reportId} onReplaced={onPhotoChanged} />
          </div>
          <div className="flex items-center justify-center rounded-lg border border-dashed border-black/15 bg-[var(--color-bg-faint,#f9f8f6)] p-5">
            <p className="text-center text-xs text-[var(--color-text-secondary)]">
              {isDropoff
                ? "The centre's receipt photo will appear here."
                : 'Collection proof will appear here after pickup.'}
            </p>
          </div>
        </div>
      </section>
    );
  }
  if (evidence || proof) {
    return (
      <section className="rounded-xl border border-black/10 bg-white p-5">
        <h2 className="text-sm font-medium">Photos</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {evidence ? (
            <div>
              <PhotoCard heading="Your photo" url={evidence.url} alt="Photo of your bags" />
              <ReplacePhotoButton reportId={reportId} onReplaced={onPhotoChanged} />
            </div>
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
