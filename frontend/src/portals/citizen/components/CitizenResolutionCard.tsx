import { type JSX, useState } from 'react';
import {
  IconCircleCheck,
  IconAlertTriangle,
  IconCamera,
  IconClock,
  IconCircleX,
} from '@tabler/icons-react';
import type { ReportDetail, ProofMediaItem } from '../types';

/**
 * P1-06 — citizen-facing resolution verification card.
 *
 * When a report is in `resolved_pending_verification`, the citizen
 * can inspect the department's proof photos and either:
 *
 *   - Verify → report moves to `verified` (terminal, positive).
 *   - Dispute → report moves to `reopened` for re-work. Time-bound:
 *     the backend rejects once `verification_deadline_at` passes.
 *
 * After the window closes (or once the report is no longer awaiting
 * verification) this component renders nothing.
 */
export function CitizenResolutionCard({
  report,
  onVerify,
  onDispute,
  isVerifying,
  isDisputing,
  error,
}: {
  report: ReportDetail;
  onVerify: () => void;
  onDispute: (reason: string) => void;
  isVerifying: boolean;
  isDisputing: boolean;
  error: string | null;
}): JSX.Element | null {
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [reason, setReason] = useState('');

  const isAwaiting = report.status?.code === 'resolved_pending_verification';

  if (!isAwaiting) {
    return null;
  }

  const deadline = report.verification_deadline_at
    ? new Date(report.verification_deadline_at)
    : null;
  const now = new Date();
  const windowClosed = deadline !== null && now > deadline;

  const proofPhotos = report.proof_photos ?? [];

  const handleSubmitDispute = (): void => {
    if (reason.trim().length < 5) {
      return;
    }
    onDispute(reason.trim());
    setReason('');
  };

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium text-emerald-900">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-100">
          <IconCircleCheck className="h-3.5 w-3.5 text-emerald-700" stroke={1.7} />
        </span>
        Resolution Awaiting Your Verification
      </h2>

      <p className="mt-2 text-sm leading-relaxed text-emerald-800">
        The department has marked this report as resolved. Please review the proof of completion
        below and confirm whether the issue is fixed.
      </p>

      {deadline !== null ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700">
          <IconClock className="h-3.5 w-3.5" stroke={1.6} />
          {windowClosed ? (
            <span>Verification window closed on {formatLongDate(deadline)}.</span>
          ) : (
            <span>
              Verify by <strong>{formatLongDate(deadline)}</strong> (the dispute window closes
              then).
            </span>
          )}
        </div>
      ) : null}

      {/* Proof of completion photos */}
      {proofPhotos.length > 0 ? (
        <div className="mt-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-700">
            Proof of completion ({proofPhotos.length}{' '}
            {proofPhotos.length === 1 ? 'photo' : 'photos'})
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {proofPhotos.map((p) => (
              <ProofPhotoItem key={p.id} photo={p} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-700">
          <IconCamera className="h-3.5 w-3.5" stroke={1.6} />
          No proof photos attached.
        </div>
      )}

      {error !== null ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
          <IconCircleX className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" stroke={1.7} />
          <p className="text-sm text-rose-800">{error}</p>
        </div>
      ) : null}

      {/* Actions */}
      {!windowClosed ? (
        <div className="mt-4 space-y-2">
          {!showDisputeForm ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onVerify}
                disabled={isVerifying || isDisputing}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <IconCircleCheck className="h-4 w-4" stroke={1.6} />
                {isVerifying ? 'Verifying…' : 'Verify resolution'}
              </button>
              <button
                type="button"
                onClick={() => setShowDisputeForm(true)}
                disabled={isVerifying || isDisputing}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                <IconAlertTriangle className="h-4 w-4" stroke={1.6} />
                Report issue not fixed
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-rose-200 bg-white p-3">
              <p className="text-sm font-medium text-rose-900">Dispute this resolution</p>
              <p className="mt-1 text-xs text-rose-700">
                Explain why the issue is still not fixed. A moderator will review your dispute.
              </p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe the remaining issue…"
                className="mt-2 w-full rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-900 placeholder:text-rose-400 focus:border-rose-400 focus:outline-none"
                rows={3}
                maxLength={1000}
              />
              {reason.trim().length > 0 && reason.trim().length < 5 ? (
                <p className="mt-1 text-xs text-rose-600">Please provide at least 5 characters.</p>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSubmitDispute}
                  disabled={isDisputing || reason.trim().length < 5}
                  className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {isDisputing ? 'Submitting…' : 'Submit dispute'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDisputeForm(false);
                    setReason('');
                  }}
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function ProofPhotoItem({ photo }: { photo: ProofMediaItem }): JSX.Element {
  const [failed, setFailed] = useState(false);
  const url = photo.signed_url;

  if (!url || failed) {
    return (
      <div className="grid aspect-square place-items-center rounded-lg border border-emerald-200 bg-white">
        <div className="flex flex-col items-center gap-1 text-center">
          <IconCamera className="h-5 w-5 text-emerald-400" />
          <span className="text-[10px] text-emerald-500">Unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-emerald-200 bg-white">
      <img
        src={url}
        alt="Proof of completion"
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function formatLongDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
