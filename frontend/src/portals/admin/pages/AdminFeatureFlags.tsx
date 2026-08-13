import { useFeatureFlags, useToggleFeatureFlag, type AppConfigFlag } from '../api/client';
import { useState, type JSX } from 'react';
import { Spinner, ErrorState, Card, CardHeader, CardTitle, Badge } from '../../../shared/ui';
import { IconAdjustments, IconSearch } from '@tabler/icons-react';

export default function AdminFeatureFlags(): JSX.Element {
  const list = useFeatureFlags();
  const toggle = useToggleFeatureFlag();
  const [search, setSearch] = useState('');

  const filtered = (list.data ?? []).filter((f) =>
    search.trim() === ''
      ? true
      : f.key.toLowerCase().includes(search.toLowerCase()) ||
        (f.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  if (list.isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)]"
        aria-live="polite"
      >
        <Spinner label="Loading flags" />
      </div>
    );
  }

  if (list.isError) {
    return (
      <div className="min-h-screen bg-[var(--color-canvas)] p-6">
        <ErrorState
          title="Failed to load feature flags"
          description="An error occurred while fetching the flag list. Try refreshing the page."
          action={
            <button
              type="button"
              onClick={() => void list.refetch()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 text-sm text-white transition hover:bg-black"
            >
              Retry
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
              Feature flags
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Master kill-switches and gradual rollouts.
            </p>
          </div>
          <div className="relative w-full max-w-xs">
            <IconSearch
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
              stroke={1.6}
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search flags…"
              className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 pl-10 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-10 text-center">
            <IconAdjustments className="mx-auto h-8 w-8 text-[var(--color-text-tertiary)]" stroke={1.4} />
            <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">
              {search ? 'No flags match your search' : 'No flags'}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {search
                ? 'Try a different search term.'
                : 'Feature flags configured in the platform will appear here.'}
            </p>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {search
                  ? `${filtered.length} result${filtered.length === 1 ? '' : 's'}`
                  : 'All flags'}
              </CardTitle>
              <span className="text-xs text-[var(--color-text-tertiary)]">{(list.data ?? []).length} total</span>
            </CardHeader>
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {filtered.map((f: AppConfigFlag) => (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-[var(--color-canvas)]/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-semibold text-[var(--color-ink)]">{f.key}</p>
                      {f.enabled ? (
                        <Badge tone="success">enabled</Badge>
                      ) : (
                        <Badge tone="neutral">disabled</Badge>
                      )}
                    </div>
                    {f.description && (
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{f.description}</p>
                    )}
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                      Rollout {f.rollout_percentage}%
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle.mutate({ key: f.key, enabled: !f.enabled })}
                    disabled={toggle.isPending}
                    className={
                      f.enabled
                        ? 'rounded-full bg-[#edf7f0] px-3 py-1.5 text-xs font-semibold text-[var(--color-success)] transition hover:bg-[#d6ede0]'
                        : 'rounded-full bg-[var(--color-surface-alt)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-border-subtle)]'
                    }
                  >
                    {f.enabled ? '● On' : '○ Off'}
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
