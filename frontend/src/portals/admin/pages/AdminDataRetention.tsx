import { useMemo, useState, type JSX } from 'react';
import {
  IconDatabase,
  IconAlertTriangle,
  IconSearch,
  IconClock,
  IconShield,
} from '@tabler/icons-react';
import { useSettings, useUpdateSetting, type Setting } from '../api/client';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Badge,
  Spinner,
  EmptyState,
  ErrorState,
} from '../../moderator/design';

const PURGE_ENABLED_KEY = 'retention.purge_enabled';

const ENFORCED_KEYS = new Set([
  'retention.media.days',
  'retention.audit.days',
  'retention.notifications.days',
  'retention.security_events.days',
  'retention.ai_logs.days',
]);

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
    update.mutate({ key: s.key, value: days, type: 'int' });
  };

  const purgeEnabledRow = (list.data ?? []).find((s) => s.key === PURGE_ENABLED_KEY);
  const purgeEnabled = asInt(purgeEnabledRow?.value, 0) === 1;
  const togglePurgeEnabled = (): void => {
    update.mutate({ key: PURGE_ENABLED_KEY, value: purgeEnabled ? 0 : 1, type: 'int' });
  };

  if (list.isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[#f3f2ed]"
        aria-live="polite"
      >
        <Spinner label="Loading retention settings" />
      </div>
    );
  }

  if (list.isError) {
    return (
      <div className="min-h-screen bg-[#f3f2ed] p-4 sm:p-6">
        <ErrorState
          title="Failed to load settings"
          description="Retention settings could not be loaded. Please try again."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f2ed] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#efeee9]">
              <IconDatabase className="h-4 w-4 text-[#6f6e69]" stroke={1.6} />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#1d1d1b]">
                Data retention &amp; backup
              </h1>
              <p className="mt-0.5 text-sm text-[#6f6e69]">
                How long the platform keeps media, audit rows, and notifications before purging.
              </p>
            </div>
          </div>
        </header>

        <Card className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#efeee9]">
                <IconShield className="h-4 w-4 text-[#6f6e69]" stroke={1.6} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#1d1d1b]">Enable scheduled purge</p>
                <p className="text-xs text-[#6f6e69]">
                  Master switch for the daily retention sweep. Off by default — no data is deleted
                  until this is on.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={purgeEnabled}
              disabled={update.isPending || !purgeEnabledRow}
              onClick={togglePurgeEnabled}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${purgeEnabled ? 'bg-[#226b46]' : 'bg-[#d0cec8]'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${purgeEnabled ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>
        </Card>

        <Card className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fff6e4]">
              <IconAlertTriangle className="h-4 w-4 text-[#805913]" stroke={1.6} />
            </span>
            <div className="text-xs text-[#805913]">
              <p className="font-semibold">Partially enforced.</p>
              <p className="mt-1 text-[#805913]">
                The daily purge job reads{' '}
                <code className="rounded bg-white px-1 py-0.5">media</code>,{' '}
                <code className="rounded bg-white px-1 py-0.5">audit</code>,{' '}
                <code className="rounded bg-white px-1 py-0.5">notifications</code>,{' '}
                <code className="rounded bg-white px-1 py-0.5">security_events</code>, and{' '}
                <code className="rounded bg-white px-1 py-0.5">ai_logs</code> (marked{' '}
                <span className="font-semibold">enforced</span> below) when the switch above is on.
                The remaining keys (audit export, soft-deleted, backup, anonymized reports) are{' '}
                <span className="font-semibold">configuration-only</span> — stored but not yet read
                by any purge target.
              </p>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-end gap-2">
          <label className="relative block">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#85847f]">
              <IconSearch className="h-4 w-4" stroke={1.6} />
            </span>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter keys…"
              className="w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-2.5 pl-10 text-sm text-[#1d1d1b] placeholder:text-[#85847f] focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
            />
          </label>
        </div>

        <Card className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          {rows.length === 0 ? (
            <div className="px-5 py-10">
              <EmptyState
                title="No retention settings"
                description="No retention settings match your filter."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[#f3f2ed]">
                  <tr>
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                      Key
                    </th>
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                      Description
                    </th>
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                      Enforced
                    </th>
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                      Days
                    </th>
                    <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e4e2dc]">
                  {rows.map((s) => {
                    const days = asInt(s.value, 0);
                    const enforced = ENFORCED_KEYS.has(s.key);
                    return (
                      <tr key={s.id}>
                        <td className="px-5 py-3 text-sm font-mono font-medium text-[#1d1d1b]">
                          {s.key}
                        </td>
                        <td className="px-5 py-3 text-sm text-[#6f6e69]">{s.description ?? '—'}</td>
                        <td className="px-5 py-3 text-sm">
                          <Badge
                            tone="neutral"
                            className={
                              enforced
                                ? 'bg-[#edf7f0] text-[#256b45]'
                                : 'bg-[#efeee9] text-[#6f6e69]'
                            }
                          >
                            {enforced ? 'enforced' : 'config only'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-sm">
                          <input
                            type="number"
                            min={0}
                            value={days}
                            disabled={update.isPending}
                            onChange={(e) => handleChange(s, Number(e.target.value))}
                            className="block w-24 rounded-xl border border-[#d0cec8] bg-white px-3 py-1.5 text-sm tabular-nums text-[#1d1d1b] focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
                          />
                        </td>
                        <td className="px-5 py-3 text-right text-sm tabular-nums text-[#6f6e69]">
                          {s.updated_at ? new Date(s.updated_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          <CardHeader className="flex items-center justify-between border-b border-[#e4e2dc] px-5 py-4">
            <div className="flex items-center gap-2">
              <IconClock className="h-5 w-5 text-[#6f6e69]" stroke={1.6} />
              <CardTitle className="text-sm font-semibold text-[#1d1d1b]">Backup policy</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-[#6f6e69]">
              Backups run on the scheduler at{' '}
              <code className="rounded bg-[#f3f2ed] px-1.5 py-0.5 text-xs text-[#1d1d1b]">
                every day at 02:00 IST
              </code>{' '}
              and are kept for the value of{' '}
              <code className="rounded bg-[#f3f2ed] px-1.5 py-0.5 text-xs text-[#1d1d1b]">
                retention.backup.days
              </code>
              . Restore drills happen quarterly — see{' '}
              <code className="rounded bg-[#f3f2ed] px-1.5 py-0.5 text-xs text-[#1d1d1b]">
                docs/runbooks/backup-restore.md
              </code>
              .
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
