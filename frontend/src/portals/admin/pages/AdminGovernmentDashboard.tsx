import { useQuery } from '@tanstack/react-query';
import { type JSX } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, type ApiEnvelope } from '../../../auth/api';
import { useAiProviders, useAuditLogs, useIntegrations, usePlatformHealth, useSchedulerJobs } from '../api/client';
import { Spinner } from '../../moderator/design';

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
  database: 'Database', redis: 'Redis cache', queue: 'Queue service', ai: 'AI providers', storage: 'Object storage', scheduler: 'Task scheduler',
};

export default function AdminGovernmentDashboard(): JSX.Element {
  const counts = useQuery({
    queryKey: ['admin', 'government-dashboard-counts'],
    queryFn: async (): Promise<Counts> => {
      const paths = ['organizations', 'departments', 'users', 'roles', 'report-types', 'security-policies', 'app-configs'];
      const rows = await Promise.all(paths.map((path) => apiRequest<ApiEnvelope<unknown[]>>(`/admin/${path}`, { query: { per_page: 1 } })));
      const total = (row: unknown): number => (row as { meta?: { total?: number } }).meta?.total ?? 0;
      return { organizations: total(rows[0]), departments: total(rows[1]), users: total(rows[2]), roles: total(rows[3]), reportTypes: total(rows[4]), policies: total(rows[5]), featureFlags: total(rows[6]) };
    },
  });
  const health = usePlatformHealth();
  const scheduler = useSchedulerJobs();
  const audit = useAuditLogs({ per_page: '6' });
  const integrations = useIntegrations({});
  const providers = useAiProviders();
  const components = health.data?.components ?? {};
  const activeProviders = (providers.data ?? []).filter((provider) => provider.active).length;
  const activeIntegrations = (integrations.data ?? []).filter((integration) => integration.status === 'active').length;
  const runningJobs = (scheduler.data ?? []).filter((job) => !job.paused).length;

  return <div className="space-y-5">
    <header className="border-b border-slate-300 pb-4">
      <div className="text-xs text-slate-500">Home / Administration</div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold text-slate-950">Administration dashboard</h1><p className="mt-1 text-sm text-slate-600">Civic Intelligence Platform, Government of Karnataka</p></div>
        <div className="text-right text-xs text-slate-500"><div>Last system check</div><div className="mt-0.5 font-medium text-slate-700">{health.data?.checked_at ? new Date(health.data.checked_at).toLocaleString() : 'In progress'}</div></div>
      </div>
    </header>

    <section className={`flex flex-wrap items-center justify-between gap-3 border-l-4 px-4 py-3 ${health.data?.status === 'ok' ? 'border-emerald-600 bg-emerald-50' : health.data?.status === 'degraded' ? 'border-amber-500 bg-amber-50' : 'border-rose-600 bg-rose-50'}`}>
      <div className="flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${health.data?.status === 'ok' ? 'bg-emerald-600' : health.data?.status === 'degraded' ? 'bg-amber-500' : 'bg-rose-600'}`} /><div><div className="text-sm font-semibold text-slate-900">Platform status: {health.data?.status === 'ok' ? 'Operational' : health.data?.status ?? 'Checking'}</div><div className="text-xs text-slate-600">Core public services, queues, storage and administration APIs</div></div></div>
      <Link to="/admin/health" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-slate-50">View system health</Link>
    </section>

    {counts.isLoading ? <Spinner label="Loading administrative summary" /> : counts.data ? <section aria-label="Administrative summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Departments" value={counts.data.departments} note={`${counts.data.organizations} registered organizations`} to="/admin/departments" />
      <SummaryCard label="User accounts" value={counts.data.users} note={`${counts.data.roles} configured roles`} to="/admin/users" />
      <SummaryCard label="Report types" value={counts.data.reportTypes} note="Available to citizen services" to="/admin/report-types" />
      <SummaryCard label="Governance controls" value={counts.data.policies + counts.data.featureFlags} note={`${counts.data.policies} policies, ${counts.data.featureFlags} feature flags`} to="/admin/security-policies" />
    </section> : null}

    <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
      <section className="overflow-hidden rounded-lg border border-slate-300 bg-white">
        <SectionTitle title="System components" note="Live status of critical platform dependencies" link="/admin/health" linkLabel="Detailed health report" />
        <div className="overflow-x-auto border-t border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-100 text-xs text-slate-600"><tr><th className="px-4 py-2.5 font-semibold">Component</th><th className="px-4 py-2.5 font-semibold">Status</th><th className="px-4 py-2.5 font-semibold">Response</th><th className="px-4 py-2.5 font-semibold">Details</th></tr></thead><tbody className="divide-y divide-slate-200">{Object.entries(components).map(([key, component]) => <tr key={key}><td className="px-4 py-3 font-medium text-slate-900">{componentNames[key] ?? key}</td><td className="px-4 py-3"><Status status={component.status} /></td><td className="px-4 py-3 font-mono text-xs text-slate-600">{component.latency_ms} ms</td><td className="px-4 py-3 text-xs text-slate-600">{component.detail}</td></tr>)}</tbody></table></div>
      </section>

      <section className="rounded-lg border border-slate-300 bg-white">
        <SectionTitle title="Service readiness" note="Configured automation and channels" />
        <dl className="divide-y divide-slate-200 border-t border-slate-200">
          <Readiness label="Scheduled tasks" value={`${runningJobs} of ${scheduler.data?.length ?? 0} running`} good={runningJobs > 0} />
          <Readiness label="AI providers" value={`${activeProviders} active`} good={activeProviders > 0} />
          <Readiness label="External integrations" value={activeIntegrations > 0 ? `${activeIntegrations} active` : 'Not configured'} good={activeIntegrations > 0} />
        </dl>
        <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-3"><PlainLink to="/admin/scheduler">Scheduler</PlainLink><PlainLink to="/admin/integrations">Integrations</PlainLink><PlainLink to="/admin/ai">AI configuration</PlainLink><PlainLink to="/admin/notifications">Notifications</PlainLink></div>
      </section>
    </div>

    <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
      <section className="overflow-hidden rounded-lg border border-slate-300 bg-white">
        <SectionTitle title="Recent administrative activity" note="Latest entries from the immutable audit register" link="/admin/audit" linkLabel="View audit register" />
        <div className="overflow-x-auto border-t border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-100 text-xs text-slate-600"><tr><th className="px-4 py-2.5 font-semibold">Date and time</th><th className="px-4 py-2.5 font-semibold">Action</th><th className="px-4 py-2.5 font-semibold">Resource</th><th className="px-4 py-2.5 font-semibold">User</th></tr></thead><tbody className="divide-y divide-slate-200">{(audit.data ?? []).slice(0, 6).map((row) => <tr key={row.id}><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{new Date(row.created_at).toLocaleString()}</td><td className="px-4 py-3 font-mono text-xs text-slate-800">{row.action}</td><td className="px-4 py-3 text-xs text-slate-600">{row.entity ?? 'Request'}</td><td className="px-4 py-3 text-xs text-slate-600">{row.user_name ?? row.roles?.[0] ?? 'System'}</td></tr>)}</tbody></table></div>
      </section>

      <section className="rounded-lg border border-slate-300 bg-white">
        <SectionTitle title="Common administrative tasks" note="Frequently used configuration areas" />
        <nav className="divide-y divide-slate-200 border-t border-slate-200" aria-label="Common administrative tasks">
          <TaskLink to="/admin/routing-rules" title="Routing rules" detail="Department assignment and priority" />
          <TaskLink to="/admin/feature-flags" title="Feature flags" detail="Controlled service rollout" />
          <TaskLink to="/admin/security-policies" title="Security policies" detail="Authentication and rate limits" />
          <TaskLink to="/admin/retention" title="Data retention" detail="Retention periods and purge controls" />
        </nav>
      </section>
    </div>
  </div>;
}

