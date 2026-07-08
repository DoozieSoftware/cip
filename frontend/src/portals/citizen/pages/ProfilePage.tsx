import { type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../auth/AuthContext';
import { apiRequest, type ApiEnvelope } from '../../../auth/api';
import { Spinner } from '../../moderator/design';

export default function ProfilePage(): JSX.Element {
  const { user } = useAuth();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<{ id: string; name?: string | null; mobile?: string | null; email?: string | null; roles: string[] }>>('/auth/me');
      return res.data;
    },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-600">Your account and sign-in info.</p>
      </header>

      {me.isLoading ? (
        <Spinner label="Loading profile" />
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Name</dt>
              <dd className="font-medium text-slate-900">{me.data?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Mobile</dt>
              <dd className="font-mono text-slate-900">{me.data?.mobile ?? user?.mobile ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Email</dt>
              <dd className="text-slate-900">{me.data?.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Roles</dt>
              <dd className="flex flex-wrap gap-1">
                {(me.data?.roles ?? []).map((r) => (
                  <span key={r} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{r}</span>
                ))}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}
