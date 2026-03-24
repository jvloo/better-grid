import { defineConfig } from 'tsup';
import { copyFileSync } from 'fs';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  onSuccess: async () => {
    // Copy CSS to dist
    copyFileSync('src/styles/grid.css', 'dist/styles.css');
  },
});
