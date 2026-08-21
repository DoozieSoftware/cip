import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthContext';
import { writeSession } from '../../auth/storage';
import { PushLoginApprovalPage } from '../PushLoginApprovalPage';

const apiRequestMock = vi.fn();

vi.mock('../../auth/api', () => ({
  apiRequest: (...args: unknown[]): Promise<unknown> => apiRequestMock(...args) as Promise<unknown>,
  ApiError: class ApiError extends Error {},
}));

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/login/push/challenge-1#' + 'a'.repeat(64)]}>
      <AuthProvider>
        <Routes>
          <Route path="/login/push/:challenge" element={<PushLoginApprovalPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('PushLoginApprovalPage', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    writeSession({
      token: 'trusted-token',
      user: { id: 'user-1', mobile: '9999900001', roles: ['citizen'] },
    });
  });

  it('allows the trusted signed-in device to approve the request', async () => {
    apiRequestMock.mockResolvedValue({ data: { status: 'approved' } });
    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith('/auth/push-login/challenge-1/approve', {
        method: 'POST',
        body: { approval_secret: 'a'.repeat(64) },
      });
      expect(screen.getByText('Sign-in approved')).toBeTruthy();
    });
  });
});
