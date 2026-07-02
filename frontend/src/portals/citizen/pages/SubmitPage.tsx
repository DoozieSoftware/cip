import { useState, type FormEvent } from 'react';
import { type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateReport, useReportTypes, type ReportType, type CreateReportInput } from '../api/client';
import { Spinner, cx } from '../../moderator/design';
import { CameraCapture, type CameraError } from '../components/CameraCapture';
import { GpsCapture, type CapturedLocation } from '../components/GpsCapture';
import { getQueue } from '../offline/queue';
import { useToast } from '../components/Toast';
import { ApiError } from '../../../auth/api';

export default function SubmitPage(): JSX.Element {
  const navigate = useNavigate();
  const toast = useToast();
  const types = useReportTypes();
  const create = useCreateReport();
  const [typeId, setTypeId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [address, setAddress] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [showVideo, setShowVideo] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  function onCameraError(err: CameraError): void {
    setError(err.message);
  }
  const [error, setError] = useState<string | null>(null);

  function removeFile(idx: number): void {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  /**
   * A `TypeError` (or any non-`ApiError`) from `mutateAsync` means
   * `fetch` itself failed — no network, not a server rejection. An
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
    if (!typeId) { setError('Pick a category.'); return; }
    if (title.length < 5) { setError('Title should be at least 5 characters.'); return; }
    if (description.length < 10) { setError('Description should be at least 10 characters.'); return; }
    if (location === null) { setError('Tap "Use my location" to tag the report.'); return; }

    const payload: CreateReportInput = {
      report_type_id: typeId,
      title,
      description,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy_m: location.accuracy_m ?? undefined,
      address,
      media_files: files,
      mock_gps_score: location.mock_heuristic.score,
    };

    setSubmitting(true);
    try {
      const res = await create.mutateAsync(payload);
      void navigate(`/citizen/reports/${res.id}`);
    } catch (err) {
      if (isNetworkFailure(err)) {
        await getQueue().enqueue({ kind: 'report.create', payload });
        toast.show("Saved offline — we'll submit it when you're back online.", 'info', 6000);
        void navigate('/citizen');
        return;
      }
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedType: ReportType | undefined = types.data?.find((t) => t.id === typeId);

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Report an issue</h1>
        <p className="text-sm text-slate-600">Add a photo, pick a category, tag the location. The rest is automatic.</p>
      </header>

      <section>
        <h2 className="text-sm font-semibold text-slate-700">1 · Category</h2>
        {types.isLoading ? (
          <Spinner label="Loading categories" />
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(types.data ?? []).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeId(t.id)}
                className={cx(
                  'flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition',
                  typeId === t.id
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                )}
              >
                <span aria-hidden className="text-xl">{iconForCode(t.code)}</span>
                <span className="font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        )}
        {selectedType && (
          <p className="mt-2 text-xs text-slate-500">
            {selectedType.requires_photo ? 'Photo required.' : 'Photo optional.'} {selectedType.requires_video ? 'Video required.' : ''}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700">2 · Title and description</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Big pothole near MG Road metro gate 3"
          className="mt-2 block w-full rounded-md border-slate-300 px-3 py-2 text-base shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
          required
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Affects traffic; vehicles swerve into the bus lane. Approx 80 cm wide."
          className="mt-2 block w-full rounded-md border-slate-300 px-3 py-2 text-base shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
          required
        />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700">3 · Location</h2>
        <GpsCapture onCapture={setLocation} className="mt-2" />
        {location !== null && (
          <span className="text-xs text-slate-600">
            {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
            {location.accuracy_m !== null && ` (±${Math.round(location.accuracy_m)} m)`}
          </span>
        )}
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Landmark / address (optional, helps the officer)"
          className="mt-2 block w-full rounded-md border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
        />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700">4 · Photo / video evidence</h2>
        <p className="text-xs text-slate-500">Up to 5 photos and 1 short video. Each up to 25 MB.</p>
        <div className="mt-2 space-y-3">
          <CameraCapture mode="photo" onCapture={(f) => setFiles((prev) => [...prev, f].slice(0, 5))} onError={onCameraError} />
          <button
            type="button"
            onClick={() => setShowVideo((v) => !v)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {showVideo ? 'Hide video recorder' : 'Add a short video (optional)'}
          </button>
          {showVideo ? (
            <CameraCapture
              mode="video"
              onCapture={(f) => setFiles((prev) => [...prev, f].slice(0, 5))}
              onError={onCameraError}
            />
          ) : null}
        </div>
        {files.length > 0 && (
          <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {files.map((f, i) => (
              <li key={i} className="relative">
                <div className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  {f.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
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
        )}
      </section>

      {error !== null && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:bg-emerald-300"
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
