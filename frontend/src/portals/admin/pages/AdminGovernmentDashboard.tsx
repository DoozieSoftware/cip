import { useQuery } from '@tanstack/react-query';
import { type JSX } from 'react';
import { Link } from 'react-router-dom';
import {
  IconServer,
  IconCpu,
  IconBuildingCommunity,
  IconUsers,
  IconReport,
  IconShieldCheck,
  IconArrowRight,
  IconRoute,
  IconFlag,
  IconClockHour4,
  IconDatabase,
} from '@tabler/icons-react';
import { requestRaw as apiRequest } from '../../../shared/api/client';
import type { ApiEnvelope } from '../../../shared/api/envelope';
import {
  useAiProviders,
  useAuditLogs,
  useIntegrations,
  usePlatformHealth,
  useSchedulerJobs,
} from '../api/client';
import { Card, CardBody, CardHeader, Spinner, ErrorState } from '../../../shared/ui';
import { auditActionLabel } from '../../../shared/auditActionLabel';

interface Counts {
  organizations: number;
  departments: number;
  users: number;
  roles: number;
  reportTypes: number;
  policies: number;
  featureFlags: number;
}

const componentNames: Record<string, string> = {
  database: 'Database',
  redis: 'Redis cache',
  queue: 'Queue service',
  ai: 'AI providers',
  storage: 'Object storage',
  scheduler: 'Task scheduler',
};

