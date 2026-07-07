import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SubmitPage from '../SubmitPage';

const mutateAsyncMock = vi.fn();

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
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
  CameraCapture: () => <div data-testid="camera-capture" />,
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
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    renderSubmitPage();

    fireEvent.click(screen.getByRole('button', { name: /pothole/i }));
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
