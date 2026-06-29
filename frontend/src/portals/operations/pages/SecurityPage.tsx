import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Spinner,
  EmptyState,
  Badge,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '../design';
import {
  securityApi,
  type SecurityDashboardSnapshot,
  type SecurityEventRow,
  type SecurityFailedLogin,
  type SecurityUserRecord,
} from '../api/operations';

interface WidgetCardProps {
  title: string;
  count: number;
  children: ReactNode;
  tone: 'info' | 'warning' | 'danger' | 'success' | 'neutral';
  hint?: string;
}

function WidgetCard({ title, count, children, tone, hint }: WidgetCardProps) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Badge tone={tone}>{count}</Badge>
      </CardHeader>
      <CardBody className="space-y-2">{children}</CardBody>
      {hint && <p className="px-4 pb-3 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

function FailedLoginsList({ rows }: { rows: SecurityFailedLogin[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-slate-500">No failed logins in the last 24h.</p>;
  }
  return (
    <ul className="space-y-2 text-sm" aria-label="Recent failed logins">
      {rows.map((r) => (
        <li key={r.id} className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 last:border-0">
          <div>
            <div className="font-medium text-slate-900">{r.user_name ?? r.mobile}</div>
            <div className="text-xs text-slate-500">
              {r.ip ?? '—'} · {r.failure_reason ?? 'unknown reason'}
            </div>
          </div>
          <time className="whitespace-nowrap text-xs text-slate-500" dateTime={r.login_at}>
            {new Date(r.login_at).toLocaleTimeString()}
          </time>
        </li>
      ))}
    </ul>
  );
}

function UserList({ rows, statusLabel }: { rows: SecurityUserRecord[]; statusLabel: string }) {
  if (rows.length === 0) {
    return <p className="text-xs text-slate-500">None.</p>;
  }
  return (
    <ul className="space-y-1 text-sm" aria-label={`${statusLabel} users`}>
      {rows.map((u) => (
        <li key={u.id} className="flex items-center justify-between gap-2">
          <span className="truncate">{u.name ?? u.mobile}</span>
          <span className="text-xs text-slate-500">{u.status}</span>
        </li>
      ))}
    </ul>
  );
}

function EventList({ rows }: { rows: SecurityEventRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-slate-500">No recent events.</p>;
  }
  return (
    <ul className="space-y-2 text-sm" aria-label="Recent security events">
      {rows.map((r) => (
        <li key={r.id} className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 last:border-0">
          <div>
            <div className="font-mono text-xs text-slate-900">{r.event}</div>
            <div className="text-xs text-slate-500">
              {r.ip ?? '—'} · {r.severity}
            </div>
          </div>
          <time className="whitespace-nowrap text-xs text-slate-500" dateTime={r.created_at ?? ''}>
            {r.created_at ? new Date(r.created_at).toLocaleTimeString() : '—'}
          </time>
        </li>
      ))}
    </ul>
  );
}

export default function SecurityPage() {
  const query = useQuery<{ success: boolean; data: SecurityDashboardSnapshot }>({
    queryKey: ['operations', 'security', 'dashboard'],
    queryFn: () => securityApi.dashboard(),
    refetchInterval: 60_000,
  });

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading security dashboard" />
      </div>
    );
  }

  if (query.error) {
    return (
      <EmptyState
        title="Could not load security dashboard"
        description="The dashboard endpoint did not respond."
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
    );
  }

  const snap = query.data?.data;
  if (!snap) {
    return <EmptyState title="No data" description="Security dashboard returned no data." />;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Security dashboard</h1>
          <p className="text-sm text-slate-500">
            Read-only summary of security events. Window: last 24 hours. Auto-refreshes every 60s.
          </p>
        </div>
        <p className="text-xs text-slate-500" aria-live="polite">
          Last fetched {new Date(snap.generated_at).toLocaleString()}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <WidgetCard title="Failed logins" count={snap.failed_logins.count} tone="warning" hint="login_histories (success = false)">
          <FailedLoginsList rows={snap.failed_logins.recent} />
        </WidgetCard>

        <WidgetCard title="Locked accounts" count={snap.locked_accounts.count} tone="info" hint="users.status = suspended">
          <UserList rows={snap.locked_accounts.recent} statusLabel="locked" />
        </WidgetCard>

        <WidgetCard title="Mock GPS reports" count={snap.mock_gps_reports.count} tone="danger" hint="security_events event = mock_gps">
          <EventList rows={snap.mock_gps_reports.recent} />
        </WidgetCard>

        <WidgetCard title="Spam detection" count={snap.spam_detection.count} tone="danger" hint="security_events event LIKE spam.%">
          <EventList rows={snap.spam_detection.recent} />
        </WidgetCard>

        <WidgetCard title="Rate limited users" count={snap.rate_limited_users.count} tone="warning" hint="security_events event = rate_limit.trip">
          <EventList rows={snap.rate_limited_users.recent} />
        </WidgetCard>

        <WidgetCard title="Suspicious devices" count={snap.suspicious_devices.count} tone="danger" hint="device.* / token.* / critical events">
          <EventList rows={snap.suspicious_devices.recent} />
        </WidgetCard>

        <WidgetCard title="Blocked users" count={snap.blocked_users.count} tone="neutral" hint="users.status = banned">
          <UserList rows={snap.blocked_users.recent} statusLabel="blocked" />
        </WidgetCard>

        <WidgetCard title="Security alerts" count={snap.security_alerts.count} tone="danger" hint="severity = critical (24h)">
          <EventList rows={snap.security_alerts.recent} />
        </WidgetCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent critical alerts</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {snap.security_alerts.recent.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No critical alerts in the last 24 hours.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Event</TH>
                  <TH>Severity</TH>
                  <TH>User</TH>
                  <TH>IP</TH>
                </TR>
              </THead>
              <TBody>
                {snap.security_alerts.recent.map((r) => (
                  <TR key={r.id}>
                    <TD className="whitespace-nowrap text-xs text-slate-500">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                    </TD>
                    <TD className="font-mono text-xs">{r.event}</TD>
                    <TD>
                      <Badge tone="danger">{r.severity}</Badge>
                    </TD>
                    <TD className="text-xs text-slate-600">{r.user_id ?? '—'}</TD>
                    <TD className="text-xs text-slate-600">{r.ip ?? '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
