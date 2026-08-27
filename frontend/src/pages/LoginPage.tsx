import { useEffect, useState, type FormEvent } from 'react';
import { type JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, type Role, type SessionUser } from '../auth/AuthContext';
import { apiRequest, ApiError, type ApiEnvelope } from '../auth/api';
import {
  IconBuildingCommunity,
  IconArrowRight,
  IconShieldCheck,
  IconUsers,
  IconClipboardList,
  IconSettings,
  IconCheck,
} from '@tabler/icons-react';

interface MeResponse {
  id: string;
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
  roles: Role[];
  departments?: SessionUser['departments'];
}

interface OtpResponse {
  debug_otp?: string;
  expires_in?: number;
}

const DEMO_ACCOUNTS: {
  label: string;
  mobile: string;
  description: string;
  icon: typeof IconUsers;
}[] = [
  {
    label: 'Citizen',
    mobile: '9999900001',
    description: 'Submit a new report, see notifications, track status.',
    icon: IconUsers,
  },
  {
    label: 'Moderator',
    mobile: '9999900002',
    description: 'Review AI-suggested reports, merge duplicates, and flag misrepresentation.',
    icon: IconShieldCheck,
  },
  {
    label: 'Department Officer',
    mobile: '9999900003',
    description: 'Accept, progress, and resolve reports assigned to your department.',
    icon: IconClipboardList,
  },
  {
    label: 'Dr. Linen Officer',
    mobile: '9999900006',
    description: 'Review, schedule, and record textile collection requests.',
    icon: IconBuildingCommunity,
  },
  {
    label: 'Super Admin',
    mobile: '9999900004',
    description: 'Configure report types, security policies, feature flags, audit log.',
    icon: IconSettings,
  },
];

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [authMode, setAuthMode] = useState<'otp' | 'push' | 'password'>('otp');
  const [mobile, setMobile] = useState<string>('9999900001');
  const [otp, setOtp] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [pushChallenge, setPushChallenge] = useState<{
    id: string;
    secret: string;
    expiresAt: string;
  } | null>(null);
  const selectedAccount = DEMO_ACCOUNTS.find((acc) => acc.mobile === mobile) ?? null;

  useEffect(() => {
    if (pushChallenge === null) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const checkApproval = async (): Promise<void> => {
      try {
        const res = await apiRequest<
          ApiEnvelope<{
            status: string;
            token?: { access_token: string };
            refresh_token?: string;
            refresh_expires_at?: string;
            user?: SessionUser;
          }>
        >(`/auth/push-login/${pushChallenge.id}/exchange`, {
          method: 'POST',
          body: { request_secret: pushChallenge.secret },
        });
        if (stopped) return;
        if (res.data.status === 'approved' && res.data.token && res.data.user) {
          login(
            res.data.token.access_token,
            res.data.user,
            res.data.refresh_token,
            res.data.refresh_expires_at,
          );
          void navigate(routeForRoles(res.data.user.roles), { replace: true });
          return;
        }
        if (res.data.status === 'rejected') {
          setError('The sign-in request was declined on your trusted device.');
          setPushChallenge(null);
          return;
        }
        if (res.data.status === 'expired' || res.data.status === 'consumed') {
          setError('The sign-in request expired. Please try again or use OTP.');
          setPushChallenge(null);
          return;
        }
        timer = setTimeout(() => void checkApproval(), 2000);
      } catch (err) {
        if (!stopped) {
          setError(err instanceof ApiError ? err.message : 'Could not check sign-in approval.');
          setPushChallenge(null);
        }
      }
    };

    void checkApproval();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [pushChallenge, login, navigate]);

  async function requestPushLogin(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<
        ApiEnvelope<{ challenge_id: string; request_secret: string; expires_at: string }>
      >('/auth/push-login', { method: 'POST', body: { mobile } });
      setPushChallenge({
        id: res.data.challenge_id,
        secret: res.data.request_secret,
        expiresAt: res.data.expires_at,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not request push approval.');
    } finally {
      setLoading(false);
    }
  }

  async function loginWithPassword(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<
        ApiEnvelope<{
          token: { access_token: string; type: string; expires_at?: string };
          refresh_token: string;
          refresh_expires_at: string;
          user: SessionUser;
        }>
      >('/auth/login', {
        method: 'POST',
        body: { mobile, password },
      });
      login(
        res.data.token.access_token,
        res.data.user,
        res.data.refresh_token,
        res.data.refresh_expires_at,
      );
      const me = await apiRequest<ApiEnvelope<MeResponse>>('/auth/me');
      login(
        res.data.token.access_token,
        { ...res.data.user, departments: me.data.departments },
        res.data.refresh_token,
        res.data.refresh_expires_at,
      );
      void navigate(routeForRoles(me.data.roles), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid mobile or password');
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<ApiEnvelope<OtpResponse>>('/auth/send-otp', {
        method: 'POST',
        body: { mobile },
      });
      if (res.data.debug_otp) {
        setDebugOtp(res.data.debug_otp);
        setOtp(res.data.debug_otp);
      }
      setStage('verify');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<
        ApiEnvelope<{
          token: { access_token: string; type: string; expires_at?: string };
          refresh_token: string;
          refresh_expires_at: string;
          user: SessionUser;
        }>
      >('/auth/verify-otp', {
        method: 'POST',
        body: { mobile, code: otp },
      });
      login(
        res.data.token.access_token,
        res.data.user,
        res.data.refresh_token,
        res.data.refresh_expires_at,
      );
      const me = await apiRequest<ApiEnvelope<MeResponse>>('/auth/me');
      login(
        res.data.token.access_token,
        { ...res.data.user, departments: me.data.departments },
        res.data.refresh_token,
        res.data.refresh_expires_at,
      );
      const target = routeForRoles(me.data.roles);
      void navigate(target, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f2ed]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-6 sm:py-12">
        <Link to="/" className="flex items-center gap-3 self-start">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#1d1d1b] text-white">
            <IconBuildingCommunity className="h-5 w-5" stroke={1.7} />
          </span>
          <span className="text-sm font-semibold tracking-[-0.01em] text-[#1d1d1b]">CIP India</span>
        </Link>

        <div className="mt-10 grid flex-1 grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <section>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#686762]">
              Citizen services
            </p>
            <h1 className="mt-3 text-3xl font-normal leading-[1.1] tracking-[-0.035em] text-[#1d1d1b] sm:text-4xl">
              Sign in to your account.
            </h1>
            <p className="mt-4 text-[15px] leading-6 text-[#4f4e4a]">
              {authMode === 'otp'
                ? 'Choose a demo role or enter your mobile number. The demo uses a one-time code printed in the response so you can sign in without a phone.'
                : authMode === 'push'
                  ? 'Approve this sign-in from a phone or browser where you are already signed in and notifications are enabled.'
                  : 'Staff accounts can use their registered mobile number and password.'}
            </p>

            <div className="mt-8 grid grid-cols-3 rounded-xl border border-[#d0cec8] bg-[#e9e7e1] p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('otp');
                  setError(null);
                }}
                className={`min-h-11 rounded-lg px-3 text-sm font-medium transition ${authMode === 'otp' ? 'bg-white text-[#1d1d1b] shadow-sm' : 'text-[#4f4e4a] hover:text-[#1d1d1b]'}`}
              >
                Sign in with OTP
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('push');
                  setPushChallenge(null);
                  setError(null);
                }}
                className={`min-h-11 rounded-lg px-2 text-sm font-medium transition ${authMode === 'push' ? 'bg-white text-[#1d1d1b] shadow-sm' : 'text-[#4f4e4a] hover:text-[#1d1d1b]'}`}
              >
                Push approval
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('password');
                  setError(null);
                }}
                className={`min-h-11 rounded-lg px-3 text-sm font-medium transition ${authMode === 'password' ? 'bg-white text-[#1d1d1b] shadow-sm' : 'text-[#4f4e4a] hover:text-[#1d1d1b]'}`}
              >
                Staff password login
              </button>
            </div>

            {authMode === 'otp' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (stage === 'request') {
                    void requestOtp(e);
                  } else {
                    void verifyOtp(e);
                  }
                }}
                className="mt-4 space-y-4"
              >
                <div>
                  <label htmlFor="mobile" className="text-sm font-medium text-[#1d1d1b]">
                    Mobile number
                  </label>
                  <input
                    id="mobile"
                    name="mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    spellCheck={false}
                    autoCorrect="off"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    placeholder="9999900001"
                    pattern="[0-9]*"
                    className="mt-2 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base shadow-sm focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
                    required
                  />
                </div>

                {stage === 'verify' && (
                  <div>
                    <label htmlFor="otp" className="text-sm font-medium text-[#1d1d1b]">
                      One-time code
                    </label>
                    <input
                      id="otp"
                      name="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      spellCheck={false}
                      autoCorrect="off"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="123456"
                      className="mt-2 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base shadow-sm focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
                      required
                    />
                    {debugOtp && (
                      <p className="mt-2 text-xs text-[#5a5955]">
                        Demo code: <span className="font-mono text-[#1d1d1b]">{debugOtp}</span>
                      </p>
                    )}
                  </div>
                )}

                {error !== null && (
                  <p
                    role="alert"
                    className="rounded-xl bg-[#f6e6e6] px-4 py-3 text-sm text-[#9b2c2c]"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1d1d1b] px-6 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
                >
                  {loading ? 'Working…' : stage === 'request' ? 'Send code' : 'Verify and continue'}
                </button>

                {stage === 'verify' && (
                  <button
                    type="button"
                    onClick={() => {
                      setStage('request');
                      setError(null);
                    }}
                    className="w-full text-sm text-[#686762] hover:text-[#1d1d1b]"
                  >
                    ← Use a different number
                  </button>
                )}
              </form>
            ) : authMode === 'push' ? (
              <form onSubmit={(e) => void requestPushLogin(e)} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="push-mobile" className="text-sm font-medium text-[#1d1d1b]">
                    Mobile number
                  </label>
                  <input
                    id="push-mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    pattern="[0-9]*"
                    className="mt-2 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base shadow-sm focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
                    required
                    disabled={pushChallenge !== null}
                  />
                </div>
                {pushChallenge !== null && (
                  <div className="rounded-xl border border-[#c8ded3] bg-[#eaf7f0] px-4 py-4 text-sm text-[#205c40]">
                    <p className="font-medium">Waiting for approval</p>
                    <p className="mt-1 text-[#386b54]">
                      Check your trusted device and approve this sign-in. This request expires at{' '}
                      {new Date(pushChallenge.expiresAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      .
                    </p>
                  </div>
                )}
                {error !== null && (
                  <p
                    role="alert"
                    className="rounded-xl bg-[#f6e6e6] px-4 py-3 text-sm text-[#9b2c2c]"
                  >
                    {error}
                  </p>
                )}
                {pushChallenge === null ? (
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#1d1d1b] px-6 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {loading ? 'Sending…' : 'Send approval request'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPushChallenge(null)}
                    className="w-full text-sm text-[#686762] hover:text-[#1d1d1b]"
                  >
                    Cancel and use another method
                  </button>
                )}
                <p className="text-xs leading-5 text-[#686762]">
                  No notification? Use OTP instead. Push approval only works after this account has
                  enabled notifications on a trusted device.
                </p>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  void loginWithPassword(e);
                }}
                className="mt-4 space-y-4"
              >
                <div>
                  <label htmlFor="staff-mobile" className="text-sm font-medium text-[#1d1d1b]">
                    Mobile number
                  </label>
                  <input
                    id="staff-mobile"
                    name="mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    spellCheck={false}
                    autoCorrect="off"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    placeholder="9999900002"
                    pattern="[0-9]*"
                    className="mt-2 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base shadow-sm focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="staff-password" className="text-sm font-medium text-[#1d1d1b]">
                    Password
                  </label>
                  <input
                    id="staff-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-2 block w-full rounded-xl border border-[#d0cec8] bg-white px-4 py-3.5 text-base shadow-sm focus:border-[#1d1d1b] focus:ring-1 focus:ring-[#1d1d1b]"
                    required
                  />
                </div>
                {error !== null && (
                  <p
                    role="alert"
                    className="rounded-xl bg-[#f6e6e6] px-4 py-3 text-sm text-[#9b2c2c]"
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1d1d1b] px-6 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
                >
                  {loading ? 'Working…' : 'Sign in'}
                </button>
              </form>
            )}
          </section>

          <section>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#6f6e69]">
              Demo accounts
            </p>
            <h2 className="mt-3 text-lg font-medium tracking-[-0.015em] text-[#1d1d1b]">
              Choose a role
            </h2>
            <ul className="mt-5 space-y-3">
              {DEMO_ACCOUNTS.map((acc) => {
                const Icon = acc.icon;
                const isActive = selectedAccount?.mobile === acc.mobile;
                return (
                  <li key={acc.mobile}>
                    <button
                      type="button"
                      onClick={() => {
                        setMobile(acc.mobile);
                        setStage('request');
                        setAuthMode('otp');
                        setError(null);
                      }}
                      aria-pressed={isActive}
                      className={`group flex min-h-20 w-full items-center gap-4 rounded-2xl border p-5 text-left transition ${
                        isActive
                          ? 'border-[#1d1d1b] bg-white shadow-sm'
                          : 'border-[#d9d7d0] bg-white hover:border-[#1d1d1b]/60'
                      }`}
                    >
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isActive ? 'bg-[#1d1d1b] text-white' : 'bg-[#efeee9]'}`}
                      >
                        {isActive ? (
                          <IconCheck className="h-5 w-5" stroke={1.8} />
                        ) : (
                          <Icon className="h-5 w-5" stroke={1.7} />
                        )}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[#1d1d1b]">{acc.label}</span>
                          <span className="font-mono text-[10px] text-[#6f6e69]">{acc.mobile}</span>
                        </div>
                        <p className="mt-1 text-xs text-[#686762]">{acc.description}</p>
                      </div>
                      <IconArrowRight className="h-4 w-4 shrink-0 text-[#aaa9a4]" stroke={1.6} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

export function routeForRoles(roles: Role[]): string {
  if (roles.includes('super_admin') || roles.includes('system')) return '/admin';
  if (roles.includes('moderator') || roles.includes('auditor')) return '/moderator';
  if (roles.includes('department_officer') || roles.includes('department_admin'))
    return '/operations';
  return '/citizen';
}
