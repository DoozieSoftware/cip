import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve(process.cwd(), 'dist');
const violations = [];

async function visit(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Unable to inspect ${directory}: ${error.message}`);
  }

  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(file);
      continue;
    }
    if (entry.name.endsWith('.map')) {
      violations.push(`${path.relative(process.cwd(), file)} is a public source map`);
      continue;
    }
    if (!/\.(?:js|mjs|css)$/.test(entry.name)) continue;
    const content = await readFile(file, 'utf8');
    if (/sourceMappingURL=/.test(content)) {
      violations.push(`${path.relative(process.cwd(), file)} references a source map`);
    }
  }
}

await visit(dist);

if (violations.length > 0) {
  console.error('Production build contains public source-map artifacts:');
  for (const violation of violations) console.error(` - ${violation}`);
  process.exit(1);
}

console.log('Production build contains no public source-map artifacts.');
