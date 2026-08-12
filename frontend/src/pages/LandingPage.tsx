import { Link, useNavigate } from 'react-router-dom';
import { type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth, type Role } from '../auth/AuthContext';
import { routeForRoles } from './LoginPage';
import { apiRequest, type ApiEnvelope } from '../auth/api';
import {
  IconBuildingCommunity,
  IconShieldCheck,
  IconClipboardList,
  IconArrowRight,
  IconGlobe,
  IconLogout,
  IconLogin,
} from '@tabler/icons-react';
import type { IconUsers } from '@tabler/icons-react';
import { trackProductEvent } from '../shared/analytics';

interface PublicStats {
  total_reports: number;
  ai_classified_percent: number;
  median_assign_seconds: number | null;
  generated_at?: string;
  cache_ttl_seconds?: number;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining === 0 ? `${minutes}m` : `${minutes}m ${remaining}s`;
}

function usePublicStats() {
  return useQuery({
    queryKey: ['public', 'stats'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<PublicStats>>('/public/stats');
      return {
        ...res.data,
        generated_at:
          typeof res.meta?.generated_at === 'string' ? res.meta.generated_at : undefined,
        cache_ttl_seconds:
          typeof res.meta?.cache_ttl_seconds === 'number' ? res.meta.cache_ttl_seconds : undefined,
      };
    },
    staleTime: 5 * 60_000,
  });
}

interface Portal {
  title: string;
  path: string;
  audience: string;
  description: string;
  highlight: string;
  roles: Role[];
  icon: typeof IconUsers;
}

const PORTALS: Portal[] = [
  {
    title: 'Moderator',
    path: '/moderator',
    audience: 'Moderators',
    description: 'Triage the AI-classified queue, merge duplicates, reject fraud.',
    highlight: 'Keyboard shortcuts · AI overlay · Bulk actions',
    roles: ['moderator', 'super_admin', 'system'],
    icon: IconShieldCheck,
  },
  {
    title: 'Operations',
    path: '/operations',
    audience: 'Departments',
    description: 'Officers accept, progress, and resolve assigned reports. GIS map and exports.',
    highlight: 'BBMP / BTP / BWSSB · SLA · CSV / Excel / PDF',
    roles: ['department_officer', 'department_admin', 'super_admin', 'system'],
    icon: IconClipboardList,
  },
  {
    title: 'Admin',
    path: '/admin',
    audience: 'Platform admins',
    description: 'Configure report types, roles, security policies, feature flags, and audit log.',
    highlight: '12 admin CRUD namespaces · live feature flags',
    roles: ['super_admin', 'system'],
    icon: IconBuildingCommunity,
  },
];

