import { useNotifications, useMarkNotificationRead } from '../api/client';
import { type JSX } from 'react';
import { Spinner } from '../../../shared/ui';
import { Link } from 'react-router-dom';
import { cx } from '../../../shared/ui/cx';
import {
  IconBell,
  IconBellRinging,
  IconChevronRight,
  IconCheck,
  IconRefresh,
  IconWifiOff,
} from '@tabler/icons-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { ApiError } from '../../../shared/api/errors';
import { useMessages, type Locale, type MessageKey } from '../messages';

function formatDateTime(value: string | null | undefined, locale: Locale): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(locale);
}

function channelKey(channel: string): MessageKey {
  switch (channel) {
    case 'push':
      return 'notifications.channel.push';
    case 'sms':
      return 'notifications.channel.sms';
    case 'email':
      return 'notifications.channel.email';
    case 'log':
      return 'notifications.channel.system';
    case 'webhook':
      return 'notifications.channel.webhook';
    default:
      return 'notifications.channel.default';
  }
}

export default function NotificationsPage(): JSX.Element {
  const list = useNotifications();
  const markRead = useMarkNotificationRead();
  const online = useOnlineStatus();
  const notifications = list.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const { t, locale } = useMessages();

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-5 border-b border-[var(--color-border-faint)] pb-7">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-subtle)]">
            {t('citizenServices')}
          </p>
          <h1 className="mt-2 text-[2rem] font-normal leading-[1.05] tracking-[-0.035em] sm:text-4xl">
            {t('notifications.title')}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[var(--color-text-secondary)]">
            {t('notifications.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8d6cf] bg-[#faf9f6] px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
              <IconBellRinging className="h-3.5 w-3.5" stroke={1.6} aria-hidden />
              {t('notifications.unread', { count: unreadCount })}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 pb-12">
        {list.isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner label={t('notifications.loading')} />
          </div>
        ) : !online && notifications.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-white">
            <div className="flex flex-col items-center px-6 py-16">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                <IconWifiOff
                  className="h-7 w-7 text-[var(--color-text-subtle)]"
                  stroke={1.5}
                  aria-hidden
                />
              </span>
              <p className="mt-4 text-base font-medium text-[var(--color-ink)]">
                {t('notifications.offlineTitle')}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-subtle)]">
                {t('notifications.offlineDetail')}
              </p>
            </div>
          </div>
        ) : list.isError && notifications.length === 0 ? (
          list.error instanceof ApiError && list.error.status === 401 ? (
            <div className="rounded-2xl border border-black/10 bg-white">
              <div className="flex flex-col items-center px-6 py-16">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                  <IconBell
                    className="h-7 w-7 text-[var(--color-text-subtle)]"
                    stroke={1.5}
                    aria-hidden
                  />
                </span>
                <p className="mt-4 text-base font-medium text-[var(--color-ink)]">
                  {t('notifications.sessionTitle')}
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-subtle)]">
                  {t('notifications.sessionDetail')}
                </p>
                <Link
                  to="/login"
                  className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-medium transition hover:border-black/30"
                >
                  {t('notifications.signInAgain')}
                  <IconChevronRight className="h-4 w-4" stroke={1.6} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-black/10 bg-white">
              <div className="flex flex-col items-center px-6 py-16">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                  <IconBell
                    className="h-7 w-7 text-[var(--color-text-subtle)]"
                    stroke={1.5}
                    aria-hidden
                  />
                </span>
                <p className="mt-4 text-base font-medium text-[var(--color-ink)]">
                  {t('notifications.errorTitle')}
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-subtle)]">
                  {t('notifications.errorDetail')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void list.refetch();
                  }}
                  className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-medium transition hover:border-black/30"
                >
                  <IconRefresh className="h-4 w-4" stroke={1.7} aria-hidden />
                  {t('common.tryAgain')}
                </button>
              </div>
            </div>
          )
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-white">
            <div className="flex flex-col items-center px-6 py-16">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                <IconBell
                  className="h-7 w-7 text-[var(--color-text-subtle)]"
                  stroke={1.5}
                  aria-hidden
                />
              </span>
              <p className="mt-4 text-base font-medium text-[var(--color-ink)]">
                {t('notifications.noNotifications')}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-subtle)]">
                {t('notifications.updatesHere')}
              </p>
              <Link
                to="/citizen/submit"
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-5 text-sm font-medium transition hover:border-black/30"
              >
                {t('notifications.fileReport')}
                <IconChevronRight className="h-4 w-4" stroke={1.6} />
              </Link>
            </div>
          </div>
        ) : (
          <>
            {list.isError && (
              <div
                role="status"
                className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800"
              >
                <span>{t('notifications.stale')}</span>
                <button
                  type="button"
                  onClick={() => {
                    void list.refetch();
                  }}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-amber-300 bg-white px-4 text-xs font-medium text-amber-800 transition hover:border-amber/30"
                >
                  <IconRefresh className="h-3.5 w-3.5" stroke={1.7} aria-hidden />
                  {t('common.retry')}
                </button>
              </div>
            )}
            {notifications.map((n) => (
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
                      n.read_at
                        ? 'bg-[var(--color-surface-alt)] text-[var(--color-text-subtle)]'
                        : 'bg-blue-100 text-blue-600',
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
                              aria-label={t('notifications.unreadLabel')}
                            />
                          )}
                          <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                            {n.title}
                          </p>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                          {n.body}
                        </p>
                      </div>
                      <IconChevronRight
                        className="h-5 w-5 shrink-0 text-[var(--color-border-strong)]"
                        stroke={1.5}
                        aria-hidden
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <time
                        dateTime={n.created_at}
                        className="text-xs text-[var(--color-text-tertiary)]"
                      >
                        {formatDateTime(n.created_at, locale)}
                      </time>
                      <span className="inline-flex items-center rounded bg-[var(--color-surface-alt)] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
                        {t(channelKey(n.channel))}
                      </span>
                    </div>
                    {n.data && typeof n.data === 'object' && 'report_id' in n.data && (
                      <Link
                        to={`/citizen/reports/${String(n.data.report_id)}`}
                        className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[#faf9f6]"
                      >
                        {t('notifications.viewReport')}
                        <IconChevronRight className="h-4 w-4" stroke={1.6} aria-hidden />
                      </Link>
                    )}
                  </div>
                </div>
                {!n.read_at && (
                  <div className="mt-4 border-t border-[var(--color-border-subtle)] pt-4">
                    <button
                      type="button"
                      onClick={() => markRead.mutate(n.id)}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-black/30 active:bg-[#faf9f6] sm:w-auto"
                    >
                      <IconCheck className="h-4 w-4" stroke={1.7} aria-hidden />
                      {t('notifications.markAsRead')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
