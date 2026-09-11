import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IconArrowLeft,
  IconHanger,
  IconCamera,
  IconMapPin,
  IconPhoto,
  IconRecycle,
  IconX,
} from '@tabler/icons-react';
import { RequiredMark } from '../../../shared/ui';
import IssueLocationPicker from '../components/IssueLocationPicker';
import { CameraCapture } from '../components/CameraCapture';
import { issueLocationFromReporter, type IssueLocation } from '../components/issueLocation';
import { ApiError } from '../../../shared/api/errors';
import { TextileCollectionFields } from '../components/TextileCollectionFields';
import {
  useCreateTextileCollection,
  useTextileCapacityMinimum,
  useTextileAvailability,
  useTextileServiceZones,
  uploadTextileCollectionPhoto,
  isTextileNetworkFailure,
  type TextileCollectionCategory,
  type TextileCollectionPayload,
} from '../api/textileZones';
import { TextileMinimumNotice, isBelowMinimum } from '../components/TextileMinimumNotice';
import { slotUnavailableFallback } from './textileStatusCopy';
import { getQueue } from '../offline/queue';
import { requestBackgroundSync } from '../offline/swBridge';
import { readSession } from '../../../auth/storage';
import { useToast } from '../components/Toast';
import { TextileOfflineBanner } from '../components/TextileOfflineBanner';

