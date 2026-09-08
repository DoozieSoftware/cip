import { useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconAlertTriangle } from '@tabler/icons-react';
import { DeskPage, useDesk } from './shared';
import { fetchOfflineRecovery, resolveOfflineRecovery } from '../../api/textileApi';
import { ApiError } from '../../../../shared/api/errors';

/** Narrow an `unknown` value to a display string, mirroring the previous `String(x ?? '')`. */
function asString(value: unknown): string {
  return typeof value === 'string' ? value : String(value);
}

export default function TextileOfflineRecoveryPage(): JSX.Element {
  const desk = useDesk();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'pending' | 'resolved'>('pending');
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['operations', 'textile', 'offline-recovery', desk.departmentId, filter],
    queryFn: () => fetchOfflineRecovery({ department_id: desk.departmentId, status: filter }),
    enabled: desk.ready && desk.isDrLinen,
  });

  const resolve = useMutation({
    mutationFn: (id: string) => resolveOfflineRecovery(id, desk.departmentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['operations', 'textile', 'offline-recovery'] });
    },
    onError: (e: unknown) => {
      setError(e instanceof ApiError ? e.message : 'Failed to resolve');
    },
  });

  return (
    <DeskPage
      desk={desk}
      title="Offline recovery"
      description="Authorised view for field uploads that permanently failed. Retry or resolve items that could not be uploaded from the device."
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFilter('pending')}
          className={`h-8 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 ${filter === 'pending' ? 'bg-[var(--color-ink)] text-white shadow-xs' : 'border border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-ink)]'}`}
        >
          Pending ({Array.isArray(query.data) ? query.data.length : '—'})
        </button>
        <button
          type="button"
          onClick={() => setFilter('resolved')}
          className={`h-8 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 ${filter === 'resolved' ? 'bg-[var(--color-ink)] text-white shadow-xs' : 'border border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-ink)]'}`}
        >
          Resolved
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-3 py-2 text-xs text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}

      {query.isLoading ? (
        <p className="text-xs text-[var(--color-text-secondary)]">Loading recovery items…</p>
      ) : query.isError ? (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          Failed to load recovery items.
        </p>
      ) : !Array.isArray(query.data) || query.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white px-6 py-8 text-center shadow-xs">
          <IconAlertTriangle className="mx-auto h-5 w-5 text-[var(--color-text-tertiary)]" />
          <p className="mt-2 text-xs font-semibold text-[var(--color-ink)]">
            No {filter} offline failures
          </p>
          <p className="mt-1 text-xs leading-normal text-[var(--color-text-secondary)]">
            Failed device-local uploads appear here when the field worker reports a permanent
            failure. No proof is silently discarded.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {(query.data as Array<Record<string, unknown>>).map((raw) => {
            const item = raw;
            const id = asString(item['id'] ?? '');
            const col = (item['collection'] ?? {}) as Record<string, unknown>;
            const snapshot = (item['payload_snapshot'] ?? {}) as Record<string, unknown>;
            return (
              <li
                key={id}
                className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-3.5 sm:p-4 text-sm shadow-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-[var(--color-ink)]">
                    {asString(col['reference'] ?? item['collection_request_id'] ?? id)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${asString(item['status']) === 'pending' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}
                  >
                    {asString(item['status'] ?? '')}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {asString(col['pickup_address'] ?? '')}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
                    {item['created_at']
                      ? new Date(asString(item['created_at'])).toLocaleString()
                      : ''}
                  </span>
                </div>
                {item['failure_reason'] ? (
                  <p className="mt-1.5 text-xs font-medium text-[var(--color-danger)]">
                    {asString(item['failure_reason'])}
                  </p>
                ) : null}
                {snapshot && Object.keys(snapshot).length > 0 ? (
                  <details className="group mt-2 text-xs">
                    <summary className="cursor-pointer select-none font-mono text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-ink)]">
                      Payload snapshot ({Object.keys(snapshot).length} keys)
                    </summary>
                    <pre className="mt-1.5 max-h-48 overflow-auto rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] p-2.5 font-mono text-[11px] leading-relaxed text-[var(--color-ink)]">
                      {JSON.stringify(snapshot, null, 2)}
                    </pre>
                  </details>
                ) : null}
                {item['idempotency_key'] ? (
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
                    Idempotency-Key: {asString(item['idempotency_key'])}
                  </p>
                ) : null}
                {String(item['status']) === 'pending' ? (
                  <button
                    type="button"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate(id)}
                    className="mt-3 inline-flex h-8 items-center justify-center rounded-lg bg-[var(--color-ink)] px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-1 disabled:opacity-40"
                  >
                    {resolve.isPending ? 'Resolving…' : 'Mark resolved'}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-[var(--color-text-tertiary)]">
        Recovery actions are audited (textile.offline_failure_reported /
        textile.offline_failure_resolved). Logout clears device-local pending queues; device change
        keeps the queue on the original device. Expired sessions require re-authentication before
        retry.
      </p>
    </DeskPage>
  );
}
