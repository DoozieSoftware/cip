import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// tests live at <root>/src/portals/admin/pages/__tests__/, so <root>/src is 4 levels up.
const srcRoot = resolve(here, '../../../../');

describe('shared primitives ownership (MAINT-01)', () => {
  it('EmptyState and Badge are exported from the shared/ui barrel', () => {
    const barrel = readFileSync(resolve(srcRoot, 'shared/ui/index.ts'), 'utf8');
    expect(barrel).toMatch(/export\s+\{\s*EmptyState\s*\}\s*from\s+['"]\.\/EmptyState['"]/);
    expect(barrel).toMatch(/export\s+\{\s*Badge\s*\}\s*from\s+['"]\.\/Badge['"]/);
  });

  it('the shared/ui directory physically contains EmptyState and Badge', async () => {
    const fs = await import('node:fs/promises');
    const sharedDir = resolve(srcRoot, 'shared/ui');
    const files = await fs.readdir(sharedDir);
    expect(files).toContain('EmptyState.tsx');
    expect(files).toContain('Badge.tsx');
  });

  it('admin pages import shared primitives from shared/ui, never via moderator/design', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const dir = resolve(srcRoot, 'portals/admin/pages');
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.tsx'));
    const importRe = /from\s+['"]([^'"]+)['"]/g;
    const banned = /moderator[\\/]design/;
    for (const file of files) {
      const src = await fs.readFile(path.join(dir, file), 'utf8');
      let m: RegExpExecArray | null;
      while ((m = importRe.exec(src)) !== null) {
        expect(banned.test(m[1]), `${file}: import "${m[1]}" must not route via moderator/design`).toBe(false);
      }
    }
  });

  it('the moderator/design re-export shim no longer exists', async () => {
    const fs = await import('node:fs/promises');
    await expect(fs.access(resolve(srcRoot, 'portals/moderator/design'))).rejects.toThrow();
  });

  it('no portal anywhere references moderator/design', async () => {
    const { execFileSync } = await import('node:child_process');
    let out = '';
    try {
      out = execFileSync(
        'grep',
        ['-rl', 'moderator/design', srcRoot + '/portals', '--include=*.ts', '--include=*.tsx'],
        { encoding: 'utf8' },
      );
    } catch {
      // grep exits 1 when there are no matches, which is the desired state.
      out = '';
    }
    const ignored = new Set([
      resolve(srcRoot, 'portals/admin/pages/__tests__/SharedPrimitiveOwnership.test.tsx'),
    ]);
    const files = out.split('\n').filter((f) => Boolean(f) && !ignored.has(f));
    expect(files, `unexpected moderator/design references: ${files.join(', ')}`).toEqual([]);
  });
});