const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Only Clothes & Textiles is offered for now; metal and e-waste options are
// hidden until the next rollout (backend still accepts those categories).
const CLOTHES_CATEGORY: TextileCollectionCategory = 'clothes_waste';
function validatePhotoFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Please select a JPEG, PNG, or WebP image.';
  if (file.size > MAX_PHOTO_SIZE_BYTES)
    return 'Photo must be 10 MB or smaller. Please choose a smaller file.';
  return null;
}
export default function TextileRequestPage(): JSX.Element {
  const navigate = useNavigate();
  const create = useCreateTextileCollection();
  const [category] = useState<TextileCollectionCategory>(CLOTHES_CATEGORY);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [details, setDetails] = useState<TextileCollectionPayload | null>(null);
  const [detailsValid, setDetailsValid] = useState(false);
  const [liveDraft, setLiveDraft] = useState<TextileCollectionPayload | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [issueLocation, setIssueLocation] = useState<IssueLocation | null>(null);
  const [dropoffInfo, setDropoffInfo] = useState<{
    name: string;
    address: string;
    center: { latitude: number; longitude: number } | null;
  } | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadWarning, setPhotoUploadWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const serviceZonesForMinimum = useTextileServiceZones(category);
  const zoneIdForMinimum =
    liveDraft?.service_zone_id ??
    details?.service_zone_id ??
    serviceZonesForMinimum.data?.[0]?.id ??
    '';
  const capacityMinimum = useTextileCapacityMinimum(zoneIdForMinimum);
  const minimum = capacityMinimum.data;
  const minimumIsLoading = serviceZonesForMinimum.isLoading || capacityMinimum.isLoading;
  const liveBags = liveDraft?.estimated_bags ?? details?.estimated_bags ?? null;
  const liveWeight = liveDraft?.estimated_weight_kg ?? details?.estimated_weight_kg ?? null;
  const liveMethod = liveDraft?.collection_method ?? details?.collection_method ?? null;
  const belowMinimum = isBelowMinimum(minimum, liveBags, liveWeight, liveMethod);
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);
  function applyPhotoFile(file: File): void {
    setPhotoError(null);
    setPhotoUploadWarning(null);
    const error = validatePhotoFile(file);
    if (error) {
      setPhotoError(error);
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }
  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    applyPhotoFile(file);
    event.target.value = '';
  }
  function removePhoto(): void {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoError(null);
    setPhotoUploadWarning(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
  const onDetailsChange = useCallback(
    (next: TextileCollectionPayload | null) => setDetails(next),
    [],
  );
  const onValidityChange = useCallback((valid: boolean) => setDetailsValid(valid), []);
  const onDraftChange = useCallback((draft: TextileCollectionPayload) => setLiveDraft(draft), []);
  const availability = useTextileAvailability(
    liveDraft?.service_zone_id ?? details?.service_zone_id ?? null,
    liveMethod ?? null,
  );
  const isPremises = liveMethod === 'premises';
  // Fail closed while the minimum is unverifiable (loading/error), but fail
  // open when no minimum is configured (minimum === null): null means "no
  // minimum", which must not block submit. Below-minimum estimates are still
  // blocked separately via `belowMinimum`.
  const pickupMinimumUnavailable = isPremises && (minimumIsLoading || capacityMinimum.isError);
  const unavailableDates = availability.data?.unavailable_dates ?? [];
  const nextAvailableDate = availability.data?.next_available_date ?? null;
  function captureLocation(): void {
    if (!navigator.geolocation) {
      setLocationMessage('Location is not available in this browser. You can still continue.');
      return;
    }
    setLocationMessage('Getting your current location…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ latitude: coords.latitude, longitude: coords.longitude });
        setIssueLocation(
          issueLocationFromReporter({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy_m: coords.accuracy,
            gps_provider: 'gps',
            captured_at: Date.now(),
            mock_heuristic: {
              likely: false,
              score: 0,
              reasons: [],
              accuracy_m: null,
              age_ms: null,
            },
          }),
        );
        setLocationMessage('Drag the pin to your exact pickup spot, or keep it here.');
      },
      () => setLocationMessage('Location could not be captured. You can still continue.'),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }
  const toast = useToast();
  async function submit(): Promise<void> {
    if (!details || !detailsValid || title.trim().length < 5) return;
    const ownerId = readSession()?.user.id ?? null;
    const idempotencyKey =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `textile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = {
      ...details,
      title: title.trim(),
      notes: notes.trim() || null,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      idempotency_key: idempotencyKey,
      photo_file: photoFile,
    } as Parameters<typeof create.mutateAsync>[0] & {
      idempotency_key?: string;
      photo_file?: File | null;
    };
    try {
      const created = await create.mutateAsync(payload);
      if (photoFile) {
        setUploadingPhoto(true);
        try {
          await uploadTextileCollectionPhoto(created.id, photoFile);
        } catch (err) {
          if (isTextileNetworkFailure(err)) {
            await getQueue(ownerId).enqueue({
              kind: 'textile.request.photo',
              payload: {
                collectionId: created.id,
                file: photoFile,
                idempotency_key: idempotencyKey,
              },
              id: `${idempotencyKey}-photo`,
            });
            void requestBackgroundSync();
            toast.show(
              'Photo queued — will upload when back online. It stays on this device only.',
              'info',
              5000,
            );
          } else {
            setPhotoUploadWarning(
              'Request created, but the photo could not be uploaded. You can add it later from the request page.',
            );
          }
        } finally {
          setUploadingPhoto(false);
        }
      }
      void navigate(`/citizen/textile-collections/${created.id}`);
    } catch (err) {
      if (isTextileNetworkFailure(err)) {
        await getQueue(ownerId).enqueue({
          kind: 'textile.request.create',
          payload,
          id: idempotencyKey,
        });
        void requestBackgroundSync();
        toast.show(
          'You are offline — request saved on this device and will send automatically when online. Check pending uploads below.',
          'info',
          6000,
        );
        void navigate('/citizen/textile-collections');
        return;
      }
      // Non-network error — create.error (ApiError) drives the existing error banner.
      return;
    }
  }
  const apiError =
    create.error instanceof ApiError
      ? create.error
      : create.error
        ? new Error(create.error.message)
        : null;
  const categoryError =
    apiError instanceof ApiError && apiError.code === 'CATEGORY_NOT_SERVED'
      ? apiError.message
      : null;
  const slotUnavailableError =
    apiError instanceof ApiError &&
    (apiError.code === 'SLOT_UNAVAILABLE' || apiError.status === 409)
      ? apiError
      : null;
  const generalError = categoryError || slotUnavailableError ? null : apiError?.message;
  const isSubmitting = create.isPending || uploadingPhoto;
  const dropoffActive = dropoffInfo !== null;
  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-6">
      <TextileOfflineBanner />
      <header className="border-b border-[var(--color-border-faint)] pb-5">
        <Link
          to="/citizen"
          className="inline-flex h-11 items-center gap-2 text-sm text-[var(--color-text-secondary)]"
        >
          <IconArrowLeft className="h-4 w-4" stroke={1.6} /> Back to services
        </Link>
        <div className="mt-4 flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-white">
            <IconRecycle className="h-5 w-5" stroke={1.7} />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              Collection service
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-normal tracking-[-0.035em]">
              Request a collection
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Pick up from location or drop at center.
            </p>
          </div>
        </div>
        <ol className="mt-4 flex gap-2 text-[10px]" aria-label="Steps">
          <li className="flex-1 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-center font-medium text-white">
            1. What to collect
          </li>
          <li className="flex-1 rounded-full bg-white px-3 py-1.5 text-center font-medium text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
            2. How much & where
          </li>
          <li className="flex-1 rounded-full bg-white px-3 py-1.5 text-center font-medium text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
            3. Photo & send
          </li>
        </ol>
      </header>
      <section className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-[var(--color-border-subtle)]">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          Step 1 — What is it?
        </p>
        <div>
          <div className="flex items-baseline gap-0.5">
            <label htmlFor="textile-title" className="text-sm font-medium">
              Short title for your request
            </label>
            <RequiredMark />
          </div>
          <input
            id="textile-title"
            value={title}
            placeholder="e.g. 2 bags of old clothes"
            aria-required="true"
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5 block min-h-11 w-full rounded-lg border border-[var(--color-border)] px-3 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </div>
        <div>
          <label htmlFor="textile-notes" className="text-sm font-medium">
            What’s inside?{' '}
            <span className="font-normal text-[var(--color-text-secondary)]">(optional)</span>
          </label>
          <textarea
            id="textile-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Wearable clothes, bedsheets, curtains"
            className="mt-1.5 block w-full rounded-lg border border-[var(--color-border)] p-3 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </div>
      </section>
      <section className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-[var(--color-border-subtle)]">
        <h2 className="text-sm font-medium">What kind of material?</h2>
        <p className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2.5 text-sm font-medium">
          <IconHanger className="h-5 w-5 text-[var(--color-ink)]" stroke={1.8} />
          Clothes & Textiles
        </p>
        <TextileMinimumNotice
          minimum={minimum}
          estimatedBags={liveBags}
          estimatedWeightKg={liveWeight}
          isLoading={minimumIsLoading}
          isError={capacityMinimum.isError}
          collectionMethod={dropoffActive ? 'dropoff' : liveMethod}
          onRetry={() => void capacityMinimum.refetch()}
        />
        {categoryError ? (
          <p role="alert" className="text-xs font-medium text-[var(--color-danger)]">
            {categoryError}
          </p>
        ) : null}
      </section>
      <TextileCollectionFields
        category={category}
        value={details}
        onChange={onDetailsChange}
        onValidityChange={onValidityChange}
        onDropoffChange={setDropoffInfo}
        onDraftChange={onDraftChange}
        minimum={minimum}
      />
      {isPremises && details ? (
        <section
          aria-label="Availability"
          className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-[var(--color-border-subtle)]"
        >
          <h2 className="text-sm font-medium">Pickup availability</h2>
          {availability.isLoading ? (
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Checking dates…</p>
          ) : unavailableDates.length > 0 ? (
            <div className="mt-2 rounded-lg border border-[var(--color-warning)]/20 bg-white p-3">
              <p className="text-xs font-medium text-[var(--color-warning)]">Unavailable dates</p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                {unavailableDates.slice(0, 8).join(', ')}
                {unavailableDates.length > 8 ? ` +${unavailableDates.length - 8} more` : ''}
              </p>
              {nextAvailableDate ? (
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Next available: <span className="font-medium">{nextAvailableDate}</span> — your
                  request will be grouped for then.
                </p>
              ) : null}
              {availability.data?.reason ? (
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {availability.data.reason}
                </p>
              ) : null}
            </div>
          ) : nextAvailableDate ? (
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
              Next available pickup:{' '}
              <span className="font-medium text-[var(--color-ink)]">{nextAvailableDate}</span>.
              Submit now and we will schedule for the next open window.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
              Pickups are available on upcoming dates. We group nearby requests into the next trip
              window.
            </p>
          )}
          {availability.data && availability.data.windows?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {availability.data.windows.map((w) => (
                <span
                  key={`${w.window_start}-${w.window_end}`}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${w.available ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20' : 'bg-zinc-100 text-zinc-500 border border-[var(--color-border-subtle)] line-through'}`}
                >
                  {w.window_start}–{w.window_end}
                  {w.available ? '' : ' unavailable'}
                </span>
              ))}
            </div>
          ) : null}
          {unavailableDates.length > 0 && availability.data?.windows?.every((w) => !w.available) ? (
            <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3 text-xs leading-5 text-[var(--color-text-secondary)]">
              <p className="font-medium">No pickup window available right now</p>
              <p className="mt-1">{slotUnavailableFallback('premises')}</p>
              <p className="mt-2 text-xs">
                You can still submit for the next open slot, or switch to drop-off above.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
      {!dropoffActive ? (
        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-[var(--color-border-subtle)]">
          <h2 className="text-sm font-medium">
            Pickup location{' '}
            <span className="font-normal text-[var(--color-text-secondary)]">(optional pin)</span>
          </h2>
          {locationMessage ? <p className="mt-2 text-xs font-medium">{locationMessage}</p> : null}
          {location ? (
            <div className="mt-3 space-y-3">
              <div className="overflow-hidden rounded-xl border border-[var(--color-border-subtle)]">
                <IssueLocationPicker
                  title="Your pickup location"
                  detail="Drag the pin to the exact spot where the collection team should pick up your textiles."
                  confirmLabel="Confirm pickup location"
                  reporterLocation={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                    accuracy_m: null,
                    gps_provider: 'gps',
                    captured_at: Date.now(),
                    mock_heuristic: {
                      likely: false,
                      score: 0,
                      reasons: [],
                      accuracy_m: null,
                      age_ms: null,
                    },
                  }}
                  value={
                    issueLocation ?? {
                      latitude: location.latitude,
                      longitude: location.longitude,
                      source: 'reporter_gps',
                    }
                  }
                  onChange={(pin) => {
                    setIssueLocation(pin);
                    setLocation({ latitude: pin.latitude, longitude: pin.longitude });
                  }}
                />
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {issueLocation?.source === 'manual_pin'
                  ? 'Pin placed manually. Drag to adjust.'
                  : 'GPS location captured. Drag the pin to refine, or leave as-is.'}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={captureLocation}
              className="mt-3 inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-[var(--color-border)] px-5 text-sm font-medium"
            >
              <IconMapPin className="h-4 w-4" stroke={1.6} /> Use current location
            </button>
          )}
        </section>
      ) : null}
      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-[var(--color-border-subtle)]">
        <div>
          <h2 className="text-sm font-medium">
            Photo of your bags{' '}
            <span className="font-normal text-[var(--color-text-secondary)]">(optional)</span>
          </h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            Helps the team recognise and count your bags. Max 10 MB.
          </p>
        </div>
        {photoPreview ? (
          <div className="mt-3 inline-block">
            <div className="relative">
              <img
                src={photoPreview}
                alt="Preview of your bags"
                className="h-40 rounded-lg border border-[var(--color-border-subtle)] object-cover"
              />
              <button
                type="button"
                onClick={removePhoto}
                aria-label="Remove photo"
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-ink)] text-white shadow-sm"
              >
                <IconX className="h-4 w-4" stroke={2} />
              </button>
            </div>
            <p className="mt-1.5 truncate text-xs text-[var(--color-text-secondary)]">
              {photoFile?.name}
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {showCamera ? (
              <div>
                <CameraCapture
                  mode="photo"
                  onCapture={(file) => {
                    applyPhotoFile(file);
                    setShowCamera(false);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowCamera(false)}
                  className="mt-2 inline-flex h-11 items-center justify-center rounded-full border border-[var(--color-border)] px-5 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-[var(--color-border)] px-5 text-sm font-medium"
                >
                  <IconCamera className="h-4 w-4" stroke={1.6} />
                  Take photo
                </button>
                <label
                  htmlFor="textile-photo-input"
                  className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-[var(--color-border)] px-5 text-sm font-medium"
                >
                  <IconPhoto className="h-4 w-4" stroke={1.6} />
                  Choose photo
                  <input
                    ref={fileInputRef}
                    id="textile-photo-input"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="sr-only"
                  />
                </label>
              </div>
            )}
          </div>
        )}
        {photoError ? (
          <p role="alert" className="mt-2 text-xs font-medium text-[var(--color-danger)]">
            {photoError}
          </p>
        ) : null}
      </section>
      {slotUnavailableError ? (
        <div
          role="alert"
          className="rounded-xl border border-[var(--color-warning)]/20 bg-white p-4"
        >
          <p className="text-sm font-medium text-[var(--color-warning)]">
            Slot no longer available
          </p>
          <p className="mt-1 text-sm leading-5 text-[var(--color-text-secondary)]">
            {slotUnavailableError.message || slotUnavailableFallback('premises')}
          </p>
          {nextAvailableDate ? (
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              Next open pickup: <span className="font-medium">{nextAvailableDate}</span>. Try
              resubmitting, or switch to drop-off — no slot needed.
            </p>
          ) : (
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              Try a different zone or switch to drop-off — no slot needed.
            </p>
          )}
        </div>
      ) : null}
      {generalError ? (
        <div
          role="alert"
          className="rounded-xl border border-[var(--color-danger)]/20 bg-white p-4 text-sm text-[var(--color-danger)]"
        >
          {generalError}
        </div>
      ) : null}
      {photoUploadWarning ? (
        <div
          role="status"
          className="rounded-xl border border-[var(--color-warning)]/20 bg-white p-4 text-sm text-[var(--color-warning)]"
        >
          {photoUploadWarning}
        </div>
      ) : null}
      {belowMinimum && !dropoffActive && minimum?.min_weight_kg != null ? (
        <p
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-5 text-amber-900"
        >
          <span className="font-semibold">
            Cannot submit — below the pickup minimum (needs at least {minimum.min_weight_kg} kg).
          </span>{' '}
          Your estimate is {liveWeight ?? '—'} kg. Add more weight, or switch to drop-off — any
          amount is accepted at the centre.
        </p>
      ) : null}
      <button
        type="button"
        disabled={
          !detailsValid ||
          title.trim().length < 5 ||
          isSubmitting ||
          pickupMinimumUnavailable ||
          (belowMinimum && !dropoffActive)
        }
        onClick={() => void submit()}
        className="h-12 w-full rounded-full bg-[var(--color-ink)] px-6 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
      >
        {uploadingPhoto
          ? 'Uploading photo…'
          : create.isPending
            ? 'Sending request…'
            : dropoffActive
              ? 'Create drop-off plan'
              : belowMinimum
                ? 'Pickup minimum not met'
                : 'Send pickup request'}
      </button>
      <p className="text-center text-xs text-[var(--color-text-tertiary)]">
        Every request is reviewed by our team before dispatch.
      </p>
    </div>
  );
}
