import { useQuery } from '@tanstack/react-query';
import { type JSX } from 'react';
import { apiRequest, type ApiEnvelope } from '../../../auth/api';
import { Spinner } from '../../moderator/design';
import { Link } from 'react-router-dom';

interface Counts {
  users: number;
  roles: number;
  report_types: number;
  security_policies: number;
  feature_flags: number;
}

export default function AdminDashboard(): JSX.Element {
  const counts = useQuery({
    queryKey: ['admin', 'dashboard-counts'],
    queryFn: async () => {
      const [u, r, rt, sp, ff] = await Promise.all([
        apiRequest<ApiEnvelope<unknown[]>>('/admin/users', { query: { per_page: 1 } }),
        apiRequest<ApiEnvelope<unknown[]>>('/admin/roles', { query: { per_page: 1 } }),
        apiRequest<ApiEnvelope<unknown[]>>('/admin/report-types', { query: { per_page: 1 } }),
        apiRequest<ApiEnvelope<unknown[]>>('/admin/security-policies', { query: { per_page: 1 } }),
        apiRequest<ApiEnvelope<unknown[]>>('/admin/app-configs', { query: { per_page: 1 } }),
      ]);
      const c: Counts = {
        users: (u as unknown as { meta?: { total?: number } }).meta?.total ?? 0,
        roles: (r as unknown as { meta?: { total?: number } }).meta?.total ?? 0,
        report_types: (rt as unknown as { meta?: { total?: number } }).meta?.total ?? 0,
        security_policies: (sp as unknown as { meta?: { total?: number } }).meta?.total ?? 0,
        feature_flags: (ff as unknown as { meta?: { total?: number } }).meta?.total ?? 0,
      };
      return c;
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Platform dashboard</h1>
        <p className="text-sm text-slate-600">Live counts and quick navigation.</p>
      </header>

      {counts.isLoading ? (
        <Spinner label="Loading" />
      ) : counts.data ? (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: 'Users', value: counts.data.users, to: '/admin/users' },
            { label: 'Roles', value: counts.data.roles, to: '/admin/roles' },
            { label: 'Report types', value: counts.data.report_types, to: '/admin/report-types' },
            { label: 'Security policies', value: counts.data.security_policies, to: '/admin/security-policies' },
            { label: 'Feature flags', value: counts.data.feature_flags, to: '/admin/feature-flags' },
          ].map((c) => (
            <Link key={c.label} to={c.to} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-fuchsia-300 hover:shadow">
              <div className="text-3xl font-bold text-fuchsia-700">{c.value}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{c.label}</div>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Quick actions</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link to="/admin/audit" className="rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50">
            <strong className="text-slate-900">Audit log</strong>
            <p className="text-xs text-slate-500">Search who-did-what across the platform.</p>
          </Link>
          <Link to="/admin/security-policies" className="rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50">
            <strong className="text-slate-900">Tune security policies</strong>
            <p className="text-xs text-slate-500">Password, OTP, JWT, rate limits, media caps.</p>
          </Link>
          <Link to="/admin/feature-flags" className="rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50">
            <strong className="text-slate-900">Flip a feature flag</strong>
            <p className="text-xs text-slate-500">Kill switch or gradual rollout.</p>
          </Link>
          <Link to="/admin/report-types" className="rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50">
            <strong className="text-slate-900">Add a report type</strong>
            <p className="text-xs text-slate-500">New civic issue categories.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
