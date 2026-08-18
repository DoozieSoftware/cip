import { describe, expect, it } from 'vitest';
import { buildStaffTimeline } from './staffStatusTimeline';

const history = (statuses: string[]) =>
  statuses.map((to_code, index) => ({
    to_code,
    created_at: `2026-08-18T10:${String(index).padStart(2, '0')}:00Z`,
  }));

describe('buildStaffTimeline', () => {
  it('shows citizen verification as the single final Completed stage', () => {
    const timeline = buildStaffTimeline(
      history([
        'draft',
        'submitted',
        'ai_processing',
        'pending_moderator',
        'assigned',
        'accepted',
        'in_progress',
        'resolved_pending_verification',
        'verified',
      ]),
    );

    expect(timeline.steps.map((step) => step.label)).toContain('Completed');
    expect(timeline.steps.filter((step) => step.label === 'Completed')).toHaveLength(1);
    expect(timeline.steps).toHaveLength(9);
    expect(timeline.currentIndex).toBe(8);
    expect(timeline.activeIndex).toBe(8);
  });

  it('uses the same final stage when staff closes a report directly', () => {
    const timeline = buildStaffTimeline(history(['resolved_pending_verification', 'closed']));

    expect(timeline.steps.at(-1)).toMatchObject({ code: 'completed', label: 'Completed' });
    expect(timeline.currentIndex).toBe(8);
    expect(timeline.activeIndex).toBe(8);
  });
});
