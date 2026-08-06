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
} from '../../moderator/design';
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
          <span className="font-medium text-[#1d1d1b]">Channel</span>
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value as NotificationConfig['channel'])}
            className="mt-1 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
          >
            {CHANNELS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[#1d1d1b]">Code</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
            pattern="[a-z0-9_-]+"
            className="mt-1 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[#1d1d1b]">Display name</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            className="mt-1 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[#1d1d1b]">Retry attempts</span>
          <input
            type="number"
            min={1}
            max={10}
            value={tries}
            onChange={(event) => setTries(Number(event.target.value))}
            className="mt-1 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-[#1d1d1b]">Credentials (JSON)</span>
        <textarea
          value={credentials}
          onChange={(event) => setCredentials(event.target.value)}
          rows={6}
          className="mt-1 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 font-mono text-xs focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-[#9f3731]">
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
      <div className="min-h-screen bg-[#f3f2ed] p-6">
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
    <div className="min-h-screen bg-[#f3f2ed] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-[#1d1d1b]">
              Notification configs
            </h1>
            <p className="mt-1 text-sm text-[#6f6e69]">
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
              <IconBell className="h-5 w-5 text-[#6f6e69]" stroke={1.6} />
              <CardTitle>Filters</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap items-end gap-4">
              <label className="text-sm">
                <span className="block font-medium text-[#1d1d1b]">Channel</span>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="mt-1 block rounded-xl border border-[#d0cec8] bg-white px-4 py-2.5 text-sm focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
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
                  className="h-4 w-4 rounded border-[#d0cec8] text-[#1d1d1b] focus:ring-[#1d1d1b]"
                />
                <span className="font-medium text-[#1d1d1b]">active only</span>
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
              <table className="min-w-full">
                <thead className="bg-[#f3f2ed]">
                  <tr>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#85847f]">
                      Channel
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#85847f]">
                      Code / name
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#85847f]">
                      Active
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#85847f]">
                      Retry
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[#85847f]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e4e2dc]">
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-3 text-sm">
                        <Badge tone={c.active ? 'success' : 'neutral'}>{c.channel}</Badge>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <div className="font-mono text-xs text-[#6f6e69]">{c.code}</div>
                        <div className="font-medium text-[#1d1d1b]">{c.display_name}</div>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <button
                          type="button"
                          onClick={() => handleToggle(c)}
                          disabled={upsert.isPending}
                          className="inline-flex items-center gap-2 text-sm text-[#1d1d1b]"
                          aria-pressed={c.active}
                          aria-label={`Toggle ${c.display_name}`}
                        >
                          {c.active ? (
                            <IconToggleRight className="h-6 w-6 text-[#226b46]" stroke={1.6} />
                          ) : (
                            <IconToggleLeft className="h-6 w-6 text-[#85847f]" stroke={1.6} />
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-sm text-[#6f6e69]">
                        <code className="rounded bg-[#efeee9] px-1.5 py-0.5 text-xs text-[#1d1d1b]">
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
            <p role="alert" className="mt-2 text-sm text-[#9f3731]">
              {upsert.error.message}
            </p>
          ) : null}
        </Dialog>
      </div>
    </div>
  );
}
