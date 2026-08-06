import { useNotifications, useMarkNotificationRead } from '../api/client';
import { type JSX } from 'react';
import { Spinner } from '../../../shared/ui';
import { Link } from 'react-router-dom';
import { cx } from '../../../shared/ui/cx';
import { IconBell, IconBellRinging, IconChevronRight, IconCheck } from '@tabler/icons-react';

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
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-5 border-b border-[#d9d7d0] pb-7">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#777670]">
            Citizen services
          </p>
          <h1 className="mt-2 text-[2rem] font-normal leading-[1.05] tracking-[-0.035em] sm:text-4xl">
            Notifications
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[#6f6e69]">
            Status updates regarding your submitted reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8d6cf] bg-[#faf9f6] px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#777670]">
              <IconBellRinging className="h-3.5 w-3.5" stroke={1.6} aria-hidden />
              {unreadCount} unread
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 pb-12">
        {list.isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner label="Loading notifications" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-white">
            <div className="flex flex-col items-center px-6 py-16">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[#efeee9]">
                <IconBell className="h-7 w-7 text-[#777670]" stroke={1.5} aria-hidden />
              </span>
              <p className="mt-4 text-base font-medium text-[#1d1d1b]">No notifications</p>
              <p className="mt-1 text-sm text-[#777670]">
                Updates about your reports will appear here
              </p>
              <Link
                to="/citizen/submit"
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-medium transition hover:border-black/30"
              >
                File a report
                <IconChevronRight className="h-4 w-4" stroke={1.6} />
              </Link>
            </div>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={cx(
                'rounded-2xl bg-white p-5 shadow-sm ring-1 transition',
                n.read_at ? 'ring-slate-200' : 'bg-blue-50/40 ring-blue-200',
              )}
            >
              <div className="flex items-start gap-4">
                <span
                  className={cx(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-full',
                    n.read_at ? 'bg-[#efeee9] text-[#777670]' : 'bg-blue-100 text-blue-600',
                  )}
                  aria-hidden
                >
                  <IconBell className="h-5 w-5" stroke={1.6} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {!n.read_at && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-blue-600"
                            aria-label="Unread"
                          />
                        )}
                        <p className="truncate text-sm font-medium text-[#1d1d1b]">{n.title}</p>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-[#6f6e69]">{n.body}</p>
                    </div>
                    <IconChevronRight
                      className="h-5 w-5 shrink-0 text-[#aaa9a4]"
                      stroke={1.5}
                      aria-hidden
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <time dateTime={n.created_at} className="text-xs text-[#85847f]">
                      {formatDateTime(n.created_at)}
                    </time>
                    <span className="inline-flex items-center rounded bg-[#efeee9] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#85847f]">
                      {channelLabel(n.channel)}
                    </span>
                  </div>
                  {n.data && typeof n.data === 'object' && 'report_id' in n.data && (
                    <Link
                      to={`/citizen/reports/${String(n.data.report_id)}`}
                      className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-[#1d1d1b] transition hover:bg-[#faf9f6]"
                    >
                      View report
                      <IconChevronRight className="h-4 w-4" stroke={1.6} aria-hidden />
                    </Link>
                  )}
                </div>
              </div>
              {!n.read_at && (
                <div className="mt-4 border-t border-[#e4e2dc] pt-4">
                  <button
                    type="button"
                    onClick={() => markRead.mutate(n.id)}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 py-2 text-sm font-medium text-[#1d1d1b] transition hover:border-black/30 active:bg-[#faf9f6] sm:w-auto"
                  >
                    <IconCheck className="h-4 w-4" stroke={1.7} aria-hidden />
                    Mark as read
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
