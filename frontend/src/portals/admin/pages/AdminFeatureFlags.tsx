import { useFeatureFlags, useToggleFeatureFlag, type AppConfigFlag } from '../api/client';
import { type JSX } from 'react';
import { Spinner, EmptyState } from '../../moderator/design';

export default function AdminFeatureFlags(): JSX.Element {
  const list = useFeatureFlags();
  const toggle = useToggleFeatureFlag();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Feature flags</h1>
        <p className="text-sm text-slate-600">Master kill-switches and gradual rollouts.</p>
      </header>

      {list.isLoading ? (
        <Spinner label="Loading flags" />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState title="No flags" />
      ) : (
        <div className="space-y-2">
          {(list.data ?? []).map((f: AppConfigFlag) => (
            <article key={f.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <h2 className="font-mono text-sm font-semibold text-slate-900">{f.key}</h2>
                {f.description && <p className="mt-0.5 text-xs text-slate-500">{f.description}</p>}
                <p className="mt-1 text-xs text-slate-500">rollout: {f.rollout_percentage}%</p>
              </div>
              <button
                type="button"
                onClick={() => toggle.mutate({ key: f.key, enabled: !f.enabled })}
                disabled={toggle.isPending}
                className={f.enabled ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200' : 'rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-300'}
              >
                {f.enabled ? '● On' : '○ Off'}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
