import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const mutateMock = vi.fn();

vi.mock('../../api/client', () => ({
  useAiProviders: vi.fn(),
  useAiPrompts: vi.fn(),
  useTestAiProvider: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useActivateAiProvider: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useApprovePrompt: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useRollbackPrompt: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useCreateAiProvider: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useUpdateAiProvider: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
  useCreatePrompt: vi.fn(() => ({ mutate: mutateMock, isPending: false })),
}));

 
const { useAiProviders, useAiPrompts } = await import('../../api/client');
const AdminAi = (await import('../AdminAi')).default;

const PROVIDERS = [
  { id: 'p1', code: 'mock', name: 'Mock provider', driver: 'mock', model: 'mock-v1', priority: 1, active: true, has_secret: false, created_at: null },
  { id: 'p2', code: 'openai', name: 'OpenAI', driver: 'openai_compatible', model: 'gpt-5-mini', priority: 10, active: false, has_secret: true, created_at: null },
];
const PROMPTS = [
  { id: 'pv1', name: 'classify_image', version: 1, status: 'approved' as const, template: 'You are an image classifier. {{slot}}', variables: ['slot'], description: null },
  { id: 'pv2', name: 'classify_image', version: 2, status: 'draft' as const, template: 'You are an image classifier v2. {{slot}}', variables: ['slot'], description: null },
];

describe('AdminAi (T-M12-021)', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    mutateMock.mockClear();
    (useAiProviders as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: PROVIDERS, isLoading: false });
    (useAiPrompts as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: PROMPTS, isLoading: false });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('renders the page title and the providers tab by default', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminAi /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('AI providers & prompts')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Providers/ })).toBeTruthy();
  });

  it('renders the providers table with Test / Activate buttons', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminAi /></MemoryRouter>
      </QueryClientProvider>,
    );
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Mock provider')).toBeTruthy();
    expect(within(table).getByText('OpenAI')).toBeTruthy();
    expect(within(table).getAllByRole('button', { name: 'Test' }).length).toBe(2);
  });

  it('switches to the prompts tab and shows the prompt versions', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminAi /></MemoryRouter>
      </QueryClientProvider>,
    );
    const promptsTab = await screen.findByRole('button', { name: /Prompts/ });
    fireEvent.click(promptsTab);
    const table = await screen.findByRole('table');
    expect(within(table).getByText('v1')).toBeTruthy();
    expect(within(table).getByText('v2')).toBeTruthy();
    expect(within(table).getByText('approved')).toBeTruthy();
    expect(within(table).getByText('draft')).toBeTruthy();
  });

  it('opens the new-provider form and submits a custom OpenAI-compatible provider (OpenRouter/Modal.com)', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminAi /></MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '+ New provider' }));

    const form = await screen.findByRole('form', { name: 'Provider form' });
    fireEvent.change(within(form).getByLabelText('Code'), { target: { value: 'openrouter' } });
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'OpenRouter' } });
    fireEvent.change(within(form).getByLabelText('Model'), { target: { value: 'openrouter/auto' } });
    fireEvent.change(within(form).getByLabelText('Base URL'), { target: { value: 'https://openrouter.ai/api' } });

    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'openrouter', name: 'OpenRouter', model: 'openrouter/auto', base_url: 'https://openrouter.ai/api' }),
      expect.anything(),
    );
  });

  it('edits an existing provider, pre-filling the form from its current values', async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><AdminAi /></MemoryRouter>
      </QueryClientProvider>,
    );

    const table = await screen.findByRole('table');
    const editButtons = within(table).getAllByRole('button', { name: 'Edit' });
    fireEvent.click(editButtons[0]);

    const form = await screen.findByRole('form', { name: 'Provider form' });
    expect(within(form).getByLabelText<HTMLInputElement>('Code').value).toBe('mock');
    expect(within(form).getByLabelText<HTMLInputElement>('Name').value).toBe('Mock provider');
  });
});
