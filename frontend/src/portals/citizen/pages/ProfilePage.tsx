import { type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../auth/AuthContext';
import { apiRequest, type ApiEnvelope } from '../../../auth/api';
import { Spinner } from '../../moderator/design';
import {
  IconUser,
  IconMail,
  IconPhone,
  IconShield,
  IconHash,
  IconLogout,
} from '@tabler/icons-react';

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
}

function InfoRow({ label, value, monospace = false }: InfoRowProps): JSX.Element {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-4 py-3">
      <dt className="text-sm text-[#6f6e69]">{label}</dt>
      <dd
        className={
          monospace
            ? 'break-all text-right font-mono text-sm text-[#1d1d1b]'
            : 'text-sm font-medium text-[#1d1d1b]'
        }
      >
        {value ?? '—'}
      </dd>
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: JSX.Element;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps): JSX.Element {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5">
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#efeee9] text-[#777670]"
          aria-hidden
        >
          {icon}
        </span>
        <h2 className="text-sm font-medium text-[#1d1d1b]">{title}</h2>
      </div>
      <div className="mt-3 divide-y divide-[#e4e2dc]">{children}</div>
    </div>
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
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-5 border-b border-[#d9d7d0] pb-7">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#777670]">
            Citizen services
          </p>
          <h1 className="mt-2 text-[2rem] font-normal leading-[1.05] tracking-[-0.035em] sm:text-4xl">
            Profile
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[#6f6e69]">
            Your registered account information
          </p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d8d6cf] bg-[#faf9f6]">
          <IconUser className="h-5 w-5" stroke={1.6} />
        </span>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 pb-12">
        {me.isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner label="Loading profile" />
          </div>
        ) : (
          <>
            <Section
              title="Personal Information"
              icon={<IconUser className="h-4 w-4" stroke={1.6} />}
            >
              <InfoRow label="Full name" value={me.data?.name} />
              <InfoRow label="Mobile number" value={me.data?.mobile ?? user?.mobile} />
            </Section>

            <Section title="Contact" icon={<IconMail className="h-4 w-4" stroke={1.6} />}>
              <InfoRow label="Email address" value={me.data?.email} />
            </Section>

            <Section title="Account" icon={<IconHash className="h-4 w-4" stroke={1.6} />}>
              <InfoRow label="Account ID" value={me.data?.id} monospace />
            </Section>

            <Section title="Access Roles" icon={<IconShield className="h-4 w-4" stroke={1.6} />}>
              {(me.data?.roles ?? []).length === 0 ? (
                <p className="py-3 text-sm text-[#85847f]">No roles assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-2 py-3">
                  {(me.data?.roles ?? []).map((r) => (
                    <span
                      key={r}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#efeee9] px-3 py-1 text-[10px] uppercase tracking-[0.08em] text-[#777670]"
                    >
                      <IconShield className="h-3.5 w-3.5" stroke={1.7} aria-hidden />
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            <div className="rounded-2xl border border-[#d8cfae] bg-[#f1ead4] p-5">
              <div className="flex items-start gap-4">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e8dfc0] text-[#746f5e]"
                  aria-hidden
                >
                  <IconPhone className="h-4 w-4" stroke={1.6} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#1d1d1b]">
                    Need to update your information?
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[#686762]">
                    Account details are managed by the civic administration. Contact your local
                    office to correct your name, mobile number, or email.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-medium text-[#1d1d1b] transition hover:border-black/30 active:bg-[#faf9f6] sm:w-auto"
            >
              <IconLogout className="h-4 w-4" stroke={1.6} aria-hidden />
              Sign out
            </button>
          </>
        )}
      </main>
    </div>
  );
}
