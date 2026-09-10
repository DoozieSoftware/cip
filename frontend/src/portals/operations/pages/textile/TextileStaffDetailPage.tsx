import { useState, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconMapPin,
  IconPhone,
  IconMail,
  IconUser,
  IconCalendar,
  IconPackage,
  IconClock,
  IconAlertTriangle,
  IconBuildingCommunity,
} from '@tabler/icons-react';
import { ConfirmActionDialog } from '../../components/ConfirmActionDialog';
import {
  approveTextileCollection,
  fetchTextileDetail,
  recordTextileOutcome,
  updateTextileZoneDropoff,
} from '../../api/textileApi';
import { DeskStates, MethodBadge, StatusBadge, useDesk } from './shared';

export default function TextileStaffDetailPage(): JSX.Element {
  const desk = useDesk();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [rejectOpen, setRejectOpen] = useState(false);

  const detail = useQuery({
    queryKey: ['operations', 'textile', 'detail', id, desk.departmentId],
    queryFn: () => fetchTextileDetail(id!, desk.departmentId),
    enabled: desk.ready && desk.isDrLinen && !!id,
  });

  const item = detail.data;
  const evidencePhoto = item?.photos?.find((p) => p.role === 'evidence');
  const proofPhoto = item?.photos?.find((p) => p.role === 'proof');

  if (!desk.ready) {
    return (
      <div className="py-20 text-center">
        <span className="text-sm text-[var(--color-text-secondary)]">Loading…</span>
      </div>
    );
  }
  if (!desk.isDrLinen) {
    return (
      <div className="py-20 text-center text-sm text-[var(--color-text-secondary)]">
        Switch to Dr. Linen to view this request.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 sm:px-6 py-4">
      {/* Top Nav & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => void navigate(-1)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
        >
          <IconArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        {item ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              {item.reference}
            </span>
            <StatusBadge status={item.status} />
          </div>
        ) : null}
      </div>

      <DeskStates
        loading={detail.isLoading}
        error={detail.isError}
        onRetry={() => void detail.refetch()}
        hasRows={!!item}
        emptyTitle="Request not found"
        emptyBody="This textile collection request could not be loaded."
      >
        {item && (
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Left Main Column: Request Overview, Requester & Evidence */}
            <div className="space-y-4 lg:col-span-7">
              {/* Header card */}
              <header className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      {item.reference}
                    </p>
                    <h1 className="mt-1 text-lg font-bold tracking-tight text-[var(--color-ink)]">
                      {item.title || 'Textile pickup request'}
                    </h1>
                  </div>
                  <MethodBadge method={item.collection_method} />
                </div>
                {item.notes ? (
                  <div className="mt-3 rounded-lg border-l-2 border-[var(--color-ink)] bg-[var(--color-surface-alt)] p-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                    <span className="font-semibold text-[var(--color-ink)]">Requester note: </span>
                    {item.notes}
                  </div>
                ) : null}
              </header>

              {/* Requester & Location card */}
              <section className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm sm:p-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Requester &amp; Location
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Requester
                    </p>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-ink)]">
                      <IconUser className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                      <span>{item.requester_name || '—'}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Requester type
                    </p>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-ink)]">
                      <IconBuildingCommunity className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                      <span>
                        {item.requester_type === 'rwa'
                          ? `RWA — ${item.rwa_name || 'Community'}`
                          : 'Individual'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Phone
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--color-ink)]">
                      <IconPhone className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                      {item.contact_phone ? (
                        <a
                          href={`tel:${item.contact_phone}`}
                          className="font-mono hover:underline hover:text-[var(--color-ink)]"
                        >
                          {item.contact_phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Email
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--color-ink)]">
                      <IconMail className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                      {item.contact_email ? (
                        <a
                          href={`mailto:${item.contact_email}`}
                          className="truncate hover:underline hover:text-[var(--color-ink)]"
                        >
                          {item.contact_email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-2 space-y-1 border-t border-[var(--color-border-subtle)] pt-2.5">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Pickup address
                    </p>
                    <div className="flex items-start gap-1.5 text-xs text-[var(--color-ink)]">
                      <IconMapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
                      <span className="leading-snug">{item.pickup_address || '—'}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Photos card — always shown while awaiting review so the approver
                  can tell "no photo uploaded" apart from a load failure. */}
              {evidencePhoto || proofPhoto || item.status === 'pending_review' ? (
                <section className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm sm:p-5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Photos &amp; Proof
                  </h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {evidencePhoto ? (
                      <div className="overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)]">
                        <div className="border-b border-[var(--color-border-subtle)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                          Citizen photo
                        </div>
                        <img
                          src={evidencePhoto.url}
                          alt="Items before collection"
                          className="h-48 w-full object-cover transition hover:scale-[1.02]"
                          loading="lazy"
                        />
                      </div>
                    ) : null}
                    {proofPhoto ? (
                      <div className="overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)]">
                        <div className="border-b border-[var(--color-border-subtle)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                          Collection proof
                        </div>
                        <img
                          src={proofPhoto.url}
                          alt="Collection proof"
                          className="h-48 w-full object-cover transition hover:scale-[1.02]"
                          loading="lazy"
                        />
                      </div>
                    ) : null}
                    {evidencePhoto && !proofPhoto ? (
                      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] p-4 text-center text-xs text-[var(--color-text-tertiary)]">
                        Collection proof will appear here after pickup.
                      </div>
                    ) : null}
                    {!evidencePhoto && !proofPhoto ? (
                      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] p-4 text-center text-xs text-[var(--color-text-tertiary)]">
                        No citizen photo uploaded — review the written details to decide.
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {/* Drop-off point editing (for dropoff method with a zone) */}
              {item.collection_method === 'dropoff' && item.service_zone ? (
                <DropoffEditSection
                  zoneId={item.service_zone.id}
                  dropoffName={item.service_zone.dropoff_name ?? ''}
                  dropoffAddress={item.service_zone.dropoff_address ?? ''}
                  departmentId={desk.departmentId}
                />
              ) : null}
            </div>

            {/* Right Column: Actions, Volume & Timeline */}
            <div className="space-y-4 lg:col-span-5">
              {/* Contextual Action Center */}
              {item.status === 'pending_review' ? (
                <section className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm sm:p-5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Review Decision
                  </h2>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Approve to make this request schedulable, or reject with a citizen notice.
                  </p>
                  <div className="mt-3.5 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => {
                        void approveTextileCollection(item.id, desk.departmentId).then(
                          () => void detail.refetch(),
                        );
                      }}
                      className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-[var(--color-ink)] px-4 text-xs font-semibold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                    >
                      Approve request
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectOpen(true)}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--color-danger)]/30 bg-white px-4 text-xs font-medium text-[var(--color-danger)] transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-1"
                    >
                      Reject
                    </button>
                  </div>
                </section>
              ) : null}

              {item.status === 'ready_to_group' && item.collection_method !== 'dropoff' ? (
                <section className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm sm:p-5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Trip scheduling
                  </h2>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Approved and ready to be batched into a collection route.
                  </p>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => void navigate('/operations/textile-collections/schedule')}
                      className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-[var(--color-ink)] px-4 text-xs font-semibold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
                    >
                      Open trip scheduling desk →
                    </button>
                  </div>
                </section>
              ) : null}

              {item.collection_method === 'dropoff' &&
              (item.status === 'ready_to_group' || item.status === 'dropoff_awaiting_drop') ? (
                <section className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm sm:p-5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Drop-off receipt
                  </h2>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Citizen can drop textiles at the centre. Record bags, weight, and proof upon
                    arrival.
                  </p>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() =>
                        void navigate('/operations/textile-collections/pickup-requests')
                      }
                      className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-[var(--color-ink)] px-4 text-xs font-semibold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
                    >
                      Open pickup request desk →
                    </button>
                  </div>
                </section>
              ) : null}

              {item.status === 'scheduled' ? (
                <section className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm sm:p-5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Active trip
                  </h2>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Scheduled for {item.scheduled_date ?? 'upcoming collection'}
                    {item.batch?.reference ? ` · Trip ${item.batch.reference}` : ''}
                    {item.batch?.driver_name ? ` · Driver: ${item.batch.driver_name}` : ''}.
                  </p>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => void navigate('/operations/textile-collections/collections')}
                      className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-[var(--color-ink)] px-4 text-xs font-semibold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
                    >
                      Open collections board →
                    </button>
                  </div>
                </section>
              ) : null}

              {/* Volume & Specifications */}
              <section className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm sm:p-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Volume &amp; Material
                </h2>
                <div className="mt-3 divide-y divide-[var(--color-border-subtle)] text-xs">
                  <div className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                      <IconPackage className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                      Estimated volume
                    </span>
                    <span className="font-semibold text-[var(--color-ink)]">
                      {item.estimated_bags ?? '—'} bags · {item.estimated_weight_kg ?? '—'} kg
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                      <IconPackage className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                      Collected volume
                    </span>
                    <span className="font-semibold text-[var(--color-ink)]">
                      {item.actual_bags !== null
                        ? `${item.actual_bags} bags · ${item.actual_weight_kg} kg`
                        : 'Not yet collected'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-[var(--color-text-secondary)]">Category</span>
                    <span className="font-medium text-[var(--color-ink)]">
                      {item.category ?? '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-[var(--color-text-secondary)]">Zone</span>
                    <span className="font-medium text-[var(--color-ink)]">
                      {item.service_zone?.name ?? '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-[var(--color-text-secondary)]">Method</span>
                    <span className="font-medium text-[var(--color-ink)]">
                      {item.collection_method === 'dropoff'
                        ? 'Drop-off at collection point'
                        : 'Premises pickup'}
                    </span>
                  </div>
                </div>
              </section>

              {/* Lifecycle & Audit */}
              <section className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm sm:p-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Lifecycle &amp; Audit
                </h2>
                <div className="mt-3 divide-y divide-[var(--color-border-subtle)] text-xs">
                  <div className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                      <IconClock className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                      Submitted
                    </span>
                    <span className="font-mono text-[11px] text-[var(--color-ink)]">
                      {item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                      <IconCalendar className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                      Scheduled
                    </span>
                    <span className="font-mono text-[11px] text-[var(--color-ink)]">
                      {item.scheduled_date ?? 'Not scheduled'}
                    </span>
                  </div>

                  {item.partner ? (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-[var(--color-text-secondary)]">Partner</span>
                      <span className="font-medium text-[var(--color-ink)]">
                        {item.partner.name}
                      </span>
                    </div>
                  ) : null}

                  {item.rejection_reason ? (
                    <div className="py-2.5">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-danger)]">
                        <IconAlertTriangle className="h-3 w-3" /> Rejection reason
                      </div>
                      <p className="mt-1 rounded bg-rose-50 p-2 text-xs text-[var(--color-danger)] border border-rose-200">
                        {item.rejection_reason}
                      </p>
                    </div>
                  ) : null}

                  {item.missed_pickup_reason ? (
                    <div className="py-2.5">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
                        <IconAlertTriangle className="h-3 w-3" /> Missed reason
                      </div>
                      <p className="mt-1 rounded bg-amber-50 p-2 text-xs text-amber-800 border border-amber-200">
                        {item.missed_pickup_reason}
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        )}
      </DeskStates>

      {item ? (
        <ConfirmActionDialog
          open={rejectOpen}
          title={`Reject ${item.reference}`}
          description="The requester will be notified that the request cannot be fulfilled, with this reason."
          confirmLabel="Reject request"
          confirmVariant="danger"
          requiresNote
          onClose={() => setRejectOpen(false)}
          onConfirm={(note) => {
            if (note) {
              void recordTextileOutcome(item.id, {
                outcome: 'rejected',
                reason: note,
                department_id: desk.departmentId,
              }).then(() => void detail.refetch());
            }
            setRejectOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

interface DropoffEditSectionProps {
  zoneId: string;
  dropoffName: string;
  dropoffAddress: string;
  departmentId: string | undefined;
}

function DropoffEditSection({
  zoneId,
  dropoffName,
  dropoffAddress,
  departmentId,
}: DropoffEditSectionProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(dropoffName);
  const [address, setAddress] = useState(dropoffAddress);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await updateTextileZoneDropoff(
        zoneId,
        { dropoff_name: name || null, dropoff_address: address || null },
        departmentId,
      );
      setEditing(false);
    } catch {
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
          Drop-off point
        </h2>
        {!editing ? (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setName(dropoffName);
              setAddress(dropoffAddress);
            }}
            className="inline-flex h-7 items-center justify-center rounded-md border border-[var(--color-border)] bg-white px-2.5 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)]"
          >
            Edit
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Drop-off name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block h-9 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
            />
          </label>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Drop-off address
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-white p-2.5 text-xs text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--color-ink)] px-3.5 text-xs font-semibold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)] disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setName(dropoffName);
                setAddress(dropoffAddress);
              }}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ink)]"
            >
              Cancel
            </button>
          </div>
          {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}
        </div>
      ) : (
        <div className="mt-2 text-xs">
          <p className="font-semibold text-[var(--color-ink)]">{dropoffName || 'Not set'}</p>
          <p className="mt-0.5 text-[var(--color-text-secondary)]">{dropoffAddress || '—'}</p>
        </div>
      )}
    </section>
  );
}
