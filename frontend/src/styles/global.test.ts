import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('global styles', () => {
  it('loads the shared design tokens used by portal utility classes', () => {
    const source = readFileSync(resolve('src/styles/global.css'), 'utf8');

    expect(source).toContain("@import '../shared/ui/tokens.css';");
  });
});
