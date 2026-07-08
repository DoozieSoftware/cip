import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ExportMenu } from './ExportMenu';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ExportMenu (T-M11-021)', () => {
  it('renders the trigger button', () => {
    render(<ExportMenu filters={{ status: 'assigned' }} />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('opens a menu with three format options on click', () => {
    render(<ExportMenu filters={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
    expect(screen.getByText(/CSV/i)).toBeInTheDocument();
    expect(screen.getByText(/XLSX/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF/i)).toBeInTheDocument();
  });

  it('fetches the export with an auth header and triggers a blob download', async () => {
    const click = vi.fn();
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        el.click = click;
      }
      return el;
    });
    // A plain <a href> navigation can't attach the bearer Authorization
    // header this API requires — the download must go through fetch()
    // like every other authenticated request, not a direct URL visit.
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(new Blob(['tracking,title\n'], { type: 'text/csv' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();

    render(<ExportMenu filters={{ status: 'assigned' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const csvItem = screen.getByRole('menuitem', { name: /CSV/i });
    fireEvent.click(csvItem);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/department/reports/export');
    expect(String(url)).toContain('format=csv');
    await waitFor(() => expect(createSpy).toHaveBeenCalledWith('a'));
    await waitFor(() => expect(click).toHaveBeenCalled());
  });
});
