import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ApiEnvelope } from '../../../auth/api';
import type { StaffProfileData } from '../StaffProfilePage';

const mockAuthContext = { updateUser: vi.fn() };

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => mockAuthContext,
}));

vi.mock('../../../auth/api', () => ({
  apiRequest: vi.fn(),
  ApiEnvelope: {},
}));

const { apiRequest } = await import('../../../auth/api');
const StaffProfilePage = (await import('../StaffProfilePage')).default;

const staffProfile: StaffProfileData = {
  id: 's-1',
  name: 'Ravi Kumar',
  preferred_name: 'Priya Rao',
  mobile: '9999900006',
  email: 'ravi.kumar@example.com',
  status: 'active',
  last_login_at: '2026-07-02T09:30:00+05:30',
  created_at: '2024-01-15T10:00:00+05:30',
  roles: ['department_officer', 'department_manager'],
  departments: [
    { id: 'd-1', code: 'BESCOM', name: 'Bengaluru Electricity Supply Company', is_manager: true },
    { id: 'd-2', code: 'BTP', name: 'Bengaluru Traffic Police', is_manager: false },
  ],
};

const envelopeFor = (data: StaffProfileData | null): ApiEnvelope<StaffProfileData | null> => ({
  success: true,
  message: 'ok',
  data,
});

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <StaffProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('StaffProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiRequest).mockResolvedValue(envelopeFor(staffProfile));
  });

  it('shows a loading spinner while the profile query is pending', () => {
    vi.mocked(apiRequest).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: 'Loading profile' })).toBeInTheDocument();
  });

  it('shows the error state with a retry action when the profile query fails', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Network error'));
    renderPage();
    expect(await screen.findByText("Couldn't load profile")).toBeInTheDocument();
    expect(
      screen.getByText('Your profile could not be loaded. Try again, or sign out and back in.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('retries the profile query when the retry action is clicked', async () => {
    vi.mocked(apiRequest)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(envelopeFor(staffProfile));
    renderPage();
    const retryButton = await screen.findByRole('button', { name: 'Try again' });
    fireEvent.click(retryButton);
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
  });

  it('shows the empty state when no profile data is returned', async () => {
    vi.mocked(apiRequest).mockResolvedValue(envelopeFor(null));
    renderPage();
    expect(await screen.findByText('No profile data')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your account returned no profile information. Contact your administrator if this persists.',
      ),
    ).toBeInTheDocument();
  });

  it('prefills the editable name and mobile fields from the profile', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Profile' });

    expect(screen.getByLabelText('Name')).toHaveValue('Ravi Kumar');
    expect(screen.getByLabelText('Mobile number')).toHaveValue('9999900006');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('saves updated name and mobile with a trimmed payload', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce(envelopeFor(staffProfile))
      .mockResolvedValueOnce(envelopeFor({ ...staffProfile, name: 'Ravi', mobile: '9898989800' }));
    renderPage();
    await screen.findByRole('heading', { name: 'Profile' });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Ravi  ' } });
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: ' 9898989800 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Profile updated.')).toBeInTheDocument();
    expect(vi.mocked(apiRequest)).toHaveBeenCalledWith('/auth/profile', {
      method: 'PATCH',
      body: { name: 'Ravi', mobile: '9898989800' },
    });
    expect(mockAuthContext.updateUser).toHaveBeenCalledWith({
      name: 'Ravi',
      mobile: '9898989800',
    });
  });

  it('shows the save error message when updating the profile fails', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce(envelopeFor(staffProfile))
      .mockRejectedValueOnce(new Error('That mobile number is already in use by another account.'));
    renderPage();
    await screen.findByRole('heading', { name: 'Profile' });

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('That mobile number is already in use by another account.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('already in use');
  });

  it('disables the save button while name or mobile is blank', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Profile' });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ravi' } });
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('renders identity, roles, departments, and account details read-only', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByText('Staff account')).toBeInTheDocument();

    // Identity card: email, preferred name, and account status are read-only rows.
    expect(screen.getByText('Identity')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('ravi.kumar@example.com')).toBeInTheDocument();
    expect(screen.getByText('Preferred name')).toBeInTheDocument();
    expect(screen.getByText('Priya Rao')).toBeInTheDocument();
    expect(screen.getByText('Account status')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Access roles badges are humanised.
    expect(screen.getByText('Access roles')).toBeInTheDocument();
    expect(screen.getByText('Department Officer')).toBeInTheDocument();
    expect(screen.getByText('Department Manager')).toBeInTheDocument();

    // Department memberships: name + code, and Manager badge only for managers.
    expect(screen.getByText('Departments')).toBeInTheDocument();
    expect(screen.getByText('Bengaluru Electricity Supply Company')).toBeInTheDocument();
    expect(screen.getByText('BESCOM')).toBeInTheDocument();
    expect(screen.getByText('Bengaluru Traffic Police')).toBeInTheDocument();
    expect(screen.getByText('BTP')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();

    // Account dates.
    expect(screen.getByText('Member since')).toBeInTheDocument();
    expect(screen.getByText(/2024/)).toBeInTheDocument();
    expect(screen.getByText('Last login')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();

    // Account card explains who manages the rest of the record.
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText(/managed by your organisation/i)).toBeInTheDocument();
  });

  it('exposes only name and mobile as editable fields', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Profile' });

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile number')).toBeInTheDocument();

    // Email and identity fields are display-only — no inputs or selects.
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Language/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Notification channel/i)).not.toBeInTheDocument();
  });
});
