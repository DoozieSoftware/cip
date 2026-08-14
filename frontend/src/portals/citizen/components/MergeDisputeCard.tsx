import { type JSX, useState } from 'react';
import { IconAlertTriangle, IconCircleCheck, IconClock } from '@tabler/icons-react';
import type { MergeDispute } from '../types';
import { useMergeDispute } from '../api/client';
import { useMessages } from '../messages';

/**
 * P1-07 — allows a citizen to dispute an incorrect merge. Shows
 * the existing dispute status when one has been filed, or a form
 * to file a new dispute when the report is in `merged` state and
 * no dispute is active.
 */
export default function MergeDisputeCard({
  reportId,
  workflowVersion,
  mergeDispute,
}: {
  reportId: string;
  workflowVersion: number;
  mergeDispute: MergeDispute | null;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useMergeDispute(reportId);
  const { t } = useMessages();

  if (mutation.isSuccess) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
        <IconCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" stroke={1.7} />
        <p className="text-sm text-emerald-800">{t('merge.success')}</p>
      </div>
    );
  }

  if (mergeDispute !== null) {
    const statusConfig = {
      open: {
        icon: <IconClock className="h-4 w-4 text-amber-600" stroke={1.7} />,
        bg: 'border-amber-200 bg-amber-50',
        text: 'text-amber-800',
        label: t('merge.pending'),
      },
      resolved: {
        icon: <IconCircleCheck className="h-4 w-4 text-emerald-600" stroke={1.7} />,
        bg: 'border-emerald-200 bg-emerald-50',
        text: 'text-emerald-800',
        label: t('merge.resolved'),
      },
      rejected: {
        icon: <IconAlertTriangle className="h-4 w-4 text-rose-600" stroke={1.7} />,
        bg: 'border-rose-200 bg-rose-50',
        text: 'text-rose-800',
        label: t('merge.rejected'),
      },
    } as const;

    const cfg = statusConfig[mergeDispute.status];

    return (
      <div className={`mt-3 rounded-lg border px-3 py-2 ${cfg.bg}`}>
        <div className="flex items-center gap-2">
          {cfg.icon}
          <span className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</span>
        </div>
        <p className={`mt-1 text-xs ${cfg.text}`}>
          {t('merge.reason', { reason: mergeDispute.reason })}
        </p>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-violet-300 bg-white px-3 text-xs font-medium text-violet-700 hover:bg-violet-50"
      >
        <IconAlertTriangle className="h-3 w-3" stroke={1.6} />
        {t('merge.action')}
      </button>
    );
  }

  const handleSubmit = (): void => {
    if (reason.trim().length < 5) {
      setError(t('merge.validation'));
      return;
    }

    setError(null);
    mutation.mutate(
      { reason, expectedWorkflowVersion: workflowVersion },
      {
        onError: (e) => {
          const msg = e instanceof Error ? e.message : t('merge.failure');
          setError(msg);
        },
      },
    );
  };

  return (
    <div className="mt-3 rounded-lg border border-violet-200 bg-white p-3">
      <p className="text-sm font-medium text-violet-900">{t('merge.action')}</p>
      <p className="mt-1 text-xs text-violet-700">{t('merge.help')}</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('merge.placeholder')}
        className="mt-2 w-full rounded-lg border border-violet-200 px-3 py-2 text-sm text-violet-900 placeholder:text-violet-400 focus:border-violet-400 focus:outline-none"
        rows={3}
        maxLength={1000}
      />
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={mutation.isPending}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-violet-600 px-3 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {mutation.isPending ? t('merge.submitting') : t('merge.submit')}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="inline-flex min-h-[44px] items-center rounded-full px-3 text-xs font-medium text-violet-700 hover:bg-violet-50"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