export default function AdminGovernmentDashboard(): JSX.Element {
  const counts = useQuery({
    queryKey: ['admin', 'government-dashboard-counts'],
    queryFn: async (): Promise<Counts> => {
      const paths = [
        'organizations',
        'departments',
        'users',
        'roles',
        'report-types',
        'security-policies',
        'app-configs',
      ];
      const rows = await Promise.all(
        paths.map((path) =>
          apiRequest<ApiEnvelope<unknown[]>>(`/admin/${path}`, {
            query: { per_page: 1 },
          }),
        ),
      );
      const total = (row: unknown): number =>
        (row as { meta?: { total?: number } }).meta?.total ?? 0;
      return {
        organizations: total(rows[0]),
        departments: total(rows[1]),
        users: total(rows[2]),
        roles: total(rows[3]),
        reportTypes: total(rows[4]),
        policies: total(rows[5]),
        featureFlags: total(rows[6]),
      };
    },
  });

  const health = usePlatformHealth();
  const scheduler = useSchedulerJobs();
  const audit = useAuditLogs({ per_page: '6' });
  const integrations = useIntegrations({});
  const providers = useAiProviders();

  if (counts.isError || health.isError) {
    return (
      <div>
        <ErrorState
          title="Failed to load dashboard"
          description="Something went wrong while loading the administrative summary."
        />
      </div>
    );
  }

  const components = health.data?.components ?? {};
  const activeProviders = (providers.data ?? []).filter((p) => p.active).length;
  const activeIntegrations = (integrations.data ?? []).filter((i) => i.status === 'active').length;
  const runningJobs = (scheduler.data ?? []).filter((j) => !j.paused).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
          Home / Administration
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
              Administration dashboard
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Civic Intelligence Platform, Government of Karnataka
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              Last system check
            </p>
            <p className="mt-0.5 text-sm font-medium text-[var(--color-ink)]">
              {health.data?.checked_at
                ? new Date(health.data.checked_at).toLocaleString()
                : 'In progress'}
            </p>
          </div>
        </div>
      </header>

      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 ${
          health.data?.status === 'ok'
            ? 'bg-[#e9e6de]'
            : health.data?.status === 'degraded'
              ? 'bg-[#fff6e4]'
              : 'bg-[#fbeeed]'
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              health.data?.status === 'ok'
                ? 'bg-[var(--color-ink-soft)]'
                : health.data?.status === 'degraded'
                  ? 'bg-[#b9822b]'
                  : 'bg-[var(--color-danger)]'
            }`}
          />
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">
              Platform status:{' '}
              {health.data?.status === 'ok' ? 'Operational' : (health.data?.status ?? 'Checking')}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Core public services, queues, storage and administration APIs
            </p>
          </div>
        </div>
        <Link
          to="/admin/health"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] ring-1 ring-[var(--color-border)] transition hover:bg-[var(--color-canvas)]"
        >
          View system health
          <IconArrowRight className="h-3.5 w-3.5" stroke={1.6} />
        </Link>
      </div>

      {counts.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner label="Loading administrative summary" />
        </div>
      ) : counts.data ? (
        <section
          aria-label="Administrative summary"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <SummaryCard
            label="Departments"
            value={counts.data.departments}
            note={`${counts.data.organizations} registered organizations`}
            to="/admin/departments"
            icon={
              <IconBuildingCommunity
                className="h-4 w-4 text-[var(--color-text-secondary)]"
                stroke={1.6}
              />
            }
          />
          <SummaryCard
            label="User accounts"
            value={counts.data.users}
            note={`${counts.data.roles} configured roles`}
            to="/admin/users"
            icon={<IconUsers className="h-4 w-4 text-[var(--color-text-secondary)]" stroke={1.6} />}
          />
          <SummaryCard
            label="Report types"
            value={counts.data.reportTypes}
            note="Available to citizen services"
            to="/admin/report-types"
            icon={
              <IconReport className="h-4 w-4 text-[var(--color-text-secondary)]" stroke={1.6} />
            }
          />
          <SummaryCard
            label="Governance controls"
            value={counts.data.policies + counts.data.featureFlags}
            note={`${counts.data.policies} policies, ${counts.data.featureFlags} feature flags`}
            to="/admin/security-policies"
            icon={
              <IconShieldCheck
                className="h-4 w-4 text-[var(--color-text-secondary)]"
                stroke={1.6}
              />
            }
          />
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card className="ring-1 ring-black/5">
          <CardHeader className="border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-2">
              <IconServer className="h-5 w-5 text-[var(--color-text-secondary)]" stroke={1.6} />
              <h2 className="text-sm font-semibold text-[var(--color-ink)]">System components</h2>
            </div>
            <Link
              to="/admin/health"
              className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] transition hover:text-[var(--color-ink)]"
            >
              Detailed health report
              <IconArrowRight className="h-3.5 w-3.5" stroke={1.6} />
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="bg-[var(--color-canvas)]">
                    <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Component
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Response
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {Object.entries(components).map(([key, component]) => (
                    <tr key={key}>
                      <td className="px-4 py-3 font-medium text-[var(--color-ink)]">
                        {componentNames[key] ?? key}
                      </td>
                      <td className="px-4 py-3">
                        <Status status={component.status} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">
                        {component.latency_ms} ms
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                        {component.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card className="ring-1 ring-black/5">
          <CardHeader className="border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-2">
              <IconCpu className="h-5 w-5 text-[var(--color-text-secondary)]" stroke={1.6} />
              <h2 className="text-sm font-semibold text-[var(--color-ink)]">Service readiness</h2>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <dl className="divide-y divide-[var(--color-border-subtle)]">
              <Readiness
                label="Scheduled tasks"
                value={`${runningJobs} of ${scheduler.data?.length ?? 0} running`}
                good={runningJobs > 0}
              />
              <Readiness
                label="AI providers"
                value={`${activeProviders} active`}
                good={activeProviders > 0}
              />
              <Readiness
                label="External integrations"
                value={activeIntegrations > 0 ? `${activeIntegrations} active` : 'Not configured'}
                good={activeIntegrations > 0}
              />
            </dl>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-[var(--color-border-subtle)] p-3">
              <PlainLink to="/admin/scheduler">Scheduler</PlainLink>
              <PlainLink to="/admin/integrations">Integrations</PlainLink>
              <PlainLink to="/admin/ai">AI configuration</PlainLink>
              <PlainLink to="/admin/notifications">Notifications</PlainLink>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card className="ring-1 ring-black/5">
          <CardHeader className="border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-2">
              <IconDatabase className="h-5 w-5 text-[var(--color-text-secondary)]" stroke={1.6} />
              <h2 className="text-sm font-semibold text-[var(--color-ink)]">
                Recent administrative activity
              </h2>
            </div>
            <Link
              to="/admin/audit"
              className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] transition hover:text-[var(--color-ink)]"
            >
              View audit register
              <IconArrowRight className="h-3.5 w-3.5" stroke={1.6} />
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            {(audit.data ?? []).length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
                No audit entries yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead>
                    <tr className="bg-[var(--color-canvas)]">
                      <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                        Date and time
                      </th>
                      <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                        Action
                      </th>
                      <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                        Resource
                      </th>
                      <th className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                        User
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {(audit.data ?? []).slice(0, 6).map((row) => (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-ink)]">
                          {auditActionLabel(row.action)}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                          {row.entity ?? 'Request'}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                          {row.user_name ?? row.roles?.[0] ?? 'System'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="ring-1 ring-black/5">
          <CardHeader className="border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-2">
              <IconClockHour4 className="h-5 w-5 text-[var(--color-text-secondary)]" stroke={1.6} />
              <h2 className="text-sm font-semibold text-[var(--color-ink)]">
                Common administrative tasks
              </h2>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <nav
              className="divide-y divide-[var(--color-border-subtle)]"
              aria-label="Common administrative tasks"
            >
              <TaskLink
                to="/admin/routing-rules"
                title="Routing rules"
                detail="Department assignment and priority"
                icon={
                  <IconRoute className="h-4 w-4 text-[var(--color-text-tertiary)]" stroke={1.6} />
                }
              />
              <TaskLink
                to="/admin/feature-flags"
                title="Feature flags"
                detail="Controlled service rollout"
                icon={
                  <IconFlag className="h-4 w-4 text-[var(--color-text-tertiary)]" stroke={1.6} />
                }
              />
              <TaskLink
                to="/admin/security-policies"
                title="Security policies"
                detail="Authentication and rate limits"
                icon={
                  <IconShieldCheck
                    className="h-4 w-4 text-[var(--color-text-tertiary)]"
                    stroke={1.6}
                  />
                }
              />
              <TaskLink
                to="/admin/retention"
                title="Data retention"
                detail="Retention periods and purge controls"
                icon={
                  <IconDatabase
                    className="h-4 w-4 text-[var(--color-text-tertiary)]"
                    stroke={1.6}
                  />
                }
              />
            </nav>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  to,
  icon,
}: {
  label: string;
  value: number;
  note: string;
  to: string;
  icon: JSX.Element;
}): JSX.Element {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:ring-[var(--color-ink)]/20"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-ink)]">{value}</p>
        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{note}</p>
      </div>
    </Link>
  );
}

function Status({ status }: { status: 'ok' | 'degraded' | 'down' }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
        status === 'ok'
          ? 'text-[var(--color-ink-soft)]'
          : status === 'degraded'
            ? 'text-[#805913]'
            : 'text-[var(--color-danger)]'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'ok'
            ? 'bg-[var(--color-ink-soft)]'
            : status === 'degraded'
              ? 'bg-[#b9822b]'
              : 'bg-[var(--color-danger)]'
        }`}
      />
      {status === 'ok' ? 'Operational' : status}
    </span>
  );
}

function Readiness({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <dt className="text-sm text-[var(--color-ink)]">{label}</dt>
      <dd
        className={`text-xs font-semibold ${good ? 'text-[var(--color-ink-soft)]' : 'text-[var(--color-text-tertiary)]'}`}
      >
        {value}
      </dd>
    </div>
  );
}

function PlainLink({ to, children }: { to: string; children: string }): JSX.Element {
  return (
    <Link
      to={to}
      className="rounded-lg px-2 py-2 text-center text-xs font-medium text-[var(--color-ink)] ring-1 ring-[var(--color-border)] transition hover:bg-[var(--color-canvas)]"
    >
      {children}
    </Link>
  );
}

function TaskLink({
  to,
  title,
  detail,
  icon,
}: {
  to: string;
  title: string;
  detail: string;
  icon: JSX.Element;
}): JSX.Element {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--color-canvas)]"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{detail}</p>
      </div>
      <IconArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" stroke={1.6} />
    </Link>
  );
}
