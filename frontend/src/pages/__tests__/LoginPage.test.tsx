import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthContext';
import { LoginPage } from '../LoginPage';

const apiRequestMock = vi.fn();

vi.mock('../../auth/api', () => ({
  apiRequest: (...args: unknown[]): Promise<unknown> => apiRequestMock(...args) as Promise<unknown>,
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    details: unknown;
    constructor(status: number, code: string, message: string, details: unknown = null) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = details;
    }
  },
}));

function renderLoginPage(): void {
  render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it('defaults to OTP mode with the demo accounts visible', () => {
    renderLoginPage();

    expect(screen.getByRole('button', { name: 'Sign in with OTP' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Staff password login' })).toBeTruthy();
    expect(screen.getByLabelText('Mobile number')).toBeTruthy();
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(screen.getByText('Super Admin')).toBeTruthy();
  });

  it('highlights the selected demo account card when clicked', () => {
    renderLoginPage();

    const officerCard = screen.getByRole('button', { name: /Department Officer/i });
    expect(officerCard).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(officerCard);

    expect(officerCard).toHaveAttribute('aria-pressed', 'true');
    expect(officerCard.className).toContain('border-brand-500');
    expect(officerCard.className).toContain('ring-2');
    expect(screen.getByText('Selected')).toBeTruthy();
  });

  it('switches to the staff password form and submits mobile + password to /auth/login', async () => {
    apiRequestMock.mockImplementation((path: string) => {
      if (path === '/auth/login') {
        return Promise.resolve({
          data: {
            token: { access_token: 'staff-token', type: 'Bearer' },
            refresh_token: 'refresh-abc',
            refresh_expires_at: '2026-01-01T00:00:00Z',
            user: { id: 'u1', mobile: '9999900002', roles: ['moderator'] },
          },
        });
      }
      if (path === '/auth/me') {
        return Promise.resolve({ data: { id: 'u1', roles: ['moderator'] } });
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: 'Staff password login' }));

    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9999900002' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Correct-Horse9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        body: { mobile: '9999900002', password: 'Correct-Horse9' },
      });
    });
  });

  it('shows the server error message when staff login fails', async () => {
    const { ApiError } = await import('../../auth/api');
    apiRequestMock.mockImplementation(() => Promise.reject(new ApiError(401, 'UNAUTHORIZED', 'Invalid mobile or password.', null)));

    renderLoginPage();
    fireEvent.click(screen.getByRole('button', { name: 'Staff password login' }));
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9999900002' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid mobile or password.')).toBeTruthy();
    });
  });
});
