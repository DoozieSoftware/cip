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
import { Spinner } from '../../moderator/design';
import { cx } from '../../moderator/design/cx';

const DRIVERS: { value: AiProviderDriver; label: string }[] = [
  { value: 'qwen_vl', label: 'Qwen-VL (DashScope)' },
  { value: 'openai_compatible', label: 'OpenAI-compatible (OpenRouter, Modal.com, …)' },
];

type TestResult = { healthy: boolean; error?: string } | null;

function ProviderRow({ p, busy, testResult, onTest, onActivate, onEdit }: {
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
        <div className="font-mono text-xs text-slate-500">{p.code}</div>
        <div className="font-medium text-slate-900">{p.name}</div>
        <div className="text-xs text-slate-500">driver: {p.driver} · model: {p.model}</div>
      </td>
      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">{p.priority}</td>
      <td className="px-5 py-3 text-sm">
        <span
          className={cx(
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide',
            p.active
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
              : 'bg-slate-200 text-slate-700 border-slate-300',
          )}
        >
          {p.active ? 'active' : 'inactive'}
        </span>
      </td>
      <td className="px-5 py-3 text-sm text-slate-700">
        {p.has_secret ? 'set' : <span className="text-rose-700">missing</span>}
      </td>
      <td className="px-5 py-3 text-sm text-slate-700">
        {testResult === null ? (
          <span className="text-slate-400">not tested yet</span>
        ) : testResult.healthy ? (
          <span className="text-emerald-700">reachable</span>
        ) : (
          <span className="text-rose-700" title={testResult.error}>unreachable</span>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex justify-end gap-1.5">
          <button type="button" disabled={busy} onClick={onEdit} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50">Edit</button>
          <button type="button" disabled={busy} onClick={onTest} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50">Test</button>
          <button type="button" disabled={busy || p.active} onClick={onActivate} className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">Activate</button>
        </div>
      </td>
    </tr>
  );
}

function PromptRow({ p, busy, onApprove, onRollback }: {
  p: PromptVersion;
  busy: boolean;
  onApprove: () => void;
  onRollback: () => void;
}): JSX.Element {
  return (
    <tr>
      <td className="px-5 py-3 text-sm">
        <div className="font-mono text-xs text-slate-500">{p.name}</div>
        <div className="font-medium text-slate-900">v{p.version}</div>
      </td>
      <td className="px-5 py-3 text-sm">
        <span
          className={cx(
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide',
            p.status === 'approved'
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
              : p.status === 'draft'
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-slate-200 text-slate-700 border-slate-300',
          )}
        >
          {p.status}
        </span>
      </td>
      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">
        {p.variables?.length ?? 0}
      </td>
      <td className="px-5 py-3 text-sm text-slate-600">
        <code className="block max-w-md truncate rounded bg-slate-100 px-1.5 py-0.5 text-xs">{p.template.slice(0, 80)}{p.template.length > 80 ? '…' : ''}</code>
      </td>
      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">
        {p.approved_at ? new Date(p.approved_at).toLocaleDateString() : '—'}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex justify-end gap-1.5">
          <button type="button" disabled={busy || p.status === 'approved'} onClick={onApprove} className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">Approve</button>
          <button type="button" disabled={busy || p.status !== 'deprecated'} onClick={onRollback} className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-50">Rollback</button>
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

function ProviderForm({ initial, onCancel, onSubmit, busy }: {
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
    <form onSubmit={handleSubmit} aria-label="Provider form" className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="text-slate-700">Code</span>
          <input
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Driver</span>
          <select
            value={form.driver}
            onChange={(e) => setForm({ ...form, driver: e.target.value as AiProviderDriver })}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {DRIVERS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Name</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Model</span>
          <input
            required
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="col-span-2 block text-sm">
          <span className="text-slate-700">Base URL</span>
          <input
            required
            type="url"
            placeholder="https://openrouter.ai/api or your Modal.com endpoint"
            value={form.base_url}
            onChange={(e) => setForm({ ...form, base_url: e.target.value })}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Auth type</span>
          <select
            value={form.auth_type}
            onChange={(e) => setForm({ ...form, auth_type: e.target.value as AiProviderInput['auth_type'] })}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="bearer">Bearer token</option>
            <option value="api_key">API key</option>
            <option value="none">None</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">API key</span>
          <input
            type="password"
            placeholder="Leave blank to keep the existing key"
            value={form.credentials?.api_key ?? ''}
            onChange={(e) => setForm({ ...form, credentials: { api_key: e.target.value } })}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Temperature</span>
          <input
            type="number" step="0.1" min={0} max={2}
            value={form.temperature}
            onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Timeout (ms)</span>
          <input
            type="number" min={1000} max={120000}
            value={form.timeout_ms}
            onChange={(e) => setForm({ ...form, timeout_ms: Number(e.target.value) })}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Retry count</span>
          <input
            type="number" min={0} max={5}
            value={form.retry_count}
            onChange={(e) => setForm({ ...form, retry_count: Number(e.target.value) })}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Priority</span>
          <input
            type="number" min={0}
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_fallback}
            onChange={(e) => setForm({ ...form, is_fallback: e.target.checked })}
          />
          <span className="text-slate-700">Fallback provider</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          <span className="text-slate-700">Active</span>
        </label>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm text-slate-700">Extra headers</span>
          <button
            type="button"
            onClick={() => setHeaderRows([...headerRows, ['', '']])}
            className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs hover:bg-slate-50"
          >
            + Add header
          </button>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Static headers for the request (e.g. OpenRouter&apos;s <code>HTTP-Referer</code> / <code>X-Title</code>).
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
              className="block w-1/2 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <input
              placeholder="Header value"
              value={value}
              onChange={(e) => {
                const next = [...headerRows];
                next[i] = [key, e.target.value];
                setHeaderRows(next);
              }}
              className="block w-1/2 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => setHeaderRows(headerRows.filter((_, idx) => idx !== i))}
              className="rounded-md border border-slate-300 bg-white px-2 text-xs hover:bg-slate-50"
              aria-label={`Remove header row ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={busy} className="rounded-md border border-fuchsia-300 bg-fuchsia-50 px-3 py-1.5 text-sm text-fuchsia-800 hover:bg-fuchsia-100 disabled:opacity-50">
          {busy ? 'Saving…' : 'Save'}
        </button>
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
      onError: () => setTestResults((prev) => ({ ...prev, [id]: { healthy: false, error: 'request failed' } })),
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
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI providers & prompts</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage AI vision pipeline providers and prompt versions. Secrets are write-only; rollback is non-destructive.
          </p>
        </div>
        {tab === 'providers' && editing === null ? (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="rounded-md border border-fuchsia-300 bg-fuchsia-50 px-3 py-1.5 text-sm text-fuchsia-800 hover:bg-fuchsia-100"
          >
            + New provider
          </button>
        ) : null}
      </header>

      <div className="flex gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('providers')}
          className={cx(
            'border-b-2 px-4 py-2 text-sm font-medium',
            tab === 'providers' ? 'border-fuchsia-600 text-fuchsia-700' : 'border-transparent text-slate-600 hover:text-slate-900',
          )}
        >
          Providers ({providerList.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('prompts')}
          className={cx(
            'border-b-2 px-4 py-2 text-sm font-medium',
            tab === 'prompts' ? 'border-fuchsia-600 text-fuchsia-700' : 'border-transparent text-slate-600 hover:text-slate-900',
          )}
        >
          Prompts ({promptList.length})
        </button>
      </div>

      {tab === 'providers' ? (
        <div className="space-y-4">
          {editing !== null ? (
            <ProviderForm
              initial={editing === 'new' ? EMPTY_FORM : {
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
              }}
              busy={formBusy}
              onCancel={() => setEditing(null)}
              onSubmit={handleFormSubmit}
            />
          ) : null}

          <section aria-label="Providers" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {providers.isLoading ? (
              <div className="flex items-center justify-center py-16"><Spinner label="Loading providers" /></div>
            ) : providerList.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">No AI providers configured.</div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Code / driver / model</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Priority</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Active</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Secret</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Last test</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
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
            )}
          </section>
        </div>
      ) : (
        <section aria-label="Prompts" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {prompts.isLoading ? (
            <div className="flex items-center justify-center py-16"><Spinner label="Loading prompts" /></div>
          ) : promptList.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">No prompt versions registered.</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name / version</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Variables</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Template</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Approved</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
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
          )}
        </section>
      )}
    </div>
  );
}
