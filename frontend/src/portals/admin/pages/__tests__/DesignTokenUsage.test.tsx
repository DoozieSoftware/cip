import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// tests live at <root>/src/portals/admin/pages/__tests__/, so <root>/src is 4 levels up.
const srcRoot = resolve(here, '../../../../');

/**
 * Hex values that tokens.css defines exactly. Once a token exists for a colour,
 * portal code must reference the variable so a theme change stays a one-file edit.
 */
const TOKENISED_HEXES: Record<string, string> = {
  '#1d1d1b': '--color-ink',
  '#4f4e4a': '--color-ink-soft',
  '#6f6e69': '--color-text-secondary',
  '#85847f': '--color-text-tertiary',
  '#777670': '--color-text-subtle',
  '#d0cec8': '--color-border',
  '#aaa9a4': '--color-border-strong',
  '#e4e2dc': '--color-border-subtle',
  '#d9d7d0': '--color-border-faint',
  '#f3f2ed': '--color-canvas',
  '#efeee9': '--color-surface-alt',
  '#226b46': '--color-success',
  '#a42f29': '--color-danger',
  '#8a2621': '--color-danger-hover',
};

const PORTALS = ['citizen', 'operations', 'admin', 'public'];

async function collectTsxFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collectTsxFiles(full)));
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

describe('design token usage (MAINT-02)', () => {
  it('tokens.css defines every hex this test treats as tokenised', () => {
    const tokens = readFileSync(resolve(srcRoot, 'shared/ui/tokens.css'), 'utf8');
    for (const [hex, variable] of Object.entries(TOKENISED_HEXES)) {
      expect(tokens, `${variable} must be defined as ${hex}`).toMatch(
        new RegExp(`${variable}:\\s*${hex}\\s*;`, 'i'),
      );
    }
  });

  it('portal Tailwind classes use CSS variables instead of tokenised hex literals', async () => {
    const offenders: string[] = [];

    for (const portal of PORTALS) {
      const files = await collectTsxFiles(resolve(srcRoot, 'portals', portal));
      for (const file of files) {
        // This spec necessarily embeds the hex literals it bans.
        if (file === fileURLToPath(import.meta.url)) continue;
        const src = await readFile(file, 'utf8');
        // Only Tailwind arbitrary values (e.g. text-[#1d1d1b]) are in scope.
        // Raw hexes passed to Leaflet/ECharts/SVG cannot resolve CSS variables.
        for (const match of src.matchAll(/\[(#[0-9a-fA-F]{3,8})\]/g)) {
          const hex = match[1].toLowerCase();
          const variable = TOKENISED_HEXES[hex];
          if (variable) {
            offenders.push(`${file.replace(srcRoot, 'src')}: ${hex} should be var(${variable})`);
          }
        }
      }
    }

    expect(offenders, `hard-coded tokenised hexes found:\n${offenders.join('\n')}`).toEqual([]);
  });
});