export function LandingPage(): JSX.Element {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const stats = usePublicStats();

  return (
    <div className="min-h-screen bg-[#f3f2ed]">
      {/* Header */}
      <header className="border-b border-[#d9d7d0] bg-[#faf9f6]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#1d1d1b] text-white">
              <IconBuildingCommunity className="h-5 w-5" stroke={1.7} />
            </span>
            <div>
              <div className="text-sm font-semibold tracking-[-0.01em] text-[#1d1d1b]">
                CIP Karnataka
              </div>
              <div className="text-[11px] text-[#777670]">Citizen services</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => void navigate(routeForRoles(user?.roles ?? []))}
                  className="inline-flex min-h-11 items-center rounded-full bg-[#1d1d1b] px-5 text-sm font-medium text-white transition hover:bg-black"
                >
                  Open my portal
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="grid h-11 w-11 place-items-center rounded-full text-[#686762] transition hover:bg-[#efeee9]"
                  aria-label="Sign out"
                >
                  <IconLogout className="h-5 w-5" stroke={1.7} />
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center rounded-full bg-[#1d1d1b] px-5 text-sm font-medium text-white transition hover:bg-black"
              >
                <IconLogin className="mr-2 h-4 w-4" stroke={1.7} />
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Hero */}
        <section className="pb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#777670]">
            Government of Karnataka
          </p>
          <h1 className="mt-3 text-4xl font-normal leading-[1.08] tracking-[-0.04em] text-[#1d1d1b] sm:text-6xl">
            Report an issue. Track the response.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-[#6f6e69]">
            A resident-first civic service for Bengaluru. Send a location-aware report in Kannada or
            English, follow the official case number, and see what happens next.
          </p>
        </section>

        {/* Resident actions */}
        <section
          aria-labelledby="resident-actions"
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <h2 id="resident-actions" className="sr-only">
            Resident services
          </h2>
          <Link
            to="/citizen/submit"
            onClick={() => trackProductEvent('report_start_clicked')}
            className="group rounded-2xl bg-[#1d1d1b] p-6 text-white transition hover:bg-black hover:shadow-sm"
          >
            <h3 className="text-xl font-medium">Report a civic issue</h3>
            <p className="mt-2 text-sm leading-6 text-white/75">
              Start with a category and location. Add evidence when it is safe to do so.
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium">
              Start a report <IconArrowRight className="h-4 w-4" stroke={1.7} />
            </span>
          </Link>
          <Link
            to="/citizen/reports"
            className="group rounded-2xl border border-black/10 bg-white p-6 transition hover:border-black/20 hover:shadow-sm"
          >
            <h3 className="text-xl font-medium text-[#1d1d1b]">Track a report</h3>
            <p className="mt-2 text-sm leading-6 text-[#6f6e69]">
              Use your stable case number to follow assignment, progress, and resolution.
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[#1d1d1b]">
              Open my reports <IconArrowRight className="h-4 w-4" stroke={1.7} />
            </span>
          </Link>
          <Link
            to="/public"
            className="group rounded-2xl border border-black/10 bg-white p-6 transition hover:border-black/20 hover:shadow-sm"
          >
            <h3 className="text-xl font-medium text-[#1d1d1b]">See public progress</h3>
            <p className="mt-2 text-sm leading-6 text-[#6f6e69]">
              Explore privacy-safe trends by area and department, refreshed every five minutes.
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[#1d1d1b]">
              Transparency portal <IconArrowRight className="h-4 w-4" stroke={1.7} />
            </span>
          </Link>
        </section>

        <aside className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4" role="note">
          <p className="text-sm font-semibold text-amber-950">Emergency or immediate danger?</p>
          <p className="mt-1 text-sm leading-6 text-amber-900">
            Call{' '}
            <a className="font-semibold underline" href="tel:112">
              112
            </a>{' '}
            first for police, fire, medical help, or any immediate threat. This service is for
            non-emergency civic issues.
          </p>
        </aside>

        {/* Staff entry point */}
        <section aria-labelledby="staff-entry" className="mt-12">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#777670]">
                Staff entry point
              </p>
              <h2 id="staff-entry" className="mt-1 text-2xl font-medium text-[#1d1d1b]">
                Operational portals
              </h2>
            </div>
            <span className="hidden text-xs text-[#777670] sm:block">For authorised staff</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PORTALS.map((p) => {
              const Icon = p.icon;
              const href =
                isAuthenticated && user
                  ? p.roles.some((r) => user.roles.includes(r))
                    ? p.path
                    : '/login'
                  : p.path;
              return (
                <Link
                  key={p.path}
                  to={href}
                  className="group rounded-2xl border border-black/10 bg-white p-6 transition hover:border-black/20 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#efeee9]">
                      <Icon className="h-5 w-5" stroke={1.7} />
                    </span>
                    <span className="rounded-full border border-[#d9d7d0] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#777670]">
                      {p.audience}
                    </span>
                  </div>
                  <h2 className="mt-5 text-xl font-medium tracking-[-0.02em] text-[#1d1d1b]">
                    {p.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#6f6e69]">{p.description}</p>
                  <p className="mt-3 text-xs text-[#85847f]">{p.highlight}</p>
                  <p className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[#1d1d1b]">
                    Open portal
                    <IconArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      stroke={1.7}
                    />
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Stats */}
        <section
          aria-label="Platform statistics"
          className="mt-12 rounded-2xl border border-black/10 bg-white"
        >
          {stats.isLoading ? (
            <div className="p-8 text-center text-sm text-[#777670]">Loading live stats…</div>
          ) : stats.isError || !stats.data ? (
            <div className="p-8 text-center text-sm text-[#777670]">
              Live stats are unavailable right now.
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-3">
                {[
                  {
                    label: 'Reports processed',
                    value: stats.data.total_reports.toLocaleString(),
                    sub: 'all time',
                  },
                  {
                    label: 'AI-classified',
                    value: `${stats.data.ai_classified_percent}%`,
                    sub: 'before human review',
                  },
                  {
                    label: 'Median time to assign',
                    value: formatDuration(stats.data.median_assign_seconds),
                    sub: 'submit → department',
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="border-b border-[#e4e2dc] p-6 text-center last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
                  >
                    <div className="text-3xl font-normal tracking-[-0.03em] text-[#1d1d1b] sm:text-4xl">
                      {m.value}
                    </div>
                    <div className="mt-2 text-sm font-medium text-[#1d1d1b]">{m.label}</div>
                    <div className="text-xs text-[#777670]">{m.sub}</div>
                  </div>
                ))}
              </div>
              <p className="border-t border-black/10 px-6 py-3 text-center text-xs text-[#777670]">
                {stats.data.generated_at
                  ? `Generated ${new Date(stats.data.generated_at).toLocaleString()}`
                  : 'Freshness timestamp unavailable'}
              </p>
            </div>
          )}
        </section>

        {/* Footer links */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-sm">
          <Link
            to="/public"
            className="inline-flex items-center gap-1 font-medium text-[#1d1d1b] hover:underline"
          >
            <IconGlobe className="h-4 w-4" stroke={1.6} />
            Public transparency portal
          </Link>
          <p className="font-mono text-xs text-[#85847f]">
            Built for the Government of Karnataka · Demo seed data · 2026
          </p>
        </div>
      </main>
    </div>
  );
}
