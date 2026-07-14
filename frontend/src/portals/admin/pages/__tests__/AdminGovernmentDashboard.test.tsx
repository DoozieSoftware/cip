import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../auth/api', () => ({
  apiRequest: vi.fn(() => Promise.resolve({ success: true, data: [], meta: { total: 2 } })),
}));

vi.mock('../../api/client', () => ({
  usePlatformHealth: vi.fn(() => ({ data: { status: 'ok', checked_at: '2026-07-14T12:00:00Z', components: { database: { status: 'ok', latency_ms: 2, detail: 'Connected', checked_at: '2026-07-14T12:00:00Z' } } } })),
  useSchedulerJobs: vi.fn(() => ({ data: [{ id: 'sla', command: 'sla', expression: '*/5 * * * *', paused: false }] })),
  useAuditLogs: vi.fn(() => ({ data: [{ id: 'a1', action: 'admin.update', entity: 'settings', roles: ['super_admin'], created_at: '2026-07-14T12:00:00Z' }] })),
  useIntegrations: vi.fn(() => ({ data: [] })),
  useAiProviders: vi.fn(() => ({ data: [{ id: 'p1', active: true }] })),
}));

const AdminGovernmentDashboard = (await import('../AdminGovernmentDashboard')).default;

describe('AdminGovernmentDashboard', () => {
  it('renders a formal operational administration summary', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AdminGovernmentDashboard /></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByRole('heading', { name: 'Administration dashboard' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'System components' })).toBeTruthy();
    expect(screen.getByText('Government of Karnataka', { exact: false })).toBeTruthy();
    expect(screen.queryByText('Control plane')).toBeNull();
  });
});
