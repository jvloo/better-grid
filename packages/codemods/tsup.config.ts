import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'bin/migrate.ts',
    'src/transforms/from-ag-grid/index.ts',
    'src/transforms/from-mui-x-data-grid/index.ts',
    'src/transforms/from-tanstack-table/index.ts',
    'src/transforms/from-handsontable/index.ts',
    'src/transforms/from-revogrid/index.ts',
    'src/transforms/from-react-data-grid/index.ts',
  ],
  format: ['esm', 'cjs'],
  dts: { entry: ['src/index.ts'] },
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  external: ['jscodeshift'],
  shims: true,
});
