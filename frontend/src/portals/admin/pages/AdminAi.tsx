import { useState, type FormEvent, type JSX } from 'react';
import {
  useAiProviders,
  useAiPrompts,
  useCreateAiProvider,
  useUpdateAiProvider,
  useActivateAiProvider,
  useTestAiProvider,
  useApprovePrompt,
  useRollbackPrompt,
  type AiProvider,
  type AiProviderDriver,
  type AiProviderInput,
  type PromptVersion,
} from '../api/client';
import { Button, Card, CardBody, Spinner, EmptyState, ErrorState, Badge } from '../../../shared/ui';
import { cx } from '../../../shared/ui/cx';
import {
  IconPlus,
  IconEdit,
  IconBolt,
  IconCheck,
  IconX,
  IconArrowBack,
  IconRosetteDiscountCheck,
} from '@tabler/icons-react';

const DRIVERS: { value: AiProviderDriver; label: string }[] = [
  { value: 'qwen_vl', label: 'Qwen-VL (DashScope)' },
  { value: 'openai_compatible', label: 'OpenAI-compatible (OpenRouter, Modal.com, …)' },
];

type TestResult = { healthy: boolean; error?: string } | null;

function ProviderRow({
  p,
  busy,
  testResult,
  onTest,
  onActivate,
  onEdit,
}: {
  p: AiProvider;
  busy: boolean;
  testResult: TestResult;
  onTest: () => void;
  onActivate: () => void;
  onEdit: () => void;
}): JSX.Element {
  return (
    <tr>
      <td className="px-5 py-3 text-sm">
        <div className="font-mono text-xs text-[var(--color-text-secondary)]">{p.code}</div>
        <div className="font-medium text-[var(--color-ink)]">{p.name}</div>
        <div className="text-xs text-[var(--color-text-secondary)]">
          driver: {p.driver} · model: {p.model}
        </div>
      </td>
      <td className="px-5 py-3 text-sm tabular-nums text-[var(--color-ink)]">{p.priority}</td>
      <td className="px-5 py-3 text-sm">
        <Badge tone={p.active ? 'success' : 'neutral'}>{p.active ? 'active' : 'inactive'}</Badge>
      </td>
      <td className="px-5 py-3 text-sm text-[var(--color-ink)]">
        {p.has_secret ? (
          <span className="inline-flex items-center gap-1 text-[var(--color-success)]">
            <IconCheck className="h-3.5 w-3.5" stroke={1.8} />
            set
          </span>
        ) : (
          <span className="text-[var(--color-text-tertiary)]">not set</span>
        )}
      </td>
      <td className="px-5 py-3 text-sm">
        {testResult === null ? (
          <span className="text-[var(--color-text-tertiary)]">not tested yet</span>
        ) : testResult.healthy ? (
          <span className="inline-flex items-center gap-1 text-[var(--color-success)]">
            <IconCheck className="h-3.5 w-3.5" stroke={1.8} />
            reachable
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-[var(--color-danger)]"
            title={testResult.error}
          >
            <IconX className="h-3.5 w-3.5" stroke={1.8} />
            unreachable
          </span>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={onEdit}
            leftIcon={<IconEdit className="h-3.5 w-3.5" stroke={1.6} />}
          >
            Edit
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={onTest}
            leftIcon={<IconBolt className="h-3.5 w-3.5" stroke={1.6} />}
          >
            Test
          </Button>
          <Button
            variant="success"
            size="sm"
            disabled={busy || p.active}
            onClick={onActivate}
            leftIcon={<IconRosetteDiscountCheck className="h-3.5 w-3.5" stroke={1.6} />}
          >
            Activate
          </Button>
        </div>
      </td>
    </tr>
  );
}

function PromptRow({
  p,
  busy,
  onApprove,
  onRollback,
}: {
  p: PromptVersion;
  busy: boolean;
  onApprove: () => void;
  onRollback: () => void;
}): JSX.Element {
  return (
    <tr>
      <td className="px-5 py-3 text-sm">
        <div className="font-mono text-xs text-[var(--color-text-secondary)]">{p.name}</div>
        <div className="font-medium text-[var(--color-ink)]">v{p.version}</div>
      </td>
      <td className="px-5 py-3 text-sm">
        <Badge
          tone={p.status === 'approved' ? 'success' : p.status === 'draft' ? 'warning' : 'neutral'}
        >
          {p.status}
        </Badge>
      </td>
      <td className="px-5 py-3 text-sm text-[var(--color-text-secondary)]">
        <code className="block max-w-md truncate rounded bg-[var(--color-surface-alt)] px-1.5 py-0.5 text-xs text-[var(--color-ink)]">
          {p.purpose ?? '—'}
        </code>
      </td>
      <td className="px-5 py-3 text-sm text-[var(--color-text-secondary)]">
        <code className="block max-w-md truncate rounded bg-[var(--color-surface-alt)] px-1.5 py-0.5 text-xs text-[var(--color-ink)]">
          {p.prompt_text.slice(0, 80)}
          {p.prompt_text.length > 80 ? '…' : ''}
        </code>
      </td>
      <td className="px-5 py-3 text-sm tabular-nums text-[var(--color-ink)]">
        {p.approved_at ? new Date(p.approved_at).toLocaleDateString() : '—'}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="success"
            size="sm"
            disabled={busy || p.status === 'approved'}
            onClick={onApprove}
            leftIcon={<IconCheck className="h-3.5 w-3.5" stroke={1.6} />}
          >
            Approve
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || p.status !== 'deprecated'}
            onClick={onRollback}
            leftIcon={<IconArrowBack className="h-3.5 w-3.5" stroke={1.6} />}
          >
            Rollback
          </Button>
        </div>
      </td>
    </tr>
  );
}

const EMPTY_FORM: AiProviderInput = {
  code: '',
  driver: 'openai_compatible',
  name: '',
  base_url: '',
  auth_type: 'bearer',
  credentials: { api_key: '' },
  extra_headers: {},
  model: '',
  temperature: 0.2,
  timeout_ms: 30000,
  retry_count: 2,
  priority: 100,
  is_fallback: false,
  active: false,
};

function ProviderForm({
  initial,
  onCancel,
  onSubmit,
  busy,
}: {
  initial: AiProviderInput;
  onCancel: () => void;
  onSubmit: (input: AiProviderInput) => void;
  busy: boolean;
}): JSX.Element {
  const [form, setForm] = useState<AiProviderInput>(initial);
  const [headerRows, setHeaderRows] = useState<[string, string][]>(
    Object.entries(initial.extra_headers ?? {}),
  );

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    const extra_headers = Object.fromEntries(headerRows.filter(([k]) => k.trim() !== ''));
    onSubmit({ ...form, extra_headers });
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Provider form"
      className="space-y-5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-canvas)] p-5"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="font-medium text-[var(--color-ink)]">Code</span>
          <input
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-sm focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[var(--color-ink)]">Driver</span>
          <select
            value={form.driver}
            onChange={(e) => setForm({ ...form, driver: e.target.value as AiProviderDriver })}
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-sm focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          >
            {DRIVERS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[var(--color-ink)]">Name</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-sm focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[var(--color-ink)]">Model</span>
          <input
            required
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-sm focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
        <label className="col-span-2 block text-sm">
          <span className="font-medium text-[var(--color-ink)]">Base URL</span>
          <input
            required
            type="url"
            placeholder="https://openrouter.ai/api or your Modal.com endpoint"
            value={form.base_url}
            onChange={(e) => setForm({ ...form, base_url: e.target.value })}
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-sm focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[var(--color-ink)]">Auth type</span>
          <select
            value={form.auth_type}
            onChange={(e) =>
              setForm({ ...form, auth_type: e.target.value as AiProviderInput['auth_type'] })
            }
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-sm focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          >
            <option value="bearer">Bearer token</option>
            <option value="api_key">API key</option>
            <option value="none">None</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[var(--color-ink)]">API key</span>
          <input
            type="password"
            placeholder="Leave blank to keep the existing key"
            value={form.credentials?.api_key ?? ''}
            onChange={(e) => setForm({ ...form, credentials: { api_key: e.target.value } })}
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-sm focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[var(--color-ink)]">Temperature</span>
          <input
            type="number"
            step="0.1"
            min={0}
            max={2}
            value={form.temperature}
            onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-sm focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[var(--color-ink)]">Timeout (ms)</span>
          <input
            type="number"
            min={1000}
            max={120000}
            value={form.timeout_ms}
            onChange={(e) => setForm({ ...form, timeout_ms: Number(e.target.value) })}
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-sm focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[var(--color-ink)]">Retry count</span>
          <input
            type="number"
            min={0}
            max={5}
            value={form.retry_count}
            onChange={(e) => setForm({ ...form, retry_count: Number(e.target.value) })}
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-sm focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-[var(--color-ink)]">Priority</span>
          <input
            type="number"
            min={0}
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
            className="mt-1 block w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-sm focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_fallback}
            onChange={(e) => setForm({ ...form, is_fallback: e.target.checked })}
            className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-ink)] focus:ring-[var(--color-ink)]"
          />
          <span className="font-medium text-[var(--color-ink)]">Fallback provider</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-ink)] focus:ring-[var(--color-ink)]"
          />
          <span className="font-medium text-[var(--color-ink)]">Active</span>
        </label>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--color-ink)]">Extra headers</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setHeaderRows([...headerRows, ['', '']])}
          >
            + Add header
          </Button>
        </div>
        <p className="mb-2 text-xs text-[var(--color-text-tertiary)]">
          Static headers for the request (e.g. OpenRouter&apos;s <code>HTTP-Referer</code> /{' '}
          <code>X-Title</code>).
        </p>
        {headerRows.map(([key, value], i) => (
          <div key={i} className="mb-1.5 flex gap-2">
            <input
              placeholder="Header name"
              value={key}
              onChange={(e) => {
                const next = [...headerRows];
                next[i] = [e.target.value, value];
                setHeaderRows(next);
              }}
              className="block w-1/2 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-sm focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
            />
            <input
              placeholder="Header value"
              value={value}
              onChange={(e) => {
                const next = [...headerRows];
                next[i] = [key, e.target.value];
                setHeaderRows(next);
              }}
              className="block w-1/2 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-sm focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
            />
            <button
              type="button"
              onClick={() => setHeaderRows(headerRows.filter((_, idx) => idx !== i))}
              className="rounded-xl border border-[var(--color-border)] bg-white px-2 text-sm hover:bg-[var(--color-canvas)]"
              aria-label={`Remove header row ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

export default function AdminAi(): JSX.Element {
  const [tab, setTab] = useState<'providers' | 'prompts'>('providers');
  const [editing, setEditing] = useState<AiProvider | 'new' | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const providers = useAiProviders();
  const prompts = useAiPrompts();
  const createProvider = useCreateAiProvider();
  const updateProvider = useUpdateAiProvider();
  const testProvider = useTestAiProvider();
  const activateProvider = useActivateAiProvider();
  const approvePrompt = useApprovePrompt();
  const rollbackPrompt = useRollbackPrompt();

  const providerList = providers.data ?? [];
  const promptList = prompts.data ?? [];
  const formBusy = createProvider.isPending || updateProvider.isPending;

  function handleTest(id: string): void {
    testProvider.mutate(id, {
      onSuccess: (result) => setTestResults((prev) => ({ ...prev, [id]: result })),
      onError: () =>
        setTestResults((prev) => ({ ...prev, [id]: { healthy: false, error: 'request failed' } })),
    });
  }

  function handleFormSubmit(input: AiProviderInput): void {
    if (editing === 'new') {
      createProvider.mutate(input, { onSuccess: () => setEditing(null) });
    } else if (editing) {
      updateProvider.mutate({ id: editing.id, ...input }, { onSuccess: () => setEditing(null) });
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
            AI providers & prompts
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Manage AI vision pipeline providers and prompt versions. Secrets are write-only;
            rollback is non-destructive.
          </p>
        </div>
        {tab === 'providers' && editing === null ? (
          <Button
            onClick={() => setEditing('new')}
            leftIcon={<IconPlus className="h-4 w-4" stroke={1.6} />}
          >
            New provider
          </Button>
        ) : null}
      </header>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setTab('providers')}
          className={cx(
            'rounded-full px-4 py-2 text-sm font-medium transition',
            tab === 'providers'
              ? 'bg-[var(--color-ink)] text-white'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]',
          )}
        >
          Providers ({providerList.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('prompts')}
          className={cx(
            'rounded-full px-4 py-2 text-sm font-medium transition',
            tab === 'prompts'
              ? 'bg-[var(--color-ink)] text-white'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]',
          )}
        >
          Prompts ({promptList.length})
        </button>
      </div>

      {tab === 'providers' ? (
        <div className="space-y-5">
          {editing !== null ? (
            <ProviderForm
              initial={
                editing === 'new'
                  ? EMPTY_FORM
                  : {
                      code: editing.code,
                      driver: editing.driver,
                      name: editing.name,
                      base_url: editing.base_url ?? '',
                      auth_type: editing.auth_type,
                      credentials: { api_key: '' },
                      extra_headers: editing.extra_headers ?? {},
                      model: editing.model,
                      temperature: editing.temperature,
                      timeout_ms: editing.timeout_ms,
                      retry_count: editing.retry_count,
                      priority: editing.priority,
                      is_fallback: editing.is_fallback,
                      active: editing.active,
                    }
              }
              busy={formBusy}
              onCancel={() => setEditing(null)}
              onSubmit={handleFormSubmit}
            />
          ) : null}

          <Card>
            <CardBody className="p-0">
              {providers.isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Spinner label="Loading providers" />
                </div>
              ) : providers.isError ? (
                <div className="p-6">
                  <ErrorState
                    title="Failed to load providers"
                    description="There was a problem fetching the AI providers."
                    error={providers.error instanceof Error ? providers.error : null}
                    action={
                      <Button
                        variant="secondary"
                        onClick={() => {
                          void providers.refetch();
                        }}
                      >
                        Try again
                      </Button>
                    }
                  />
                </div>
              ) : providerList.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No AI providers configured"
                    description="Add a provider to start processing complaints with AI vision."
                    action={
                      <Button variant="secondary" onClick={() => setEditing('new')}>
                        Add provider
                      </Button>
                    }
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[60rem]">
                    <thead className="bg-[var(--color-canvas)]">
                      <tr>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                          Code / driver / model
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                          Priority
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                          Active
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                          Secret
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                          Last test
                        </th>
                        <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-subtle)]">
                      {providerList.map((p) => (
                        <ProviderRow
                          key={p.id}
                          p={p}
                          busy={testProvider.isPending || activateProvider.isPending}
                          testResult={testResults[p.id] ?? null}
                          onTest={() => handleTest(p.id)}
                          onActivate={() => activateProvider.mutate(p.id)}
                          onEdit={() => setEditing(p)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      ) : (
        <Card>
          <CardBody className="p-0">
            {prompts.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner label="Loading prompts" />
              </div>
            ) : prompts.isError ? (
              <div className="p-6">
                <ErrorState
                  title="Failed to load prompts"
                  description="There was a problem fetching the prompt versions."
                  error={prompts.error instanceof Error ? prompts.error : null}
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void prompts.refetch();
                      }}
                    >
                      Try again
                    </Button>
                  }
                />
              </div>
            ) : promptList.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No prompt versions registered"
                  description="Prompt versions will appear here once created."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[60rem]">
                  <thead className="bg-[var(--color-canvas)]">
                    <tr>
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                        Name / version
                      </th>
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                        Status
                      </th>
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                        Variables
                      </th>
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                        Template
                      </th>
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                        Approved
                      </th>
                      <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {promptList.map((p) => (
                      <PromptRow
                        key={p.id}
                        p={p}
                        busy={approvePrompt.isPending || rollbackPrompt.isPending}
                        onApprove={() => approvePrompt.mutate(p.id)}
                        onRollback={() => rollbackPrompt.mutate(p.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
