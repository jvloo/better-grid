# Better Grid

A framework-agnostic, TypeScript-first data grid & spreadsheet library with a composable plugin architecture. Virtualized rendering, range selection, keyboard nav, a rich MIT plugin set, and source-available pro plugins.

> **Status:** v1.0.0.

## Quick Start

```bash
npm install @better-grid/core @better-grid/react @better-grid/plugins
```

```tsx
import { BetterGrid, defineColumn as col } from '@better-grid/react';
import '@better-grid/core/styles.css';

interface Row { id: number; name: string; amount: number; active: boolean }

const columns = [
  col.text('name', { headerName: 'Name', width: 200, editable: true }),
  col.currency('amount', { headerName: 'Amount', width: 150, precision: 2 }),
  col.boolean('active', { headerName: 'Active', width: 80 }),
];

export function MyGrid({ data }: { data: Row[] }) {
  return (
    <BetterGrid<Row>
      columns={columns}
      data={data}
      mode="spreadsheet"            // sort + filter + edit + clipboard + undo
      frozen={{ left: 1 }}
      selection={{ mode: 'range' }}
      height={400}
    />
  );
}
```

`col.<type>(field, opts)` fills `id`, `field`, `cellType`, alignment. `mode` opts you into a curated bundle of features; use `features={['edit', 'sort']}` for finer control or `features={{ edit: { editTrigger: 'click' } }}` for options.

**Vanilla TS** (no framework):

```ts
import { createGrid } from '@better-grid/core';
import { formatting, sorting } from '@better-grid/plugins';

const grid = createGrid<Row>({
  columns: [
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'amount', headerName: 'Amount', cellType: 'currency', align: 'right' },
  ],
  data,
  plugins: [formatting({ locale: 'en-US', currencyCode: 'USD' }), sorting()],
});
grid.mount(document.getElementById('grid-host')!);
```

## Examples

### Computed columns and cross-field formatting

```tsx
col.currency('amount', {
  headerName: 'Amount',
  // Formatter receives (value, row) — format per-row currency from a sibling field
  valueFormatter: (value, row) =>
    Number(value).toLocaleString('en-US', { style: 'currency', currency: row.currency }),
});

col.text('duration', {
  headerName: 'Duration',
  // Computed column — no field, value derived per row
  valueGetter: (row) =>
    `${Math.round((+new Date(row.endDate) - +new Date(row.startDate)) / 86_400_000)}d`,
});
```

### Always-on inputs (finance-style sheets)

```tsx
col.currency('unitCost', {
  headerName: 'Unit Cost',
  alwaysInput: true,                              // real <input> in every cell, no double-click
  precision: 2,
  rules: [{ validate: (v) => Number(v) >= 0 || 'Must be ≥ 0' }],
});
```

### react-hook-form bridge

```tsx
import { useForm, FormProvider } from 'react-hook-form';
import { BetterGrid, useGrid } from '@better-grid/react';
import { useGridForm } from '@better-grid/react/rhf';

function CostsTable({ data }: { data: Row[] }) {
  const grid = useGrid<Row>({ columns, data, mode: 'spreadsheet' });
  useGridForm({ grid, baseName: 'rows', shouldValidate: true });
  return <BetterGrid grid={grid} height={400} />;
}

export function Page({ defaultRows }: { defaultRows: Row[] }) {
  const methods = useForm({ defaultValues: { rows: defaultRows } });
  return (
    <FormProvider {...methods}>
      <CostsTable data={defaultRows} />
    </FormProvider>
  );
}
```

### Custom validation message UI

```tsx
import { Alert } from '@mui/material';
import { createRoot } from 'react-dom/client';

col.number('qty', {
  headerName: 'Qty',
  rules: [{
    validate: (v) => Number(v) > 0 || 'Qty must be > 0',
    messageRenderer: (issue) => {
      const host = document.createElement('div');
      createRoot(host).render(
        <Alert severity="error" variant="filled">{issue.message}</Alert>,
      );
      return host;
    },
  }],
});
```

### Hierarchy with collapsible parent rows

```tsx
<BetterGrid<Row>
  columns={columns}
  data={flatRows}                                  // parent rows + child rows in one array
  getRowId={(row) => row.id}                       // top-level — also used by selection
  hierarchy={{
    getParentId: (row) => row.parentId,            // null for root rows
    defaultExpanded: true,
  }}
  mode="spreadsheet"
/>
```

A full prop reference (`<BetterGrid />` and `useGrid()` together with every option exercised) lives at [`docs/guides/kitchen-sink.md`](docs/guides/kitchen-sink.md).

## Migrating from another grid?

> **Tip:** `npx @better-grid/codemods from-<lib> src/` runs a one-shot codemod that auto-converts the mechanical renames and flags the rest for review.

[AG Grid](docs/migrations/from-ag-grid.md) · [MUI X Data Grid](docs/migrations/from-mui-x-data-grid.md) · [Handsontable](docs/migrations/from-handsontable.md) · [RevoGrid](docs/migrations/from-revogrid.md) · [react-data-grid](docs/migrations/from-react-data-grid.md) · [TanStack Table](docs/migrations/from-tanstack-table.md)

