import { useQuery } from '@tanstack/react-query';
import { EmptyState, Spinner } from '../../../shared/ui';
import { queueApi } from '../api/moderator';
import { FlaggedQueue } from '../components/FlaggedQueue';

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
    <FlaggedQueue
      title="Duplicate review"
      description="Complaints flagged by the AI pipeline as potentially the same incident. Open one to merge it into its canonical complaint."
      items={q.data.data}
      scoreKey="duplicate_score"
      emptyTitle="No duplicate candidates"
      emptyDescription="Nothing to merge right now."
    />
  );
}
