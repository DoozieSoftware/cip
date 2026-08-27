import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { IconCamera, IconSearch } from '@tabler/icons-react';
import { ApiError } from '../../../../shared/api/errors';
import {
  recordTextileOutcome,
  uploadTextileProofPhoto,
  type TextileCollectionListItem,
} from '../../api/textileApi';
import {
  DeskPage,
  DeskStates,
  formatVolume,
  StatusBadge,
  useDesk,
  useTextileQueue,
} from './shared';
import { validatePhotoFile } from './photoCapture';

const REASONS = [
  'quantity_mismatch',
  'wrong_material',
  'outside_zone',
  'damaged_wet',
  'no_show_at_centre',
  'other',
];

export default function TextileReceiptPage(): JSX.Element {
  const desk = useDesk();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TextileCollectionListItem | null>(null);
  const [bags, setBags] = useState('');
  const [weight, setWeight] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );

  const queue = useTextileQueue({
    status: 'ready_to_group',
    search,
    page: 1,
    collectionMethod: 'dropoff',
    enabled: desk.ready && desk.isDrLinen && search.length > 0,
    departmentId: desk.departmentId,
  });
  const rows = useMemo(() => queue.data?.data ?? [], [queue.data]);

  // when search results arrive, auto-select exact reference match
  useEffect(() => {
    if (!search) {
      setSelected(null);
      return;
    }
    const exact = rows.find(
      (r) => r.reference.toLowerCase() === search.toLowerCase() || r.contact_phone.includes(search),
    );
    if (exact) setSelected(exact);
    else if (rows.length === 1) setSelected(rows[0]);
    else if (rows.length === 0) setSelected(null);
  }, [rows, search]);

  const variance = selected ? Number(weight || 0) - (selected.estimated_weight_kg ?? 0) : 0;
  const variancePct = selected?.estimated_weight_kg
    ? (variance / selected.estimated_weight_kg) * 100
    : 0;
  const needsReason =
    Math.abs(variancePct) >= 25 || Number(bags) !== (selected?.estimated_bags ?? Number(bags));
  const canConfirm =
    selected && Number(bags) > 0 && Number(weight) > 0 && photoFile && (!needsReason || reason);

  function handlePhoto(f: File | null) {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setServerError(null);
    if (!f) {
      setPhotoFile(null);
      setPhotoError('Photo is required');
      return;
    }
    const err = validatePhotoFile(f);
    if (err) {
      setPhotoFile(null);
      setPhotoError(err);
      return;
    }
    setPhotoFile(f);
    setPhotoError(null);
    setPhotoPreview(URL.createObjectURL(f));
  }

  async function confirm() {
    if (!selected || !canConfirm) return;
    setBusy(true);
    setServerError(null);
    try {
      if (!photoFile) return;
      await uploadTextileProofPhoto(selected.id, photoFile, desk.departmentId);
      await recordTextileOutcome(selected.id, {
        outcome: 'collected',
        actual_bags: Number(bags),
        actual_weight_kg: Number(weight),
        reason: reason ? `${reason}${note ? ': ' + note : ''}` : undefined,
        department_id: desk.departmentId,
      });
      setSuccess(`Receipt confirmed for ${selected.reference} — ${bags} bags, ${weight} kg`);
    } catch (e) {
      if (e instanceof ApiError) setServerError(e.message);
      else setServerError('Failed to record receipt');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DeskPage
      desk={desk}
      title="Centre receipt"
      description="Find a drop-off booking by reference or phone, verify, weigh and confirm receipt."
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(query.trim());
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <input
                inputMode="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Scan QR or type DL-… / phone"
                aria-label="Search by reference or phone"
                className="min-h-12 w-full rounded-xl border border-black/15 bg-white pl-9 pr-3 text-sm"
              />
            </div>
            <button
              type="submit"
              className="min-h-12 rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white"
            >
              Find
            </button>
          </form>
          {!search ? (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Enter a reference like DL-24-0917 or a phone number.
            </p>
          ) : null}
          {search && queue.isLoading ? (
            <p className="text-sm text-[var(--color-text-secondary)]">Searching…</p>
          ) : null}
          {search && !queue.isLoading && rows.length === 0 ? (
            <div className="rounded-xl border border-black/10 bg-white p-4 text-sm">
              No booking found for “{search}”.
            </div>
          ) : null}
          {rows.length > 1 && !selected ? (
            <ul className="divide-y divide-black/5 rounded-xl border border-black/10 bg-white">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className="w-full px-4 py-3 text-left text-sm hover:bg-[var(--color-surface-alt)]"
                  >
                    <span className="font-mono text-xs">{r.reference}</span> — {r.requester_name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {selected ? (
            <div className="rounded-xl border border-black/10 bg-white p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-medium">{selected.reference}</span>
                <StatusBadge status={selected.status} />
              </div>
              <p className="mt-1 font-medium">
                {selected.requester_name} · {selected.contact_phone.slice(0, 3)}****
                {selected.contact_phone.slice(-2)}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {selected.service_zone?.name ?? '—'}{' '}
                {selected.service_zone?.dropoff_name
                  ? `· ${selected.service_zone.dropoff_name}`
                  : ''}
              </p>
              {selected.service_zone?.dropoff_address ? (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {selected.service_zone.dropoff_address}
                </p>
              ) : null}
              <p className="mt-2 text-xs">
                Est. {formatVolume(selected.estimated_bags, selected.estimated_weight_kg)}
              </p>
              {selected.status === 'picked_up' ? (
                <p className="mt-2 text-xs text-amber-700">
                  Already received at {selected.picked_up_at ?? '—'}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-4">
          {!selected ? (
            <DeskStates
              loading={false}
              error={false}
              hasRows={false}
              emptyTitle="Select a booking"
              emptyBody="Search and select a drop-off booking to record receipt."
              onRetry={() => {}}
            >
              <span />
            </DeskStates>
          ) : (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold">Weigh &amp; count</h2>
              <div className="flex flex-wrap gap-3">
                <label className="text-xs font-medium">
                  Actual bags
                  <input
                    type="number"
                    min={1}
                    value={bags}
                    onChange={(e) => setBags(e.target.value)}
                    className="mt-1 block min-h-12 w-28 rounded-lg border border-black/15 bg-white px-3 text-sm"
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
                    className="mt-1 block min-h-12 w-32 rounded-lg border border-black/15 bg-white px-3 text-sm"
                  />
                </label>
              </div>
              {weight && selected.estimated_weight_kg !== null ? (
                <p
                  className={`text-xs ${Math.abs(variancePct) >= 50 ? 'text-rose-600' : Math.abs(variancePct) >= 25 ? 'text-amber-700' : 'text-[var(--color-text-secondary)]'}`}
                >
                  Variance: {variance > 0 ? '+' : ''}
                  {variance.toFixed(1)} kg ({variancePct.toFixed(0)}%){' '}
                  {needsReason ? '— reason required' : ''}
                </p>
              ) : null}

              <div>
                <p className="text-xs font-medium">
                  Proof photo <span className="text-red-700">(required)</span>
                </p>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-4 text-sm font-medium"
                >
                  {photoFile ? 'Replace photo' : 'Choose photo'}
                  <IconCamera className="h-4 w-4" />
                </button>
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="proof preview"
                    className="mt-2 h-20 w-20 rounded object-cover"
                  />
                ) : null}
                {photoError ? (
                  <p role="alert" className="mt-1 text-xs text-red-600">
                    {photoError}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">
                  Reason{' '}
                  {needsReason ? (
                    <span className="text-red-700">*</span>
                  ) : (
                    <span className="text-[var(--color-text-tertiary)]">(optional)</span>
                  )}
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1 block w-full min-h-11 rounded-lg border border-black/15 bg-white px-3 text-sm"
                  >
                    <option value="">Select reason</option>
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note"
                  rows={2}
                  className="block w-full rounded-lg border border-black/15 bg-white p-3 text-sm"
                />
              </div>

              {serverError ? (
                <p role="alert" className="text-xs text-red-600">
                  {serverError}
                </p>
              ) : null}
              {success ? (
                <p
                  role="status"
                  className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
                >
                  {success}
                </p>
              ) : null}

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!canConfirm || busy}
                  onClick={() => void confirm()}
                  className="min-h-11 rounded-full bg-[var(--color-ink)] px-6 text-sm font-medium text-white disabled:opacity-40"
                >
                  {busy ? 'Confirming…' : 'Confirm receipt'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setSearch('');
                    setQuery('');
                  }}
                  className="min-h-11 rounded-full border border-black/15 bg-white px-4 text-sm"
                >
                  Clear
                </button>
              </div>
              {!canConfirm && selected ? (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Enter bags, weight and photo{needsReason ? ' and a reason' : ''} to confirm.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </DeskPage>
  );
}
