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
    expect(screen.getByRole('button', { name: 'Send code' })).toBeTruthy();
    expect(screen.getByText('Citizen')).toBeTruthy();
    expect(screen.getByText('Super Admin')).toBeTruthy();
  });

  it('submits staff credentials to the password login endpoint', async () => {
    apiRequestMock.mockImplementation((path: string) => {
      if (path === '/auth/login') {
        return Promise.resolve({
          data: {
            token: { access_token: 'staff-token', type: 'Bearer' },
            refresh_token: 'refresh',
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

  it('shows the server error when staff password login fails', async () => {
    const { ApiError } = await import('../../auth/api');
    apiRequestMock.mockImplementation(() =>
      Promise.reject(new ApiError(401, 'UNAUTHORIZED', 'Invalid mobile or password.', null)),
    );

    renderLoginPage();
    fireEvent.click(screen.getByRole('button', { name: 'Staff password login' }));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid mobile or password.')).toBeTruthy();
    });
  });

  it('highlights the selected demo account card when clicked', () => {
    renderLoginPage();

    const officerCard = screen.getByRole('button', { name: /Department Officer/i });
    expect(officerCard).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(officerCard);

    expect(officerCard).toHaveAttribute('aria-pressed', 'true');
  });

  it('sends OTP and shows the verify stage', async () => {
    apiRequestMock.mockImplementation((path: string) => {
      if (path === '/auth/send-otp') {
        return Promise.resolve({ data: { debug_otp: '123456' } });
      }
      if (path === '/auth/verify-otp') {
        return Promise.resolve({
          data: {
            token: { access_token: 'token', type: 'Bearer' },
            refresh_token: 'refresh',
            refresh_expires_at: '2026-01-01T00:00:00Z',
            user: { id: 'u1', mobile: '9999900001', roles: ['citizen'] },
          },
        });
      }
      if (path === '/auth/me') {
        return Promise.resolve({ data: { id: 'u1', roles: ['citizen'] } });
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    renderLoginPage();

    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9999900001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith('/auth/send-otp', {
        method: 'POST',
        body: { mobile: '9999900001' },
      });
    });

    expect(screen.getByRole('button', { name: /verify and continue/i })).toBeTruthy();
  });

  it('shows error message when OTP request fails', async () => {
    const { ApiError } = await import('../../auth/api');
    apiRequestMock.mockImplementation(() =>
      Promise.reject(new ApiError(400, 'BAD_REQUEST', 'Failed to send OTP', null)),
    );

    renderLoginPage();
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9999900001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to send OTP')).toBeTruthy();
    });
  });

  it('requests trusted-device approval without changing the OTP flow', async () => {
    apiRequestMock.mockImplementation((path: string) => {
      if (path === '/auth/push-login') {
        return Promise.resolve({
          data: {
            challenge_id: 'challenge-1',
            request_secret: 'a'.repeat(64),
            expires_at: '2026-08-21T12:00:00Z',
          },
        });
      }
      if (path.includes('/exchange')) {
        return new Promise(() => undefined);
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    renderLoginPage();
    fireEvent.click(screen.getByRole('button', { name: 'Push approval' }));
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9999900001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send approval request' }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith('/auth/push-login', {
        method: 'POST',
        body: { mobile: '9999900001' },
      });
      expect(screen.getByText('Waiting for approval')).toBeTruthy();
    });
  });
});
