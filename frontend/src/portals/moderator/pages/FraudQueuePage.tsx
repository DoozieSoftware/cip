import { useQuery } from '@tanstack/react-query';
import { EmptyState, Spinner } from '../../../shared/ui';
import { queueApi } from '../api/moderator';
import { FlaggedQueue } from '../components/FlaggedQueue';

export default function FraudQueuePage() {
  const q = useQuery({
    queryKey: ['moderator', 'fraud'],
    queryFn: () => queueApi.fraud(),
    refetchInterval: 15_000,
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading misrepresentation review" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <EmptyState
        title="Could not load misrepresentation review"
        description="The review queue did not respond."
      />
    );
  }
  return (
    <FlaggedQueue
      title="Misrepresentation review"
      description="Complaints flagged as likely spam, repeat offenders, or synthetic media. Reject the clear cases; escalate the ambiguous ones."
      items={q.data.data}
      scoreKey="fraud_score"
      emptyTitle="No misrepresentation alerts"
      emptyDescription="Nothing to review right now."
    />
  );
}
