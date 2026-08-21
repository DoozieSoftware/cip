import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type * as ClientApi from '../../api/client';
import SubmitPage from '../SubmitPage';

const mutateAsyncMock = vi.fn();
const refetchMock = vi.fn();

let reportTypesMock: {
  isLoading: boolean;
  isError: boolean;
  data: ClientApi.ReportType[] | undefined;
  error: unknown;
  refetch: () => unknown;
} = {
  isLoading: false,
  isError: false,
  data: [
    {
      id: 'type-roads',
      code: 'roads',
      name: 'Roads',
      requires_photo: true,
      requires_video: false,
      min_photos: 1,
      max_photos: 5,
    },
  ],
  error: null,
  refetch: refetchMock,
};

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof ClientApi>('../../api/client');
  return {
    ...actual,
    useReportTypes: vi.fn(() => reportTypesMock),
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

vi.mock('../../../shared/geo/useReverseGeocode', () => ({
  useReverseGeocode: () => '',
}));

function renderSubmitPage(): void {
  render(
    <MemoryRouter>
      <SubmitPage />
    </MemoryRouter>,
  );
}

describe('SubmitPage report types states', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue({ id: 'report-1', status: 'submitted' });
    refetchMock.mockReset();
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
    reportTypesMock = {
      isLoading: false,
      isError: false,
      data: [
        {
          id: 'type-roads',
          code: 'roads',
          name: 'Roads',
          requires_photo: true,
          requires_video: false,
          min_photos: 1,
          max_photos: 5,
        },
      ],
      error: null,
      refetch: refetchMock,
    };
  });

  it('shows a distinct loading state while fetching report types', () => {
    reportTypesMock = {
      isLoading: true,
      isError: false,
      data: undefined,
      error: null,
      refetch: refetchMock,
    };

    renderSubmitPage();

    expect(screen.getByText(/loading complaint categories/i)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('renders the error state when report types fail to load', () => {
    reportTypesMock = {
      isLoading: false,
      isError: true,
      data: undefined,
      error: new Error('Network request failed'),
      refetch: refetchMock,
    };

    renderSubmitPage();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/could not load categories/i);
    expect(alert).toHaveTextContent(/network request failed/i);
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('calls refetch when the retry button is clicked after an error', () => {
    reportTypesMock = {
      isLoading: false,
      isError: true,
      data: undefined,
      error: new Error('Network request failed'),
      refetch: refetchMock,
    };

    renderSubmitPage();

    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it('renders a distinct empty state when no categories are available', () => {
    reportTypesMock = {
      isLoading: false,
      isError: false,
      data: [],
      error: null,
      refetch: refetchMock,
    };

    renderSubmitPage();

    expect(screen.getByText(/no categories available/i)).toBeInTheDocument();
    expect(screen.getByText(/no active complaint categories are available/i)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('calls refetch when the refresh button is clicked on empty state', () => {
    reportTypesMock = {
      isLoading: false,
      isError: false,
      data: [],
      error: null,
      refetch: refetchMock,
    };

    renderSubmitPage();

    const refreshButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(refreshButton);

    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not show loading, error, or empty states when data is present', () => {
    reportTypesMock = {
      isLoading: false,
      isError: false,
      data: [
        {
          id: 'type-roads',
          code: 'roads',
          name: 'Roads',
          requires_photo: true,
          requires_video: false,
          min_photos: 1,
          max_photos: 5,
        },
      ],
      error: null,
      refetch: refetchMock,
    };

    renderSubmitPage();

    expect(screen.queryByText(/loading categories/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/no categories available/i)).not.toBeInTheDocument();
    expect(screen.getByText('Roads')).toBeInTheDocument();
  });
});
