import { StepTimeline } from '../../../shared/components/StepTimeline';
import { buildStaffTimeline } from '../../../shared/staffStatusTimeline';
import type { StatusHistoryEntry } from '../types';

export function StatusTimeline({ entries }: { entries: StatusHistoryEntry[] }) {
  const { steps, currentIndex, activeIndex, offPathBadge } = buildStaffTimeline(entries);

  return (
    <StepTimeline
      steps={steps}
      currentIndex={currentIndex}
      activeIndex={activeIndex}
      offPathBadge={offPathBadge}
    />
  );
}
