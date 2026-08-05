import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type * as ClientApi from '../../api/client';
import SubmitPage from '../SubmitPage';

const mutateAsyncMock = vi.fn();

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof ClientApi>('../../api/client');
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

vi.mock('../../components/CameraCapture', () => ({
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

function renderSubmitPage(): void {
  render(
    <MemoryRouter>
      <SubmitPage />
    </MemoryRouter>,
  );
}

describe('SubmitPage', () => {
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

  it('submits a report after completing all steps', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 12.9716,
          longitude: 77.5946,
          accuracy: 25,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: 1_700_000_000_000,
      } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      geolocation: { getCurrentPosition },
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    renderSubmitPage();

    // Step 1: Category
    fireEvent.click(screen.getByText('Roads').closest('label') ?? screen.getByText('Roads'));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    // Step 2: Details
    await waitFor(() => expect(screen.getByText('Issue Details')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/Large pothole/i), {
      target: { value: 'Large pothole near metro' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the issue/i), {
      target: { value: 'Vehicles are swerving into the bus lane near the metro gate.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    // Step 3: Location
    await waitFor(() => expect(screen.getByText('Location Verification')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /use my location/i }));
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Location captured')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    // Step 4: Evidence
    await waitFor(() => expect(screen.getByText('Attach Evidence')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('camera-photo'));
    fireEvent.click(screen.getByRole('button', { name: /^review$/i }));

    // Step 5: Review & Submit
    await waitFor(() => expect(screen.getByText('Review Your Report')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /file report/i }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          report_type_id: 'type-roads',
          latitude: 12.9716,
          longitude: 77.5946,
          accuracy_m: 25,
          media_files: [expect.objectContaining({ type: 'image/jpeg' })],
        }),
      );
    });
    expect(screen.queryByText('This category requires a video.')).toBeNull();
  });

  it('validates category selection', () => {
    renderSubmitPage();
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(screen.getByText('Pick a category.')).toBeInTheDocument();
  });

  it('validates title and description length', async () => {
    renderSubmitPage();

    // Go to details
    fireEvent.click(screen.getByText('Roads').closest('label') ?? screen.getByText('Roads'));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    // Try to continue with short input
    await waitFor(() => expect(screen.getByText('Issue Details')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/Large pothole/i), {
      target: { value: 'Hi' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the issue/i), {
      target: { value: 'Short' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(screen.getByText('Title should be at least 5 characters.')).toBeInTheDocument();
    expect(screen.getByText('Description should be at least 10 characters.')).toBeInTheDocument();
  });

  it('allows navigating back to edit previous steps', async () => {
    renderSubmitPage();

    // Select category and proceed
    fireEvent.click(screen.getByText('Roads').closest('label') ?? screen.getByText('Roads'));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    // Verify we're on details step
    await waitFor(() => expect(screen.getByText('Issue Details')).toBeInTheDocument());

    // Get the Back button (there should be only one visible at this step)
    const backButton = screen.getByRole('button', { name: /^back$/i });
    fireEvent.click(backButton);

    // Should be back on category
    await waitFor(() => expect(screen.getByText('Report Category')).toBeInTheDocument());
  });
});
