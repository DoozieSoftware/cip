import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SlaBadge } from './SlaBadge';
import { slaInfo } from './slaInfo';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('slaInfo', () => {
  it('returns null when the Due target is not set', () => {
    expect(slaInfo(null, null)).toBeNull();
    expect(slaInfo('2026-08-01T10:00:00Z', null)).toBeNull();
  });

  it('returns null when the Due target is set but created_at is missing', () => {
    expect(slaInfo(null, 120)).toBeNull();
  });

  it('returns null for an unparseable created_at', () => {
    expect(slaInfo('not-a-date', 120)).toBeNull();
  });

  it('marks a report as overdue after the Due target window has passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));
    const info = slaInfo('2026-08-01T10:00:00Z', 60);
    expect(info).not.toBeNull();
    expect(info?.overdue).toBe(true);
    expect(info?.deadline.toISOString()).toBe('2026-08-01T11:00:00.000Z');
    vi.useRealTimers();
  });

  it('marks a report as on time inside the Due target window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T10:30:00Z'));
    const info = slaInfo('2026-08-01T10:00:00Z', 60);
    expect(info?.overdue).toBe(false);
    vi.useRealTimers();
  });
});

describe('SlaBadge', () => {
  it('renders nothing when the report carries no Due target data', () => {
    const { container } = render(
      <SlaBadge
        report={{ created_at: null, department_sla_minutes: null, current_status_code: null }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders an overdue badge for a report past its deadline', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));
    render(
      <SlaBadge
        report={{
          created_at: '2026-08-01T10:00:00Z',
          department_sla_minutes: 60,
          current_status_code: 'assigned',
        }}
      />,
    );
    expect(screen.getByText(/Overdue by 1 hour/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders a due badge for a report inside its Due target window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T10:30:00Z'));
    render(
      <SlaBadge
        report={{
          created_at: '2026-08-01T10:00:00Z',
          department_sla_minutes: 60,
          current_status_code: 'assigned',
        }}
      />,
    );
    expect(screen.getByText(/Due in 1 hour/)).toBeInTheDocument();
    vi.useRealTimers();
  });
});
