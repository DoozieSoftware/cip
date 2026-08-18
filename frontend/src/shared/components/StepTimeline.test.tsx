import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepTimeline } from './StepTimeline';

describe('StepTimeline', () => {
  it('keeps every workflow label and timestamp available for narrow layouts', () => {
    const steps = [
      'Draft',
      'New report',
      'AI checking',
      'Needs review',
      'Assigned',
      'Accepted by officer',
      'Work in progress',
      'Waiting for verification',
      'Citizen confirmation',
      'Completed',
    ].map((label, index) => ({
      code: `step-${index}`,
      label,
      at: '2026-08-18T11:08:23Z',
    }));

    render(<StepTimeline steps={steps} currentIndex={4} activeIndex={4} />);

    for (const step of steps) {
      expect(screen.getByText(step.label)).toBeInTheDocument();
    }

    expect(screen.getAllByText(/Aug 18/)).toHaveLength(10);
    expect(screen.getByText('Accepted by officer')).toHaveClass('lg:whitespace-normal');
  });
});
