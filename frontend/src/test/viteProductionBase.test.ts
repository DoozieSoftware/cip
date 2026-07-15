// @vitest-environment node

import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveConfig } from 'vite';

describe('production asset base', () => {
  it('uses root-relative assets so nested routes survive a browser refresh', async () => {
    const config = await resolveConfig(
      { configFile: path.resolve(process.cwd(), 'vite.config.ts') },
      'build',
    );

    expect(config.base).toBe('/');
  });
});
