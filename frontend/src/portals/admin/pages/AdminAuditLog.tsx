import { useState, type JSX } from 'react';
import { useAuditLogs, type AuditLog } from '../api/client';
import { Spinner, ErrorState, Card, CardHeader, CardTitle, CardBody } from '../../../shared/ui';
import {
  IconSearch,
  IconCalendarUser,
  IconFilter,
  IconArrowUp,
  IconUser,
  IconDoorEnter,
  IconPencil,
  IconTrash,
  IconWorld,
} from '@tabler/icons-react';

function actionIcon(action: string): JSX.Element {
  const cls = 'h-3.5 w-3.5';
  const lower = action.toLowerCase();
  if (lower.includes('login') || lower.includes('auth'))
    return <IconDoorEnter className={cls} stroke={1.6} />;
  if (lower.includes('update') || lower.includes('edit'))
    return <IconPencil className={cls} stroke={1.6} />;
  if (lower.includes('delete') || lower.includes('remove'))
    return <IconTrash className={cls} stroke={1.6} />;
  if (lower.includes('create') || lower.includes('store'))
    return <IconArrowUp className={cls} stroke={1.6} />;
  return <IconUser className={cls} stroke={1.6} />;
}

export default function AdminAuditLog(): JSX.Element {
  const [action, setAction] = useState<string>('');
  const [entity, setEntity] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const list = useAuditLogs({
    action: action || undefined,
    entity: entity || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const hasFilters =
    action.trim() !== '' || entity.trim() !== '' || dateFrom !== '' || dateTo !== '';

  const clearFilters = () => {
    setAction('');
    setEntity('');
    setDateFrom('');
    setDateTo('');
  };

  if (list.isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)]"
        aria-live="polite"
      >
        <Spinner label="Loading audit log" />
      </div>
    );
  }

  if (list.isError) {
    return (
      <div className="min-h-screen bg-[var(--color-canvas)] p-6">
        <ErrorState
          title="Failed to load audit log"
          description="An error occurred while fetching entries. Try refreshing the page."
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
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">Audit log</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Search who-did-what across the platform.</p>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-[var(--color-ink)] ring-1 ring-[var(--color-border)] transition hover:bg-[var(--color-canvas)]"
          >
            <IconFilter className="h-4 w-4" stroke={1.6} />
            Filters
            {hasFilters && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-ink)] text-[10px] text-white">
                !
              </span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-[var(--color-text-secondary)] transition hover:text-[var(--color-ink)]"
                >
                  Clear all
                </button>
              )}
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label
                    htmlFor="audit-action"
                    className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]"
                  >
                    Action
                  </label>
                  <div className="relative">
                    <IconSearch
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
                      stroke={1.6}
                    />
                    <input
                      id="audit-action"
                      value={action}
                      onChange={(e) => setAction(e.target.value)}
                      placeholder="e.g. report.update"
                      className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 pl-10 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="audit-entity"
                    className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]"
                  >
                    Entity
                  </label>
                  <div className="relative">
                    <IconSearch
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
                      stroke={1.6}
                    />
                    <input
                      id="audit-entity"
                      value={entity}
                      onChange={(e) => setEntity(e.target.value)}
                      placeholder="e.g. Report"
                      className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 pl-10 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="audit-date-from"
                    className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]"
                  >
                    From
                  </label>
                  <input
                    id="audit-date-from"
                    type="datetime-local"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="audit-date-to"
                    className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]"
                  >
                    To
                  </label>
                  <input
                    id="audit-date-to"
                    type="datetime-local"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {(list.data ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-10 text-center">
            <IconCalendarUser className="mx-auto h-8 w-8 text-[var(--color-text-tertiary)]" stroke={1.4} />
            <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">No entries found</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Try widening the filters or pick a different action/entity.
            </p>
          </div>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-[var(--color-canvas)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    <th className="px-5 py-3 font-medium">When</th>
                    <th className="px-5 py-3 font-medium">Action</th>
                    <th className="px-5 py-3 font-medium">Entity</th>
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {(list.data ?? []).map((row: AuditLog) => (
                    <tr key={row.id} className="transition hover:bg-[var(--color-canvas)]/60">
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-[var(--color-text-secondary)]">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                            {actionIcon(row.action)}
                          </span>
                          <div>
                            <p className="font-mono text-xs font-medium text-[var(--color-ink)]">
                              {row.action}
                            </p>
                            {row.roles.length > 0 && (
                              <p className="text-[10px] text-[var(--color-text-tertiary)]">{row.roles.join(', ')}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {row.entity ? (
                          <div>
                            <p className="text-xs font-medium text-[var(--color-ink)]">{row.entity}</p>
                            {row.entity_id && (
                              <p className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
                                {row.entity_id.slice(0, 8)}…
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--color-text-tertiary)]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {(row.user_name ?? row.user_id) ? (
                          <div>
                            <p className="text-xs font-medium text-[var(--color-ink)]">
                              {row.user_name ?? row.user_id?.slice(0, 8)}
                            </p>
                            {!row.user_name && row.user_id && (
                              <p className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
                                {row.user_id.slice(0, 8)}…
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--color-text-tertiary)]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {row.ip ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--color-text-secondary)]">
                            <IconWorld className="h-3 w-3" stroke={1.6} />
                            {row.ip}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--color-text-tertiary)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-canvas)] px-5 py-3">
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Showing {(list.data ?? []).length} entr
                {(list.data ?? []).length === 1 ? 'y' : 'ies'}
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
