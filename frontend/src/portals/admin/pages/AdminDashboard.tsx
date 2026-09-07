import { useQuery } from '@tanstack/react-query';
import { type JSX } from 'react';
import { Link } from 'react-router-dom';
import { requestRaw as apiRequest } from '../../../shared/api/client';
import type { ApiEnvelope } from '../../../shared/api/envelope';
import { Card, Spinner } from '../../../shared/ui';

interface Counts {
  organizations: number;
  departments: number;
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
      const [o, d, u, r, rt, sp, ff] = await Promise.all([
        apiRequest<ApiEnvelope<unknown[]>>('/admin/organizations', { query: { per_page: 1 } }),
        apiRequest<ApiEnvelope<unknown[]>>('/admin/departments', { query: { per_page: 1 } }),
        apiRequest<ApiEnvelope<unknown[]>>('/admin/users', { query: { per_page: 1 } }),
        apiRequest<ApiEnvelope<unknown[]>>('/admin/roles', { query: { per_page: 1 } }),
        apiRequest<ApiEnvelope<unknown[]>>('/admin/report-types', { query: { per_page: 1 } }),
        apiRequest<ApiEnvelope<unknown[]>>('/admin/security-policies', { query: { per_page: 1 } }),
        apiRequest<ApiEnvelope<unknown[]>>('/admin/app-configs', { query: { per_page: 1 } }),
      ]);
      const c: Counts = {
        organizations: (o as unknown as { meta?: { total?: number } }).meta?.total ?? 0,
        departments: (d as unknown as { meta?: { total?: number } }).meta?.total ?? 0,
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
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
          Platform dashboard
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Live counts and quick navigation.
        </p>
      </header>

      {counts.isLoading ? (
        <Spinner label="Loading" />
      ) : counts.data ? (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
          {[
            {
              label: 'Organizations',
              value: counts.data.organizations,
              to: '/admin/organizations',
            },
            { label: 'Departments', value: counts.data.departments, to: '/admin/departments' },
            { label: 'Users', value: counts.data.users, to: '/admin/users' },
            { label: 'Roles', value: counts.data.roles, to: '/admin/roles' },
            { label: 'Report types', value: counts.data.report_types, to: '/admin/report-types' },
            {
              label: 'Security policies',
              value: counts.data.security_policies,
              to: '/admin/security-policies',
            },
            {
              label: 'Feature flags',
              value: counts.data.feature_flags,
              to: '/admin/feature-flags',
            },
          ].map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="rounded-xl bg-[var(--color-surface)] p-5 shadow-sm ring-1 ring-black/5 transition hover:shadow hover:ring-[var(--color-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
            >
              <div className="text-3xl font-semibold tracking-[-0.01em] tabular-nums text-[var(--color-ink)]">
                {c.value}
              </div>
              <div className="mt-1 text-sm font-medium text-[var(--color-ink)]">{c.label}</div>
            </Link>
          ))}
        </section>
      ) : null}

      <Card className="p-5">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          Quick actions
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link
            to="/admin/audit"
            className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4 text-sm transition hover:border-[var(--color-border)] hover:bg-[var(--color-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
          >
            <strong className="font-medium text-[var(--color-ink)]">Audit log</strong>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              Search who-did-what across the platform.
            </p>
          </Link>
          <Link
            to="/admin/security-policies"
            className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4 text-sm transition hover:border-[var(--color-border)] hover:bg-[var(--color-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
          >
            <strong className="font-medium text-[var(--color-ink)]">Tune security policies</strong>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              Password, OTP, JWT, rate limits, media caps.
            </p>
          </Link>
          <Link
            to="/admin/feature-flags"
            className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4 text-sm transition hover:border-[var(--color-border)] hover:bg-[var(--color-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
          >
            <strong className="font-medium text-[var(--color-ink)]">Flip a feature flag</strong>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              Kill switch or gradual rollout.
            </p>
          </Link>
          <Link
            to="/admin/report-types"
            className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4 text-sm transition hover:border-[var(--color-border)] hover:bg-[var(--color-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
          >
            <strong className="font-medium text-[var(--color-ink)]">Add a report type</strong>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              New civic issue categories.
            </p>
          </Link>
        </div>
      </Card>
    </div>
  );
}
