import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IconArrowLeft,
  IconDeviceDesktop,
  IconHanger,
  IconCamera,
  IconMapPin,
  IconPhoto,
  IconRecycle,
  IconSettings,
  IconX,
} from '@tabler/icons-react';
import { cx } from '../../../shared/ui';
import IssueLocationPicker from '../components/IssueLocationPicker';
import { CameraCapture } from '../components/CameraCapture';
import { issueLocationFromReporter, type IssueLocation } from '../components/issueLocation';
import { ApiError } from '../../../shared/api/errors';
import { TextileCollectionFields } from '../components/TextileCollectionFields';
import { CentreCard } from '../components/CentreCard';
import {
  useCreateTextileCollection,
  useTextileAvailability,
  uploadTextileCollectionPhoto,
  type TextileCollectionCategory,
  type TextileCollectionPayload,
} from '../api/textileZones';
import { slotUnavailableFallback } from './textileStatusCopy';

const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CATEGORY_OPTIONS: {
  value: TextileCollectionCategory;
  label: string;
  icon: typeof IconHanger;
}[] = [
  { value: 'clothes_waste', label: 'Clothes & Textiles', icon: IconHanger },
  { value: 'metal_scrap', label: 'Metal Scrap', icon: IconSettings },
  { value: 'e_waste', label: 'E-Waste', icon: IconDeviceDesktop },
];
function validatePhotoFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Please select a JPEG, PNG, or WebP image.';
  if (file.size > MAX_PHOTO_SIZE_BYTES)
    return 'Photo must be 10 MB or smaller. Please choose a smaller file.';
  return null;
}
export default function TextileRequestPage(): JSX.Element {
  const navigate = useNavigate();
  const create = useCreateTextileCollection();
  const [category, setCategory] = useState<TextileCollectionCategory>('clothes_waste');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [details, setDetails] = useState<TextileCollectionPayload | null>(null);
  const [detailsValid, setDetailsValid] = useState(false);
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
  const availability = useTextileAvailability(
    details?.service_zone_id ?? null,
    details?.collection_method ?? null,
  );
  const isPremises = details?.collection_method === 'premises';
  const unavailableDates = availability.data?.unavailable_dates ?? [];
  const nextAvailableDate = availability.data?.next_available_date ?? null;
  function handleCategoryChange(next: TextileCollectionCategory): void {
    setCategory(next);
    setDetails(null);
  }
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
  async function submit(): Promise<void> {
    if (!details || !detailsValid || title.trim().length < 5) return;
    const created = await create.mutateAsync({
      ...details,
      title: title.trim(),
      notes: notes.trim() || null,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
    });
    if (photoFile) {
      setUploadingPhoto(true);
      try {
        await uploadTextileCollectionPhoto(created.id, photoFile);
      } catch {
        setPhotoUploadWarning(
          'Request created, but the photo could not be uploaded. You can add it later from the request page.',
        );
      } finally {
        setUploadingPhoto(false);
      }
    }
    void navigate(`/citizen/textile-collections/${created.id}`);
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
    apiError instanceof ApiError && (apiError.code === 'SLOT_UNAVAILABLE' || apiError.status === 409)
      ? apiError
      : null;
  const generalError = categoryError || slotUnavailableError ? null : apiError?.message;
  const isSubmitting = create.isPending || uploadingPhoto;
  const dropoffActive = dropoffInfo !== null;
  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-6">
      <header className="border-b border-[var(--color-border-faint)] pb-6">
        <Link
          to="/citizen"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--color-text-secondary)]"
        >
          <IconArrowLeft className="h-4 w-4" stroke={1.6} /> Back to services
        </Link>
        <div className="mt-4 flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-white">
            <IconRecycle className="h-5 w-5" stroke={1.7} />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
              Collection service
            </p>
            <h1 className="mt-1 text-3xl font-normal tracking-[-0.035em]">Request a collection</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              Send items to a verified local partner for pickup or drop-off.
            </p>
          </div>
        </div>
      </header>
      <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
        <div>
          <label htmlFor="textile-title" className="text-sm font-medium">
            Request title
          </label>
          <input
            id="textile-title"
            value={title}
            placeholder="e.g. Wardrobe cleanout"
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-[#d8d6cf] px-3 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </div>
        <div>
          <label htmlFor="textile-notes" className="text-sm font-medium">
            What should be collected?
          </label>
          <textarea
            id="textile-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="For example: wearable clothes, bedsheets and curtains"
            className="mt-1 block w-full rounded-lg border border-[#d8d6cf] p-3 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </div>
      </section>
      <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-sm font-medium">What are we collecting?</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
            Choose the material type so we can route your request to the right partner.
          </p>
        </div>
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 max-[360px]:grid-cols-2"
          role="radiogroup"
          aria-label="Material category"
        >
          {CATEGORY_OPTIONS.map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className={cx(
                'flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center text-sm min-h-11',
                category === value
                  ? 'border-[var(--color-ink)] bg-[var(--color-surface-alt)] font-medium'
                  : 'border-[#d8d6cf] bg-white',
              )}
            >
              <input
                type="radio"
                name="textile-category"
                value={value}
                checked={category === value}
                onChange={() => handleCategoryChange(value)}
                className="sr-only"
              />
              <Icon className="h-5 w-5 text-[var(--color-ink)]" stroke={1.8} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {dropoffActive ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            No minimum — drop off any amount during centre hours.
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-medium">Minimum quantities for a collection route:</p>
            <ul className="mt-1 space-y-0.5 pl-4" style={{ listStyleType: 'disc' }}>
              <li>Clothes &amp; Textiles — about 5 kg</li>
              <li>Metal Scrap — about 5 kg</li>
              <li>E-Waste — about 2 kg</li>
            </ul>
          </div>
        )}
        {categoryError ? (
          <p role="alert" className="text-xs font-medium text-red-600">
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
      />
      {isPremises && details ? (
        <section aria-label="Availability" className="rounded-xl border border-black/10 bg-white p-5">
          <h2 className="text-sm font-medium">Pickup availability</h2>
          {availability.isLoading ? (
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Checking dates…</p>
          ) : unavailableDates.length > 0 ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-800">Unavailable dates</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">{unavailableDates.slice(0, 8).join(', ')}{unavailableDates.length > 8 ? ` +${unavailableDates.length - 8} more` : ''}</p>
              {nextAvailableDate ? <p className="mt-1 text-xs text-amber-700">Next available: <span className="font-medium">{nextAvailableDate}</span> — your request will be grouped for then.</p> : null}
              {availability.data?.reason ? <p className="mt-1 text-[11px] text-amber-700">{availability.data.reason}</p> : null}
            </div>
          ) : nextAvailableDate ? (
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">Next available pickup: <span className="font-medium text-[var(--color-ink)]">{nextAvailableDate}</span>. Submit now and we will schedule for the next open window.</p>
          ) : (
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">Pickups are available on upcoming dates. We group nearby requests into the next trip window.</p>
          )}
          {availability.data && availability.data.windows?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {availability.data.windows.map((w) => (
                <span key={`${w.window_start}-${w.window_end}`} className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${w.available ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-zinc-100 text-zinc-500 border border-black/10 line-through'}`}>
                  {w.window_start}–{w.window_end}{w.available ? '' : ' unavailable'}
                </span>
              ))}
            </div>
          ) : null}
          {unavailableDates.length > 0 && availability.data?.windows?.every((w) => !w.available) ? (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
              <p className="font-medium">No pickup window available right now</p>
              <p className="mt-1">{slotUnavailableFallback('premises')}</p>
              <p className="mt-2 text-[11px]">You can still submit for the next open slot, or switch to drop-off above.</p>
            </div>
          ) : null}
        </section>
      ) : null}
      {dropoffActive ? (
        <section className="rounded-xl border border-black/10 bg-white p-5">
          <h2 className="text-sm font-medium">Drop-off location</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
            Take your items to the collection point below. No pickup is arranged.
          </p>
          <div className="mt-3">
            <CentreCard
              name={dropoffInfo.name}
              address={dropoffInfo.address}
              center={dropoffInfo.center}
            />
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-black/10 bg-white p-5">
          <h2 className="text-sm font-medium">Pickup location</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
            Optional. Add your exact location so the collection team finds you easily.
          </p>
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
              className="mt-3 inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-black/15 px-5 text-sm font-medium"
            >
              <IconMapPin className="h-4 w-4" stroke={1.6} /> Use current location
            </button>
          )}
        </section>
      )}
      <section className="rounded-xl border border-black/10 bg-white p-5">
        <h2 className="text-sm font-medium">Add a photo of your bags (optional)</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
          {dropoffActive
            ? 'A photo helps centre staff recognise your bags. You can also add one later.'
            : 'A photo helps the collection team identify your items. You can also add one later.'}
        </p>
        {photoPreview ? (
          <div className="mt-3 inline-block">
            <div className="relative">
              <img
                src={photoPreview}
                alt="Preview of your bags"
                className="h-40 rounded-lg border border-black/10 object-cover"
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
                  className="mt-2 inline-flex min-h-10 items-center rounded-full border border-black/15 px-5 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-black/15 px-5 text-sm font-medium"
                >
                  <IconCamera className="h-4 w-4" stroke={1.6} />
                  Take photo
                </button>
                <label
                  htmlFor="textile-photo-input"
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-black/15 px-5 text-sm font-medium"
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
          <p role="alert" className="mt-2 text-xs font-medium text-red-600">
            {photoError}
          </p>
        ) : null}
      </section>
      {slotUnavailableError ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">Slot no longer available</p>
          <p className="mt-1 text-sm leading-5 text-amber-800">{slotUnavailableError.message || slotUnavailableFallback('premises')}</p>
          {nextAvailableDate ? <p className="mt-2 text-xs text-amber-700">Next open pickup: <span className="font-medium">{nextAvailableDate}</span>. Try resubmitting, or switch to drop-off — no slot needed.</p> : <p className="mt-2 text-xs text-amber-700">Try a different zone or switch to drop-off — no slot needed.</p>}
        </div>
      ) : null}
      {generalError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {generalError}
        </div>
      ) : null}
      {photoUploadWarning ? (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          {photoUploadWarning}
        </div>
      ) : null}
      <button
        type="button"
        disabled={!detailsValid || title.trim().length < 5 || isSubmitting}
        onClick={() => void submit()}
        className="min-h-12 w-full rounded-full bg-[var(--color-ink)] px-6 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
      >
        {uploadingPhoto
          ? 'Uploading photo…'
          : create.isPending
            ? 'Sending request…'
            : dropoffActive
              ? 'Create drop-off plan'
              : 'Send pickup request'}
      </button>
    </div>
  );
}
