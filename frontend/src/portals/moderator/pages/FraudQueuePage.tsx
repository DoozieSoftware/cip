import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Badge, EmptyState, Spinner } from '../../../shared/ui';
import { queueApi } from '../api/moderator';
import {
  IconArrowRight,
  IconHash,
  IconCalendar,
  IconTag,
  IconPercentage,
} from '@tabler/icons-react';

export default function FraudQueuePage() {
  const q = useQuery({
    queryKey: ['moderator', 'fraud'],
    queryFn: () => queueApi.fraud(),
    refetchInterval: 15_000,
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading fraud review" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <EmptyState
        title="Could not load fraud review"
        description="The /moderator/fraud endpoint did not respond."
      />
    );
  }
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-[#1d1d1b]">Fraud review</h1>
        <p className="text-sm text-[#6f6e69]">
          Reports flagged as likely spam, repeat offenders, or synthetic media. Reject the clear
          cases; escalate the ambiguous ones.
        </p>
      </header>
      {q.data.data.length === 0 ? (
        <EmptyState title="No fraud suspects" description="Nothing to review right now." />
      ) : (
        <div className="space-y-3">
          {q.data.data.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-4 rounded-xl bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-[#f3f2ed] p-1.5">
                    <IconHash className="h-4 w-4 text-[#85847f]" stroke={1.6} />
                  </div>
                  <span className="font-mono text-sm font-medium text-[#1d1d1b]">
                    {r.tracking_number}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <IconCalendar className="h-4 w-4 text-[#85847f]" stroke={1.6} />
                  <span className="text-sm text-[#6f6e69]">
                    {new Date(r.submitted_at).toLocaleString()}
                  </span>
                </div>
                {r.category && (
                  <div className="flex items-center gap-2">
                    <IconTag className="h-4 w-4 text-[#85847f]" stroke={1.6} />
                    <span className="text-sm text-[#1d1d1b]">{r.category.name}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {r.fraud_score !== null && (
                  <div className="flex items-center gap-1.5">
                    <IconPercentage className="h-4 w-4 text-[#85847f]" stroke={1.6} />
                    <Badge tone={r.fraud_score > 80 ? 'danger' : 'warning'}>
                      {r.fraud_score.toFixed(0)}%
                    </Badge>
                  </div>
                )}
                <Link
                  to={`/moderator/reports/${r.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1d1d1b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2d2d2b]"
                >
                  Review
                  <IconArrowRight className="h-4 w-4" stroke={1.6} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
