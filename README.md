# Better Grid

A framework-agnostic, TypeScript-first data grid & spreadsheet library with a composable plugin architecture. Ships a virtualized rendering pipeline, range selection, keyboard navigation, a rich MIT plugin set, and source-available pro plugins.

> **Status**: v1.0.0. Ready for early production use, with active iteration expected.

## Quick Start

```bash
npm install @better-grid/core @better-grid/react @better-grid/plugins
```

**React:**

```tsx
import { BetterGrid, defineColumn as col } from '@better-grid/react';
import '@better-grid/core/styles.css';

interface Row {
  id: number;
  name: string;
  amount: number;
  active: boolean;
}

const columns = [
  col.text('name', { header: 'Name', width: 200, editable: true }),
  col.currency('amount', { header: 'Amount', width: 150, precision: 2 }),
  col.boolean('active', { header: 'Active', width: 80 }),
];

function MyGrid({ data }: { data: Row[] }) {
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

The `col.<type>(field, opts)` builder fills in `id`, `accessorKey`, `cellType`, and alignment for you. The `mode` preset opts you into a curated bundle of features; use `features={['edit', 'sort']}` for finer control or `features={{ edit: { editTrigger: 'click' } }}` to pass options. See [`docs/migration-v0-to-v1.md`](docs/migration-v0-to-v1.md) for every breaking change vs v0.

**Vanilla TypeScript** (no framework):

```ts
import { createGrid } from '@better-grid/core';
import { formatting, sorting } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

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

The vanilla path takes plugin instances directly — no `mode`/`features` registry, by design (the registry lives in `@better-grid/react`).

## Migrating from another grid?

- [From v0 to v1 (Better Grid)](docs/migration-v0-to-v1.md) — full breaking-change inventory for the new init API
- [From AG Grid](docs/migration-from-ag-grid.md) — column-def + grid-options cheat sheet
- [From TanStack Table](docs/migration-from-tanstack-table.md) — rendering-included vs headless cheat sheet

## Why Better Grid?

The data grid market has a gap — no library combines a rich free tier, type-safe plugin composition, and framework-agnostic design:

| Library         | Free renderers | Type-safe plugin DX | Framework-agnostic? | Free badge/progress/rating? |
| --------------- | -------------- | ------------------- | ------------------- | --------------------------: |
| AG Grid         | 2              | No (modules)        | Yes                 |        No (Enterprise $999) |
| MUI X           | 6              | No (slots)          | No (React only)     |                          No |
| Handsontable    | 11             | No (monolithic)     | Yes                 |                          No |
| RevoGrid        | 4              | No (BasePlugin)     | Yes                 |               No (Pro only) |
| TanStack Table  | 0 (headless)   | Partial (features)  | Yes                 |                         N/A |
| **Better Grid** | **6+ (MIT)**   | **Yes (InferRow)**  | **Yes**             |                     **Yes** |

## Features

### Core (MIT, free forever)

- Virtual scrolling (10M+ cells at 60 FPS sustained)
- DOM cell pooling with recycling (~200 elements regardless of dataset size)
- Fake scrollbar scroll architecture (no blank flash on fast scroll)
- Frozen rows & columns (separate overlay, zero lag)
- Cell selection (single, range, multi-range)
- Keyboard navigation (arrow, tab, enter, escape)
- Multi-level column headers (colSpan + rowSpan)
- Column resizing (drag handles)
- Column alignment (`align`, `verticalAlign` props)
- Custom cell renderers (DOM-based `cellRenderer` API)
- Cell type registry (`cellType` + `registerCellType()`)
- CSS custom properties for theming

### Free Plugins (MIT)

- **Formatting** — currency, percent, dates via Intl API
- **Editing** — text input, dropdown, boolean toggle, date, masked, autocomplete
  - **`alwaysInput` per-column flag** — render a real `<input>` permanently in every cell (Wiseway-shape finance sheets)
  - Floating or inline editor mode
  - `inputStyle` cells with placeholder + prefix/suffix adornments
- **Sorting** — single/multi-column, custom comparators, header click
- **Filtering** — 9 operators, context menu, column filters
- **Validation** — required fields, custom rules, error tooltip UI
  - **`messageRenderer` callback** — return any HTMLElement (e.g. an MUI Alert) to control the error body

### Additional Free Plugins (MIT)

