import { useNotifications, useMarkNotificationRead } from '../api/client';
import { type JSX } from 'react';
import { Spinner } from '../../moderator/design';
import { Link } from 'react-router-dom';
import { cx } from '../../moderator/design/cx';
import { Bell, BellRing, ChevronRight } from 'lucide-react';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function channelLabel(channel: string): string {
  switch (channel) {
    case 'push':
      return 'Push';
    case 'sms':
      return 'SMS';
    case 'email':
      return 'Email';
    case 'log':
      return 'System';
    case 'webhook':
      return 'Webhook';
    default:
      return 'Notification';
  }
}

export default function NotificationsPage(): JSX.Element {
  const list = useNotifications();
  const markRead = useMarkNotificationRead();
  const notifications = list.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Official Notifications
          </h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-100">
              <BellRing className="h-3.5 w-3.5" aria-hidden />
              {unreadCount} unread
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500">
          Status updates regarding your submitted reports and civic interactions.
        </p>
      </header>

      {list.isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner label="Loading notifications" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-inset ring-slate-100">
            <Bell className="h-7 w-7 text-slate-300" aria-hidden />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-slate-800">No notifications</h2>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
            You have no official notifications at this time. Updates will appear here.
          </p>
          <Link
            to="/citizen/submit"
            className="mt-8 inline-flex min-h-[44px] items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 active:bg-slate-950"
          >
            Submit a report
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={cx(
                'rounded-xl border bg-white transition',
                n.read_at
                  ? 'border-slate-200 hover:border-slate-300'
                  : 'border-blue-200 bg-blue-50/30',
              )}
            >
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div
                    className={cx(
                      'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl',
                      n.read_at ? 'bg-slate-50 text-slate-400' : 'bg-blue-100/70 text-blue-700',
                    )}
                    aria-hidden
                  >
                    <Bell className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {!n.read_at && (
                            <span
                              className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-600"
                              aria-label="Unread"
                            />
                          )}
                          <h2 className="truncate text-base font-medium text-slate-900">
                            {n.title}
                          </h2>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{n.body}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <time dateTime={n.created_at} className="text-xs font-medium text-slate-400">
                        {formatDateTime(n.created_at)}
                      </time>
                      <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-100">
                        {channelLabel(n.channel)}
                      </span>
                    </div>
                    {n.data && typeof n.data === 'object' && 'report_id' in n.data && (
                      <Link
                        to={`/citizen/reports/${String(n.data.report_id)}`}
                        className="mt-4 inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-slate-900 transition hover:text-slate-700"
                      >
                        View related report
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
                    )}
                  </div>
                </div>
                {!n.read_at && (
                  <div className="mt-4 border-t border-blue-100/80 pt-4">
                    <button
                      type="button"
                      onClick={() => markRead.mutate(n.id)}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 sm:w-auto"
                    >
                      Mark as read
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
