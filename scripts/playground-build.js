#!/usr/bin/env node
// Build the playground to check for compilation errors

for (const key of Object.keys(process.env)) {
  if (process.env[key] && process.env[key].includes('\x00')) {
    delete process.env[key];
  }
}

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const pnpmDir = path.resolve(root, 'node_modules/.pnpm2');
const viteEntry = fs.readdirSync(pnpmDir).find((d) => d.startsWith('vite@6'));
const viteBin = path.resolve(pnpmDir, viteEntry, 'node_modules/vite/bin/vite.js');

const action = process.argv[2] || 'build';
console.log(`Running vite ${action}...`);
execSync(`node "${viteBin}" ${action}`, {
  stdio: 'inherit',
  env: process.env,
  cwd: path.resolve(root, 'apps/playground'),
});
