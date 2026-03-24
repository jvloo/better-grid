#!/usr/bin/env node

/**
 * Dev script — launches the playground with Vite.
 * Works around the Windows null-bytes-in-env-var issue.
 *
 * Usage: node scripts/dev.js
 */

// Clean null bytes from environment variables
for (const key of Object.keys(process.env)) {
  if (process.env[key] && process.env[key].includes('\x00')) {
    delete process.env[key];
  }
}

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const playgroundDir = path.join(root, 'apps/playground');

// Find vite binary
const pnpmDirs = ['node_modules/.pnpm2', 'node_modules/.pnpm'];
let viteBin;
for (const dir of pnpmDirs) {
  const fullDir = path.join(root, dir);
  if (!fs.existsSync(fullDir)) continue;
  const viteEntry = fs.readdirSync(fullDir).find((d) => d.startsWith('vite@') && !d.includes('plugin'));
  if (viteEntry) {
    viteBin = path.join(fullDir, viteEntry, 'node_modules/vite/bin/vite.js');
    if (fs.existsSync(viteBin)) break;
  }
}

if (!viteBin) {
  console.error('Could not find vite. Run pnpm install first.');
  process.exit(1);
}

console.log('Starting playground dev server...');
try {
  execSync(`node "${viteBin}"`, {
    stdio: 'inherit',
    env: process.env,
    cwd: playgroundDir,
  });
} catch {
  // Vite exits with SIGINT on Ctrl+C, that's expected
}
