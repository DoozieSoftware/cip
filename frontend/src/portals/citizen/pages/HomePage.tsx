import { Link } from 'react-router-dom';
import { type JSX } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  Clock3,
  FileEdit,
  Bell,
  Plus,
  Upload,
  ShieldCheck,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../../auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, type ApiEnvelope } from '../../../auth/api';
import { Spinner } from '../../moderator/design';
import { getQueue } from '../offline/queue';

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

  const queueSize = queue.data ?? 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Header */}
      <header className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium uppercase tracking-widest text-slate-500">CIP</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
                Citizen Dashboard
              </h1>
              <p className="mt-3 max-w-xl text-base text-slate-600 sm:text-lg">
                Submit service requests and track their progress through resolution.
              </p>
            </div>
            <Link
              to="/citizen/notifications"
              className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900 sm:h-12 sm:w-12"
              aria-label="Open notifications"
            >
              <Bell className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="space-y-8">
          {/* Welcome */}
          <p className="text-base text-slate-700 sm:text-lg">
            Welcome,{' '}
            <span className="font-semibold text-slate-900">
              {user?.name ? user.name.split(' ')[0] : 'Citizen'}
            </span>
            . Your voice matters — report issues and help improve your community.
          </p>

          {/* Primary CTA */}
          <Link
            to="/citizen/submit"
            className="flex min-h-[68px] items-center justify-between gap-4 rounded-xl bg-indigo-600 px-5 py-5 text-white transition hover:bg-indigo-700 sm:min-h-[76px] sm:px-6 sm:py-6"
          >
            <span className="flex items-center gap-4">
              <span
                aria-hidden
                className="grid h-12 w-12 place-items-center rounded-lg bg-white/15 sm:h-14 sm:w-14"
              >
                <Plus className="h-6 w-6" />
              </span>
              <span>
                <span className="block text-lg font-bold sm:text-xl">Submit New Report</span>
                <span className="mt-0.5 block text-sm text-indigo-100 sm:text-base">
                  Report a service issue in your area
                </span>
              </span>
            </span>
          </Link>

          {/* Stats Cards */}
          <section className="rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 className="text-lg font-bold text-slate-900">Report Summary</h2>
              <p className="text-sm text-slate-500">Current period</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4">
              {[
                {
                  label: 'Total Reports',
                  value: '12',
                  icon: FileCheck2,
                  iconBg: 'bg-indigo-50',
                  iconColor: 'text-indigo-600',
                  valueColor: 'text-indigo-600',
                },
                {
                  label: 'Resolved',
                  value: '5',
                  icon: CheckCircle2,
                  iconBg: 'bg-emerald-50',
                  iconColor: 'text-emerald-600',
                  valueColor: 'text-emerald-600',
                },
                {
                  label: 'In Progress',
                  value: '4',
                  icon: Clock3,
                  iconBg: 'bg-amber-50',
                  iconColor: 'text-amber-600',
                  valueColor: 'text-amber-600',
                },
                {
                  label: 'Drafts',
                  value: String(queueSize),
                  icon: FileEdit,
                  iconBg: 'bg-slate-100',
                  iconColor: 'text-slate-600',
                  valueColor: 'text-slate-600',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center gap-3 border-slate-200 px-4 py-6 text-center odd:border-r sm:odd:border-r-0 sm:[&:not(:last-child)]:border-r"
                >
                  <span
                    aria-hidden
                    className={`grid h-12 w-12 place-items-center rounded-lg ${item.iconBg}`}
                  >
                    <item.icon className={`h-6 w-6 ${item.iconColor}`} />
                  </span>
                  <div>
                    <div
                      className={`text-3xl font-bold tabular-nums sm:text-4xl ${item.valueColor}`}
                    >
                      {item.value}
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-600">{item.label}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Sync Status */}
            <div className="flex items-center gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
              <span
                aria-hidden
                className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"
              >
                <RefreshCw className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {queueSize > 0
                    ? `${queueSize} report${queueSize > 1 ? 's' : ''} awaiting synchronization`
                    : 'All reports synchronized'}
                </p>
                <p className="text-sm text-slate-500">
                  Offline submissions sync when connectivity is restored.
                </p>
              </div>
            </div>
          </section>

          {/* Process Section */}
          <section className="rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 className="text-lg font-bold text-slate-900">How Your Report Is Processed</h2>
              <p className="text-sm text-slate-500">Four steps from submission to resolution</p>
            </div>
            <ol className="px-5 py-4 sm:px-6 sm:py-5">
              {[
                {
                  step: 1,
                  title: 'Submit Evidence',
                  description:
                    'Upload photos, video, and GPS coordinates to document the issue in your area.',
                  icon: Upload,
                },
                {
                  step: 2,
                  title: 'Evidence Verification',
                  description:
                    'Photographs, video, GPS coordinates, and device signals are validated for authenticity.',
                  icon: ShieldCheck,
                },
                {
                  step: 3,
                  title: 'Department Assignment',
                  description:
                    'The report is routed to the appropriate department based on category and location.',
                  icon: Building2,
                },
                {
                  step: 4,
                  title: 'Status Tracking',
                  description: 'Track every update through your dashboard and notification center.',
                  icon: FileCheck2,
                },
              ].map((item, idx) => (
                <li key={item.step} className="relative flex gap-5">
                  {/* Connector line */}
                  {idx < 3 && (
                    <div
                      className="absolute left-5 top-14 h-[calc(100%-20px)] w-0.5 bg-slate-200"
                      aria-hidden
                    />
                  )}
                  <div className="relative flex flex-col items-center">
                    <span
                      aria-hidden
                      className="grid h-10 w-10 place-items-center rounded-full border-2 border-indigo-600 bg-white text-indigo-600 sm:h-11 sm:w-11"
                    >
                      <item.icon className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="flex-1 pb-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                      Step {item.step}
                    </p>
                    <p className="mt-1 text-base font-bold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Account Section */}
          <section className="rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 className="text-lg font-bold text-slate-900">Registered Account</h2>
            </div>
            {me.isLoading ? (
              <div className="px-5 py-6 sm:px-6">
                <Spinner label="Loading profile" />
              </div>
            ) : me.data ? (
              <div className="px-5 py-5 sm:px-6">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Full Name
                    </dt>
                    <dd className="mt-1 text-base font-medium text-slate-900">
                      {me.data.name ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Mobile Number
                    </dt>
                    <dd className="mt-1 font-mono text-base text-slate-900">
                      {me.data.mobile ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Email Address
                    </dt>
                    <dd className="mt-1 text-base text-slate-900">{me.data.email ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Account Roles
                    </dt>
                    <dd className="mt-2 flex flex-wrap gap-2">
                      {me.data.roles.map((r) => (
                        <span
                          key={r}
                          className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700"
                        >
                          {r}
                        </span>
                      ))}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : me.error ? (
              <div className="px-5 py-5 sm:px-6">
                <p className="text-sm text-red-600">Unable to load profile information.</p>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
