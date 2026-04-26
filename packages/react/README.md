# @better-grid/react

React adapter for [`@better-grid/core`](https://www.npmjs.com/package/@better-grid/core). Three layered APIs (sugar, handle, vanilla) plus a `defineColumn` helper, mode presets, and a feature registry.

```bash
npm install @better-grid/core @better-grid/react @better-grid/plugins
```

```tsx
import { BetterGrid, defineColumn as col } from '@better-grid/react';
import '@better-grid/core/styles.css';

interface Row { name: string; salary: number; active: boolean }

const columns = [
  col.text('name',     { headerName: 'Name', width: 200, editable: true }),
  col.currency('salary', { headerName: 'Salary', width: 140 }),
  col.boolean('active',  { headerName: 'Active', width: 100 }),
];

export default function App() {
  return <BetterGrid columns={columns} data={rows} mode="spreadsheet" />;
}
```

**Mode presets:** `null` (default — no features), `view`, `interactive`, `spreadsheet`, `dashboard`. Override individual features with `features={{ edit: { editTrigger: 'click' } }}`.

**`useGrid` handle** — for imperative access (`grid.api.scrollToCell`), the `context` ref, or [`useGridForm`](#react-hook-form-bridge):

```tsx
import { useGrid, BetterGrid } from '@better-grid/react';
const grid = useGrid({ columns, data, mode: 'spreadsheet' });
return <BetterGrid grid={grid} />;
```

**React Hook Form bridge** — `import { useGridForm } from '@better-grid/react/rhf'` (rhf is an optional peer dep).

License: MIT — see [LICENSE](./LICENSE). Repo & docs: https://github.com/jvloo/better-grid.
