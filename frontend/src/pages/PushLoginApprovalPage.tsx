import { useState, type JSX } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { IconBuildingCommunity, IconShieldCheck, IconX } from '@tabler/icons-react';
import { useAuth } from '../auth/AuthContext';
import { apiRequest, ApiError, type ApiEnvelope } from '../auth/api';

export function PushLoginApprovalPage(): JSX.Element {
  const { challenge = '' } = useParams();
  const { hash } = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<'ready' | 'approved' | 'rejected' | 'error'>('ready');
  const [message, setMessage] = useState<string | null>(null);
  const approvalSecret = decodeURIComponent(hash.slice(1));

  async function decide(action: 'approve' | 'reject'): Promise<void> {
    setWorking(true);
    setMessage(null);
    try {
      await apiRequest<ApiEnvelope<{ status: string }>>(`/auth/push-login/${challenge}/${action}`, {
        method: 'POST',
        body: { approval_secret: approvalSecret },
      });
      setStatus(action === 'approve' ? 'approved' : 'rejected');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof ApiError ? error.message : 'Could not handle this request.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f2ed] px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-[#d9d7d0] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1d1d1b] text-white">
            <IconBuildingCommunity className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-[#1d1d1b]">CIP Karnataka</p>
            <p className="text-xs text-[#686762]">Secure sign-in request</p>
          </div>
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-[#686762]">Restoring your session…</p>
        ) : !isAuthenticated ? (
          <div className="mt-8">
            <h1 className="text-2xl tracking-[-0.03em] text-[#1d1d1b]">
              Sign in on this trusted device
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#686762]">
              You must already be signed in here before you can approve another device.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#1d1d1b] px-5 text-sm font-medium text-white"
            >
              Go to sign in
            </Link>
          </div>
        ) : status === 'ready' ? (
          <div className="mt-8">
            <IconShieldCheck className="h-8 w-8 text-[#087a50]" />
            <h1 className="mt-4 text-2xl tracking-[-0.03em] text-[#1d1d1b]">
              Approve this sign-in?
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#686762]">
              Another device is requesting access to your CIP account. Approve only if you started
              this request.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                disabled={working || !approvalSecret}
                onClick={() => void decide('approve')}
                className="min-h-12 rounded-full bg-[#087a50] px-5 text-sm font-medium text-white disabled:opacity-50"
              >
                Approve
              </button>
              <button
                disabled={working || !approvalSecret}
                onClick={() => void decide('reject')}
                className="min-h-12 rounded-full border border-[#c9c6bf] px-5 text-sm font-medium text-[#1d1d1b] disabled:opacity-50"
              >
                Not me
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8">
            {status === 'approved' ? (
              <IconShieldCheck className="h-8 w-8 text-[#087a50]" />
            ) : (
              <IconX className="h-8 w-8 text-[#a52f2f]" />
            )}
            <h1 className="mt-4 text-2xl text-[#1d1d1b]">
              {status === 'approved'
                ? 'Sign-in approved'
                : status === 'rejected'
                  ? 'Sign-in declined'
                  : 'Request not completed'}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#686762]">
              {message ??
                (status === 'approved'
                  ? 'The other device will sign in automatically. You can close this page.'
                  : 'The other device will not be signed in.')}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
