import { describe, it, expect } from 'vitest';
import { buildCitizenTimeline } from './citizenStatusTimeline';

describe('buildCitizenTimeline', () => {
  const hist = [
    { to_code: 'submitted', created_at: '2026-08-14T09:58:04Z' },
    { to_code: 'ai_processing', created_at: '2026-08-14T09:58:05Z' },
    { to_code: 'pending_moderator', created_at: '2026-08-14T10:01:26Z' },
    { to_code: 'assigned', created_at: '2026-08-14T10:29:07Z' },
    { to_code: 'accepted', created_at: '2026-08-14T10:36:06Z' },
    { to_code: 'in_progress', created_at: '2026-08-14T10:36:13Z' },
    { to_code: 'resolved_pending_verification', created_at: '2026-08-14T10:36:44Z' },
  ];

  it('collapses to 5 stages', () => {
    const t = buildCitizenTimeline(hist, 'resolved_pending_verification');
    expect(t.steps.map((s) => s.label)).toEqual([
      'Received',
      'Assigned to department',
      'In progress',
      'Fixed — please verify',
      'Completed',
    ]);
    expect(t.currentIndex).toBe(3);
    expect(t.activeIndex).toBe(3);
    expect(t.offPathBadge).toBeNull();
  });

  it('uses first-entry timestamp per stage', () => {
    const t = buildCitizenTimeline(hist, 'resolved_pending_verification');
    expect(t.steps[0].at).toBe('2026-08-14T09:58:04Z'); // submitted, not pending_moderator
    expect(t.steps[1].at).toBe('2026-08-14T10:29:07Z'); // assigned, not accepted
  });

  it('shows a badge and keeps progress when rejected', () => {
    const t = buildCitizenTimeline(hist.slice(0, 3), 'rejected');
    expect(t.offPathBadge).toEqual({ label: 'Could not accept', tone: 'danger' });
    expect(t.activeIndex).toBeNull();
    expect(t.currentIndex).toBe(0);
  });

  it('handles an empty history', () => {
    const t = buildCitizenTimeline([], 'submitted');
    expect(t.currentIndex).toBe(0);
    expect(t.steps).toHaveLength(5);
  });
});
