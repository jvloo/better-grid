# @better-grid/core

Framework-agnostic, TypeScript-first data grid & spreadsheet engine. The pure rendering + state machine that powers Better Grid.

- Virtualized rendering with DOM cell pooling (~200 elements regardless of dataset size)
- Fake-scrollbar architecture, multi-level headers, frozen rows/columns, separate pinned-row overlay
- Range / multi-range / fill-handle selection, full keyboard navigation
- `cellType` registry, custom `cellRenderer` API, CSS variables for theming
- Composable plugin architecture (`createGrid({ plugins: [...] })`)

```bash
npm install @better-grid/core
```

```ts
import { createGrid } from '@better-grid/core';
import '@better-grid/core/styles.css';

const grid = createGrid({
  columns: [{ id: 'name', field: 'name', headerName: 'Name', width: 200 }],
  data: [{ name: 'Alice' }],
});
grid.mount(document.getElementById('grid')!);
```

For most React apps you want [`@better-grid/react`](https://www.npmjs.com/package/@better-grid/react) and [`@better-grid/plugins`](https://www.npmjs.com/package/@better-grid/plugins) on top.

License: MIT — see [LICENSE](./LICENSE). Repo & docs: https://github.com/jvloo/better-grid (CHANGELOG, ROADMAP, guides).
