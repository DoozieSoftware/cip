import { useMemo, useState, type FormEvent, type JSX } from 'react';
import {
  IconDatabase,
  IconAlertTriangle,
  IconSearch,
  IconClock,
  IconShield,
} from '@tabler/icons-react';
import {
  useSettings,
  useUpdateSetting,
  useRetentionHolds,
  useCreateRetentionHold,
  useReleaseRetentionHold,
  type Setting,
  type RetentionHoldEntityType,
} from '../api/client';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Badge,
  Spinner,
  EmptyState,
  ErrorState,
} from '../../../shared/ui';

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

const HOLD_ENTITY_TYPES: Array<{ value: RetentionHoldEntityType; label: string }> = [
  { value: 'media', label: 'Evidence media' },
  { value: 'security_event', label: 'Security event' },
  { value: 'notification', label: 'Notification' },
  { value: 'ai_job', label: 'AI job' },
  { value: 'ai_result', label: 'AI result' },
  { value: 'ai_label', label: 'AI label' },
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
  const holds = useRetentionHolds(true);
  const createHold = useCreateRetentionHold();
  const releaseHold = useReleaseRetentionHold();
  const [filter, setFilter] = useState('');
  const [holdType, setHoldType] = useState<RetentionHoldEntityType>('media');
  const [holdEntityId, setHoldEntityId] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [holdExpiry, setHoldExpiry] = useState('');

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

  const submitHold = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (holdEntityId.trim() === '' || holdReason.trim().length < 10) return;
    createHold.mutate(
      {
        entity_type: holdType,
        entity_id: holdEntityId.trim(),
        reason: holdReason.trim(),
        expires_at: holdExpiry === '' ? null : new Date(holdExpiry).toISOString(),
      },
      {
        onSuccess: () => {
          setHoldEntityId('');
          setHoldReason('');
          setHoldExpiry('');
        },
      },
    );
  };

  const release = (holdId: string): void => {
    if (
      !window.confirm('Release this legal hold? The release will be recorded in the audit trail.')
    )
      return;
    const reason = window.prompt(
      'Enter the approval or legal basis for release (at least 10 characters):',
    );
    if (reason === null || reason.trim().length < 10) return;
    releaseHold.mutate({ id: holdId, release_reason: reason.trim() });
  };

  if (list.isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)]"
        aria-live="polite"
      >
        <Spinner label="Loading retention settings" />
      </div>
    );
  }

  if (list.isError) {
    return (
      <div>
        <ErrorState
          title="Failed to load settings"
          description="Retention settings could not be loaded. Please try again."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-surface-alt)]">
            <IconDatabase className="h-4 w-4 text-[var(--color-text-secondary)]" stroke={1.6} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
              Data retention &amp; backup
            </h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              How long the platform keeps media, audit rows, and notifications before purging.
            </p>
          </div>
        </div>
      </header>

      <Card className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)]">
              <IconShield className="h-4 w-4 text-[var(--color-text-secondary)]" stroke={1.6} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                Enable scheduled purge
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
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
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${purgeEnabled ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'}`}
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
              The daily purge job reads <code className="rounded bg-white px-1 py-0.5">media</code>,{' '}
              <code className="rounded bg-white px-1 py-0.5">audit</code>,{' '}
              <code className="rounded bg-white px-1 py-0.5">notifications</code>,{' '}
              <code className="rounded bg-white px-1 py-0.5">security_events</code>, and{' '}
              <code className="rounded bg-white px-1 py-0.5">ai_logs</code> (marked{' '}
              <span className="font-semibold">enforced</span> below) when the switch above is on.
              The remaining keys (audit export, soft-deleted, backup, anonymized reports) are{' '}
              <span className="font-semibold">configuration-only</span> — stored but not yet read by
              any purge target.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-end gap-2">
        <label className="relative block">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]">
            <IconSearch className="h-4 w-4" stroke={1.6} />
          </span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter keys…"
            className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 pl-10 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
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
            <table className="w-full min-w-[52rem]">
              <thead className="bg-[var(--color-canvas)]">
                <tr>
                  <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    Key
                  </th>
                  <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    Description
                  </th>
                  <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    Enforced
                  </th>
                  <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    Days
                  </th>
                  <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {rows.map((s) => {
                  const days = asInt(s.value, 0);
                  const enforced = ENFORCED_KEYS.has(s.key);
                  return (
                    <tr key={s.id}>
                      <td className="px-5 py-3 text-sm font-mono font-medium text-[var(--color-ink)]">
                        {s.key}
                      </td>
                      <td className="px-5 py-3 text-sm text-[var(--color-text-secondary)]">
                        {s.description ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <Badge
                          tone="neutral"
                          className={
                            enforced
                              ? 'bg-[#edf7f0] text-[var(--color-success)]'
                              : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]'
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
                          className="block w-24 rounded-xl border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm tabular-nums text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                        />
                      </td>
                      <td className="px-5 py-3 text-right text-sm tabular-nums text-[var(--color-text-secondary)]">
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
        <CardHeader className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-5 py-4">
          <div className="flex items-center gap-2">
            <IconClock className="h-5 w-5 text-[var(--color-text-secondary)]" stroke={1.6} />
            <CardTitle className="text-sm font-semibold text-[var(--color-ink)]">
              Backup policy
            </CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Backups run on the scheduler at{' '}
            <code className="rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs text-[var(--color-ink)]">
              every day at 02:00 IST
            </code>{' '}
            and are kept for the value of{' '}
            <code className="rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs text-[var(--color-ink)]">
              retention.backup.days
            </code>
            . Restore drills happen quarterly — see{' '}
            <code className="rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs text-[var(--color-ink)]">
              docs/runbooks/backup-restore.md
            </code>
            .
          </p>
        </CardBody>
      </Card>

      <Card className="rounded-xl bg-white shadow-sm ring-1 ring-black/5">
        <CardHeader className="border-b border-[var(--color-border-subtle)] px-5 py-4">
          <div className="flex items-center gap-2">
            <IconShield className="h-5 w-5 text-[var(--color-text-secondary)]" stroke={1.6} />
            <div>
              <CardTitle className="text-sm font-semibold text-[var(--color-ink)]">
                Active legal holds
              </CardTitle>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                Preserve evidence or operational records until an authorised release is recorded.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-5">
          <form
            onSubmit={submitHold}
            className="grid gap-3 rounded-xl bg-[var(--color-canvas)] p-4 sm:grid-cols-2"
          >
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              Entity type
              <select
                aria-label="Hold entity type"
                value={holdType}
                onChange={(event) => setHoldType(event.target.value as RetentionHoldEntityType)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)]"
              >
                {HOLD_ENTITY_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              Entity UUID
              <input
                required
                aria-label="Hold entity UUID"
                value={holdEntityId}
                onChange={(event) => setHoldEntityId(event.target.value)}
                placeholder="UUID of the record to preserve"
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-text-tertiary)]"
              />
            </label>
            <label className="text-xs font-medium text-[var(--color-text-secondary)] sm:col-span-2">
              Legal basis / investigation reference
              <textarea
                required
                minLength={10}
                aria-label="Legal basis for retention hold"
                value={holdReason}
                onChange={(event) => setHoldReason(event.target.value)}
                rows={2}
                className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-ink)]"
              />
            </label>
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              Optional expiry
              <input
                type="datetime-local"
                aria-label="Retention hold expiry"
                value={holdExpiry}
                onChange={(event) => setHoldExpiry(event.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)]"
              />
            </label>
            <div className="flex items-end justify-end">
              <button
                type="submit"
                disabled={
                  createHold.isPending ||
                  holdEntityId.trim() === '' ||
                  holdReason.trim().length < 10
                }
                className="min-h-[44px] rounded-full bg-[var(--color-ink)] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createHold.isPending ? 'Creating…' : 'Create hold'}
              </button>
            </div>
          </form>
          {createHold.isError && (
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              {createHold.error instanceof Error
                ? createHold.error.message
                : 'Could not create the hold.'}
            </p>
          )}
          {holds.isLoading ? (
            <Spinner label="Loading active legal holds" />
          ) : holds.isError ? (
            <ErrorState title="Failed to load legal holds" error={holds.error} />
          ) : (holds.data ?? []).length === 0 ? (
            <EmptyState title="No active legal holds" description="New holds will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem]">
                <thead className="bg-[var(--color-canvas)] text-left text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  <tr>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Legal basis</th>
                    <th className="px-4 py-3">Expiry</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {(holds.data ?? []).map((hold) => (
                    <tr key={hold.id}>
                      <td className="px-4 py-3 text-xs text-[var(--color-ink)]">
                        <span className="font-semibold">{hold.entity_type}</span>
                        <span className="mt-0.5 block max-w-[220px] truncate font-mono text-[10px] text-[var(--color-text-tertiary)]">
                          {hold.entity_id}
                        </span>
                      </td>
                      <td className="max-w-sm px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                        {hold.reason}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                        {hold.expires_at
                          ? new Date(hold.expires_at).toLocaleString()
                          : 'Indefinite'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => release(hold.id)}
                          disabled={releaseHold.isPending}
                          className="min-h-[44px] rounded-full border border-[var(--color-border)] px-4 text-xs font-semibold text-[var(--color-ink)] disabled:opacity-50"
                        >
                          Release
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
