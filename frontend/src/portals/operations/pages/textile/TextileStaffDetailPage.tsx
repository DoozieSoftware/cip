import { useState, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { ConfirmActionDialog } from '../../components/ConfirmActionDialog';
import {
  approveTextileCollection,
  fetchTextileDetail,
  recordTextileOutcome,
  updateTextileZoneDropoff,
} from '../../api/textileApi';
import { DeskStates, StatusBadge, useDesk } from './shared';

export default function TextileStaffDetailPage(): JSX.Element {
  const desk = useDesk();
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
      <div className="py-20">
        <span className="text-sm text-[var(--color-text-secondary)]">Loading…</span>
      </div>
    );
  }
  if (!desk.isDrLinen) {
    return (
      <div className="py-20 text-sm text-[var(--color-text-secondary)]">
        Switch to Dr. Linen to view this request.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <Link
        to="/operations/textile-collections/review"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-ink)]"
      >
        <IconArrowLeft className="h-4 w-4" /> Back to reviews
      </Link>

      <DeskStates
        loading={detail.isLoading}
        error={detail.isError}
        onRetry={() => void detail.refetch()}
        hasRows={!!item}
        emptyTitle="Request not found"
        emptyBody="This textile collection request could not be loaded."
      >
        {item && (
          <>
            {/* Header */}
            <header className="rounded-xl bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
                    {item.reference}
                  </p>
                  <h1 className="mt-1 text-xl font-medium">
                    {item.title || 'Textile pickup request'}
                  </h1>
                  {item.notes ? (
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.notes}</p>
                  ) : null}
                </div>
                <StatusBadge status={item.status} />
              </div>
              {item.partner ? (
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  Collected by {item.partner.name}
                </p>
              ) : null}
            </header>

            {/* Details grid */}
            <section className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="text-sm font-medium text-[var(--color-ink)]">Request details</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Detail label="Requester" value={item.requester_name} />
                <Detail label="Phone" value={item.contact_phone} />
                <Detail label="Email" value={item.contact_email} />
                <Detail
                  label="Requester type"
                  value={item.requester_type === 'rwa' ? `RWA — ${''}` : 'Individual'}
                />
                <Detail label="Pickup address" value={item.pickup_address} />
                <Detail label="Zone" value={item.service_zone?.name ?? '—'} />
                <Detail
                  label="Method"
                  value={
                    item.collection_method === 'dropoff'
                      ? 'Drop-off at collection point'
                      : 'Premises pickup'
                  }
                />
                <Detail label="Category" value={item.category ?? '—'} />
                <Detail
                  label="Estimated volume"
                  value={`${item.estimated_bags ?? '—'} bags · ${item.estimated_weight_kg ?? '—'} kg`}
                />
                <Detail
                  label="Collected volume"
                  value={
                    item.actual_bags !== null
                      ? `${item.actual_bags} bags · ${item.actual_weight_kg} kg`
                      : 'Not yet collected'
                  }
                />
                <Detail
                  label="Submitted"
                  value={item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '—'}
                />
                <Detail label="Scheduled" value={item.scheduled_date ?? 'Not scheduled'} />
                {item.rejection_reason ? (
                  <Detail label="Rejection reason" value={item.rejection_reason} />
                ) : null}
                {item.missed_pickup_reason ? (
                  <Detail label="Missed reason" value={item.missed_pickup_reason} />
                ) : null}
              </div>
            </section>

            {/* Photos */}
            {evidencePhoto || proofPhoto ? (
              <section className="rounded-xl bg-white p-5 shadow-sm">
                <h2 className="text-sm font-medium text-[var(--color-ink)]">Photos</h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {evidencePhoto ? (
                    <div>
                      <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
                        Citizen photo
                      </p>
                      <img
                        src={evidencePhoto.url}
                        alt="Citizen photo"
                        className="w-full rounded-lg border border-[var(--color-border-subtle)] object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  {proofPhoto ? (
                    <div>
                      <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
                        Collection proof
                      </p>
                      <img
                        src={proofPhoto.url}
                        alt="Collection proof"
                        className="w-full rounded-lg border border-[var(--color-border-subtle)] object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  {evidencePhoto && !proofPhoto ? (
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] p-6 text-sm text-[var(--color-text-tertiary)]">
                      Collection proof will appear here after pickup.
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {/* Drop-off editing (only for dropoff method with a zone) */}
            {item.collection_method === 'dropoff' && item.service_zone ? (
              <DropoffEditSection
                zoneId={item.service_zone.id}
                dropoffName={item.service_zone.dropoff_name ?? ''}
                dropoffAddress={item.service_zone.dropoff_address ?? ''}
                departmentId={desk.departmentId}
              />
            ) : null}

            {/* Actions */}
            {item.status === 'pending_review' ? (
              <section className="rounded-xl bg-white p-5 shadow-sm">
                <h2 className="text-sm font-medium text-[var(--color-ink)]">Actions</h2>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      void approveTextileCollection(item.id, desk.departmentId).then(
                        () => void detail.refetch(),
                      );
                    }}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white"
                  >
                    Approve request
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectOpen(true)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-rose-300 px-5 text-sm font-medium text-rose-700"
                  >
                    Reject
                  </button>
                </div>
              </section>
            ) : null}

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
          </>
        )}
      </DeskStates>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-[var(--color-ink)]">{value || '—'}</p>
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
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="text-sm font-medium text-[var(--color-ink)]">Drop-off point</h2>
      {editing ? (
        <div className="mt-3 space-y-3">
          <label className="block text-xs font-medium">
            Drop-off name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block text-xs font-medium">
            Drop-off address
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-black/15 bg-white p-3 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="min-h-10 rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white disabled:opacity-40"
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
              className="min-h-10 rounded-full border border-black/15 bg-white px-4 text-sm"
            >
              Cancel
            </button>
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{dropoffName || 'Not set'}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{dropoffAddress || '—'}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setName(dropoffName);
              setAddress(dropoffAddress);
            }}
            className="min-h-9 rounded-full border border-black/15 px-4 text-xs font-medium"
          >
            Edit
          </button>
        </div>
      )}
    </section>
  );
}
