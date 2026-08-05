import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Badge, EmptyState, Spinner } from '../design';
import { queueApi } from '../api/moderator';
import {
  IconArrowRight,
  IconHash,
  IconCalendar,
  IconTag,
  IconPercentage,
} from '@tabler/icons-react';

export default function DuplicatesQueuePage() {
  const q = useQuery({
    queryKey: ['moderator', 'duplicates'],
    queryFn: () => queueApi.duplicates(),
    refetchInterval: 15_000,
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading duplicates" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <EmptyState
        title="Could not load duplicates"
        description="The /moderator/duplicates endpoint did not respond."
      />
    );
  }
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-[#1d1d1b]">Duplicate queue</h1>
        <p className="text-sm text-[#6f6e69]">
          Reports flagged by the AI pipeline as potentially the same incident. Open one to merge it
          into its canonical report.
        </p>
      </header>
      {q.data.data.length === 0 ? (
        <EmptyState title="No duplicate candidates" description="Nothing to merge right now." />
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
                {r.duplicate_score !== null && (
                  <div className="flex items-center gap-1.5">
                    <IconPercentage className="h-4 w-4 text-[#85847f]" stroke={1.6} />
                    <Badge tone={r.duplicate_score > 80 ? 'danger' : 'warning'}>
                      {r.duplicate_score.toFixed(0)}%
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
