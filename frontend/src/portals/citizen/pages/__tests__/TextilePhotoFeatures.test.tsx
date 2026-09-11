import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import TextileRequestPage from '../TextileRequestPage';
import { ApiError } from '../../../../shared/api/errors';
import TextileCollectionDetailPage from '../TextileCollectionDetailPage';
import type { TextileCollectionRequest } from '../../api/textileZones';
import type * as TextileZonesApi from '../../api/textileZones';

// ── Mock the textileZones API module ──────────────────────────────────────────
const mockCreate = vi.fn();
const mockUploadPhoto = vi.fn();
const mockCancel = vi.fn();
const mockCollectionData = vi.fn<() => TextileCollectionRequest | null>();

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));

vi.mock('../../api/textileZones', async (importOriginal) => ({
  ...(await importOriginal<typeof TextileZonesApi>()),
  useRescheduleTextileCollection: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  useUpdateTextileInstructions: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  useTextileAvailability: () => ({
    data: { unavailable_dates: [], next_available_date: null },
    isLoading: false,
    isError: false,
  }),
  useTextileCapacityMinimum: () => ({ data: null, isLoading: false, isError: false }),
  useCreateTextileCollection: () => ({
    mutateAsync: mockCreate,
    isPending: false,
    error: null,
  }),
  useCitizenTextileCollection: () => ({
    data: mockCollectionData(),
    refetch: vi.fn(),
    isLoading: false,
    isError: false,
  }),
  useCancelTextileCollection: () => ({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock passthrough
    mutateAsync: (...args: unknown[]) => mockCancel(...args),
    isPending: false,
  }),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock passthrough
  uploadTextileCollectionPhoto: (...args: unknown[]) => mockUploadPhoto(...args),
  useTextileServiceZones: (_category: string) => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
}));

// ── Mock CameraCapture: jsdom has no getUserMedia ─────────────────────────
vi.mock('../../components/CameraCapture', () => ({
  CameraCapture: ({ onCapture }: { onCapture: (file: File) => void }) => (
    <div data-testid="camera-capture">
      <button
        type="button"
        onClick={() =>
          onCapture(new File([new ArrayBuffer(64)], 'shot.jpg', { type: 'image/jpeg' }))
        }
      >
        stub capture
      </button>
    </div>
  ),
}));

// ── Mock TextileCollectionFields to avoid its internal zone loading ──────────
vi.mock('../../components/TextileCollectionFields', () => ({
  TextileCollectionFields: ({
    category,
    onValidityChange,
    onChange,
  }: {
    category: string;
    onValidityChange: (v: boolean) => void;
    onChange: (v: unknown) => void;
  }) => {
    useEffect(() => {
      onValidityChange(true);
      onChange({
        service_zone_id: 'zone-1',
        category,
        requester_type: 'individual',
        requester_name: 'Test User',
        rwa_name: null,
        contact_email: 'test@example.com',
        contact_phone: '9999900001',
        pickup_address: '123 Test Street',
        collection_method: 'premises',
        estimated_bags: 3,
        estimated_weight_kg: null,
      });
    }, [category, onValidityChange, onChange]);
    return <div data-testid="textile-collection-fields">fields</div>;
  },
}));

