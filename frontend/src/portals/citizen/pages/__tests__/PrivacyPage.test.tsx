import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PrivacyPage from '../PrivacyPage';

describe('PrivacyPage', () => {
  it('renders the page title', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Privacy policy')).toBeTruthy();
  });

  it('renders placeholder text', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/This page is a placeholder/)).toBeTruthy();
  });
});
