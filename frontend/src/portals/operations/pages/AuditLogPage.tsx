import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  IconShield,
  IconDownload,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconX,
} from '@tabler/icons-react';
import { Spinner, Input, Select, Button, Badge } from '../shared/ui';
import { auditApi, type AuditLogFilters, type AuditLogRow } from '../api/operations';
import type { PaginationMeta } from '../types';

const ROLES: Array<{ value: string; label: string }> = [
  { value: '', label: 'All roles' },
  { value: 'super_admin', label: 'super_admin' },
  { value: 'system', label: 'system' },
  { value: 'auditor', label: 'auditor' },
  { value: 'department_admin', label: 'department_admin' },
  { value: 'department', label: 'department' },
  { value: 'moderator', label: 'moderator' },
  { value: 'senior_moderator', label: 'senior_moderator' },
  { value: 'citizen', label: 'citizen' },
];

function downloadCsv(rows: AuditLogRow[], filename: string): void {
  const headers = [
    'id',
    'created_at',
    'user_id',
    'user_name',
    'roles',
    'entity',
    'entity_id',
    'action',
    'ip',
    'device_fingerprint',
    'request_id',
  ];
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    if (/[",\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.created_at ?? '',
        r.user_id ?? '',
        r.user_name ?? '',
        r.roles.join('|'),
        r.entity,
        r.entity_id ?? '',
        r.action,
        r.ip ?? '',
        r.device_fingerprint ?? '',
        r.request_id ?? '',
      ]
        .map(escape)
        .join(','),
    );
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AuditLogPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    per_page: 50,
  });
  const [exportedAt, setExportedAt] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const query = useQuery<{ success: boolean; data: AuditLogRow[]; meta: PaginationMeta }>({
    queryKey: ['operations', 'audit', filters],
    queryFn: () => auditApi.list(filters),
  });

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta ?? { current_page: 1, per_page: 50, total: 0, last_page: 1 };

  const setFilter = <K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]): void => {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  };

  const csvFilename = useMemo(() => {
    const d = new Date();
    const stamp = d.toISOString().replace(/[:.]/g, '-');
    return `audit-log-${stamp}.csv`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportedAt]);

  const activeFilterCount = [
    filters.user_id,
    filters.role,
    filters.action,
    filters.entity,
    filters.ip,
    filters.device_fingerprint,
    filters.date_from,
    filters.date_to,
    filters.search,
  ].filter(Boolean).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1d1d1b]">
            <IconShield className="h-5 w-5 text-white" stroke={1.6} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#1d1d1b]">Audit log</h1>
            <p className="text-xs text-[#85847f]">Immutable record of security-relevant events</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {exportedAt && (
            <span className="text-xs text-[#85847f]" aria-live="polite">
              Exported {exportedAt}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={rows.length === 0}
            onClick={() => {
              downloadCsv(rows, csvFilename);
              setExportedAt(new Date().toLocaleTimeString());
            }}
            leftIcon={<IconDownload className="h-3.5 w-3.5" stroke={1.6} />}
          >
            Export CSV
          </Button>
        </div>
      </header>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-black/5">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <IconFilter className="h-4 w-4 text-[#6f6e69]" stroke={1.6} />
            <span className="text-sm font-medium text-[#1d1d1b]">Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1d1d1b] px-1.5 text-[10px] font-medium text-white">
                {activeFilterCount}
              </span>
            )}
          </div>
          <IconChevronRight
            className={`h-4 w-4 text-[#85847f] transition-transform ${showFilters ? 'rotate-90' : ''}`}
            stroke={1.6}
          />
        </button>
        {showFilters && (
          <div className="border-t border-black/5 px-4 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
              <Input
                label="User ID"
                placeholder="uuid"
                value={filters.user_id ?? ''}
                onChange={(e) => setFilter('user_id', e.target.value || undefined)}
              />
              <Select
                label="Role"
                value={filters.role ?? ''}
                options={ROLES}
                onChange={(e) => setFilter('role', e.target.value || undefined)}
              />
              <Input
                label="Action"
                placeholder="e.g. report.department_action"
                value={filters.action ?? ''}
                onChange={(e) => setFilter('action', e.target.value || undefined)}
              />
              <Input
                label="Entity"
                placeholder="e.g. reports, departments"
                value={filters.entity ?? ''}
                onChange={(e) => setFilter('entity', e.target.value || undefined)}
              />
              <Input
                label="IP address"
                placeholder="e.g. 10.0.0.5"
                value={filters.ip ?? ''}
                onChange={(e) => setFilter('ip', e.target.value || undefined)}
              />
              <Input
                label="Browser (device fp)"
                placeholder="partial match"
                value={filters.device_fingerprint ?? ''}
                onChange={(e) => setFilter('device_fingerprint', e.target.value || undefined)}
              />
              <Input
                label="Date from"
                type="date"
                value={filters.date_from ?? ''}
                onChange={(e) => setFilter('date_from', e.target.value || undefined)}
              />
              <Input
                label="Date to"
                type="date"
                value={filters.date_to ?? ''}
                onChange={(e) => setFilter('date_to', e.target.value || undefined)}
              />
              <Input
                label="Search"
                placeholder="free text (action / entity)"
                value={filters.search ?? ''}
                onChange={(e) => setFilter('search', e.target.value || undefined)}
                className="md:col-span-2 lg:col-span-3"
              />
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => setFilters({ page: 1, per_page: 50 })}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#6f6e69] hover:text-[#1d1d1b]"
              >
                <IconX className="h-3.5 w-3.5" stroke={1.6} />
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {query.isLoading ? (
        <div className="flex items-center justify-center py-20" aria-live="polite">
          <Spinner label="Loading audit log" />
        </div>
      ) : query.error ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-black/5">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <IconShield className="h-6 w-6 text-red-500" stroke={1.6} />
          </div>
          <h3 className="text-base font-semibold text-[#1d1d1b]">Could not load audit log</h3>
          <p className="mt-1 text-sm text-[#6f6e69]">The audit log endpoint did not respond.</p>
          <button
            type="button"
            onClick={() => {
              void query.refetch();
            }}
            className="mt-4 text-sm font-medium text-[#1d1d1b] underline underline-offset-2 hover:text-[#6f6e69]"
          >
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-black/5">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f3f2ed]">
            <IconFilter className="h-6 w-6 text-[#85847f]" stroke={1.6} />
          </div>
          <h3 className="text-base font-semibold text-[#1d1d1b]">
            No audit events match these filters
          </h3>
          <p className="mt-1 text-sm text-[#6f6e69]">
            Loosen the filters or clear them to see all events.
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-black/5 bg-[#f3f2ed]">
                <tr>
                  <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-[#85847f]">
                    When
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-[#85847f]">
                    User
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-[#85847f]">
                    Role
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-[#85847f]">
                    Entity
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-[#85847f]">
                    Action
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-[#85847f]">
                    IP
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-[#85847f]">
                    Browser
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {rows.map((r) => (
                  <tr key={r.id} className="transition hover:bg-[#f3f2ed]/50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#6f6e69]">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1d1d1b]">{r.user_name ?? '—'}</div>
                      <div className="text-xs text-[#85847f]">{r.user_id ?? ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.roles.length === 0 ? (
                          <span className="text-xs text-[#85847f]">—</span>
                        ) : (
                          r.roles.map((role) => (
                            <Badge key={role} tone="info">
                              {role}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-[#1d1d1b]">{r.entity}</div>
                      <div className="text-xs text-[#85847f]">{r.entity_id ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#6f6e69]">{r.action}</td>
                    <td className="px-4 py-3 text-xs text-[#6f6e69]">{r.ip ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#6f6e69]">
                      {r.device_fingerprint ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#6f6e69]">
            Page {meta.current_page} of {meta.last_page} &middot; {meta.total} total
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={meta.current_page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }))}
              leftIcon={<IconChevronLeft className="h-3.5 w-3.5" stroke={1.6} />}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={meta.current_page >= meta.last_page}
              onClick={() =>
                setFilters((f) => ({ ...f, page: Math.min(meta.last_page, (f.page ?? 1) + 1) }))
              }
              leftIcon={<IconChevronRight className="h-3.5 w-3.5" stroke={1.6} />}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
