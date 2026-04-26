import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Allow tests that import plugins (via relative path) to resolve
      // '@better-grid/core' to the local source rather than the compiled dist.
      '@better-grid/core': path.resolve(__dirname, './src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'happy-dom',
  },
});
