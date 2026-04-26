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
  col.text('name', { header: 'Name', width: 200, editable: true }),
  col.currency('amount', { header: 'Amount', width: 150, precision: 2 }),
  col.boolean('active', { header: 'Active', width: 80 }),
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

`col.<type>(field, opts)` fills `id`, `accessorKey`, `cellType`, alignment. `mode` opts you into a curated bundle of features; use `features={['edit', 'sort']}` for finer control or `features={{ edit: { editTrigger: 'click' } }}` for options.

**Vanilla TS** (no framework):

```ts
import { createGrid } from '@better-grid/core';
import { formatting, sorting } from '@better-grid/plugins';

const grid = createGrid<Row>({
  columns: [
    { id: 'name', accessorKey: 'name', header: 'Name', width: 200 },
    { id: 'amount', accessorKey: 'amount', header: 'Amount', cellType: 'currency', align: 'right' },
  ],
  data,
  plugins: [formatting({ locale: 'en-US', currencyCode: 'USD' }), sorting()],
});
grid.mount(document.getElementById('grid-host')!);
```

## Migrating from another grid?

[AG Grid](docs/migrations/from-ag-grid.md) · [MUI X Data Grid](docs/migrations/from-mui-x-data-grid.md) · [Handsontable](docs/migrations/from-handsontable.md) · [RevoGrid](docs/migrations/from-revogrid.md) · [react-data-grid](docs/migrations/from-react-data-grid.md) · [TanStack Table](docs/migrations/from-tanstack-table.md)

## Features

**Core (MIT):** virtual scrolling (10M+ cells, 60 FPS sustained, ~200 DOM elements), frozen rows/columns, multi-level headers, range/multi-range selection, keyboard nav, custom `cellRenderer` API, `cellType` registry, CSS-variable theming.

**Free plugins (`@better-grid/plugins`, MIT):** formatting, editing (text/dropdown/boolean/date/masked/autocomplete + per-column `alwaysInput`), sorting, filtering (9 operators), validation (with custom `messageRenderer`), hierarchy, clipboard (Excel-compatible), undo/redo, search, CSV/Excel export, pagination, grouping, built-in cell renderers (badge, progress, boolean, rating, change, link, timeline, tooltip, loading, custom).

**React adapter (`@better-grid/react`, MIT):** `useGrid` hook returning a `GridHandle`, `defineColumn` / `registerColumn` builders, `configureBetterGrid` for app-wide defaults, mode/feature presets. Optional `@better-grid/react/rhf` sub-export with `useGridForm` to bridge cell commits into a `<FormProvider>`.

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
