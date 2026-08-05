import { type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../auth/AuthContext';
import { apiRequest, type ApiEnvelope } from '../../../auth/api';
import { Spinner } from '../../moderator/design';
import { cx } from '../../moderator/design/cx';
import { User, Mail, Phone, Shield, Hash } from 'lucide-react';

interface ProfileData {
  id: string;
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
  roles: string[];
}

interface InfoRowProps {
  label: string;
  value: string | null | undefined;
  monospace?: boolean;
  icon?: JSX.Element;
}

function InfoRow({ label, value, monospace = false, icon }: InfoRowProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-start sm:gap-6">
      <dt className="flex w-44 flex-shrink-0 items-center gap-2 text-sm font-medium text-slate-400">
        {icon}
        {label}
      </dt>
      <dd
        className={cx(
          'min-w-0 flex-1 text-base text-slate-800',
          monospace && 'break-all font-mono text-sm text-slate-500',
        )}
      >
        {value ?? '—'}
      </dd>
    </div>
  );
}

interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: JSX.Element;
}

function Section({ title, description, children, icon }: SectionProps): JSX.Element {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
        {icon && (
          <span
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-100"
            aria-hidden
          >
            {icon}
          </span>
        )}
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
        </div>
      </header>
      <div className="px-6">{children}</div>
    </section>
  );
}

export default function ProfilePage(): JSX.Element {
  const { user } = useAuth();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<ProfileData>>('/auth/me');
      return res.data;
    },
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900"
            aria-hidden
          >
            <User className="h-5 w-5 text-white" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Citizen Account Record
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Your registered account information and access credentials.
            </p>
          </div>
        </div>
      </header>

      {me.isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner label="Loading account record" />
        </div>
      ) : (
        <>
          <Section
            title="Personal Information"
            description="Your registered identity details on file."
            icon={<User className="h-4 w-4" />}
          >
            <dl className="divide-y divide-slate-100">
              <InfoRow
                label="Full name"
                value={me.data?.name}
                icon={<User className="h-3.5 w-3.5" />}
              />
              <InfoRow
                label="Mobile number"
                value={me.data?.mobile ?? user?.mobile}
                icon={<Phone className="h-3.5 w-3.5" />}
              />
              <InfoRow
                label="Email address"
                value={me.data?.email}
                icon={<Mail className="h-3.5 w-3.5" />}
              />
            </dl>
          </Section>

          <Section
            title="Account Details"
            description="System identifiers for your record."
            icon={<Hash className="h-4 w-4" />}
          >
            <dl className="divide-y divide-slate-100">
              <InfoRow label="Account ID" value={me.data?.id} monospace />
            </dl>
          </Section>

          <Section
            title="Access Roles"
            description="Your permissions within the civic platform."
            icon={<Shield className="h-4 w-4" />}
          >
            {(me.data?.roles ?? []).length === 0 ? (
              <p className="py-4 text-sm text-slate-400">No roles assigned.</p>
            ) : (
              <ul className="flex flex-wrap gap-2 py-4">
                {(me.data?.roles ?? []).map((r) => (
                  <li
                    key={r}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-100"
                  >
                    <Shield className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <section className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-5">
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100/80 text-amber-600 ring-1 ring-inset ring-amber-200/50"
                aria-hidden
              >
                <Shield className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-amber-900">
                  Need to update your information?
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-amber-700">
                  Account details are managed by the civic administration. To correct your name,
                  mobile number, or email, please contact your local office or submit a request
                  through the support channel.
                </p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
