import { run as jscodeshiftRun } from 'jscodeshift/src/Runner.js';
import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export interface TransformReport {
  filesChanged: number;
  sitesConverted: number;
  flagged: { file: string; line: number; reason: string }[];
}

export async function runTransform(args: {
  transform: string;             // 'from-ag-grid' etc.
  paths: string[];
  dryRun?: boolean;
  extensions?: string[];          // default: ['ts', 'tsx', 'js', 'jsx']
}): Promise<TransformReport> {
  const transformPath = path.resolve(__dirname, 'transforms', args.transform, 'index.js');
  if (!fs.existsSync(transformPath)) {
    throw new Error(`Unknown transform: ${args.transform}`);
  }

  const exts = args.extensions ?? ['ts', 'tsx', 'js', 'jsx'];
  const result = await jscodeshiftRun(transformPath, args.paths, {
    parser: 'tsx',
    extensions: exts.join(','),
    dry: args.dryRun ?? false,
    print: args.dryRun ?? false,
    verbose: 0,
    babel: false,
    runInBand: true,
    silent: true,
    stdin: false,
  });

  const filesChanged = (result.ok as number | undefined) ?? 0;
  const flagged = collectFlagged(args.paths, exts);
  return {
    filesChanged,
    sitesConverted: filesChanged,
    flagged,
  };
}

function collectFlagged(paths: string[], exts: string[]): TransformReport['flagged'] {
  const out: TransformReport['flagged'] = [];
  for (const root of paths) {
    walk(root, (file) => {
      if (!exts.some((e) => file.endsWith(`.${e}`))) return;
      const text = fs.readFileSync(file, 'utf8');
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        const m = line.match(/@better-grid\/migrate:\s*(.+)$/);
        if (m) out.push({ file, line: i + 1, reason: m[1]!.trim() });
      });
    });
  }
  return out;
}

function walk(p: string, cb: (file: string) => void): void {
  if (!fs.existsSync(p)) return;
  const stat = fs.statSync(p);
  if (stat.isFile()) { cb(p); return; }
  for (const child of fs.readdirSync(p)) {
    if (child === 'node_modules' || child.startsWith('.')) continue;
    walk(path.join(p, child), cb);
  }
}
