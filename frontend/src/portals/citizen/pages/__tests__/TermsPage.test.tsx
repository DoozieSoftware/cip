import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TermsPage from '../TermsPage';

describe('TermsPage', () => {
  it('renders the page title', () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Terms of use')).toBeTruthy();
  });

  it('renders placeholder text', () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/This page is a placeholder/)).toBeTruthy();
  });
});
