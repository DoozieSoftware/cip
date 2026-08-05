import { Link } from 'react-router-dom';
import { type JSX } from 'react';
import {
  IconArrowUpRight,
  IconBell,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconFileDescription,
  IconMapPin,
  IconPlus,
  IconShieldCheck,
  IconWifiOff,
} from '@tabler/icons-react';
import { useAuth } from '../../../auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, type ApiEnvelope } from '../../../auth/api';
import { Spinner } from '../../moderator/design';
import { getQueue } from '../offline/queue';
import { useCitizenReports } from '../api/client';

interface ProfileResponse {
  id: string;
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
  roles: string[];
}

export default function HomePage(): JSX.Element {
  const { user } = useAuth();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<ProfileResponse>>('/auth/me');
      return res.data;
    },
  });
  const queue = useQuery({
    queryKey: ['citizen', 'queue', 'size'],
    queryFn: async () => getQueue().size(),
    refetchInterval: 5_000,
  });
  const reports = useCitizenReports(1, 100);

  const queueSize = queue.data ?? 0;
  const reportRows = reports.data?.data ?? [];
  const total = reports.data?.meta.total ?? reportRows.length;
  const resolved = reportRows.filter((report) =>
    ['resolved', 'verified', 'closed'].includes(report.status.code),
  ).length;
  const active = reportRows.filter(
    (report) =>
      !['resolved', 'verified', 'closed', 'rejected', 'merged'].includes(report.status.code),
  ).length;
  const recent = reportRows.slice(0, 3);

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-5 border-b border-[#d9d7d0] pb-7">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#777670]">
            Citizen services
          </p>
          <h1 className="mt-2 text-[2rem] font-normal leading-[1.05] tracking-[-0.035em] sm:text-4xl">
            Good morning, {user?.name?.split(' ')[0] ?? 'Citizen'}.
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[#6f6e69]">
            Report an issue, follow department action, and keep one reference for every update.
          </p>
        </div>
        <Link
          to="/citizen/notifications"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d8d6cf] bg-[#faf9f6] transition hover:bg-white"
          aria-label="Notifications"
        >
          <IconBell className="h-5 w-5" stroke={1.6} />
        </Link>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
          <Link
            to="/citizen/submit"
            className="group flex min-h-36 items-end justify-between gap-5 bg-[#1d1d1b] p-6 text-white transition hover:bg-black sm:p-7"
          >
            <div>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#1d1d1b]">
                <IconPlus className="h-5 w-5" stroke={1.8} />
              </span>
              <h2 className="mt-5 text-2xl font-normal tracking-[-0.025em]">File a new report</h2>
              <p className="mt-1 text-sm text-white/65">
                Photo, location and details in under two minutes.
              </p>
            </div>
            <IconArrowUpRight
              className="h-6 w-6 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              stroke={1.5}
            />
          </Link>
          <div className="grid grid-cols-4 border-t border-[#e4e2dc]">
            {[
              { label: 'Filed', value: total },
              { label: 'Active', value: active },
              { label: 'Resolved', value: resolved },
              { label: 'Offline', value: queueSize },
            ].map((s) => (
              <div
                key={s.label}
                className="border-r border-[#e4e2dc] px-2 py-4 text-center last:border-r-0 sm:px-4"
              >
                <p className="font-mono text-xl text-[#1d1d1b]">{s.value}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#85847f]">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-[#e9e8e2] p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#777670]">
            Service promise
          </p>
          <h2 className="mt-4 text-2xl font-normal leading-tight tracking-[-0.025em]">
            One report. One traceable record.
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#686762]">
            Every submission keeps its evidence, location, department and status history together.
          </p>
          <Link
            to="/citizen/reports"
            className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-medium transition hover:border-black/30"
          >
            View my reports
            <IconChevronRight className="h-4 w-4" stroke={1.6} />
          </Link>
        </div>
      </section>

      {queueSize > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#d8cfae] bg-[#f1ead4] px-5 py-4">
          <IconWifiOff className="h-5 w-5 shrink-0" stroke={1.6} />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {queueSize} report{queueSize > 1 ? 's' : ''} waiting to sync
            </p>
            <p className="text-xs text-[#746f5e]">
              They will submit automatically when your connection returns.
            </p>
          </div>
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white">
          <div className="flex items-center justify-between border-b border-[#e4e2dc] px-5 py-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#85847f]">
                Recent activity
              </p>
              <h2 className="mt-1 text-lg font-medium tracking-[-0.015em]">Your latest reports</h2>
            </div>
            <IconFileDescription className="h-5 w-5 text-[#777670]" stroke={1.5} />
          </div>
          {reports.isLoading ? (
            <div className="p-6">
              <Spinner label="Loading reports" />
            </div>
          ) : recent.length === 0 ? (
            <p className="p-6 text-sm text-[#777670]">No reports filed yet.</p>
          ) : (
            <div className="divide-y divide-[#e4e2dc]">
              {recent.map((report) => (
                <Link
                  key={report.id}
                  to={`/citizen/reports/${report.id}`}
                  className="group flex min-h-16 items-center gap-3 px-5 py-3 transition hover:bg-[#faf9f6]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#efeee9]">
                    {['resolved', 'verified', 'closed'].includes(report.status.code) ? (
                      <IconCheck className="h-4 w-4" stroke={1.8} />
                    ) : (
                      <IconClock className="h-4 w-4" stroke={1.7} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{report.title}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#85847f]">
                      {report.status.name}
                    </p>
                  </div>
                  <IconChevronRight
                    className="h-4 w-4 text-[#aaa9a4] transition-transform group-hover:translate-x-0.5"
                    stroke={1.5}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-black/10 bg-white">
          <div className="border-b border-[#e4e2dc] px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#85847f]">
              From report to resolution
            </p>
            <h2 className="mt-1 text-lg font-medium tracking-[-0.015em]">What happens next</h2>
          </div>
          <div className="divide-y divide-[#e4e2dc]">
            {[
              {
                n: '01',
                title: 'Evidence review',
                desc: 'Photo and location are checked.',
                icon: IconShieldCheck,
              },
              {
                n: '02',
                title: 'Department routing',
                desc: 'The responsible team receives it.',
                icon: IconMapPin,
              },
              {
                n: '03',
                title: 'Tracked resolution',
                desc: 'Every status change stays visible.',
                icon: IconCheck,
              },
            ].map((step) => (
              <div key={step.n} className="flex items-center gap-4 px-5 py-4">
                <span className="font-mono text-[11px] text-[#85847f]">{step.n}</span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#efeee9]">
                  <step.icon className="h-4 w-4" stroke={1.6} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-0.5 text-xs text-[#777670]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {me.isLoading ? null : me.data ? (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d9d7d0] pt-5 text-xs text-[#777670]">
          <span>Signed in as {me.data.name ?? 'Citizen'}</span>
          <span className="font-mono">{me.data.mobile ?? ''}</span>
        </footer>
      ) : null}
    </div>
  );
}
