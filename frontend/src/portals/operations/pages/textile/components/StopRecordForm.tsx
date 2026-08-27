import { useRef, useState, useEffect, type JSX } from 'react';
import { IconCamera } from '@tabler/icons-react';
import type { TextileCollectionListItem } from '../../../api/textileApi';
import { validatePhotoFile } from '../photoCapture';

export function StopRecordForm({
  item,
  onSubmit,
  busy,
}: {
  item: TextileCollectionListItem;
  onSubmit: (p: { bags: number; weight: number; file: File }) => void;
  busy: boolean;
}): JSX.Element {
  const [bags, setBags] = useState(String(item.estimated_bags ?? ''));
  const [weight, setWeight] = useState(String(item.estimated_weight_kg ?? ''));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const can = Number(bags) > 0 && Number(weight) > 0 && file !== null;
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
  return (
    <div className="rounded-lg bg-[var(--color-surface-alt)] p-3">
      <div className="flex flex-wrap gap-3">
        <label className="text-xs font-medium">
          Actual bags
          <input
            type="number"
            min={1}
            value={bags}
            onChange={(e) => setBags(e.target.value)}
            className="mt-1 block min-h-11 w-28 rounded-lg border border-black/15 bg-white px-3 text-sm"
          />
        </label>
        <label className="text-xs font-medium">
          Actual weight (kg)
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="mt-1 block min-h-11 w-32 rounded-lg border border-black/15 bg-white px-3 text-sm"
          />
        </label>
        <div>
          <p className="text-xs font-medium">
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
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-4 text-sm"
          >
            {file ? 'Replace photo' : 'Choose photo'}
            <IconCamera className="h-4 w-4" />
          </button>
        </div>
      </div>
      {preview ? (
        <img src={preview} alt="preview" className="mt-2 h-16 w-16 rounded object-cover" />
      ) : null}
      {err ? (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {err}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!can || busy}
          onClick={() => file && onSubmit({ bags: Number(bags), weight: Number(weight), file })}
          className="min-h-10 rounded-full bg-[var(--color-ink)] px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? 'Uploading…' : 'Confirm collected'}
        </button>
      </div>
    </div>
  );
}
