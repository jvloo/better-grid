#!/usr/bin/env node

/**
 * Build script that works around the Windows null-bytes-in-env-var issue.
 * See: https://github.com/nodejs/node/issues/something
 *
 * Usage: node scripts/build.js [package]
 *   node scripts/build.js          # build all
 *   node scripts/build.js core     # build core only
 */

// Clean null bytes from environment variables
for (const key of Object.keys(process.env)) {
  if (process.env[key] && process.env[key].includes('\x00')) {
    delete process.env[key];
  }
}

const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const target = process.argv[2]; // 'core', 'plugins', 'react', or undefined for all

const packages = [
  { name: 'core', dir: 'packages/core' },
  { name: 'plugins', dir: 'packages/plugins' },
  { name: 'pro', dir: 'packages/pro' },
  { name: 'react', dir: 'packages/react' },
  { name: 'codemods', dir: 'packages/codemods' },
];

const toBuild = target ? packages.filter((p) => p.name === target) : packages;

if (toBuild.length === 0) {
  console.error(`Unknown package: ${target}`);
  console.error(`Available: ${packages.map((p) => p.name).join(', ')}`);
  process.exit(1);
}

// Find tsup
const { readdirSync } = require('fs');
const pnpmDir = path.join(root, 'node_modules/.pnpm2');
let tsupPath;
if (require('fs').existsSync(pnpmDir)) {
  const tsupEntry = readdirSync(pnpmDir).find((d) => d.startsWith('tsup@'));
  if (tsupEntry) {
    const candidate = path.join(pnpmDir, tsupEntry, 'node_modules/tsup/dist/cli-default.js');
    if (require('fs').existsSync(candidate)) tsupPath = candidate;
  }
}
if (!tsupPath) {
  // Fallback to standard location
  const pnpmDirStd = path.join(root, 'node_modules/.pnpm');
  const tsupEntry = readdirSync(pnpmDirStd).find((d) => d.startsWith('tsup@'));
  if (tsupEntry) {
    const candidate = path.join(pnpmDirStd, tsupEntry, 'node_modules/tsup/dist/cli-default.js');
    if (require('fs').existsSync(candidate)) tsupPath = candidate;
  }
}

if (!tsupPath) {
  console.error('Could not find tsup. Run pnpm install first.');
  process.exit(1);
}

for (const pkg of toBuild) {
  console.log(`\n=== Building @better-grid/${pkg.name} ===`);
  const cmd = `node ${tsupPath} --config tsup.config.ts`;
  try {
    execSync(cmd, {
      stdio: 'inherit',
      env: process.env,
      cwd: path.join(root, pkg.dir),
    });
  } catch {
    console.error(`\nFailed to build @better-grid/${pkg.name}`);
    process.exit(1);
  }
}

console.log('\n=== All builds successful ===');
