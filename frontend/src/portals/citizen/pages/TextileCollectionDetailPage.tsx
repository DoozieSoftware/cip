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
  useRescheduleTextileCollection,
  useTextileAvailability,
  useUpdateTextileInstructions,
  uploadTextileCollectionPhoto,
  type TextileCollectionPhoto,
} from '../api/textileZones';
import { CentreCard } from '../components/CentreCard';
import { ReferencePass } from '../components/ReferencePass';
import { CollectionProgress } from '../components/CollectionProgress';
import { ReceiptCard } from '../components/ReceiptCard';
import {
  statusHeading,
  nextStepCopy,
  tripStatusLabel,
  rescheduleBlockedReason,
  slotUnavailableFallback,
} from './textileStatusCopy';
import { ApiError } from '../../../shared/api/errors';

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
  const windowStr = formatWindow(
    item.scheduled_window_start ?? item.batch?.window_start ?? null,
    item.scheduled_window_end ?? item.batch?.window_end ?? null,
  );
  const tripStatus = item.batch?.status ?? null;
  const tripLabel = tripStatusLabel(tripStatus);
  const nextStep = nextStepCopy(item.status, method, {
    centre: centreName,
    reference: item.reference,
    address: item.pickup_address,
    window: windowStr ?? undefined,
    date: item.scheduled_date ?? item.batch?.collection_date ?? undefined,
    actual: actualStr,
    tripStatus: tripStatus ?? undefined,
  });
  const confirmedDate = item.scheduled_date ?? item.batch?.collection_date ?? null;
  const isScheduledPremises = !isDropoff && item.status === 'scheduled';
  const canReschedule =
    isScheduledPremises && tripStatus !== 'in_progress' && tripStatus !== 'completed';
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

      {isScheduledPremises ? (
        <section
          aria-label="Pickup schedule"
          className="rounded-xl border border-black/10 bg-white p-5"
        >
          <h2 className="text-sm font-medium">Confirmed pickup</h2>
          <p className="mt-2 text-sm">
            <span className="font-medium">{formatDate(confirmedDate)}</span>
            {windowStr ? (
              <span className="text-[var(--color-text-secondary)]"> · {windowStr}</span>
            ) : null}
          </p>
          {tripLabel ? (
            <p className="mt-2 inline-flex rounded-full bg-[var(--color-surface-alt)] px-2.5 py-1 text-xs font-medium">
              Collection status: {tripLabel}
            </p>
          ) : null}
          {item.readiness_instructions ? (
            <p className="mt-3 text-xs leading-5 text-[var(--color-text-secondary)]">
              {item.readiness_instructions}
            </p>
          ) : null}
          {item.batch?.trip_reference ? (
            <p className="mt-2 font-mono text-[11px] text-[var(--color-text-tertiary)]">
              Trip {item.batch.trip_reference}
            </p>
          ) : null}
        </section>
      ) : null}

      {!isDropoff ? (
        <section
          aria-label="Service contact"
          className="rounded-xl border border-black/10 bg-white p-5"
        >
          <h2 className="text-sm font-medium">Service contact</h2>
          <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
            {item.partner?.name ? `Partner: ${item.partner.name}. ` : ''}
            For help with this pickup, use the support channel in the app. Staff contact details are
            not shared for privacy.
          </p>
          <Link
            to="/citizen/reports"
            className="mt-3 inline-flex min-h-11 items-center rounded-full border border-black/15 bg-white px-4 text-xs font-medium"
          >
            Contact support
          </Link>
        </section>
      ) : null}

      {!isDropoff && ['scheduled', 'ready_to_group'].includes(item.status) ? (
        <RescheduleSection
          collectionId={id}
          serviceZoneId={item.service_zone?.id ?? null}
          canReschedule={canReschedule}
          tripStatus={tripStatus}
          currentDate={confirmedDate}
          currentWindow={windowStr}
          onRescheduled={() => void query.refetch()}
        />
      ) : null}

      {!isDropoff && ['pending_review', 'ready_to_group', 'scheduled'].includes(item.status) ? (
        <ReadinessContactSection
          collectionId={id}
          readiness={item.readiness_instructions}
          contactPhone={item.contact_phone}
          contactEmail={item.contact_email}
          pickupAddress={item.pickup_address}
          onUpdated={() => void query.refetch()}
        />
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
function RescheduleSection({
  collectionId,
  serviceZoneId,
  canReschedule,
  tripStatus,
  currentDate,
  currentWindow,
  onRescheduled,
}: {
  collectionId: string;
  serviceZoneId: string | null;
  canReschedule: boolean;
  tripStatus: string | null;
  currentDate: string | null;
  currentWindow: string | null;
  onRescheduled: () => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [wStart, setWStart] = useState('09:00');
  const [wEnd, setWEnd] = useState('12:00');
  const [success, setSuccess] = useState<string | null>(null);
  const mutate = useRescheduleTextileCollection(collectionId);
  const availability = useTextileAvailability(serviceZoneId, 'premises');
  const blocked = rescheduleBlockedReason(tripStatus);
  const unavailableDates = availability.data?.unavailable_dates ?? [];
  const nextAvailable = availability.data?.next_available_date ?? null;
  const isUnavailablePicked = date ? unavailableDates.includes(date) : false;
  const fallback = slotUnavailableFallback('premises');

  async function handleSubmit(): Promise<void> {
    if (!date) return;
    setSuccess(null);
    try {
      await mutate.mutateAsync({
        requested_date: date,
        window_start: wStart || null,
        window_end: wEnd || null,
      });
      setSuccess(`Rescheduled to ${date}${wStart && wEnd ? ` · ${wStart}–${wEnd}` : ''}. Old assignment was removed atomically.`);
      setOpen(false);
      onRescheduled();
    } catch (e) {
      // error is surfaced via mutate.error
      if (e instanceof ApiError && (e.code === 'SLOT_UNAVAILABLE' || e.status === 409)) {
        // keep fallback visible
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- mutate.error is unknown
  const apiError = mutate.error instanceof ApiError ? mutate.error : mutate.error ? new Error((mutate.error as Error).message) : null;
  const isSlotUnavailable = apiError instanceof ApiError && (apiError.code === 'SLOT_UNAVAILABLE' || apiError.status === 409);

  if (!canReschedule) {
    return (
      <section aria-label="Reschedule" className="rounded-xl border border-black/10 bg-white p-5">
        <h2 className="text-sm font-medium">Need a different date?</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{blocked ?? 'Rescheduling is paused while the crew is on the route. Please contact support if you need help.'}</p>
        <p className="mt-2 text-[11px] text-[var(--color-text-tertiary)]">No staff contact is shown here. Use Contact support above. Rescheduling removes the old trip assignment atomically.</p>
      </section>
    );
  }

  return (
    <section aria-label="Reschedule" className="rounded-xl border border-black/10 bg-white p-5">
      <h2 className="text-sm font-medium">Need a different date?</h2>
      {currentDate ? (
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Current: <span className="font-medium text-[var(--color-ink)]">{currentDate}{currentWindow ? ` · ${currentWindow}` : ''}</span></p>
      ) : null}
      {unavailableDates.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">Unavailable dates</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">{unavailableDates.slice(0, 6).join(', ')}{unavailableDates.length > 6 ? ` +${unavailableDates.length - 6} more` : ''}</p>
          {nextAvailable ? <p className="mt-1 text-xs text-amber-700">Next available: <span className="font-medium">{nextAvailable}</span></p> : null}
          {availability.data?.reason ? <p className="mt-1 text-[11px] text-amber-700">{availability.data.reason}</p> : null}
        </div>
      ) : null}
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex min-h-11 items-center rounded-full border border-black/15 bg-white px-4 text-xs font-medium">Reschedule pickup</button>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium">New date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={isUnavailablePicked} className={`mt-1 block w-full rounded-lg border p-2.5 text-sm ${isUnavailablePicked ? 'border-amber-500 bg-amber-50' : 'border-[#d8d6cf]'}`} />
              {isUnavailablePicked ? <span className="mt-1 block text-[11px] font-medium text-amber-700">This date is unavailable — pick another or see fallback below.</span> : null}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className="text-xs font-medium">From</span><input type="time" value={wStart} onChange={(e) => setWStart(e.target.value)} className="mt-1 block w-full rounded-lg border border-[#d8d6cf] p-2.5 text-sm" /></label>
              <label className="block"><span className="text-xs font-medium">To</span><input type="time" value={wEnd} onChange={(e) => setWEnd(e.target.value)} className="mt-1 block w-full rounded-lg border border-[#d8d6cf] p-2.5 text-sm" /></label>
            </div>
          </div>
          {isSlotUnavailable ? (
            <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              <p className="font-medium">Slot no longer available</p>
              <p className="mt-1">{fallback}</p>
              {nextAvailable ? <p className="mt-2">Try <span className="font-medium">{nextAvailable}</span> next, or switch to drop-off — no slot needed.</p> : null}
              <p className="mt-2 text-[11px]">{apiError?.message ?? 'The partner removed this window. Your old schedule stays visible in history until confirmed.'}</p>
            </div>
          ) : apiError ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{apiError.message}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!date || mutate.isPending || isUnavailablePicked} onClick={() => void handleSubmit()} className="inline-flex min-h-11 items-center rounded-full bg-[var(--color-ink)] px-5 text-xs font-medium text-white disabled:opacity-40">{mutate.isPending ? 'Rescheduling…' : 'Confirm new slot'}</button>
            <button type="button" onClick={() => { setOpen(false); mutate.reset(); }} className="inline-flex min-h-11 items-center rounded-full border border-black/15 px-4 text-xs font-medium">Cancel</button>
          </div>
          <p className="text-[11px] leading-4 text-[var(--color-text-tertiary)]">Rescheduling replaces the old trip assignment atomically. No duplicate booking is created. Old and new schedules remain in history.</p>
        </div>
      )}
      {success ? <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-xs font-medium text-green-700">{success}</p> : null}
      <p className="mt-3 text-[11px] text-[var(--color-text-tertiary)]">No staff contact is shown here. Use Contact support above.</p>
    </section>
  );
}

function ReadinessContactSection({
  collectionId,
  readiness,
  contactPhone,
  contactEmail,
  pickupAddress,
  onUpdated,
}: {
  collectionId: string;
  readiness: string | null;
  contactPhone: string;
  contactEmail: string;
  pickupAddress: string;
  onUpdated: () => void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draftReadiness, setDraftReadiness] = useState(readiness ?? '');
  const [draftPhone, setDraftPhone] = useState(contactPhone);
  const [draftEmail, setDraftEmail] = useState(contactEmail);
  const [draftAddress, setDraftAddress] = useState(pickupAddress);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const mutate = useUpdateTextileInstructions(collectionId);
  const canSave = draftPhone.trim().length >= 8 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draftEmail) && draftAddress.trim().length >= 10;

  async function handleSave(): Promise<void> {
    setLocalSuccess(null);
    try {
      await mutate.mutateAsync({
        readiness_instructions: draftReadiness.trim() || null,
        contact_phone: draftPhone.trim(),
        contact_email: draftEmail.trim(),
        pickup_address: draftAddress.trim(),
      });
      setLocalSuccess('Instructions updated. Historical evidence is unchanged.');
      setEditing(false);
      onUpdated();
    } catch {
      // surfaced via mutate.error
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- mutate.error is unknown
  const apiError = mutate.error instanceof ApiError ? mutate.error.message : mutate.error ? (mutate.error as Error).message : null;

  return (
    <section aria-label="Readiness and contact" className="rounded-xl border border-black/10 bg-white p-5">
      <h2 className="text-sm font-medium">Readiness & contact</h2>
      <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">Update where to leave bags and how to reach you. This does not change old photos or history.</p>
      {!editing ? (
        <>
          <dl className="mt-3 space-y-2 text-xs">
            <div><dt className="font-medium text-[var(--color-text-tertiary)]">Readiness instructions</dt><dd className="mt-0.5 text-[var(--color-ink)]">{readiness || '— no instructions yet'}</dd></div>
            <div><dt className="font-medium text-[var(--color-text-tertiary)]">Pickup address</dt><dd className="mt-0.5">{pickupAddress}</dd></div>
            <div><dt className="font-medium text-[var(--color-text-tertiary)]">Phone</dt><dd className="mt-0.5">{contactPhone}</dd></div>
            <div><dt className="font-medium text-[var(--color-text-tertiary)]">Email</dt><dd className="mt-0.5">{contactEmail}</dd></div>
          </dl>
          <button type="button" onClick={() => setEditing(true)} className="mt-3 inline-flex min-h-11 items-center rounded-full border border-black/15 bg-white px-4 text-xs font-medium">Update instructions</button>
        </>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="block"><span className="text-xs font-medium">Readiness instructions (e.g. leave at gate, call on arrival)</span><textarea rows={2} value={draftReadiness} onChange={(e) => setDraftReadiness(e.target.value)} placeholder="Leave bags at the gate, call on arrival" className="mt-1 block w-full rounded-lg border border-[#d8d6cf] p-2.5 text-sm" /></label>
          <label className="block"><span className="text-xs font-medium">Pickup address</span><textarea rows={2} value={draftAddress} onChange={(e) => setDraftAddress(e.target.value)} className="mt-1 block w-full rounded-lg border border-[#d8d6cf] p-2.5 text-sm" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-xs font-medium">Contact phone</span><input type="tel" value={draftPhone} onChange={(e) => setDraftPhone(e.target.value)} className="mt-1 block w-full rounded-lg border border-[#d8d6cf] p-2.5 text-sm" /></label>
            <label className="block"><span className="text-xs font-medium">Contact email</span><input type="email" value={draftEmail} onChange={(e) => setDraftEmail(e.target.value)} className="mt-1 block w-full rounded-lg border border-[#d8d6cf] p-2.5 text-sm" /></label>
          </div>
          {apiError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{apiError}</p> : null}
          <div className="flex gap-2">
            <button type="button" disabled={!canSave || mutate.isPending} onClick={() => void handleSave()} className="inline-flex min-h-11 items-center rounded-full bg-[var(--color-ink)] px-5 text-xs font-medium text-white disabled:opacity-40">{mutate.isPending ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => { setEditing(false); mutate.reset(); setDraftReadiness(readiness ?? ''); setDraftPhone(contactPhone); setDraftEmail(contactEmail); setDraftAddress(pickupAddress); }} className="inline-flex min-h-11 items-center rounded-full border border-black/15 px-4 text-xs font-medium">Cancel</button>
          </div>
          <p className="text-[11px] text-[var(--color-text-tertiary)]">Updates are audit-logged. Past collection evidence stays unchanged.</p>
        </div>
      )}
      {localSuccess ? <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-xs font-medium text-green-700">{localSuccess}</p> : null}
    </section>
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
