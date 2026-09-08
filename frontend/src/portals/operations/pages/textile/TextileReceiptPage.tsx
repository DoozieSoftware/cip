import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { IconCamera, IconCircleCheck, IconSearch } from '@tabler/icons-react';
import { ApiError } from '../../../../shared/api/errors';
import {
  recordDropoffReceipt,
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

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'quantity_mismatch', label: 'Wrong quantity' },
  { value: 'wrong_material', label: 'Wrong material' },
  { value: 'outside_zone', label: 'Outside service area' },
  { value: 'damaged_wet', label: 'Damaged or wet' },
  { value: 'no_show_at_centre', label: 'No show at centre' },
  { value: 'other', label: 'Other' },
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
  const [confirmed, setConfirmed] = useState<{
    reference: string;
    bags: string;
    weight: string;
  } | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (confirmed) successHeadingRef.current?.focus();
  }, [confirmed]);

  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );

  const queue = useTextileQueue({
    // Phase 1 lane-aware approve sends drop-offs to `dropoff_awaiting_drop`;
    // `ready_to_group` kept for pre-lane records so the counter can still find them.
    status: 'dropoff_awaiting_drop,ready_to_group',
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
    if (!selected || !canConfirm || busy || confirmed) return;
    const zoneId = selected.service_zone?.id;
    if (!zoneId) {
      setServerError('This booking has no service zone; configure the centre before receipt.');
      return;
    }
    setBusy(true);
    setServerError(null);
    const confirmedReference = selected.reference;
    const confirmedBags = bags;
    const confirmedWeight = weight;
    try {
      if (!photoFile) return;
      // One key per receipt attempt so a retry after a network failure cannot
      // double-record the receipt (docs/11 idempotency requirement).
      const idempotencyKey =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? `receipt-${crypto.randomUUID()}`
          : `receipt-${Date.now()}`;
      const proof = await uploadTextileProofPhoto(selected.id, photoFile, desk.departmentId);
      await recordDropoffReceipt(zoneId, {
        collection_request_id: selected.id,
        actual_bags: Number(bags),
        actual_weight_kg: Number(weight),
        proof_media_id: proof.photo.id,
        exception_code: reason || undefined,
        exception_reason: reason ? `${reason}${note ? ': ' + note : ''}` : undefined,
        idempotencyKey,
        department_id: desk.departmentId,
      });
      setConfirmed({
        reference: confirmedReference,
        bags: confirmedBags,
        weight: confirmedWeight,
      });
    } catch (e) {
      if (e instanceof ApiError) setServerError(e.message);
      else setServerError('Failed to record receipt');
    } finally {
      setBusy(false);
    }
  }

  function resetToFreshForm() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setQuery('');
    setSearch('');
    setSelected(null);
    setBags('');
    setWeight('');
    setReason('');
    setNote('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoError(null);
    setServerError(null);
    setConfirmed(null);
    setBusy(false);
    // Search input stays mounted in the left column; return focus there so
    // staff can scan the next booking without extra taps.
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    } else {
      searchInputRef.current?.focus();
    }
  }

  return (
    <DeskPage
      desk={desk}
      title="Centre receipt"
      description="Find a drop-off booking by reference or phone, verify, weigh and confirm receipt."
    >
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(query.trim());
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <IconSearch
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
                stroke={1.65}
              />
              <input
                ref={searchInputRef}
                inputMode="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Scan QR or type DL-… / phone"
                aria-label="Search by reference or phone"
                className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white pl-9 pr-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 focus-visible:border-[var(--color-border-strong)]"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--color-ink)] px-4 text-xs font-semibold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
            >
              Find
            </button>
          </form>
          {!search ? (
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              Enter a reference like DL-24-0917 or a phone number.
            </p>
          ) : null}
          {search && queue.isLoading ? (
            <p className="text-xs text-[var(--color-text-secondary)]">Searching…</p>
          ) : null}
          {search && queue.isError ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-danger)]/20 bg-rose-50 px-3 py-2.5 text-xs text-[var(--color-danger)]"
            >
              <span>Could not search bookings.</span>
              <button
                type="button"
                onClick={() => void queue.refetch()}
                className="inline-flex h-7 items-center justify-center rounded-md border border-[var(--color-border)] bg-white px-2.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)]"
              >
                Retry
              </button>
            </div>
          ) : null}
          {search && !queue.isLoading && !queue.isError && rows.length === 0 ? (
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm text-xs text-[var(--color-text-secondary)]">
              No booking found for “{search}”.
            </div>
          ) : null}
          {rows.length > 1 && !selected ? (
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-white shadow-sm overflow-hidden">
              <div className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                {rows.length} matching bookings
              </div>
              <ul className="max-h-72 divide-y divide-[var(--color-border-subtle)] overflow-y-auto">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(r)}
                      className="w-full px-3 py-2 text-left text-xs transition hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:bg-[var(--color-surface-alt)]"
                    >
                      <span className="font-mono font-medium text-[var(--color-ink)]">
                        {r.reference}
                      </span>{' '}
                      —{' '}
                      <span className="text-[var(--color-text-secondary)]">{r.requester_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {selected ? (
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-[var(--color-ink)]">
                  {selected.reference}
                </span>
                <StatusBadge status={selected.status} />
              </div>
              <p className="font-medium text-[var(--color-ink)]">
                {selected.requester_name} · {selected.contact_phone.slice(0, 3)}****
                {selected.contact_phone.slice(-2)}
              </p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                {selected.service_zone?.name ?? '—'}{' '}
                {selected.service_zone?.dropoff_name
                  ? `· ${selected.service_zone.dropoff_name}`
                  : ''}
              </p>
              {selected.service_zone?.dropoff_address ? (
                <p className="text-[11px] text-[var(--color-text-tertiary)]">
                  {selected.service_zone.dropoff_address}
                </p>
              ) : null}
              <p className="rounded bg-[var(--color-surface-alt)] px-2 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
                Est. {formatVolume(selected.estimated_bags, selected.estimated_weight_kg)}
              </p>
              {selected.status === 'picked_up' ? (
                <p className="text-xs text-[var(--color-warning)]">
                  Already received at {selected.picked_up_at ?? '—'}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 sm:p-5 shadow-sm">
          {confirmed ? (
            <div className="space-y-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-success)]/[0.12] text-[var(--color-success)]">
                <IconCircleCheck className="h-5 w-5" stroke={1.75} aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2
                  ref={successHeadingRef}
                  tabIndex={-1}
                  className="text-base font-semibold text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2 rounded"
                >
                  Receipt confirmed
                </h2>
                <p role="status" className="text-xs text-[var(--color-text-secondary)]">
                  Receipt confirmed for{' '}
                  <span className="font-mono text-xs font-semibold text-[var(--color-ink)]">
                    {confirmed.reference}
                  </span>{' '}
                  — {confirmed.bags} bags, {confirmed.weight} kg
                </p>
              </div>
              <button
                type="button"
                onClick={resetToFreshForm}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--color-ink)] px-4 text-xs font-semibold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
              >
                Find next booking
              </button>
            </div>
          ) : !selected ? (
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
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Weigh &amp; count
              </h2>
              <div className="flex flex-wrap gap-3">
                <label className="text-xs font-medium text-[var(--color-ink)]">
                  Actual bags
                  <input
                    type="number"
                    min={1}
                    value={bags}
                    onChange={(e) => setBags(e.target.value)}
                    className="mt-1 block h-10 w-28 rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 focus-visible:border-[var(--color-border-strong)]"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--color-ink)]">
                  Actual weight (kg)
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="mt-1 block h-10 w-32 rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 focus-visible:border-[var(--color-border-strong)]"
                  />
                </label>
              </div>
              {weight && selected.estimated_weight_kg !== null ? (
                <p
                  className={`text-xs ${Math.abs(variancePct) >= 50 ? 'text-[var(--color-danger)]' : Math.abs(variancePct) >= 25 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-secondary)]'}`}
                >
                  Variance: {variance > 0 ? '+' : ''}
                  {variance.toFixed(1)} kg ({variancePct.toFixed(0)}%){' '}
                  {needsReason ? '— reason required' : ''}
                </p>
              ) : null}

              <div>
                <p className="text-xs font-medium text-[var(--color-ink)]">
                  Proof photo <span className="text-[var(--color-danger)]">(required)</span>
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
                  className="mt-1 inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
                >
                  {photoFile ? 'Replace photo' : 'Choose photo'}
                  <IconCamera className="h-3.5 w-3.5" />
                </button>
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="proof preview"
                    className="mt-2 h-20 w-20 rounded-lg border border-[var(--color-border-subtle)] object-cover"
                  />
                ) : null}
                {photoError ? (
                  <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
                    {photoError}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--color-ink)]">
                  Reason{' '}
                  {needsReason ? (
                    <span className="text-[var(--color-danger)]">*</span>
                  ) : (
                    <span className="text-[var(--color-text-tertiary)]">(optional)</span>
                  )}
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1 block w-full h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 focus-visible:border-[var(--color-border-strong)]"
                  >
                    <option value="">Select reason</option>
                    {REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note"
                  rows={2}
                  className="block w-full rounded-lg border border-[var(--color-border)] bg-white p-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 focus-visible:border-[var(--color-border-strong)]"
                />
              </div>

              {serverError ? (
                <p role="alert" className="text-xs text-[var(--color-danger)]">
                  {serverError}
                </p>
              ) : null}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={!canConfirm || busy}
                  onClick={() => void confirm()}
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--color-ink)] px-4 text-xs font-semibold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 disabled:opacity-40"
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
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)]"
                >
                  Clear
                </button>
              </div>
              {!canConfirm && selected ? (
                <p className="text-[11px] text-[var(--color-text-secondary)]">
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
