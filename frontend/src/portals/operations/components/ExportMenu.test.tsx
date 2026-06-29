import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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

  it('triggers a programmatic anchor click for the chosen format', () => {
    const click = vi.fn();
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        el.click = click;
      }
      return el;
    });
    render(<ExportMenu filters={{ status: 'assigned' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const csvItem = screen.getByRole('menuitem', { name: /CSV/i });
    fireEvent.click(csvItem);
    expect(createSpy).toHaveBeenCalledWith('a');
    expect(click).toHaveBeenCalled();
  });
});
