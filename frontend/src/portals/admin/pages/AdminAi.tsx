import { useState, type JSX } from 'react';
import {
  useAiProviders,
  useAiPrompts,
  useActivateAiProvider,
  useTestAiProvider,
  useApprovePrompt,
  useRollbackPrompt,
  type AiProvider,
  type PromptVersion,
} from '../api/client';
import { Spinner } from '../../moderator/design';
import { cx } from '../../moderator/design/cx';

function ProviderRow({ p, busy, onTest, onActivate }: {
  p: AiProvider;
  busy: boolean;
  onTest: () => void;
  onActivate: () => void;
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
      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">
        {p.last_health_at ? new Date(p.last_health_at).toLocaleString() : 'never'}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex justify-end gap-1.5">
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

export default function AdminAi(): JSX.Element {
  const [tab, setTab] = useState<'providers' | 'prompts'>('providers');
  const providers = useAiProviders();
  const prompts = useAiPrompts();
  const testProvider = useTestAiProvider();
  const activateProvider = useActivateAiProvider();
  const approvePrompt = useApprovePrompt();
  const rollbackPrompt = useRollbackPrompt();

  const providerList = providers.data ?? [];
  const promptList = prompts.data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">AI providers & prompts</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage AI vision pipeline providers and prompt versions. Secrets are write-only; rollback is non-destructive.
        </p>
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
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Last health</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {providerList.map((p) => (
                  <ProviderRow
                    key={p.id}
                    p={p}
                    busy={testProvider.isPending || activateProvider.isPending}
                    onTest={() => testProvider.mutate(p.id)}
                    onActivate={() => activateProvider.mutate(p.id)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </section>
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
