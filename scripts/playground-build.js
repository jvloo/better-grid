#!/usr/bin/env node
// Build the playground to check for compilation errors

for (const key of Object.keys(process.env)) {
  if (process.env[key] && process.env[key].includes('\x00')) {
    delete process.env[key];
  }
}

const { execSync } = require('child_process');
const { createRequire } = require('node:module');
const path = require('path');
const root = path.resolve(__dirname, '..');

// Playground pins vite@^6 but vitest may also pull in vite@5.x — resolve via the
// actual workspace import so we always get the version playground/package.json
// picked, not whichever sibling happens to sort first. Going through package.json
// sidesteps vite's exports map, which hides /bin/ from direct resolution.
const playgroundDir = path.resolve(root, 'apps/playground');
const vitePkgPath = createRequire(path.join(playgroundDir, 'package.json'))
  .resolve('vite/package.json');
const viteBin = path.join(path.dirname(vitePkgPath), 'bin/vite.js');

const action = process.argv[2] || 'build';
console.log(`Running vite ${action}...`);
execSync(`node "${viteBin}" ${action}`, {
  stdio: 'inherit',
  env: process.env,
  cwd: path.resolve(root, 'apps/playground'),
});
