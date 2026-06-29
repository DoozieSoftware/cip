import { Link } from 'react-router-dom';
import { type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../auth/AuthContext';
import { apiRequest, type ApiEnvelope } from '../../../auth/api';
import { EmptyState } from '../../moderator/design';

interface MeResponse {
  id: string;
  name?: string | null;
  mobile?: string | null;
}

export default function MyReportsPage(): JSX.Element {
  const { user } = useAuth();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<MeResponse>>('/auth/me');
      return res.data;
    },
  });

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My reports</h1>
          <p className="text-sm text-slate-600">Everything you've reported. Tap a card for the full timeline.</p>
        </div>
        <Link
          to="/citizen/submit"
          className="rounded-full bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          + New
        </Link>
      </header>

      <EmptyState
        title="Your report list shows up here"
        description="After you submit, the report will appear with live status updates from the department. Check the Updates tab for the latest notification."
        action={
          <Link
            to="/citizen/submit"
            className="mt-2 rounded-full bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Report an issue
          </Link>
        }
      />

      <p className="text-xs text-slate-500">
        Signed in as <span className="font-mono">{user?.mobile}</span>. User ID: <span className="font-mono">{me.data?.id ?? '…'}</span>
      </p>
    </div>
  );
}
