import { useRef, useState, useEffect, type FormEvent } from 'react';
import { type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateReport, useReportTypes, type ReportType, type CreateReportInput } from '../api/client';
import { Spinner, cx } from '../../moderator/design';
import { CameraCapture, type CameraError } from '../components/CameraCapture';
import { GpsCapture, type CapturedLocation, type GpsCaptureHandle } from '../components/GpsCapture';
import { getQueue } from '../offline/queue';
import { useToast } from '../components/Toast';
import { evidencePreviewHandlers } from '../security/evidenceGuards';
import { useReverseGeocode } from '../utils/useReverseGeocode';
import { ApiError } from '../../../auth/api';

export default function SubmitPage(): JSX.Element {
  const navigate = useNavigate();
  const toast = useToast();
  const types = useReportTypes();
  const create = useCreateReport();
  const gpsRef = useRef<GpsCaptureHandle | null>(null);
  const [typeId, setTypeId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [address, setAddress] = useState<string>('');
  // Human-readable place name for the captured GPS point (e.g. "Kengeri,
  // Bengaluru"). Empty until the lookup resolves; we show coordinates until
  // then and if geocoding is unavailable.
  const placeName = useReverseGeocode(location?.latitude ?? NaN, location?.longitude ?? NaN);
  const [files, setFiles] = useState<File[]>([]);
  const [showVideo, setShowVideo] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'type' | 'title' | 'description' | 'location' | 'evidence', string>>>({});

  function onCameraError(err: CameraError): void {
    setError(err.message);
  }

  function setFieldError(field: keyof typeof fieldErrors, message: string | null): void {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (message === null) {
        delete next[field];
      } else {
        next[field] = message;
      }
      return next;
    });
  }

  function removeFile(idx: number): void {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function addPhoto(f: File): void {
    const photoCount = files.filter((x) => x.type.startsWith('image/')).length;
    if (photoCount >= 5) {
      setError('You can attach up to 5 photos.');
      return;
    }
    setFiles((prev) => [...prev, f].slice(0, 6));
  }

  function addVideo(f: File): void {
    setFiles((prev) => [...prev.filter((x) => !x.type.startsWith('video/')), f].slice(0, 6));
  }

  /**
   * A `TypeError` (or any non-`ApiError`) from `mutateAsync` means
   * `fetch` itself failed - no network, not a server rejection. An
   * `ApiError` means the server was reachable and said no (validation,
   * auth, etc.), which must surface as a real error, not a silent
   * offline-queue save.
   */
  function isNetworkFailure(err: unknown): boolean {
    return !(err instanceof ApiError);
  }

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!typeId) { setFieldError('type', 'Pick a category.'); }
    if (title.trim().length < 5) { setFieldError('title', 'Title should be at least 5 characters.'); }
    if (description.trim().length < 10) { setFieldError('description', 'Description should be at least 10 characters.'); }
    if (Object.keys(fieldErrors).length > 0) { return; }

    const activeLocation = location ?? await gpsRef.current?.requestLocation() ?? null;
    if (activeLocation === null) { setFieldError('location', 'Allow location access to tag the report.'); return; }

    const hasPhoto = files.some((f) => f.type.startsWith('image/'));
    const hasVideo = files.some((f) => f.type.startsWith('video/'));
    if (selectedType?.requires_photo && !hasPhoto) { setFieldError('evidence', 'This category requires at least one photo.'); return; }
    if (selectedType?.requires_video && !hasVideo) { setFieldError('evidence', 'This category requires a video.'); return; }

    const payload: CreateReportInput = {
      report_type_id: typeId,
      title,
      description,
      latitude: activeLocation.latitude,
      longitude: activeLocation.longitude,
      accuracy_m: activeLocation.accuracy_m ?? undefined,
      address,
      media_files: files,
      mock_gps_score: activeLocation.mock_heuristic.score,
    };

    setSubmitting(true);
    try {
      const res = await create.mutateAsync(payload);
      void navigate(`/citizen/reports/${res.id}`);
    } catch (err) {
      if (isNetworkFailure(err)) {
        await getQueue().enqueue({ kind: 'report.create', payload });
        toast.show("Saved offline - we'll submit it when you're back online.", 'info', 6000);
        void navigate('/citizen');
        return;
      }
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedType: ReportType | undefined = types.data?.find((t) => t.id === typeId);
  const evidenceRequired = Boolean(selectedType?.requires_photo || selectedType?.requires_video);
  const reportTypes = types.data ?? [];

  // If the chosen category requires a video, reveal the recorder and
  // never let it read as optional — previously the toggle label was
  // hardcoded "(optional)", so required-video categories looked skippable.
  useEffect(() => {
    if (selectedType?.requires_video) {
      setShowVideo(true);
    }
  }, [selectedType?.requires_video]);

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void navigate('/citizen')}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-xl text-blue-700 hover:bg-slate-50"
            aria-label="Back to citizen home"
          >
            ‹
          </button>
          <div className="text-center">
            <h1 className="text-lg font-bold text-slate-950">New Report</h1>
            <p className="text-xs text-slate-500">Issue details, location, and evidence on one screen</p>
          </div>
          <span aria-hidden className="h-9 w-9" />
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-full rounded-full bg-blue-600" />
        </div>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-950">
            Issue details <span className="text-red-500" aria-hidden>*</span>
          </h2>
          {selectedType ? <span className="text-xs text-slate-500">{selectedType.name}</span> : null}
        </div>
        {types.isLoading ? (
          <Spinner label="Loading categories" />
        ) : types.isError ? (
          <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Could not load categories. Your session may have expired. Please log in again.
          </p>
        ) : reportTypes.length === 0 ? (
          <p role="alert" className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            No active report categories are available. Please contact an administrator.
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {reportTypes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeId(t.id)}
                className={cx(
                  'flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition',
                  typeId === t.id
                    ? 'border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-200'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                  fieldErrors.type ? 'border-red-400' : '',
                )}
              >
                <span aria-hidden className="text-xl">{iconForCode(t.code)}</span>
                <span className="font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        )}
        {fieldErrors.type ? (
          <p role="alert" className="mt-2 text-xs font-medium text-red-600">{fieldErrors.type}</p>
        ) : null}
        {selectedType ? (
          <p className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
            {selectedType.requires_photo ? 'Evidence required' : 'Evidence optional'}
            {selectedType.requires_video ? ' - Video required' : ''}
          </p>
        ) : null}
        <label htmlFor="report-title" className="mt-3 block text-xs font-medium text-slate-600">
          Title <span className="text-red-500" aria-hidden>*</span>
        </label>
        <input
          id="report-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Big pothole near MG Road metro gate 3"
          aria-invalid={fieldErrors.title ? true : undefined}
          className={cx(
            'mt-1 block w-full rounded-md border px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500',
            fieldErrors.title ? 'border-red-400' : 'border-slate-300',
          )}
          required
        />
        {fieldErrors.title ? (
          <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.title}</p>
        ) : null}
        <label htmlFor="report-description" className="mt-2 block text-xs font-medium text-slate-600">
          Description <span className="text-red-500" aria-hidden>*</span>
        </label>
        <textarea
          id="report-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Affects traffic; vehicles swerve into the bus lane. Approx 80 cm wide."
          aria-invalid={fieldErrors.description ? true : undefined}
          className={cx(
            'mt-1 block w-full rounded-md border px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500',
            fieldErrors.description ? 'border-red-400' : 'border-slate-300',
          )}
          required
        />
        {fieldErrors.description ? (
          <p role="alert" className="mt-1 text-xs font-medium text-red-600">{fieldErrors.description}</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-950">
            Location <span className="text-red-500" aria-hidden>*</span>
          </h2>
           {location !== null ? (
              location.mock_heuristic.likely ? (
                <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Location suspicious</span>
              ) : (
                <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">GPS verified</span>
              )
            ) : null}
        </div>
        <GpsCapture ref={gpsRef} onCapture={setLocation} className="mt-2" />
        {fieldErrors.location ? (
          <p role="alert" className="mt-2 text-xs font-medium text-red-600">{fieldErrors.location}</p>
        ) : null}
        {location !== null ? (
          <div className="mt-2 space-y-0.5">
            <span className="flex items-start gap-1 text-xs font-medium text-slate-700">
              <span aria-hidden>📍</span>
              <span>{placeName || `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}</span>
            </span>
            <span className="block text-[11px] text-slate-400">
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              {location.accuracy_m !== null ? ` (+/-${Math.round(location.accuracy_m)} m)` : ''}
            </span>
          </div>
        ) : null}
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Landmark / address (optional, helps the officer)"
          className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Evidence</h2>
            <p className="text-xs text-slate-500">Up to 5 photos and 1 short video. Each up to 25 MB.</p>
          </div>
           <span className={cx('rounded-full border px-2 py-1 text-xs font-semibold', evidenceRequired ? 'border-red-200 text-red-600' : 'border-slate-200 text-slate-500')}>
              {evidenceRequired ? 'Required' : 'Optional'}
            </span>
         </div>
        {fieldErrors.evidence ? (
          <p role="alert" className="mt-2 text-xs font-medium text-red-600">{fieldErrors.evidence}</p>
        ) : null}
        <div className="mt-2 space-y-3">
          <CameraCapture
            mode="photo"
            onCapture={addPhoto}
            onError={onCameraError}
          />
          <button
            type="button"
            onClick={() => setShowVideo((v) => !v)}
            className="w-full rounded-md border border-blue-600 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            {showVideo
              ? 'Hide video recorder'
              : `Add a short video (${selectedType?.requires_video ? 'required' : 'optional'})`}
          </button>
          {showVideo ? (
            <CameraCapture
              mode="video"
              onCapture={addVideo}
              onError={onCameraError}
            />
          ) : null}
        </div>
        {files.length > 0 ? (
          <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {files.map((f, i) => (
              <li key={i} className="relative">
                <div className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  {f.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(f)}
                      alt=""
                      className="h-full w-full object-cover"
                      {...evidencePreviewHandlers()}
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-2xl">🎥</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900/80 text-xs text-white"
                  aria-label={`Remove ${f.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {error !== null ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        {submitting ? 'Submitting…' : 'Submit report'}
      </button>
    </form>
  );
}

function iconForCode(code: string): string {
  const map: Record<string, string> = {
    illegal_parking: '🅿️',
    garbage: '🗑️',
    pothole: '🚧',
    streetlight: '💡',
    water_leakage: '💧',
    road_damage: '🛣️',
    illegal_dumping: '🚯',
    encroachment: '🚧',
    dead_animal: '🐾',
    open_drain: '🌊',
  };
  return map[code] ?? '📌';
}