## Comparison

Same example (4 columns: text, currency, date, boolean — with inline edit, sort, filter), each lib's idiomatic minimal-React quick-start. Bundle sizes are gzipped, approximate as of April 2026 — verify on [bundlephobia](https://bundlephobia.com/) for live numbers.

| Library                  | Gzipped install | Lines of code | Notes                                          |
| ------------------------ | --------------- | ------------- | ---------------------------------------------- |
| **Better Grid**          | **~115 KB**     | **~12**       | core + react + plugins; `mode="spreadsheet"`   |
| AG Grid Community        | ~340 KB         | ~18           | `ModuleRegistry.registerModules` + theme CSS   |
| MUI X Data Grid (free)   | ~200 KB         | ~15           | `sx` for size; `type` per-column               |
| Handsontable (Hobby)     | ~720 KB         | ~22           | Non-commercial; commercial license needed      |
| RevoGrid                 | ~110 KB         | ~19           | Web Component                                  |
| react-data-grid          | ~95 KB          | ~17           | No built-in editors — needs editor classes     |
| TanStack Table           | ~13 KB headless | 60+           | Headless — bring your own DOM/JSX + virtualizer |

Better Grid LOC includes the `defineColumn` builder calls, the `<BetterGrid …>` element, and the CSS import — no theme registration, no row-model boilerplate, no `flexRender` plumbing. AG Grid's higher number is mostly the module registry + theme CSS imports; MUI X is closer because it ships defaults inline. TanStack stays small because it's headless — every row of rendering plus virtualization is the consumer's code.

## Features

**Core (MIT):** virtual scrolling (10M+ cells, 60 FPS sustained, ~200 DOM elements), frozen rows/columns, multi-level headers, range/multi-range selection, keyboard nav, custom `cellRenderer` API, `cellType` registry, CSS-variable theming.

**Free plugins (`@better-grid/plugins`, MIT):** formatting, editing (text/dropdown/boolean/date/masked/autocomplete + per-column `alwaysInput`), sorting, filtering (9 operators), validation (with custom `messageRenderer`), hierarchy, clipboard (Excel-compatible), undo/redo, search, CSV/Excel export, pagination, grouping, built-in cell renderers (badge, progress, boolean, rating, change, link, timeline, tooltip, loading, custom).

**React adapter (`@better-grid/react`, MIT):** `useGrid` hook returning a `GridHandle`, `defineColumn` / `registerColumn` builders, `configure` for app-wide defaults, mode/feature presets. Optional `@better-grid/react/rhf` sub-export with `useGridForm` to bridge cell commits into a `<FormProvider>`.

**Pro plugins (`@better-grid/pro`, source-available):** Gantt, aggregation, merge cells, row actions, advanced renderers (sparkline, heatmap, mini-chart).

## Packages

| Package                  | Purpose                                                      |
| ------------------------ | ------------------------------------------------------------ |
| `@better-grid/core`      | Framework-agnostic engine                                    |
| `@better-grid/react`     | React adapter (`useGrid`, `BetterGrid`, `defineColumn`)      |
| `@better-grid/react/rhf` | Optional react-hook-form bridge (`useGridForm`)              |
| `@better-grid/plugins`   | Free plugins + built-in renderers                            |
| `@better-grid/pro`       | Source-available pro plugins                                 |

## Theming

Customize via CSS custom properties (`--bg-cell-bg`, `--bg-header-bg`, `--bg-selection-bg`, etc.). For Material UI integration — palette, typography, density, dark mode in one `styled()` wrapper — see [`docs/guides/theming-with-mui.md`](docs/guides/theming-with-mui.md).

## Browser support

Evergreen browsers with native `ResizeObserver` and `PointerEvent`. Tested baseline: Chrome/Edge ≥88, Firefox ≥78, Safari ≥14.

## Roadmap

See [`ROADMAP.md`](ROADMAP.md).

## License

| Package                | License                                  |
| ---------------------- | ---------------------------------------- |
| `@better-grid/core`    | MIT — [`LICENSE`](LICENSE)               |
| `@better-grid/react`   | MIT — [`LICENSE`](LICENSE)               |
| `@better-grid/plugins` | MIT — [`LICENSE`](LICENSE)               |
| `@better-grid/pro`     | Better Grid Pro Source-Available — [`LICENSE-PRO`](LICENSE-PRO) |

`@better-grid/pro` is source-available for transparency, evaluation, and integration. Commercial production use requires a Pro license — `ping@xavierloo.com`.

## Support

[`SUPPORT.md`](SUPPORT.md) for channels and contacts. Bugs/features via [Issues](https://github.com/jvloo/better-grid/issues); how-do-I via [Discussions](https://github.com/jvloo/better-grid/discussions); security via [Advisories](https://github.com/jvloo/better-grid/security/advisories/new). Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md), [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Release history: [`CHANGELOG.md`](CHANGELOG.md).
