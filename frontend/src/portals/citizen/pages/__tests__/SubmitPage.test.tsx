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
          id: 'type-pothole',
          code: 'pothole',
          name: 'Pothole',
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

  it('requests browser location permission from the submit action when location is mandatory', async () => {
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

    renderSubmitPage();

    fireEvent.click(screen.getByRole('button', { name: /pothole/i }));
    fireEvent.click(screen.getByTestId('camera-photo'));
    fireEvent.change(screen.getByPlaceholderText(/Big pothole/i), {
      target: { value: 'Large pothole near metro' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Affects traffic/i), {
      target: { value: 'Vehicles are swerving into the bus lane near the metro gate.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(expect.objectContaining({
        report_type_id: 'type-pothole',
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy_m: 25,
      }));
    });
  });
});
