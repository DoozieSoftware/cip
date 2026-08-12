import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// tests live at <root>/src/portals/admin/pages/__tests__/, so <root>/src is 4 levels up.
const srcRoot = resolve(here, '../../../../');

const MAPPED_HEX = [
  '#1d1d1b', '#85847f', '#6f6e69', '#777670', '#4f4e4a', '#a8a7a1',
  '#d0cec8', '#d9d7d0', '#e4e2dc', '#aaa9a4', '#efeee9', '#f3f2ed',
  '#a42f29', '#9f3731', '#8a2621', '#226b46', '#256b45', '#1b5738', '#1d4ed8',
];

describe('design-token migration in portals (MAINT-02)', () => {
  it('AdminUsers uses CSS variables and is free of mapped hard-coded hex', () => {
    const src = readFileSync(
      resolve(srcRoot, 'portals/admin/pages/AdminUsers.tsx'),
      'utf8',
    );
    for (const hex of MAPPED_HEX) {
      expect(src, `AdminUsers.tsx should not contain hard-coded ${hex}`).not.toContain(hex);
    }
    expect(src).toContain('var(--color-ink)');
    expect(src).toContain('var(--color-border)');
    expect(src).toContain('var(--color-text-secondary)');
  });

  it('CitizenLayout uses CSS variables instead of mapped hard-coded hex', () => {
    const src = readFileSync(
      resolve(srcRoot, 'portals/citizen/layout/CitizenLayout.tsx'),
      'utf8',
    );
    for (const hex of ['#1d1d1b', '#6f6e69', '#d0cec8', '#f3f2ed']) {
      expect(src).not.toContain(hex);
    }
    expect(src).toContain('var(--color-ink)');
  });

  it('AdminReports migrated its most frequent mapped hex to variables', () => {
    const src = readFileSync(
      resolve(srcRoot, 'portals/admin/pages/AdminReports.tsx'),
      'utf8',
    );
    for (const hex of MAPPED_HEX) {
      expect(src).not.toContain(hex);
    }
    expect(src).toContain('var(--color-ink)');
  });
});
