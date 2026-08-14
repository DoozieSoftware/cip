import { useMemo, useState, type FormEvent, type JSX } from 'react';
import {
  IconSettings,
  IconPlus,
  IconSearch,
  IconTrash,
  IconDeviceFloppy,
} from '@tabler/icons-react';
import {
  useSettings,
  useUpdateSetting,
  useCreateSetting,
  useDeleteSetting,
  type Setting,
} from '../api/client';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Button,
  Badge,
  Input,
  Select,
  Spinner,
  EmptyState,
  ErrorState,
} from '../../../shared/ui';

const TYPES: Setting['type'][] = ['string', 'int', 'bool', 'json', 'datetime'];

const NON_SYSTEM_KEYS = [
  'retention.',
  'media_storage',
  'app_config',
  'feature_flag',
  'ai.vision.',
  'notification.',
];

function isSystemKey(key: string): boolean {
  return !NON_SYSTEM_KEYS.some((prefix) => key.startsWith(prefix));
}

function coerceValue(raw: string, type: Setting['type']): unknown {
  if (type === 'json') {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
  if (type === 'int') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (type === 'bool') {
    return raw === 'true' || raw === '1';
  }
  return raw;
}

function SettingRow({
  s,
  busy,
  onSave,
  onDelete,
}: {
  s: Setting;
  busy: boolean;
  onSave: (patch: Partial<Setting>) => void;
  onDelete: () => void;
}): JSX.Element {
  const [value, setValue] = useState<string>(
    typeof s.value === 'string' ? s.value : JSON.stringify(s.value),
  );
  return (
    <tr className="divide-y divide-[var(--color-border-subtle)]">
      <td className="px-5 py-3 text-sm font-mono font-medium text-[var(--color-ink)]">{s.key}</td>
      <td className="px-5 py-3 text-sm">
        <Badge
          tone="neutral"
          className="bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]"
        >
          {s.type}
        </Badge>
        <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
          {s.is_public ? 'public' : 'private'}
        </span>
      </td>
      <td className="px-5 py-3 text-sm">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
          className="block w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-1.5 font-mono text-xs text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
        />
      </td>
      <td className="px-5 py-3 text-sm text-[var(--color-text-secondary)]">
        {s.description ?? '—'}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="success"
            size="sm"
            disabled={busy}
            onClick={() => onSave({ key: s.key, value: coerceValue(value, s.type), type: s.type })}
            leftIcon={<IconDeviceFloppy className="h-3.5 w-3.5" stroke={1.6} />}
          >
            Save
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={() => onDelete()}
            leftIcon={<IconTrash className="h-3.5 w-3.5" stroke={1.6} />}
          >
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminSystemConfig(): JSX.Element {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  const [draftType, setDraftType] = useState<Setting['type']>('string');
  const [draftValue, setDraftValue] = useState('');
  const [draftDescription, setDraftDescription] = useState('');

  const list = useSettings(q);
  const create = useCreateSetting();
  const update = useUpdateSetting();
  const remove = useDeleteSetting();

  const rows = useMemo(() => {
    const all = list.data ?? [];
    return all.filter((s) => isSystemKey(s.key)).sort((a, b) => a.key.localeCompare(b.key));
  }, [list.data]);

  const handleCreate = (e: FormEvent): void => {
    e.preventDefault();
    let parsed: unknown = draftValue;
    if (draftType === 'json') {
      try {
        parsed = JSON.parse(draftValue);
      } catch {
        parsed = draftValue;
      }
    } else if (draftType === 'int') {
      parsed = Number(draftValue);
    } else if (draftType === 'bool') {
      parsed = draftValue === 'true' || draftValue === '1';
    }
    create.mutate(
      {
        key: draftKey.trim(),
        value: parsed,
        type: draftType,
        description: draftDescription.trim() || null,
        is_public: false,
      },
      {
        onSuccess: () => {
          setCreating(false);
          setDraftKey('');
          setDraftValue('');
          setDraftDescription('');
        },
      },
    );
  };

  if (list.isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)]"
        aria-live="polite"
      >
        <Spinner label="Loading settings" />
      </div>
    );
  }

  if (list.isError) {
    return (
      <div>
        <ErrorState
          title="Failed to load settings"
          description="System settings could not be loaded. Please try again."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-surface-alt)]">
            <IconSettings className="h-4 w-4 text-[var(--color-text-secondary)]" stroke={1.6} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
              System configuration
            </h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              Generic key/value settings. Dedicated pages own retention, media storage, security
              policies, and feature flags.
            </p>
          </div>
        </div>
        <Button
          variant={creating ? 'secondary' : 'primary'}
          size="md"
          onClick={() => setCreating((c) => !c)}
          leftIcon={<IconPlus className="h-4 w-4" stroke={1.6} />}
        >
          {creating ? 'Cancel' : 'New setting'}
        </Button>
      </header>

      {creating ? (
        <Card className="rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[var(--color-ink)]">
              Create new setting
            </CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Key"
                  name="key"
                  value={draftKey}
                  onChange={(e) => setDraftKey(e.target.value)}
                  required
                  placeholder="limits.upload.per_hour"
                  className="font-mono"
                />
                <Select
                  label="Type"
                  name="type"
                  value={draftType}
                  onChange={(e) => setDraftType(e.target.value as Setting['type'])}
                  options={TYPES.map((t) => ({ value: t, label: t }))}
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Value"
                    name="value"
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                    required
                    className="font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    label="Description"
                    name="description"
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
              </div>
              <div className="flex flex-wrap justify-end">
                <Button variant="primary" size="md" type="submit" loading={create.isPending}>
                  Create setting
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="relative block w-full">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]">
            <IconSearch className="h-4 w-4" stroke={1.6} />
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search keys…"
            className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 pl-10 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
      </div>

      <Card className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
        {rows.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState title="No system settings" description="No settings match your search." />
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
                    Type / visibility
                  </th>
                  <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    Value
                  </th>
                  <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    Description
                  </th>
                  <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {rows.map((s) => (
                  <SettingRow
                    key={s.id}
                    s={s}
                    busy={create.isPending || update.isPending || remove.isPending}
                    onSave={(patch) => update.mutate(patch as Partial<Setting> & { key: string })}
                    onDelete={() => {
                      if (confirm(`Delete ${s.key}?`)) remove.mutate(s.id);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
