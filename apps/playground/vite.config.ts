import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    alias: [
      // CSS must come before the base package alias (more specific first)
      {
        find: '@better-grid/core/styles.css',
        replacement: path.resolve(__dirname, '../../packages/core/src/styles/grid.css'),
      },
      // In dev, resolve workspace packages to their source for HMR
      {
        find: '@better-grid/core',
        replacement: path.resolve(__dirname, '../../packages/core/src'),
      },
      {
        find: '@better-grid/react',
        replacement: path.resolve(__dirname, '../../packages/react/src'),
      },
      {
        find: '@better-grid/plugins',
        replacement: path.resolve(__dirname, '../../packages/plugins/src'),
      },
    ],
  },
});
