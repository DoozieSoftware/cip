import { useState, type FormEvent, type JSX } from 'react';
import {
  useNotificationConfigs,
  useUpsertNotificationConfig,
  useDeleteNotificationConfig,
  type NotificationConfig,
} from '../api/client';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  Spinner,
  EmptyState,
  ErrorState,
  Badge,
} from '../../../shared/ui';
import {
  IconBell,
  IconPlus,
  IconTrash,
  IconToggleRight,
  IconToggleLeft,
} from '@tabler/icons-react';

const CHANNELS: NotificationConfig['channel'][] = ['mail', 'sms', 'push', 'webhook'];

function ConfigForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: Partial<NotificationConfig>) => void;
}): JSX.Element {
  const [channel, setChannel] = useState<NotificationConfig['channel']>('mail');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [credentials, setCredentials] = useState('{\n  "host": "smtp.example.in"\n}');
  const [tries, setTries] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    try {
      const parsed = JSON.parse(credentials) as unknown;
      if (
        parsed === null ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed) ||
        Object.keys(parsed).length === 0
      ) {
        setError('Credentials must be a non-empty JSON object.');
        return;
      }
      setError(null);
      onSubmit({
        channel,
        code: code.trim(),
        display_name: displayName.trim(),
        credentials: parsed as Record<string, unknown>,
        retry_policy: { tries, backoff: [30, 120, 600].slice(0, tries) },
        settings: {},
        per_locale_defaults: {},
        active: false,
      });
    } catch {
      setError('Credentials must be valid JSON.');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-[var(--color-ink)]">Channel</span>
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value as NotificationConfig['channel'])}
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          >
            {CHANNELS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[var(--color-ink)]">Code</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
            pattern="[a-z0-9_-]+"
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[var(--color-ink)]">Display name</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[var(--color-ink)]">Retry attempts</span>
          <input
            type="number"
            min={1}
            max={10}
            value={tries}
            onChange={(event) => setTries(Number(event.target.value))}
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-[var(--color-ink)]">Credentials (JSON)</span>
        <textarea
          value={credentials}
          onChange={(event) => setCredentials(event.target.value)}
          rows={6}
          className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 font-mono text-xs focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving...' : 'Create config'}
        </Button>
      </div>
    </form>
  );
}

export default function AdminNotificationConfigs(): JSX.Element {
  const [channel, setChannel] = useState<string>('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const list = useNotificationConfigs({
    channel: channel || undefined,
    active: activeOnly || undefined,
  });
  const upsert = useUpsertNotificationConfig();
  const remove = useDeleteNotificationConfig();

  const rows = list.data ?? [];

  const handleToggle = (cfg: NotificationConfig): void => {
    upsert.mutate({
      id: cfg.id,
      channel: cfg.channel,
      code: cfg.code,
      display_name: cfg.display_name,
      active: !cfg.active,
      credentials: cfg.credentials,
      retry_policy: cfg.retry_policy,
    });
  };

  if (list.isError) {
    return (
      <div>
        <ErrorState
          title="Failed to load notification configs"
          description="There was a problem fetching the notification configurations."
          error={list.error instanceof Error ? list.error : null}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void list.refetch();
              }}
            >
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
            Notification configs
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Channel credentials, retry policy, and per-locale template defaults. Credentials are
            masked on every read.
          </p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          leftIcon={<IconPlus className="h-4 w-4" stroke={1.6} />}
        >
          New config
        </Button>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconBell className="h-5 w-5 text-[var(--color-text-secondary)]" stroke={1.6} />
            <CardTitle>Filters</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <span className="block font-medium text-[var(--color-ink)]">Channel</span>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="mt-1 block rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
              >
                <option value="">all</option>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-ink)] focus:ring-[var(--color-ink)]"
              />
              <span className="font-medium text-[var(--color-ink)]">active only</span>
            </label>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {list.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner label="Loading configs" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No notification configs"
                description="Create a new config to start managing notification channels."
                action={
                  <Button variant="secondary" onClick={() => setCreating(true)}>
                    Create config
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem]">
                <thead className="bg-[var(--color-canvas)]">
                  <tr>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Channel
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Code / name
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Active
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Retry
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-3 text-sm">
                        <Badge tone={c.active ? 'success' : 'neutral'}>{c.channel}</Badge>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <div className="font-mono text-xs text-[var(--color-text-secondary)]">
                          {c.code}
                        </div>
                        <div className="font-medium text-[var(--color-ink)]">{c.display_name}</div>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <button
                          type="button"
                          onClick={() => handleToggle(c)}
                          disabled={upsert.isPending}
                          className="inline-flex items-center gap-2 text-sm text-[var(--color-ink)]"
                          aria-pressed={c.active}
                          aria-label={`Toggle ${c.display_name}`}
                        >
                          {c.active ? (
                            <IconToggleRight
                              className="h-6 w-6 text-[var(--color-success)]"
                              stroke={1.6}
                            />
                          ) : (
                            <IconToggleLeft
                              className="h-6 w-6 text-[var(--color-text-tertiary)]"
                              stroke={1.6}
                            />
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-sm text-[var(--color-text-secondary)]">
                        <code className="rounded bg-[var(--color-surface-alt)] px-1.5 py-0.5 text-xs text-[var(--color-ink)]">
                          {c.retry_policy?.tries ?? '—'} attempts ·{' '}
                          {JSON.stringify(c.retry_policy?.backoff ?? [])}
                        </code>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (confirm(`Delete ${c.code}?`)) remove.mutate(c.id);
                          }}
                          leftIcon={<IconTrash className="h-3.5 w-3.5" stroke={1.6} />}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Dialog open={creating} onClose={() => setCreating(false)} title="New notification config">
        <ConfigForm
          busy={upsert.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(input) => upsert.mutate(input, { onSuccess: () => setCreating(false) })}
        />
        {upsert.isError ? (
          <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
            {upsert.error.message}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
