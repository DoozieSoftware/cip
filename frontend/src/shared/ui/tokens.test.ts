import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, '../../');

const tokensCss = readFileSync(resolve(here, 'tokens.css'), 'utf8');

function tokenHexes(): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of tokensCss.matchAll(/(--color-[a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    map.set(match[2].toLowerCase(), match[1]);
  }
  return map;
}

const PORTALS = ['citizen', 'operations', 'admin', 'public'];

async function collectTsxFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    // Specs legitimately embed hex fixtures, including the literals they ban.
    if (entry.isDirectory() && entry.name !== '__tests__') out.push(...(await collectTsxFiles(full)));
    else if (entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.includes('.test.'))
      out.push(full);
  }
  return out;
}

describe('design tokens (MAINT-02)', () => {
  it('tokens.css defines the semantic colour palette exactly once per variable', () => {
    const names = [...tokensCss.matchAll(/(--color-[a-z-]+):/g)].map((m) => m[1]);
    expect(new Set(names).size, 'duplicate token declarations in tokens.css').toBe(names.length);
    expect(names).toContain('--color-ink');
    expect(names).toContain('--color-border');
    expect(names).toContain('--color-canvas');
  });

  it('portal Tailwind arbitrary values never inline a hex that tokens.css already names', async () => {
    const known = tokenHexes();
    const offenders: string[] = [];

    for (const portal of PORTALS) {
      for (const file of await collectTsxFiles(resolve(srcRoot, 'portals', portal))) {
        if (file === fileURLToPath(import.meta.url)) continue;
        const src = await readFile(file, 'utf8');
        // Only Tailwind arbitrary values are in scope: Leaflet/ECharts/SVG props
        // take raw colour strings and cannot resolve a CSS variable.
        for (const match of src.matchAll(/\[(#[0-9a-fA-F]{3,8})\]/g)) {
          const variable = known.get(match[1].toLowerCase());
          if (variable) {
            offenders.push(`${file.replace(srcRoot, 'src')}: ${match[1]} -> var(${variable})`);
          }
        }
      }
    }

    expect(offenders, `tokenised hexes still inlined:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('every var(--color-*) referenced by portal code resolves to a declared token', async () => {
    const declared = new Set([...tokensCss.matchAll(/(--color-[a-z-]+):/g)].map((m) => m[1]));
    const unknown = new Set<string>();

    for (const portal of PORTALS) {
      for (const file of await collectTsxFiles(resolve(srcRoot, 'portals', portal))) {
        const src = await readFile(file, 'utf8');
        for (const match of src.matchAll(/var\((--color-[a-z-]+)\)/g)) {
          if (!declared.has(match[1])) unknown.add(`${file.replace(srcRoot, 'src')}: ${match[1]}`);
        }
      }
    }

    expect([...unknown], 'portal code references undeclared colour tokens').toEqual([]);
  });
});
