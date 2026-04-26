import { describe, test, expect } from 'vitest';
import { applyTransform } from 'jscodeshift/src/testUtils.js';
import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

interface FixturePair { name: string; input: string; output: string }

function loadPairs(libDir: string): FixturePair[] {
  const dir = path.resolve(__dirname, `../src/transforms/${libDir}/__testfixtures__`);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.input.tsx'))
    .map((f) => {
      const name = f.replace('.input.tsx', '');
      return {
        name,
        input: fs.readFileSync(path.join(dir, f), 'utf8'),
        output: fs.readFileSync(path.join(dir, `${name}.output.tsx`), 'utf8'),
      };
    });
}

async function loadTransform(libDir: string): Promise<unknown> {
  return (await import(`../src/transforms/${libDir}/index.ts`)).default;
}

const TRANSFORMS = [
  'from-ag-grid',
  'from-mui-x-data-grid',
  'from-tanstack-table',
  'from-handsontable',
  'from-revogrid',
  'from-react-data-grid',
];

for (const lib of TRANSFORMS) {
  const pairs = loadPairs(lib);
  if (pairs.length === 0) continue;
  describe(lib, () => {
    for (const { name, input, output } of pairs) {
      test(name, async () => {
        const transform = await loadTransform(lib);
        const result = applyTransform(transform as never, {}, { source: input, path: 'in.tsx' });
        const norm = (s: string) => s.replace(/\r\n/g, '\n').trim();
        expect(norm(result)).toBe(norm(output));
      });
    }
  });
}
