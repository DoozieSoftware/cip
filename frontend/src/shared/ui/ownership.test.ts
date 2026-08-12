import { describe, it, expect } from 'vitest';
import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, '../../');

const PORTALS = ['citizen', 'moderator', 'operations', 'admin', 'public'];

async function collectSourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collectSourceFiles(full)));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('shared UI ownership (MAINT-01)', () => {
  it('no portal owns a design barrel that re-exports shared primitives', async () => {
    for (const portal of PORTALS) {
      const barrel = resolve(srcRoot, 'portals', portal, 'design');
      expect(await exists(barrel), `portals/${portal}/design must not exist`).toBe(false);
    }
  });

  it('cross-portal, auth and page code imports primitives only from shared/ui', async () => {
    const roots = ['portals', 'auth', 'pages'].filter(Boolean);
    const offenders: string[] = [];
    const importRe = /from\s+['"]([^'"]+)['"]/g;

    for (const root of roots) {
      const dir = resolve(srcRoot, root);
      if (!(await exists(dir))) continue;
      for (const file of await collectSourceFiles(dir)) {
        if (file === fileURLToPath(import.meta.url)) continue;
        const src = await readFile(file, 'utf8');
        for (const match of src.matchAll(importRe)) {
          if (/portals?[\\/][a-z]+[\\/]design/.test(match[1])) {
            offenders.push(`${file.replace(srcRoot, 'src')}: ${match[1]}`);
          }
        }
      }
    }

    expect(offenders, `portal-owned design imports remain:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('shared/ui barrel owns every primitive the portals consume', async () => {
    const barrel = await readFile(resolve(srcRoot, 'shared/ui/index.ts'), 'utf8');
    for (const primitive of [
      'Button',
      'Card',
      'Input',
      'Select',
      'Badge',
      'Spinner',
      'Dialog',
      'Table',
      'EmptyState',
      'ErrorState',
      'ErrorBoundary',
      'SidebarLayout',
      'cx',
    ]) {
      expect(barrel, `shared/ui must export ${primitive}`).toMatch(
        new RegExp(`\\b${primitive}\\b`),
      );
    }
  });
});
