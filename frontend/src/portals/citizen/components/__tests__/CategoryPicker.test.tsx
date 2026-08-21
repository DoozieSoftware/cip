import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CategoryPicker, type CategoryPickerProps } from '../CategoryPicker';
import type { ReportType } from '../../types';

type TestReportType = ReportType & {
  sort_order?: number;
  localizations?: Record<string, string>;
  aliases?: string[];
};

const baseTypes: TestReportType[] = [
  {
    id: 't1',
    code: 'roads',
    name: 'Roads',
    requires_photo: true,
    requires_video: false,
    min_photos: 1,
    max_photos: 5,
    sort_order: 2,
  },
  {
    id: 't2',
    code: 'garbage',
    name: 'Garbage & Dumping',
    requires_photo: true,
    requires_video: false,
    min_photos: 1,
    max_photos: 5,
    sort_order: 1,
  },
  {
    id: 't3',
    code: 'other',
    name: 'Other',
    requires_photo: false,
    requires_video: false,
    min_photos: 0,
    max_photos: 5,
    sort_order: 99,
  },
  {
    id: 't4',
    code: 'electricity',
    name: 'Electricity',
    requires_photo: true,
    requires_video: false,
    min_photos: 1,
    max_photos: 5,
    sort_order: 3,
  },
];

const localizedTypes: TestReportType[] = [
  {
    id: 't1',
    code: 'roads',
    name: 'Roads',
    requires_photo: true,
    requires_video: false,
    min_photos: 1,
    max_photos: 5,
    sort_order: 1,
    localizations: { 'kn-IN': 'ರಸ್ತೆಗಳು' },
    aliases: ['pothole', 'street'],
  },
  {
    id: 't2',
    code: 'other',
    name: 'Other',
    requires_photo: false,
    requires_video: false,
    min_photos: 0,
    max_photos: 5,
    sort_order: 99,
    localizations: { 'kn-IN': 'ಇತರೆ' },
    aliases: ['misc'],
  },
];

const wasteStreamTypes: TestReportType[] = [
  {
    id: 'w1',
    code: 'garbage',
    name: 'Garbage & Dumping',
    requires_photo: true,
    requires_video: false,
    min_photos: 1,
    max_photos: 5,
    sort_order: 1,
  },
  {
    id: 'w2',
    code: 'clothes_waste',
    name: 'Clothes & Textiles',
    requires_photo: true,
    requires_video: false,
    min_photos: 1,
    max_photos: 5,
    sort_order: 2,
  },
  {
    id: 'w3',
    code: 'metal_scrap',
    name: 'Metal Scrap',
    requires_photo: true,
    requires_video: false,
    min_photos: 1,
    max_photos: 5,
    sort_order: 3,
  },
  {
    id: 'w4',
    code: 'e_waste',
    name: 'Electronic Waste (E-Waste)',
    requires_photo: true,
    requires_video: false,
    min_photos: 1,
    max_photos: 5,
    sort_order: 4,
  },
];

function renderPicker(props: Partial<CategoryPickerProps> = {}): void {
  render(<CategoryPicker types={baseTypes} selectedId="" onSelect={() => undefined} {...props} />);
}

describe('CategoryPicker', () => {
  it('ranks common categories first and Other last', () => {
    renderPicker();
    const labels = screen.getAllByRole('radio').map((r) => r.getAttribute('value'));
    expect(labels).toEqual(['t2', 't1', 't4', 't3']);
  });

  it('Other always ranks last even with a low sort_order', () => {
    const types: TestReportType[] = [
      {
        id: 't1',
        code: 'roads',
        name: 'Roads',
        requires_photo: true,
        requires_video: false,
        min_photos: 1,
        max_photos: 5,
        sort_order: 5,
      },
      {
        id: 't2',
        code: 'other',
        name: 'Other',
        requires_photo: false,
        requires_video: false,
        min_photos: 0,
        max_photos: 5,
        sort_order: 1,
      },
    ];
    renderPicker({ types });
    const labels = screen.getAllByRole('radio').map((r) => r.getAttribute('value'));
    expect(labels).toEqual(['t1', 't2']);
  });

  it('filters by search query matching name', () => {
    renderPicker();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'elec' } });
    expect(screen.getByText('Electricity')).toBeInTheDocument();
    expect(screen.queryByText('Roads')).toBeNull();
  });

  it('filters by search query matching alias', () => {
    renderPicker({ types: localizedTypes });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'pothole' } });
    expect(screen.getByText('Roads')).toBeInTheDocument();
    expect(screen.queryByText('Other')).toBeNull();
  });

  it('shows empty state when no categories match', () => {
    renderPicker();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzzz' } });
    expect(screen.getByText('No categories match your search.')).toBeInTheDocument();
  });

  it('renders localized label when locale is kn-IN', () => {
    const original = window.localStorage.getItem('cip.locale');
    window.localStorage.setItem('cip.locale', 'kn-IN');
    try {
      renderPicker({ types: localizedTypes });
      expect(screen.getByText('ರಸ್ತೆಗಳು')).toBeInTheDocument();
      expect(screen.getByText('(Roads)')).toBeInTheDocument();
    } finally {
      if (original === null) window.localStorage.removeItem('cip.locale');
      else window.localStorage.setItem('cip.locale', original);
    }
  });

  it('shows Needs manual routing for Other', () => {
    renderPicker();
    expect(screen.getByText(/Needs manual routing/)).toBeInTheDocument();
  });

  it('renders Evidence required vs optional', () => {
    renderPicker();
    expect(screen.getAllByText('Evidence required').length).toBeGreaterThan(0);
    expect(screen.getByText(/Evidence optional/)).toBeInTheDocument();
  });

  it('calls onSelect when a category is clicked', () => {
    const onSelect = vi.fn();
    renderPicker({ onSelect });
    fireEvent.click(screen.getByText('Roads').closest('label') ?? screen.getByText('Roads'));
    expect(onSelect).toHaveBeenCalledWith('t1');
  });

  it('marks the selected category with a check indicator', () => {
    renderPicker({ selectedId: 't1' });
    const radios = screen.getAllByRole('radio');
    const roadsRadio = radios.find((r) => r.getAttribute('value') === 't1');
    expect(roadsRadio?.getAttribute('checked')).toBe('');
  });

  it('renders an icon and label for each new waste-stream category', () => {
    renderPicker({ types: wasteStreamTypes });
    for (const label of ['Clothes & Textiles', 'Metal Scrap', 'Electronic Waste (E-Waste)']) {
      const row = screen.getByText(label).closest('label');
      expect(row).not.toBeNull();
      expect(row?.querySelector('svg')).not.toBeNull();
    }
  });

  it('keeps the generic fallback icon for unknown codes', () => {
    const unknown: TestReportType[] = [
      {
        id: 'u1',
        code: 'mystery_stream',
        name: 'Mystery Stream',
        requires_photo: false,
        requires_video: false,
        min_photos: 0,
        max_photos: 5,
        sort_order: 50,
      },
    ];
    renderPicker({ types: unknown });
    const row = screen.getByText('Mystery Stream').closest('label');
    expect(row?.querySelector('svg')).not.toBeNull();
  });

  it('orders waste-stream categories by sort_order after garbage', () => {
    renderPicker({ types: wasteStreamTypes });
    const order = screen.getAllByRole('radio').map((r) => r.getAttribute('value'));
    expect(order).toEqual(['w1', 'w2', 'w3', 'w4']);
  });
});
