import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useMutation } from '@tanstack/react-query';
import { IconCalendar, IconCamera, IconPhoto, IconRefresh } from '@tabler/icons-react';
import { ApiError } from '../../../../shared/api/errors';
import { ConfirmActionDialog } from '../../components/ConfirmActionDialog';
import {
  recordTextileOutcome,
  uploadTextileProofPhoto,
  type TextileCollectionListItem,
} from '../../api/textileApi';
import {
  CategoryBadge,
  CategoryFilter,
  DeskPage,
  DeskStates,
  Pager,
  SearchBox,
  useDesk,
  useTextileQueue,
  ZoneFilter,
  formatVolume,
} from './shared';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function validatePhotoFile(file: File | null): string | null {
  if (!file) return 'Photo is required';
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) return 'File must be JPEG, PNG, or WebP';
  if (file.size > MAX_PHOTO_BYTES) return 'File must be ≤ 10 MB';
  return null;
}

export default function TextileDispatchPage(): JSX.Element {
  const desk = useDesk();
  const [search, setSearch] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bags, setBags] = useState('');
  const [weight, setWeight] = useState('');
  const [missedTarget, setMissedTarget] = useState<TextileCollectionListItem | null>(null);

  // Proof photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Revoke object URL on cleanup or when photo changes
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const queue = useTextileQueue({
    status: 'scheduled',
    search,
    page,
    zoneId: zoneId || undefined,
    categoryId: categoryId || undefined,
    enabled: desk.ready && desk.isDrLinen,
    departmentId: desk.departmentId,
  });
  const rows = useMemo(() => queue.data?.data ?? [], [queue.data?.data]);

  const outcome = useMutation({
    mutationFn: ({
      id,
      kind,
      bags: actualBags,
      weight: actualWeight,
      reason,
    }: {
      id: string;
      kind: 'collected' | 'missed';
      bags?: number;
      weight?: number;
      reason?: string;
    }) =>
      recordTextileOutcome(id, {
        outcome: kind,
        department_id: desk.departmentId,
        ...(kind === 'collected'
          ? { actual_bags: actualBags, actual_weight_kg: actualWeight }
          : { reason }),
      }),
    onSuccess: () => {
      setExpandedId(null);
      setMissedTarget(null);
      resetPhotoState();
      void queue.refetch();
    },
  });

  function resetPhotoState() {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoError(null);
    setServerError(null);
    setUploadBusy(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  function handlePhotoChange(file: File | null) {
    // Revoke previous preview
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setServerError(null);

    if (!file) {
      setPhotoFile(null);
      setPhotoError('Photo is required');
      return;
    }

    const err = validatePhotoFile(file);
    if (err) {
      setPhotoFile(null);
      setPhotoError(err);
      return;
    }

    setPhotoFile(file);
    setPhotoError(null);
    setPhotoPreview(URL.createObjectURL(file));
  }

  const canConfirm = Number(bags) > 0 && Number(weight) > 0 && photoFile !== null;

  async function handleConfirmCollect(item: TextileCollectionListItem) {
    if (!canConfirm || uploadBusy) return;

    setServerError(null);
    setUploadBusy(true);
    try {
      // Step 1: upload proof photo first
      await uploadTextileProofPhoto(item.id, photoFile, desk.departmentId);
      // Step 2: record the outcome (photo already attached → no 422)
      await outcome.mutateAsync({
        id: item.id,
        kind: 'collected',
        bags: Number(bags),
        weight: Number(weight),
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PROOF_PHOTO_REQUIRED') {
        setServerError('A proof photo is required before recording the collection.');
      } else if (err instanceof ApiError) {
        // Photo upload failed or other API error
        const isPhotoUpload =
          err.message.toLowerCase().includes('photo') ||
          err.message.toLowerCase().includes('upload');
        setServerError(isPhotoUpload ? 'Photo upload failed — try again' : err.message);
      } else {
        setServerError('An unexpected error occurred — try again');
      }
    } finally {
      setUploadBusy(false);
    }
  }

  const trips = useMemo(() => {
    const map = new Map<string, { label: string; items: TextileCollectionListItem[] }>();
    for (const row of rows) {
      const key = row.batch?.id ?? 'none';
      const entry = map.get(key) ?? {
        label: row.batch
          ? `${row.batch.reference} · ${row.batch.collection_date}`
          : 'Unassigned trip',
        items: [],
      };
      entry.items.push(row);
      map.set(key, entry);
    }
    return [...map.values()];
  }, [rows]);

  return (
    <DeskPage
      desk={desk}
      title="Dispatch board"
      description="Today's trips and their stops. Log what was actually collected, or mark a stop missed with the reason."
      toolbar={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchBox
            value={search}
            onChange={(next) => {
              setSearch(next);
              setPage(1);
            }}
          />
          <ZoneFilter
            value={zoneId}
            onChange={(next) => {
              setZoneId(next);
              setPage(1);
            }}
          />
          <CategoryFilter
            value={categoryId}
            onChange={(next) => {
              setCategoryId(next);
              setPage(1);
            }}
          />
          <button
            type="button"
            onClick={() => void queue.refetch()}
            className="inline-flex min-h-10 items-center gap-2 self-start rounded-full border border-black/15 bg-white px-4 text-sm font-medium"
          >
            <IconRefresh className="h-4 w-4" /> Refresh
          </button>
        </div>
      }
    >
      <DeskStates
        loading={queue.isLoading}
        error={queue.isError}
        onRetry={() => void queue.refetch()}
        hasRows={rows.length > 0}
        emptyTitle="No scheduled pickups"
        emptyBody="Schedule a trip on the Trip scheduling page and it will appear here for dispatch."
      >
        <div className="space-y-4">
          {trips.map(({ label, items }) => (
            <section
              key={label}
              className="overflow-hidden rounded-xl border border-black/10 bg-white"
            >
              <header className="flex items-center gap-2 border-b border-black/5 bg-[var(--color-surface-alt)] px-4 py-3">
                <IconCalendar className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                <h2 className="text-sm font-semibold">{label}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium">
                  {items.length} stops
                </span>
              </header>
              <ul className="divide-y divide-black/5">
                {items.map((item) => {
                  const hasProof = item.photos?.some((p) => p.role === 'proof');
                  const evidencePhoto = item.photos?.find((p) => p.role === 'evidence');
                  return (
                    <li key={item.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        {evidencePhoto ? (
                          <img
                            src={evidencePhoto.url}
                            alt="Citizen evidence"
                            className="h-12 w-12 flex-shrink-0 rounded object-cover"
                          />
                        ) : null}
                        <span className="font-mono text-xs">{item.reference}</span>
                        <CategoryBadge category={item.category} />
                        <span className="min-w-0 flex-1 truncate">
                          {item.requester_name} · {item.pickup_address}
                        </span>
                        <span className="whitespace-nowrap text-xs text-[var(--color-text-secondary)]">
                          Est. {formatVolume(item.estimated_bags, item.estimated_weight_kg)}
                        </span>
                        {hasProof ? (
                          <span className="whitespace-nowrap text-[10px] font-medium text-emerald-600">
                            proof ✓
                          </span>
                        ) : null}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={outcome.isPending || uploadBusy}
                            onClick={() => {
                              resetPhotoState();
                              setExpandedId(expandedId === item.id ? null : item.id);
                              setBags(String(item.estimated_bags ?? ''));
                              setWeight(String(item.estimated_weight_kg ?? ''));
                            }}
                            className="min-h-9 rounded-full bg-[var(--color-ink)] px-3.5 text-xs font-medium text-white disabled:opacity-40"
                          >
                            Record collection
                          </button>
                          <button
                            type="button"
                            disabled={outcome.isPending || uploadBusy}
                            onClick={() => setMissedTarget(item)}
                            className="min-h-9 rounded-full border border-black/15 px-3.5 text-xs disabled:opacity-40"
                          >
                            Mark missed
                          </button>
                        </div>
                      </div>
                      {expandedId === item.id ? (
                        <div className="mt-3 rounded-lg bg-[var(--color-surface-alt)] p-3">
                          <div className="flex flex-wrap items-start gap-3">
                            <label className="text-xs font-medium">
                              Actual bags
                              <input
                                type="number"
                                min="1"
                                value={bags}
                                onChange={(event) => setBags(event.target.value)}
                                className="mt-1 block min-h-11 w-28 rounded-lg border border-black/15 bg-white px-3 text-sm"
                              />
                            </label>
                            <label className="text-xs font-medium">
                              Actual weight (kg)
                              <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={weight}
                                onChange={(event) => setWeight(event.target.value)}
                                className="mt-1 block min-h-11 w-32 rounded-lg border border-black/15 bg-white px-3 text-sm"
                              />
                            </label>
                            <div className="min-w-[220px]">
                              <p className="text-xs font-medium">
                                Proof photo <span className="text-red-700">(required)</span>
                              </p>
                              <input
                                ref={photoInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                capture="environment"
                                onChange={(event) =>
                                  handlePhotoChange(event.target.files?.[0] ?? null)
                                }
                                className="sr-only"
                                tabIndex={-1}
                                aria-hidden="true"
                              />
                              <button
                                type="button"
                                disabled={outcome.isPending || uploadBusy}
                                onClick={() => photoInputRef.current?.click()}
                                className="mt-1 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-alt)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <IconCamera className="h-4 w-4" stroke={1.6} />
                                {photoFile ? 'Replace proof photo' : 'Choose proof photo'}
                              </button>
                              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                JPG, PNG or WebP, up to 10 MB.
                              </p>
                            </div>
                          </div>

                          {/* Photo preview + filename */}
                          {photoPreview ? (
                            <div className="mt-2 flex items-center gap-3">
                              <img
                                src={photoPreview}
                                alt="Proof preview"
                                className="h-16 w-16 rounded object-cover"
                              />
                              <span className="max-w-[180px] truncate text-xs text-[var(--color-text-secondary)]">
                                {photoFile?.name}
                              </span>
                            </div>
                          ) : photoFile ? (
                            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                              {photoFile.name}
                            </p>
                          ) : null}

                          {/* Validation / server errors */}
                          {photoError ? (
                            <p role="alert" className="mt-1 text-xs text-red-600">
                              {photoError}
                            </p>
                          ) : null}
                          {serverError ? (
                            <p role="alert" className="mt-1 text-xs text-red-600">
                              {serverError}
                            </p>
                          ) : null}
                          {!canConfirm ? (
                            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                              Enter the actual bags and weight, then add a proof photo to confirm.
                            </p>
                          ) : null}

                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              disabled={outcome.isPending || uploadBusy || !canConfirm}
                              onClick={() => void handleConfirmCollect(item)}
                              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 text-sm font-medium text-white disabled:opacity-40"
                            >
                              {uploadBusy ? (
                                <>
                                  <IconPhoto className="h-4 w-4 animate-pulse" />
                                  Uploading proof…
                                </>
                              ) : (
                                'Confirm collected'
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={uploadBusy}
                              onClick={() => {
                                resetPhotoState();
                                setExpandedId(null);
                              }}
                              className="min-h-10 rounded-full border border-black/15 bg-white px-4 text-sm disabled:opacity-40"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <ConfirmActionDialog
            open={missedTarget !== null}
            title={`Mark ${missedTarget?.reference ?? ''} as missed`}
            description="The visit will be logged as a missed pickup and the request can be re-scheduled into a future trip."
            confirmLabel="Log missed pickup"
            confirmVariant="danger"
            requiresNote
            busy={outcome.isPending}
            onClose={() => setMissedTarget(null)}
            onConfirm={(note) => {
              if (missedTarget && note) {
                void outcome.mutateAsync({ id: missedTarget.id, kind: 'missed', reason: note });
              }
            }}
          />
        </div>
      </DeskStates>

      <Pager meta={queue.data?.meta} onPage={setPage} />
    </DeskPage>
  );
}
