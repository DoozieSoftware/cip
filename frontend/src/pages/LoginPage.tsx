import { useState, type FormEvent } from 'react';
import { type JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, type Role, type SessionUser } from '../auth/AuthContext';
import { apiRequest, ApiError, type ApiEnvelope } from '../auth/api';

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

const DEMO_ACCOUNTS: { label: string; mobile: string; description: string; path: string }[] = [
  { label: 'Citizen', mobile: '9999900001', description: 'Submit a new report, see notifications, track status.', path: '/citizen' },
  { label: 'Moderator', mobile: '9999900002', description: 'Triage the AI-classified queue, merge duplicates, reject fraud.', path: '/moderator' },
  { label: 'Department Officer', mobile: '9999900003', description: 'Accept, progress, resolve assigned reports in the BBMP zone.', path: '/operations' },
  { label: 'Super Admin', mobile: '9999900004', description: 'Configure report types, security policies, feature flags, audit log.', path: '/admin' },
];

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [authMode, setAuthMode] = useState<'otp' | 'password'>('otp');
  const [mobile, setMobile] = useState<string>('9999900001');
  const [otp, setOtp] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const selectedAccount = DEMO_ACCOUNTS.find((acc) => acc.mobile === mobile) ?? null;

  async function loginWithPassword(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<ApiEnvelope<{ token: { access_token: string; type: string; expires_at?: string }; refresh_token: string; refresh_expires_at: string; user: SessionUser }>>('/auth/login', {
        method: 'POST',
        body: { mobile, password },
      });
      login(res.data.token.access_token, res.data.user);
      const me = await apiRequest<ApiEnvelope<MeResponse>>('/auth/me');
      login(res.data.token.access_token, { ...res.data.user, departments: me.data.departments });
      const target = routeForRoles(me.data.roles);
      void navigate(target, { replace: true });
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
      const res = await apiRequest<ApiEnvelope<{ token: { access_token: string; type: string; expires_at?: string }; refresh_token: string; refresh_expires_at: string; user: SessionUser }>>('/auth/verify-otp', {
        method: 'POST',
        body: { mobile, code: otp },
      });
      login(res.data.token.access_token, res.data.user);
      // Pull /auth/me to confirm roles
      const me = await apiRequest<ApiEnvelope<MeResponse>>('/auth/me');
      login(res.data.token.access_token, { ...res.data.user, departments: me.data.departments });
      const target = routeForRoles(me.data.roles);
      void navigate(target, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <Link to="/" className="flex items-center gap-3 self-start">
          <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-sm">
            CIP
          </span>
          <span className="text-lg font-semibold text-slate-900">Civic Intelligence Platform</span>
        </Link>

        <div className="mt-12 grid flex-1 grid-cols-1 gap-12 lg:grid-cols-2">
          <section>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Sign in to the demo
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              {authMode === 'otp'
                ? 'Pick a role on the right, or enter your own mobile number. The demo uses a static OTP (printed in the response) so you can sign in without a phone.'
                : 'Staff accounts (moderator, department, super admin) can sign in with a password instead of OTP.'}
            </p>

            <div className="mt-6 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm">
              <button
                type="button"
                onClick={() => { setAuthMode('otp'); setError(null); }}
                className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${authMode === 'otp' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Sign in with OTP
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('password'); setError(null); }}
                className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${authMode === 'password' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Staff password login
              </button>
            </div>

            {authMode === 'otp' ? (
              <form onSubmit={(e) => { e.preventDefault(); if (stage === 'request') { void requestOtp(e); } else { void verifyOtp(e); } }} className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                  <label htmlFor="mobile" className="block text-sm font-medium text-slate-700">Mobile number</label>
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
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>

                {stage === 'verify' && (
                  <div>
                    <label htmlFor="otp" className="block text-sm font-medium text-slate-700">One-time code</label>
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
                      className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
                      required
                    />
                    {debugOtp && (
                      <p className="mt-2 text-xs text-emerald-700">
                        Demo OTP (auto-filled): <span className="font-mono">{debugOtp}</span>
                      </p>
                    )}
                  </div>
                )}

                {error !== null && (
                  <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:bg-brand-300"
                >
                  {loading ? 'Working…' : stage === 'request' ? 'Send OTP' : 'Verify and continue'}
                </button>

                {stage === 'verify' && (
                  <button
                    type="button"
                    onClick={() => { setStage('request'); setError(null); }}
                    className="w-full text-sm text-slate-500 hover:text-slate-700"
                  >
                    ← Use a different number
                  </button>
                )}
              </form>
            ) : (
              <form onSubmit={(e) => { void loginWithPassword(e); }} className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                  <label htmlFor="staff-mobile" className="block text-sm font-medium text-slate-700">Mobile number</label>
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
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="staff-password" className="block text-sm font-medium text-slate-700">Password</label>
                  <input
                    id="staff-password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>

                {error !== null && (
                  <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:bg-brand-300"
                >
                  {loading ? 'Working…' : 'Sign in'}
                </button>
              </form>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Demo accounts</h2>
            <ul className="mt-4 space-y-3">
              {DEMO_ACCOUNTS.map((acc) => (
                <li key={acc.mobile}>
                  <button
                    type="button"
                    onClick={() => { setMobile(acc.mobile); setStage('request'); setAuthMode('otp'); setError(null); }}
                    aria-pressed={selectedAccount?.mobile === acc.mobile}
                    className={`group block w-full rounded-2xl border p-5 text-left shadow-sm transition ${
                      selectedAccount?.mobile === acc.mobile
                        ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200 shadow-md'
                        : 'border-slate-200 bg-white hover:border-brand-400 hover:shadow'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold text-slate-900">{acc.label}</span>
                      <span className="flex items-center gap-2">
                        {selectedAccount?.mobile === acc.mobile && (
                          <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            Selected
                          </span>
                        )}
                        <span className="font-mono text-xs text-slate-400">{acc.mobile}</span>
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{acc.description}</p>
                    <p className="mt-2 text-xs font-medium text-brand-700 group-hover:underline">
                      {selectedAccount?.mobile === acc.mobile ? `Ready to sign in as ${acc.label} →` : `Sign in as ${acc.label} →`}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

export function routeForRoles(roles: Role[]): string {
  if (roles.includes('super_admin') || roles.includes('system')) {
    return '/admin';
  }
  if (roles.includes('moderator') || roles.includes('auditor')) {
    return '/moderator';
  }
  if (roles.includes('department_officer') || roles.includes('department_admin')) {
    return '/operations';
  }
  return '/citizen';
}