- Clipboard (copy/cut/paste, fill-down)
- Row grouping with collapse/expand
- Undo/redo history
- CSV/Excel export
- Search & highlight
- Hierarchy, pagination, cell renderers, and auto-detect helpers

### React extras

- **`useGrid`** hook — returns a `GridHandle` with `api`, `containerRef`, and ref-based `context`
- **`defineColumn` builders** — `col.text` / `col.currency` / `col.percent` / `col.date` / `col.badge` / `col.boolean` / `col.progress` / `col.rating` / `col.change` / `col.link` / `col.timeline` / `col.tooltip` / `col.loading` / `col.custom`; extend with `registerColumn`
- **`configureBetterGrid`** — app-wide feature option defaults
- **Mode presets** — `view` / `interactive` / `spreadsheet` / `dashboard` / `null`; extend with `registerMode`
- **`@better-grid/react/rhf`** sub-export — `useGridForm` bridges cell commits into a surrounding `<FormProvider>` (react-hook-form is an optional peer dep)

### Pro Plugins (source-available)

- **Gantt** — timeline bars with drag-to-move and resize
- **Aggregation** — summary rows and grouped totals
- **Merge cells** — row/column spanning
- **Row actions** — contextual per-row action menus
- **Pro renderers** — advanced commercial renderers

### AI Integration (coming soon)

- **MCP Server** — AI-assisted column config, schema inference, migration from other grids
- **AI Plugin** — natural language filtering, data summarization, smart suggestions

## Design Philosophy

Inspired by [Better Auth](https://better-auth.com):

- **Type-safe plugin composition** — composable, tree-shakeable plugins with `InferRow<typeof grid>` for full TypeScript inference
- **Framework-agnostic** — vanilla TS core, thin framework adapters
- **Works out of the box** — sensible defaults, zero config needed
- **AI-ready** — composable AI plugins with free NL filtering (planned)
- **Performance first** — 10M cells, 60 FPS sustained, ~200 cell elements

## Packages

| Package                      | Description                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `@better-grid/core`          | Framework-agnostic grid engine                                                       |
| `@better-grid/react`         | React adapter (`useGrid` hook + `BetterGrid` component + `defineColumn` builders)    |
| `@better-grid/react/rhf`     | Optional react-hook-form bridge (`useGridForm`)                                      |
| `@better-grid/plugins`       | Official free plugins + built-in cell renderers                                      |
| `@better-grid/pro`           | Source-available pro plugins                                                         |

## Support

Better Grid is an independent project. If it saves you time or helps your work,
you can support development through sponsorship or commercial support. A coffee
link will be added once it is available.

## Theming

Customize via CSS custom properties:

```css
.my-grid {
  --bg-cell-padding: 0 16px;
  --bg-cell-border-color: #333;
  --bg-cell-bg: #1e1e1e;
  --bg-text-color: #e0e0e0;
  --bg-header-bg: #2d2d2d;
  --bg-selection-bg: rgba(100, 149, 237, 0.2);
  --bg-active-border: #6495ed;
  --bg-frozen-col-shadow: 6px 0 12px rgba(0, 0, 0, 0.3);
  --bg-frozen-col-border: 2px solid #6495ed;
}
```

For Material UI integration — palette, typography, density, dark mode wired through one `styled()` wrapper — see [`docs/mui-theme-integration.md`](docs/mui-theme-integration.md).

## Browser support

Better Grid targets evergreen browsers and assumes native support for `ResizeObserver` and `PointerEvent`. The tested baseline is:

| Browser             | Minimum version |
| ------------------- | --------------- |
| Chrome / Edge       | 88              |
| Firefox             | 78              |
| Safari (macOS, iOS) | 14              |

Older browsers are not supported. If you need to serve them, polyfill `ResizeObserver` and `PointerEvent` yourself — we do not ship polyfills.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the full feature roadmap, tier strategy, and competitive analysis.

## License

| Package | License |
| ------- | ------- |
| `@better-grid/core` | MIT |
| `@better-grid/react` | MIT |
| `@better-grid/plugins` | MIT |
| `@better-grid/pro` | Better Grid Pro Source-Available License |

`@better-grid/pro` is source-available for transparency, evaluation, learning,
debugging, and easier integration. Commercial production use requires a Better
Grid Pro license. There is no hard runtime DRM in v1.
