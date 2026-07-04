import { useNotifications, useMarkNotificationRead } from '../api/client';
import { type JSX } from 'react';
import { Spinner, EmptyState } from '../../moderator/design';
import { Link } from 'react-router-dom';
import { cx } from '../../moderator/design/cx';

const CHANNEL_ICON: Record<string, string> = {
  push: '🔔',
  sms: '📱',
  email: '✉️',
  log: '📋',
  webhook: '🔗',
};

export default function NotificationsPage(): JSX.Element {
  const list = useNotifications();
  const markRead = useMarkNotificationRead();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Updates</h1>
        <p className="text-sm text-slate-600">Status changes from moderators and departments.</p>
      </header>

      {list.isLoading ? (
        <Spinner label="Loading updates" />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState
          title="No updates yet"
          description="Submit a report and you'll see status changes here as it moves through moderation and assignment."
          action={<Link to="/citizen/submit" className="mt-2 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white">Report an issue</Link>}
        />
      ) : (
        <ul className="space-y-2">
          {(list.data ?? []).map((n) => (
            <li
              key={n.id}
              className={cx(
                'rounded-lg border bg-white p-4 transition',
                n.read_at ? 'border-slate-200' : 'border-blue-300 ring-1 ring-blue-100',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-base">
                    {CHANNEL_ICON[n.channel] ?? '🔔'}
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{n.title}</h2>
                    <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>
                    <p className="mt-1 text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</p>
                  {n.data && typeof n.data === 'object' && 'report_id' in n.data && (
                      <Link
                        to={`/citizen/reports/${String((n.data).report_id)}`}
                        className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline"
                      >
                        View report →
                      </Link>
                    )}
                  </div>
                </div>
                {!n.read_at && (
                  <button
                    type="button"
                    onClick={() => markRead.mutate(n.id)}
                    className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
