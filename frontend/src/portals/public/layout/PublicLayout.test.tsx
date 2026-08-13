import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PublicLayout } from './PublicLayout';

describe('PublicLayout', () => {
  it('keeps every public section action visible in wrapping navigation', () => {
    render(
      <MemoryRouter initialEntries={['/public']}>
        <PublicLayout />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole('navigation', { name: 'Public portal sections' });
    expect(navigation).toHaveClass('flex-wrap');
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/public');
    expect(screen.getByRole('link', { name: 'Heat map' })).toHaveAttribute(
      'href',
      '/public/heatmap',
    );
    expect(screen.getByRole('link', { name: 'Department performance' })).toHaveAttribute(
      'href',
      '/public/departments',
    );
  });

  it('gives the brand home action an explicit destination', () => {
    render(
      <MemoryRouter>
        <PublicLayout />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Civic Intelligence Platform home' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
