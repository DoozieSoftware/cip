import { useMemo, useState, type JSX } from 'react';
import { useSettings, useUpdateSetting, type Setting } from '../api/client';
import { Spinner } from '../../moderator/design';

/**
 * T-M12-027 — Data retention and backup dashboard.
 *
 * Surfaces a curated subset of `settings` rows that govern
 * how long the platform keeps user content before purging.
 * Every row is a real `Setting` (the storage page edits the
 * `media_storage` row; this page is the source of truth for
 * `retention.*` keys).
 */

const PURGE_ENABLED_KEY = 'retention.purge_enabled';

// Keys the daily `settings:purge-retention` scheduled command actually
// reads (see backend/app/Modules/Settings/Console/PurgeRetentionCommand.php).
const ENFORCED_KEYS = new Set([
  'retention.media.days',
  'retention.audit.days',
  'retention.notifications.days',
  'retention.security_events.days',
  'retention.ai_logs.days',
]);

// Everything else on this page is configuration-only — stored but not
// (yet) read by any purge job.
const RETENTION_KEYS = [
  'retention.media.days',
  'retention.audit.days',
  'retention.audit_export.days',
  'retention.notifications.days',
  'retention.security_events.days',
  'retention.ai_logs.days',
  'retention.anonymized_reports.days',
  'retention.soft_deleted.days',
  'retention.backup.days',
];

function asInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export default function AdminDataRetention(): JSX.Element {
  const list = useSettings();
  const update = useUpdateSetting();
  const [filter, setFilter] = useState('');

  const rows = useMemo(() => {
    const all = list.data ?? [];
    return all
      .filter((s) => RETENTION_KEYS.includes(s.key))
      .filter((s) => (filter ? s.key.includes(filter.toLowerCase()) : true))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [list.data, filter]);

  const handleChange = (s: Setting, days: number): void => {
    // Backend Setting controller keys rows by the dotted `key`, not
    // the UUID (see plans/admin-portal-bugs.md #6). Send `key`.
    update.mutate({ key: s.key, value: days, type: 'int' });
  };

  const purgeEnabledRow = (list.data ?? []).find((s) => s.key === PURGE_ENABLED_KEY);
  const purgeEnabled = asInt(purgeEnabledRow?.value, 0) === 1;
  const togglePurgeEnabled = (): void => {
    update.mutate({ key: PURGE_ENABLED_KEY, value: purgeEnabled ? 0 : 1, type: 'int' });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Data retention &amp; backup</h1>
        <p className="mt-1 text-sm text-slate-600">
          How long the platform keeps media, audit rows, and notifications before purging. A daily job (`settings:purge-retention`, 03:00) enforces the keys marked below when the master switch is on.
        </p>
      </header>

      <section className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Enable scheduled purge</p>
          <p className="text-xs text-slate-500">
            Master switch for the daily retention sweep. Off by default — no data is deleted until this is on.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={purgeEnabled}
          disabled={update.isPending || !purgeEnabledRow}
          onClick={togglePurgeEnabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${purgeEnabled ? 'bg-emerald-600' : 'bg-slate-300'} disabled:opacity-50`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${purgeEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <span className="font-semibold">Partially enforced.</span> The daily purge job reads <code className="rounded bg-white px-1 py-0.5">media</code>,
        <code className="mx-1 rounded bg-white px-1 py-0.5">audit</code>, <code className="rounded bg-white px-1 py-0.5">notifications</code>,
        <code className="mx-1 rounded bg-white px-1 py-0.5">security_events</code>, and <code className="rounded bg-white px-1 py-0.5">ai_logs</code> (marked <span className="font-semibold">enforced</span> below)
        when the switch above is on. The remaining keys (audit export, soft-deleted, backup, anonymized reports) are
        <span className="font-semibold"> configuration-only</span> — stored but not yet read by any purge target.
      </div>

      <section className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Filter</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="retention…"
            className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {list.isLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner label="Loading retention settings" /></div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No retention settings found.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Key</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Description</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Enforced</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Days</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((s) => {
                const days = asInt(s.value, 0);
                const enforced = ENFORCED_KEYS.has(s.key);
                return (
                  <tr key={s.id}>
                    <td className="px-5 py-3 text-sm font-mono text-slate-700">{s.key}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{s.description ?? '—'}</td>
                    <td className="px-5 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${enforced ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                        {enforced ? 'enforced' : 'config only'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <input
                        type="number"
                        min={0}
                        value={days}
                        disabled={update.isPending}
                        onChange={(e) => handleChange(s, Number(e.target.value))}
                        className="block w-24 rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums"
                      />
                    </td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums text-slate-500">
                      {s.updated_at ? new Date(s.updated_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <p className="font-semibold text-slate-700">Backup policy</p>
        <p className="mt-1">
          Backups run on the scheduler at <code className="rounded bg-white px-1.5 py-0.5 text-xs">every day at 02:00 IST</code> and are kept for the
          value of <code className="rounded bg-white px-1.5 py-0.5 text-xs">retention.backup.days</code>. Restore drills happen quarterly — see
          <code className="ml-1 rounded bg-white px-1.5 py-0.5 text-xs">docs/runbooks/backup-restore.md</code>.
        </p>
      </section>
    </div>
  );
}