function SummaryCard({ label, value, note, to }: { label: string; value: number; note: string; to: string }): JSX.Element { return <Link to={to} className="rounded-lg border border-slate-300 bg-white p-4 hover:border-blue-500"><div className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</div><div className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{value}</div><div className="mt-1 text-xs text-slate-500">{note}</div></Link>; }
function SectionTitle({ title, note, link, linkLabel }: { title: string; note: string; link?: string; linkLabel?: string }): JSX.Element { return <div className="flex items-center justify-between gap-3 px-4 py-3"><div><h2 className="text-sm font-semibold text-slate-950">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{note}</p></div>{link ? <Link to={link} className="text-xs font-semibold text-blue-700 underline-offset-2 hover:underline">{linkLabel}</Link> : null}</div>; }
function Status({ status }: { status: 'ok' | 'degraded' | 'down' }): JSX.Element { return <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${status === 'ok' ? 'text-emerald-700' : status === 'degraded' ? 'text-amber-700' : 'text-rose-700'}`}><span className={`h-1.5 w-1.5 rounded-full ${status === 'ok' ? 'bg-emerald-600' : status === 'degraded' ? 'bg-amber-500' : 'bg-rose-600'}`} />{status === 'ok' ? 'Operational' : status}</span>; }
function Readiness({ label, value, good }: { label: string; value: string; good: boolean }): JSX.Element { return <div className="flex items-center justify-between gap-3 px-4 py-3"><dt className="text-sm text-slate-700">{label}</dt><dd className={`text-xs font-semibold ${good ? 'text-emerald-700' : 'text-slate-500'}`}>{value}</dd></div>; }
function PlainLink({ to, children }: { to: string; children: string }): JSX.Element { return <Link to={to} className="rounded border border-slate-300 px-2 py-2 text-center text-xs font-medium text-blue-900 hover:bg-slate-50">{children}</Link>; }
function TaskLink({ to, title, detail }: { to: string; title: string; detail: string }): JSX.Element { return <Link to={to} className="block px-4 py-3 hover:bg-slate-50"><div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-900">{title}</span><span className="text-slate-400">›</span></div><div className="mt-0.5 text-xs text-slate-500">{detail}</div></Link>; }
