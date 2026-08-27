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
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import IssueLocationPicker from '../components/IssueLocationPicker';
import { CameraCapture } from '../components/CameraCapture';
import { issueLocationFromReporter, type IssueLocation } from '../components/issueLocation';
import { ApiError } from '../../../shared/api/errors';
import { TextileCollectionFields } from '../components/TextileCollectionFields';
import {
  useCreateTextileCollection,
  uploadTextileCollectionPhoto,
  type TextileCollectionCategory,
  type TextileCollectionPayload,
} from '../api/textileZones';

const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
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

const DROP_OFF_PIN = L.divIcon({
  className: 'cip-dropoff-pin',
  html: '<span aria-hidden="true" style="display:block;width:22px;height:22px;border-radius:50%;background:#1d6fb8;border:3px solid #fff;box-shadow:0 1px 5px #0008"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function DropOffMap({ center }: { center: { latitude: number; longitude: number } }): JSX.Element {
  return (
    <div
      role="img"
      aria-label="Map showing the collection point area"
      className="mt-3 overflow-hidden rounded-lg border border-blue-200"
      style={{ height: 190 }}
    >
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        attributionControl={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        touchZoom={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[center.latitude, center.longitude]} icon={DROP_OFF_PIN} />
      </MapContainer>
    </div>
  );
}

function googleMapsUrl(info: {
  name: string;
  address: string;
  center: { latitude: number; longitude: number } | null;
}): string {
  if (info.center) {
    return `https://www.google.com/maps?q=${info.center.latitude}%2C${info.center.longitude}`;
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(`${info.name} ${info.address}`)}`;
}

function validatePhotoFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Please select a JPEG, PNG, or WebP image.';
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return 'Photo must be 10 MB or smaller. Please choose a smaller file.';
  }
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

  // --- Photo picker state ---
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadWarning, setPhotoUploadWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  // Revoke object URL on cleanup or when the preview changes.
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
    // Clear the input so the same file can be re-selected after removal.
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

  const onDetailsChange = useCallback((next: TextileCollectionPayload | null) => {
    setDetails(next);
  }, []);
  const onValidityChange = useCallback((valid: boolean) => setDetailsValid(valid), []);

  function handleCategoryChange(next: TextileCollectionCategory): void {
    setCategory(next);
    // Clear zone selection when category changes — the zone list will refetch.
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

    // Upload the optional photo *after* the request is created.
    // A photo upload failure is non-blocking — the user is redirected
    // to the detail page with a warning.
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
  const generalError = categoryError ? null : apiError?.message;
  const isSubmitting = create.isPending || uploadingPhoto;

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
              Pickup service
            </p>
            <h1 className="mt-1 text-3xl font-normal tracking-[-0.035em]">Request a collection</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              This is a pickup request sent to a verified local partner. It is not a civic
              complaint.
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
            onChange={(event) => setTitle(event.target.value)}
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
            onChange={(event) => setNotes(event.target.value)}
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
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Material category">
          {CATEGORY_OPTIONS.map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className={cx(
                'flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center text-sm',
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
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-medium">Minimum quantities for a collection route:</p>
          <ul className="mt-1 space-y-0.5 pl-4" style={{ listStyleType: 'disc' }}>
            <li>Clothes &amp; Textiles — about 5 kg</li>
            <li>Metal Scrap — about 5 kg</li>
            <li>E-Waste — about 2 kg</li>
          </ul>
        </div>
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

      {dropoffInfo ? (
        <section className="rounded-xl border border border-black/10 bg-white p-5">
          <h2 className="text-sm font-medium">Drop-off location</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
            Take your items to the collection point below. No pickup is arranged.
          </p>
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-medium text-blue-800">📍 Drop-off point</p>
            <p className="mt-0.5 text-base font-semibold text-blue-900">{dropoffInfo.name}</p>
            <p className="mt-0.5 text-sm text-blue-700">{dropoffInfo.address}</p>
            <a
              href={googleMapsUrl(dropoffInfo)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-blue-300 bg-white px-5 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              <IconMapPin className="h-4 w-4" stroke={1.6} />
              Open in Google Maps
            </a>
          </div>
          {dropoffInfo.center ? <DropOffMap center={dropoffInfo.center} /> : null}
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

      {/* --- Optional photo picker --- */}
      <section className="rounded-xl border border-black/10 bg-white p-5">
        <h2 className="text-sm font-medium">Add a photo of your bags (optional)</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
          A photo helps the collection team identify your items. You can also add one later.
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
            : 'Send pickup request'}
      </button>
    </div>
  );
}
