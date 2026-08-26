import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import TextileRequestPage from '../TextileRequestPage';
import TextileCollectionDetailPage from '../TextileCollectionDetailPage';
import type { TextileCollectionRequest } from '../../api/textileZones';

// ── Mock the textileZones API module ──────────────────────────────────────────
const mockCreate = vi.fn();
const mockUploadPhoto = vi.fn();
const mockCollectionData = vi.fn<() => TextileCollectionRequest | null>();

vi.mock('../../api/textileZones', () => ({
  useCreateTextileCollection: () => ({
    mutateAsync: mockCreate,
    isPending: false,
    error: null,
  }),
  useCitizenTextileCollection: () => ({
    data: mockCollectionData(),
    isLoading: false,
    isError: false,
  }),
  useCancelTextileCollection: () => ({
    mutateAsync: vi.fn(),
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

  it('shows a file input with image accept and capture attributes', () => {
    const input = screen.getByLabelText('Choose photo');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(input).toHaveAttribute('capture', 'environment');
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

    fireEvent.click(screen.getByRole('button', { name: /send pickup request/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockUploadPhoto).toHaveBeenCalledWith('new-collection-1', validFile);
    });
  });

  it('still navigates if the photo upload fails', async () => {
    mockUploadPhoto.mockRejectedValueOnce(new Error('Network error'));

    const input = screen.getByLabelText('Choose photo');
    const validFile = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => expect(screen.getByAltText('Preview of your bags')).toBeInTheDocument());

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
  it('defaults to clothes_waste category', () => {
    render(
      <MemoryRouter initialEntries={['/citizen/textile-collections/new']}>
        <Routes>
          <Route path="/citizen/textile-collections/new" element={<TextileRequestPage />} />
          <Route path="/citizen/textile-collections/:id" element={<div>detail page</div>} />
        </Routes>
      </MemoryRouter>,
      { wrapper: qcWrapper },
    );

    const clothesRadio = screen.getByRole('radio', { name: /clothes & textiles/i });
    expect(clothesRadio).toBeChecked();
  });

  it('allows switching to Metal Scrap', async () => {
    render(
      <MemoryRouter initialEntries={['/citizen/textile-collections/new']}>
        <Routes>
          <Route path="/citizen/textile-collections/new" element={<TextileRequestPage />} />
          <Route path="/citizen/textile-collections/:id" element={<div>detail page</div>} />
        </Routes>
      </MemoryRouter>,
      { wrapper: qcWrapper },
    );

    const metalRadio = screen.getByRole('radio', { name: /metal scrap/i });
    fireEvent.click(metalRadio);

    await waitFor(() => {
      expect(metalRadio).toBeChecked();
    });
    expect(screen.getByRole('radio', { name: /clothes & textiles/i })).not.toBeChecked();
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
});
