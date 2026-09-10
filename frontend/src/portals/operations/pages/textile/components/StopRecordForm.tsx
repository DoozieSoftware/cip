import { useRef, useState, useEffect, type JSX } from 'react';
import { IconCamera, IconPhoto } from '@tabler/icons-react';
import type { TextileCollectionListItem } from '../../../api/textileApi';
import { CameraCapture } from '../../../../citizen/components/CameraCapture';
import { validatePhotoFile } from '../photoCapture';

export function StopRecordForm({
  item,
  onSubmit,
  busy,
}: {
  item: TextileCollectionListItem;
  onSubmit: (p: { bags: number; weight: number; file: File; reason?: string }) => void;
  busy: boolean;
}): JSX.Element {
  const [bags, setBags] = useState(String(item.estimated_bags ?? ''));
  const [weight, setWeight] = useState(String(item.estimated_weight_kg ?? ''));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const estBags = item.estimated_bags ?? 0;
  const estKg = item.estimated_weight_kg ?? 0;
  const varianceBags = Number(bags || 0) - estBags;
  const varianceKg = Number(weight || 0) - estKg;
  const variancePct = estKg ? (varianceKg / estKg) * 100 : 0;
  const needsReason = Math.abs(variancePct) >= 25 || Number(bags) !== estBags;
  const can =
    Number(bags) > 0 &&
    Number(weight) > 0 &&
    file !== null &&
    (!needsReason || reason.trim().length > 0);

  function handle(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (!f) {
      setFile(null);
      setErr('Photo is required');
      return;
    }
    const e = validatePhotoFile(f);
    if (e) {
      setFile(null);
      setErr(e);
      return;
    }
    setFile(f);
    setErr(null);
    setPreview(URL.createObjectURL(f));
  }

  const evidencePhoto = item.photos?.find((p) => p.role === 'evidence');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      {item.readiness_instructions ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          Instructions: {item.readiness_instructions}
        </p>
      ) : null}
      {evidencePhoto ? (
        <div className="mb-3 flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-2">
          <img
            src={evidencePhoto.url}
            alt="citizen evidence"
            className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200"
          />
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-800">Citizen evidence photo</span>
            <p className="text-[11px] text-slate-500">Provided at booking</p>
          </div>
        </div>
      ) : null}
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Collection Verification
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
          Est. {item.estimated_bags ?? '—'} bags · {item.estimated_weight_kg ?? '—'} kg
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <label className="text-xs font-semibold text-slate-700">
          Actual bags
          <input
            type="number"
            min={1}
            value={bags}
            onChange={(e) => setBags(e.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 text-sm font-semibold text-slate-900 shadow-2xs transition focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Actual weight (kg)
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 text-sm font-semibold text-slate-900 shadow-2xs transition focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </label>
      </div>

      <div className="mt-3.5">
        <p className="text-xs font-semibold text-slate-700">
          Proof photo <span className="text-red-700">(required)</span>
        </p>
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(e) => handle(e.target.files?.[0] ?? null)}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setCameraError(null);
              setShowCamera(true);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <IconCamera className="h-4 w-4 text-slate-600" />
            Take photo
          </button>
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <IconPhoto className="h-4 w-4 text-slate-600" />
            {file ? 'Replace photo' : 'Choose proof photo'}
          </button>
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt="preview"
                className="h-11 w-11 rounded-lg object-cover ring-2 ring-emerald-500 shadow-2xs"
              />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                ✓
              </span>
            </div>
          ) : null}
        </div>
        {showCamera ? (
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <CameraCapture
              mode="photo"
              onCapture={(f) => {
                setCameraError(null);
                setShowCamera(false);
                handle(f);
              }}
              onError={(e) => setCameraError(e.message)}
            />
            {cameraError ? (
              <p role="status" className="mt-2 text-[11px] text-slate-600">
                {cameraError} You can choose a photo file instead.
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowCamera(false)}
                className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                Cancel camera
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCamera(false);
                  ref.current?.click();
                }}
                className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                Choose a file instead
              </button>
            </div>
          </div>
        ) : null}
        <p className="mt-1.5 text-[11px] text-slate-500">JPG, PNG or WebP, up to 10 MB.</p>
      </div>

      {weight && estKg ? (
        <p
          className={`mt-3 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
            Math.abs(variancePct) >= 50
              ? 'border border-rose-200 bg-rose-50 text-rose-800'
              : Math.abs(variancePct) >= 25
                ? 'border border-amber-200 bg-amber-50 text-amber-900'
                : 'border border-slate-200 bg-slate-50 text-slate-700'
          }`}
        >
          Variance: {varianceBags > 0 ? `+${varianceBags}` : `${varianceBags}`} bags,{' '}
          {varianceKg > 0 ? '+' : ''}
          {varianceKg.toFixed(1)} kg ({variancePct.toFixed(0)}%){' '}
          {needsReason ? '— remarks required' : ''}
        </p>
      ) : null}

      {needsReason ? (
        <label className="mt-3 block text-xs font-semibold text-slate-800">
          Remarks <span className="text-red-700">*</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Brief remark — e.g. half a kg more than estimated"
            className="mt-1 block w-full min-h-11 rounded-lg border border-amber-300 bg-amber-50/40 px-3 text-sm text-slate-900 shadow-2xs focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </label>
      ) : null}

      {err ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-red-600">
          {err}
        </p>
      ) : null}

      <div className="mt-5 border-t border-slate-100 pt-3">
        <button
          type="button"
          disabled={!can || busy}
          onClick={() =>
            file &&
            onSubmit({
              bags: Number(bags),
              weight: Number(weight),
              file,
              reason: reason || undefined,
            })
          }
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-1 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          {busy ? 'Uploading…' : 'Confirm'}
        </button>
      </div>

      {!can ? (
        <p className="mt-2 text-center text-xs text-slate-500">
          Enter bags, weight, photo{needsReason ? ' and remarks' : ''} to confirm.
        </p>
      ) : null}
    </div>
  );
}
