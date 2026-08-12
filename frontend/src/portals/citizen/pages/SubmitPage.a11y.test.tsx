import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type * as ClientApi from '../api/client';
import SubmitPage from './SubmitPage';

const mutateAsyncMock = vi.fn();

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof ClientApi>('../api/client');
  return {
    ...actual,
    useReportTypes: () => ({
      isLoading: false,
      data: [
        {
          id: 'type-roads',
          code: 'roads',
          name: 'Roads',
          requires_photo: true,
          requires_video: false,
        },
      ],
    }),
    useCreateReport: () => ({
      mutateAsync: mutateAsyncMock,
    }),
  };
});

vi.mock('../components/CameraCapture', () => ({
  CameraCapture: ({ mode, onCapture }: { mode: string; onCapture: (f: File) => void }) => (
    <button
      type="button"
      data-testid={`camera-${mode}`}
      onClick={() =>
        onCapture(
          new File(['x'], mode === 'video' ? 'clip.webm' : 'photo.jpg', {
            type: mode === 'video' ? 'video/webm' : 'image/jpeg',
          }),
        )
      }
    >
      capture {mode}
    </button>
  ),
}));

vi.mock('../../../shared/geo/useReverseGeocode', () => ({
  useReverseGeocode: () => '',
}));

describe('SubmitPage accessibility', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue({ id: 'report-1', status: 'submitted' });
    window.scrollTo = vi.fn();
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = vi.fn(() => 'blob:mock');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    }
  });

  function renderSubmit(): void {
    render(
      <MemoryRouter>
        <SubmitPage />
      </MemoryRouter>,
    );
  }

  it('renders an aria-live region announcing the current step', () => {
    renderSubmit();

    const liveRegion = screen.getByRole('status', { name: /step 1 of 5: category/i });
    expect(liveRegion).toBeInTheDocument();
  });

  it('wraps each step section with aria-labelledby pointing to its heading', () => {
    renderSubmit();

    const section = screen.getByRole('region', { name: /report category/i });
    expect(section).toBeInTheDocument();
  });

  it('gives each step heading a stable id and makes it programmatically focusable', () => {
    renderSubmit();

    const heading = screen.getByText('Report Category');
    expect(heading.getAttribute('id')).toBe('step-heading');
    expect(heading.getAttribute('tabindex')).toBe('-1');
  });

  it('announces the step when advancing to the details step', async () => {
    renderSubmit();

    fireEvent.click(screen.getByText('Roads').closest('label') ?? screen.getByText('Roads'));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(screen.getByRole('status', { name: /step 2 of 5: details/i })).toBeInTheDocument();
    });
  });
});
