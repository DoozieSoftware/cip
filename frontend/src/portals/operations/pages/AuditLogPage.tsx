import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Spinner,
  EmptyState,
  Input,
  Select,
  Button,
  Badge,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '../design';
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
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
  }, [exportedAt]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Audit log</h1>
          <p className="text-sm text-slate-500">
            Immutable, append-only record of security-relevant events. Read-only for auditors and admins.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {exportedAt && (
            <span className="text-xs text-slate-500" aria-live="polite">
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
          >
            Export CSV (current page)
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
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
        </CardBody>
      </Card>

      {query.isLoading ? (
        <div className="flex items-center justify-center py-20" aria-live="polite">
          <Spinner label="Loading audit log" />
        </div>
      ) : query.error ? (
        <EmptyState
          title="Could not load audit log"
          description="The audit log endpoint did not respond."
          action={
            <button
              type="button"
              onClick={() => {
                void query.refetch();
              }}
              className="text-sm font-medium text-emerald-600 hover:underline"
            >
              Retry
            </button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No audit events match these filters"
          description="Loosen the filters or clear them to see all events."
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>User</TH>
                  <TH>Role</TH>
                  <TH>Entity</TH>
                  <TH>Action</TH>
                  <TH>IP</TH>
                  <TH>Browser</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.id}>
                    <TD className="whitespace-nowrap text-xs text-slate-500">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                    </TD>
                    <TD>
                      <div className="font-medium text-slate-900">{r.user_name ?? '—'}</div>
                      <div className="text-xs text-slate-500">{r.user_id ?? ''}</div>
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {r.roles.length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          r.roles.map((role) => (
                            <Badge key={role} tone="info">
                              {role}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TD>
                    <TD>
                      <div className="text-sm">{r.entity}</div>
                      <div className="text-xs text-slate-500">{r.entity_id ?? '—'}</div>
                    </TD>
                    <TD className="font-mono text-xs">{r.action}</TD>
                    <TD className="text-xs text-slate-600">{r.ip ?? '—'}</TD>
                    <TD className="text-xs text-slate-600">{r.device_fingerprint ?? '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      )}

      {rows.length > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {meta.current_page} of {meta.last_page} · {meta.total} total
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={meta.current_page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }))}
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
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
