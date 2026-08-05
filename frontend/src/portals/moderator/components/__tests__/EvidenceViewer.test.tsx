import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EvidenceViewer } from '../EvidenceViewer';

describe('EvidenceViewer', () => {
  it('opens an image in a full-size dialog and closes it with Escape', () => {
    render(
      <EvidenceViewer
        media={[
          {
            id: 'media-1',
            mime_type: 'image/png',
            url: 'https://example.test/evidence.png',
            width: 632,
            height: 826,
            duration_seconds: null,
            captured_at: null,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View evidence image 1 full size' }));

    expect(screen.getByRole('dialog', { name: 'Evidence preview' })).toBeTruthy();
    expect(screen.getByAltText('Report evidence full-size preview')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Evidence preview' })).toBeNull();
  });
});