// ── Shared helpers ───────────────────────────────────────────────────────────
function qcWrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const BASE_COLLECTION: TextileCollectionRequest = {
  id: 'col-1',
  reference: 'TX-001',
  title: 'Clothes pickup',
  status: 'pending_review',
  notes: null,
  pickup_address: '123 Main St',
  collection_method: 'premises',
  category: 'clothes_waste',
  estimated_bags: 2,
  estimated_weight_kg: null,
  scheduled_date: null,
  scheduled_window_start: null,
  scheduled_window_end: null,
  readiness_instructions: null,
  rejection_reason: null,
  cancellation_reason: null,
  missed_pickup_reason: null,
  picked_up_at: null,
  submitted_at: null,
  latitude: null,
  longitude: null,
  actual_bags: null,
  actual_weight_kg: null,
  service_zone: null,
  partner: null,
  batch: null,
  service_zone_id: 'zone-1',
  requester_type: 'individual',
  requester_name: 'Test',
  rwa_name: null,
  contact_email: '',
  contact_phone: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue({ id: 'new-collection-1' });
  mockUploadPhoto.mockResolvedValue({
    photo: { id: 'photo-1', role: 'evidence', url: 'https://example.com/photo.jpg' },
  });
  mockCollectionData.mockReturnValue(null);

  // Mock URL.createObjectURL / revokeObjectURL for preview tests.
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

// ═══════════════════════════════════════════════════════════════════════════════
// TextileRequestPage — photo picker
// ═══════════════════════════════════════════════════════════════════════════════

describe('TextileRequestPage — photo picker', () => {
  beforeEach(() => {
    render(
      <MemoryRouter initialEntries={['/citizen/textile-collections/new']}>
        <Routes>
          <Route path="/citizen/textile-collections/new" element={<TextileRequestPage />} />
          <Route path="/citizen/textile-collections/:id" element={<div>detail page</div>} />
        </Routes>
      </MemoryRouter>,
      { wrapper: qcWrapper },
    );
  });

  it('keeps "Choose photo" as a plain file picker', () => {
    const fileInput = screen.getByLabelText('Choose photo');
    expect(fileInput).toHaveAttribute('accept', 'image/*');
    expect(fileInput).not.toHaveAttribute('capture');
  });

  // Regression: "Take photo" used to be a hidden file input with
  // capture="environment", which only opens a camera on some mobile browsers.
  // It is now a button that mounts the getUserMedia CameraCapture component.
  it('opens the live camera from "Take photo" instead of a capture input', () => {
    expect(screen.queryByTestId('camera-capture')).not.toBeInTheDocument();
    // The legacy capture input must be gone, not merely hidden.
    expect(screen.queryByLabelText('Take photo')).not.toBeInstanceOf(HTMLInputElement);

    fireEvent.click(screen.getByRole('button', { name: /take photo/i }));

    expect(screen.getByTestId('camera-capture')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /take photo/i })).not.toBeInTheDocument();
  });

  it('accepts a camera shot and closes the camera', () => {
    fireEvent.click(screen.getByRole('button', { name: /take photo/i }));
    fireEvent.click(screen.getByRole('button', { name: /stub capture/i }));

    expect(screen.queryByTestId('camera-capture')).not.toBeInTheDocument();
    expect(screen.getByAltText('Preview of your bags')).toBeInTheDocument();
  });

  it('closes the camera on cancel without selecting a photo', () => {
    fireEvent.click(screen.getByRole('button', { name: /take photo/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByTestId('camera-capture')).not.toBeInTheDocument();
    expect(screen.queryByAltText('Preview of your bags')).not.toBeInTheDocument();
  });

  it('rejects files larger than 10 MB', async () => {
    const input = screen.getByLabelText('Choose photo');
    const bigFile = new File([new ArrayBuffer(10.5 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(input, { target: { files: [bigFile] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Photo must be 10 MB or smaller');
    });
  });

  it('rejects non-image files', async () => {
    const input = screen.getByLabelText('Choose photo');
    const textFile = new File(['hello'], 'readme.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [textFile] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Please select a JPEG, PNG, or WebP image.',
      );
    });
  });

  it('shows a preview and allows removing a valid photo', async () => {
    const input = screen.getByLabelText('Choose photo');
    const validFile = new File(['data'], 'bags.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.getByAltText('Preview of your bags')).toBeInTheDocument();
    });
    expect(screen.getByText('bags.jpg')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Remove photo'));
    await waitFor(() => {
      expect(screen.queryByAltText('Preview of your bags')).not.toBeInTheDocument();
    });
  });

  it('creates the request, uploads the photo, then navigates', async () => {
    const input = screen.getByLabelText('Choose photo');
    const validFile = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => expect(screen.getByAltText('Preview of your bags')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Short title for your request'), {
      target: { value: 'Test pickup request' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send pickup request/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockUploadPhoto).toHaveBeenCalledWith('new-collection-1', validFile);
    });
  });

  it('shows a recoverable warning if the photo upload is rejected', async () => {
    mockUploadPhoto.mockRejectedValueOnce(
      new ApiError(422, 'VALIDATION_FAILED', 'Photo was rejected', {}),
    );

    const input = screen.getByLabelText('Choose photo');
    const validFile = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => expect(screen.getByAltText('Preview of your bags')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Short title for your request'), {
      target: { value: 'Test pickup request' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send pickup request/i }));

    await waitFor(() => {
      expect(mockUploadPhoto).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/photo could not be uploaded/)).toBeInTheDocument();
    });
  });

  it('shows Uploading photo… while the upload is in progress', async () => {
    let resolveUpload!: (v: unknown) => void;
    mockUploadPhoto.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const input = screen.getByLabelText('Choose photo');
    const validFile = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => expect(screen.getByAltText('Preview of your bags')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Short title for your request'), {
      target: { value: 'Test pickup request' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send pickup request/i }));

    await waitFor(() => {
      expect(screen.getByText('Uploading photo…')).toBeInTheDocument();
    });

    resolveUpload({ photo: { id: '1', role: 'evidence', url: 'x' } });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TextileRequestPage — category picker & partner hint
// ═══════════════════════════════════════════════════════════════════════════════

describe('TextileRequestPage — category picker', () => {
  it('locks to clothes_waste category (other materials hidden)', () => {
    render(
      <MemoryRouter initialEntries={['/citizen/textile-collections/new']}>
        <Routes>
          <Route path="/citizen/textile-collections/new" element={<TextileRequestPage />} />
          <Route path="/citizen/textile-collections/:id" element={<div>detail page</div>} />
        </Routes>
      </MemoryRouter>,
      { wrapper: qcWrapper },
    );

    expect(screen.getByText('Clothes & Textiles')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /metal scrap/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /clothes & textiles/i })).not.toBeInTheDocument();
  });

  it('submits payload with category on send', async () => {
    render(
      <MemoryRouter initialEntries={['/citizen/textile-collections/new']}>
        <Routes>
          <Route path="/citizen/textile-collections/new" element={<TextileRequestPage />} />
          <Route path="/citizen/textile-collections/:id" element={<div>detail page</div>} />
        </Routes>
      </MemoryRouter>,
      { wrapper: qcWrapper },
    );

    fireEvent.change(screen.getByLabelText('Short title for your request'), {
      target: { value: 'Test pickup request' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send pickup request/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    const payload = mockCreate.mock.calls[0][0] as { category: string };
    expect(payload.category).toBe('clothes_waste');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TextileCollectionDetailPage — photo trust view
// ═══════════════════════════════════════════════════════════════════════════════

describe('TextileCollectionDetailPage — photo trust view', () => {
  function renderDetail() {
    return render(
      <MemoryRouter initialEntries={['/citizen/textile-collections/col-1']}>
        <Routes>
          <Route
            path="/citizen/textile-collections/:id"
            element={<TextileCollectionDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
      { wrapper: qcWrapper },
    );
  }

  it('renders both "Your photo" and "Collection proof" cards when both photos exist', () => {
    mockCollectionData.mockReturnValue({
      ...BASE_COLLECTION,
      status: 'picked_up',
      photos: [
        { id: 'p1', role: 'evidence', url: 'https://example.com/evidence.jpg' },
        { id: 'p2', role: 'proof', url: 'https://example.com/proof.jpg' },
      ],
    });

    renderDetail();

    expect(screen.getByText('Your photo')).toBeInTheDocument();
    expect(screen.getByText('Collection proof')).toBeInTheDocument();
    expect(screen.getByAltText('Photo of your bags')).toHaveAttribute(
      'src',
      'https://example.com/evidence.jpg',
    );
    expect(screen.getByAltText('Crew collection proof')).toHaveAttribute(
      'src',
      'https://example.com/proof.jpg',
    );
  });

  it('shows the "proof will appear here" note when only evidence photo exists', () => {
    mockCollectionData.mockReturnValue({
      ...BASE_COLLECTION,
      status: 'scheduled',
      photos: [{ id: 'p1', role: 'evidence', url: 'https://example.com/evidence.jpg' }],
    });

    renderDetail();

    expect(screen.getByText('Your photo')).toBeInTheDocument();
    expect(screen.getByText(/Collection proof will appear here after pickup/)).toBeInTheDocument();
    expect(screen.queryByAltText('Crew collection proof')).not.toBeInTheDocument();
  });

  it('renders no photo section when photos array is empty', () => {
    mockCollectionData.mockReturnValue({
      ...BASE_COLLECTION,
      photos: [],
    });

    renderDetail();

    expect(screen.queryByText('Your photo')).not.toBeInTheDocument();
    expect(screen.queryByText('Collection proof')).not.toBeInTheDocument();
  });

  // Regression: "Replace photo" was a bare <label> styled as 12px grey text
  // whose only affordance was hover:underline, so on touch devices it read as
  // a caption and it was unreachable by keyboard. It must be a real button.
  it('exposes "Replace photo" as a focusable button, not bare text', () => {
    mockCollectionData.mockReturnValue({
      ...BASE_COLLECTION,
      status: 'scheduled',
      photos: [{ id: 'p1', role: 'evidence', url: 'https://example.com/evidence.jpg' }],
    });

    renderDetail();

    const button = screen.getByRole('button', { name: /replace photo/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it('opens the file picker from the button without adding a second tab stop', () => {
    mockCollectionData.mockReturnValue({
      ...BASE_COLLECTION,
      status: 'scheduled',
      photos: [{ id: 'p1', role: 'evidence', url: 'https://example.com/evidence.jpg' }],
    });

    renderDetail();

    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    // The visible button drives the picker, so the input stays out of the tab
    // order and out of the accessibility tree.
    expect(input).toHaveAttribute('tabindex', '-1');

    const clickSpy = vi.spyOn(input as HTMLInputElement, 'click');
    fireEvent.click(screen.getByRole('button', { name: /replace photo/i }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  // Regression: the cancel entry point was bare red text (no border, padding or
  // icon) inside an empty card, so it read as a caption rather than an action.
  it('presents cancellation as a button that opens a reason form', () => {
    mockCollectionData.mockReturnValue({ ...BASE_COLLECTION, status: 'scheduled', photos: [] });

    renderDetail();

    const trigger = screen.getByRole('button', { name: /cancel this pickup request/i });
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm cancellation/i })).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(screen.getByLabelText(/why are you cancelling/i)).toBeInTheDocument();
  });

  it('requires a reason before the cancellation can be confirmed', () => {
    mockCollectionData.mockReturnValue({ ...BASE_COLLECTION, status: 'scheduled', photos: [] });

    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: /cancel this pickup request/i }));

    const confirm = screen.getByRole('button', { name: /confirm cancellation/i });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/why are you cancelling/i), {
      target: { value: 'Bags already donated myself' },
    });
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    expect(mockCancel).toHaveBeenCalledWith('Bags already donated myself');
  });

  it('hides the cancel action once the collection has been picked up', () => {
    mockCollectionData.mockReturnValue({ ...BASE_COLLECTION, status: 'picked_up', photos: [] });

    renderDetail();

    expect(
      screen.queryByRole('button', { name: /cancel this pickup request/i }),
    ).not.toBeInTheDocument();
  });

  // Regression (#28): the detail page ignored the booking's chosen centre and
  // showed the zone legacy default (a demo placeholder in prod).
  it('prefers the chosen drop-off centre over the zone default', () => {
    mockCollectionData.mockReturnValue({
      ...BASE_COLLECTION,
      collection_method: 'dropoff',
      pickup_address: null as unknown as string,
      status: 'pending_review',
      photos: [],
      dropoff_centre: {
        id: 'c1',
        name: 'Kengeri Satellite Town centre',
        address: 'Kengeri Main Road',
      },
      service_zone: {
        id: 'zone-1',
        code: 'DRL-K',
        name: 'Kengeri',
        dropoff_name: 'Dr. Linen Kengeri collection point',
        dropoff_address: 'Demo collection point',
        center: null,
      },
    });

    renderDetail();

    expect(screen.getByText('Kengeri Satellite Town centre')).toBeVisible();
    expect(screen.getByText('Kengeri Main Road')).toBeVisible();
    expect(screen.queryByText('Dr. Linen Kengeri collection point')).not.toBeInTheDocument();
    expect(screen.queryByText('Demo collection point')).not.toBeInTheDocument();
  });

  // Regression (prod crash): new drop-off rows return pickup_address null
  // since the #16 nullable migration, and the page crashed with "Cannot read
  // properties of null (reading 'trim')". The cast reproduces the runtime
  // shape the API actually returns.
  it('renders a drop-off with null pickup address without crashing', () => {
    mockCollectionData.mockReturnValue({
      ...BASE_COLLECTION,
      collection_method: 'dropoff',
      pickup_address: null as unknown as string,
      status: 'pending_review',
      photos: [],
    });

    renderDetail();

    expect(screen.getAllByText('Drop at center').length).toBeGreaterThan(0);
    expect(screen.queryByText('Pickup address')).not.toBeInTheDocument();
    expect(screen.queryByText('Your address')).not.toBeInTheDocument();
  });
});
