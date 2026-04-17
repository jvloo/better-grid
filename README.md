# [WIP] Better Grid

A framework-agnostic, TypeScript-first data grid & spreadsheet library with a composable plugin architecture. Ships a virtualized rendering pipeline, range selection, keyboard navigation, and 15+ free plugins (formatting, editing, sorting, filtering, clipboard, export, hierarchy, search, validation, pagination, undo/redo, ...) — without the "Community vs Enterprise" fork.

> **Status**: Early development (v0.0.1). API is unstable.

## Quick Start

```bash
npm install @better-grid/core @better-grid/react @better-grid/plugins
```

**React:**

```tsx
import { BetterGrid } from '@better-grid/react';
import { formatting, editing, sorting } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface Row {
  id: number;
  name: string;
  amount: number;
  active: boolean;
}

function MyGrid({ data }: { data: Row[] }) {
  return (
    <BetterGrid<Row>
      columns={[
        { id: 'id', header: '#', width: 40 },
        { id: 'name', header: 'Name', width: 200, editable: true },
        { id: 'amount', header: 'Amount', width: 150, cellType: 'currency', align: 'right', sortable: true },
        { id: 'active', header: 'Active', width: 80, align: 'center' },
      ]}
      data={data}
      frozenLeftColumns={1}
      selection={{ mode: 'range' }}
      plugins={[
        formatting({ locale: 'en-US', currencyCode: 'USD' }),
        editing({ editTrigger: 'dblclick' }),
        sorting(),
      ]}
      height={400}
    />
  );
}
```

**Vanilla TypeScript** (no framework):

```ts
import { createGrid } from '@better-grid/core';
import { formatting, sorting } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

const grid = createGrid<Row>({
  columns: [
    { id: 'name', header: 'Name', width: 200 },
    { id: 'amount', header: 'Amount', cellType: 'currency', align: 'right' },
  ],
  data,
  plugins: [formatting({ locale: 'en-US', currencyCode: 'USD' }), sorting()],
});

grid.mount(document.getElementById('grid-host')!);
```

## Migrating from another grid?

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
- **Editing** — text input, dropdown, boolean toggle, date
- **Sorting** — single/multi-column, custom comparators, header click
- **Filtering** — 9 operators, context menu, column filters
- **Validation** — required fields, custom rules, error state UI

### Pro Plugins (Commercial, coming soon)

- Clipboard (copy/cut/paste, fill-down)
- Row grouping with collapse/expand
- Undo/redo history
- CSV/Excel export
- Search & highlight
- Formulas (=SUM, =IF, =VLOOKUP)
- Advanced cell renderers (sparkline, heatmap, avatar, mini charts)

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

| Package                | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| `@better-grid/core`    | Framework-agnostic grid engine                          |
| `@better-grid/react`   | React adapter (`useGrid` hook + `BetterGrid` component) |
| `@better-grid/plugins` | Official free plugins + built-in cell renderers         |

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

MIT (core + free plugins). Commercial license for pro plugins.
