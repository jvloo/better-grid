import { Command } from 'commander';
import fs from 'node:fs';
import { runTransform } from './runner.js';

const TRANSFORMS = [
  'from-ag-grid',
  'from-mui-x-data-grid',
  'from-tanstack-table',
  'from-handsontable',
  'from-revogrid',
  'from-react-data-grid',
] as const;
type TransformName = typeof TRANSFORMS[number];

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name('better-grid-migrate')
    .description('Migrate to Better Grid from another grid library')
    .argument('<transform>', `one of: ${TRANSFORMS.join(', ')}`)
    .argument('[paths...]', 'files or directories to walk', ['src'])
    .option('--dry-run', 'preview changes without writing')
    .option('--report <path>', 'write a JSON summary to this file')
    .option('--ext <list>', 'comma-separated file extensions', 'ts,tsx,js,jsx')
    .action(async (transform: string, paths: string[], opts: { dryRun?: boolean; report?: string; ext: string }) => {
      if (!TRANSFORMS.includes(transform as TransformName)) {
        console.error(`Unknown transform: ${transform}\nKnown: ${TRANSFORMS.join(', ')}`);
        process.exit(2);
      }
      const result = await runTransform({
        transform,
        paths,
        dryRun: opts.dryRun,
        extensions: opts.ext.split(',').map((s) => s.trim()).filter(Boolean),
      });
      console.log(`\n${transform}\n`);
      console.log(`  ✓ ${result.filesChanged} file(s) changed`);
      console.log(`  ⚠ ${result.flagged.length} site(s) flagged for manual review`);
      for (const f of result.flagged) {
        console.log(`    ${f.file}:${f.line}  ${f.reason}`);
      }
      if (opts.report) {
        fs.writeFileSync(opts.report, JSON.stringify(result, null, 2));
        console.log(`\nReport written to ${opts.report}`);
      }
    });

  await program.parseAsync(argv);
}
