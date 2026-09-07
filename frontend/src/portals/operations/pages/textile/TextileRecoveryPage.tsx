import type { JSX } from 'react';
import { useOpsQueue } from '../../offline/useOpsQueue';
import { DeskPage, useDesk } from './shared';
import { IconAlertTriangle, IconRefresh, IconTrash } from '@tabler/icons-react';

export default function TextileRecoveryPage(): JSX.Element {
  const desk = useDesk();
  const { pending, dead, drain, remove, clearDone } = useOpsQueue();
  const allFailed = [...pending.filter((i) => i.status === 'failed'), ...dead];

  return (
    <DeskPage
      desk={desk}
      title="Upload recovery"
      description="Pending and failed field uploads. Retry safely — the same proof is never recorded twice."
    >
      {allFailed.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-[var(--color-ink)]">
            No pending or failed uploads
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
            Collections captured offline appear here until they are safely uploaded.
          </p>
          {pending.length === 0 ? null : (
            <button
              type="button"
              onClick={() => {
                void clearDone();
              }}
              className="mt-4 inline-flex min-h-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
            >
              Clear completed
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => void drain()}
              className="inline-flex min-h-9 items-center gap-1 rounded-full bg-[var(--color-ink)] px-4 text-xs font-medium text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
            >
              <IconRefresh className="h-4 w-4" /> Retry all
            </button>
          </div>
          <ul className="space-y-3">
            {allFailed.map((item) => {
              const p = item.payload as {
                collectionId?: string;
                reference?: string;
                actualBags?: number;
                actualWeightKg?: number;
                photoName?: string;
              };
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
                        <IconAlertTriangle className="h-4 w-4 text-amber-700" /> {item.kind} ·{' '}
                        {p.reference ?? p.collectionId?.slice(0, 8) ?? item.id.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-xs text-amber-800">
                        {p.actualBags ?? '—'} bags · {p.actualWeightKg ?? '—'} kg{' '}
                        {p.photoName ? `· ${p.photoName}` : ''}
                      </p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-amber-700">
                        Status: {item.status} · attempts {item.attempts}/{item.max_attempts}
                      </p>
                      {item.last_error ? (
                        <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
                          {item.last_error}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] leading-4 text-[var(--color-text-tertiary)]">
                        Tied to your account — logging out clears pending uploads for this device.
                        Corrupted photos must be re-captured.
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => void drain()}
                        className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        aria-label={`Discard ${item.id}`}
                        onClick={() => void remove(item.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1"
                      >
                        <IconTrash className="h-3.5 w-3.5" /> Discard
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </DeskPage>
  );
}
