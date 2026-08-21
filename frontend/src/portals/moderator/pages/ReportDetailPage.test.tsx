import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ModeratorActionError, ModeratorReportHeader } from './ReportDetailPage';
import { moderatorActionMessage } from './moderatorStatus';

describe('ModeratorReportHeader', () => {
  it('gives the report title the full mobile width before showing header badges', () => {
    render(
      <MemoryRouter>
        <ModeratorReportHeader
          data={{
            tracking_number: 'CIV-2026-000050',
            title: 'Roadside garbage accumulation - duplicate review check',
            submitted_at: '2026-08-17T18:37:18+05:30',
            status_code: 'pending_moderator',
            evidence_count: 1,
          }}
        />
      </MemoryRouter>,
    );

    const heading = screen.getByRole('heading', {
      name: 'Roadside garbage accumulation - duplicate review check',
    });
    const headerLayout = heading.parentElement?.parentElement;

    expect(heading).toHaveClass('w-full', 'break-words');
    expect(headerLayout).toHaveClass('flex-col', 'sm:flex-row');
    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(screen.getByText('1 evidence')).toBeInTheDocument();
  });
});

describe('moderatorActionMessage', () => {
  it('explains that citizen-confirmed and closed reports need no further action', () => {
    expect(moderatorActionMessage('verified')).toBe(
      'This report is complete. No further moderator action is needed.',
    );
    expect(moderatorActionMessage('closed')).toBe(
      'This report is complete. No further moderator action is needed.',
    );
  });
});

describe('ModeratorActionError', () => {
  it('shows the reason when a moderator action fails', () => {
    render(<ModeratorActionError error={new Error('Approval could not be routed.')} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Action could not be completed');
    expect(screen.getByRole('alert')).toHaveTextContent('Approval could not be routed.');
  });

  it('renders nothing when there is no error', () => {
    const { container } = render(<ModeratorActionError error={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
