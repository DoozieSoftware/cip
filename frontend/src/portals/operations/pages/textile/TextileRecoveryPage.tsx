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
      title="Reupload"
      description="Pending and failed field uploads. Retry safely — the same proof is never recorded twice."
    >
      {allFailed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-8 text-center shadow-xs">
          <p className="text-xs font-semibold text-[var(--color-ink)]">
            No pending or failed uploads
          </p>
          <p className="mt-1 text-xs leading-normal text-[var(--color-text-secondary)]">
            Collections captured offline appear here until they are safely uploaded.
          </p>
          {pending.length === 0 ? null : (
            <button
              type="button"
              onClick={() => {
                void clearDone();
              }}
              className="mt-4 inline-flex h-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-ink)] shadow-xs transition hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
            >
              Clear completed
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => void drain()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
            >
              <IconRefresh className="h-3.5 w-3.5" /> Retry all
            </button>
          </div>
          <ul className="space-y-2.5">
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
                  className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 sm:p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                        <IconAlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700" />{' '}
                        {item.kind} ·{' '}
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
                        <p
                          role="alert"
                          className="mt-1 text-xs font-medium text-[var(--color-danger)]"
                        >
                          {item.last_error}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] leading-4 text-[var(--color-text-tertiary)]">
                        Tied to your account — logging out clears pending uploads for this device.
                        Corrupted photos must be re-captured.
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => void drain()}
                        className="inline-flex h-7 items-center justify-center rounded-lg border border-amber-300 bg-white px-2.5 text-xs font-semibold text-amber-900 shadow-xs transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        aria-label={`Discard ${item.id}`}
                        onClick={() => void remove(item.id)}
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white px-2.5 text-xs font-semibold text-[var(--color-ink)] shadow-xs transition hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]"
                      >
                        <IconTrash className="h-3 w-3" /> Discard
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
