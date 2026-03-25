# Better Grid

A framework-agnostic, TypeScript-first, AI-native data grid & spreadsheet library — built for the AI era.

> **Status**: Early development (v0.0.1). API is unstable.

## Why Better Grid?

The data grid market has a gap:

| Library         | Free editing & formatting? | Free cell renderers?   | Framework-agnostic? | Plugin architecture? | AI-native? |
| --------------- | -------------------------- | ---------------------- | ------------------- | -------------------- | ---------: |
| AG Grid         | Paywalled ($999/dev/yr)    | 2 (checkbox, skeleton) | Yes                 | No                   |         No |
| Handsontable    | Non-commercial only        | 13 (all included)      | Yes                 | No                   |         No |
| RevoGrid        | Yes (MIT)                  | 0 free / 16 Pro        | Yes                 | No                   |         No |
| TanStack Table  | Headless (build yourself)  | N/A                    | Yes                 | No                   |         No |
| **Better Grid** | **Yes (MIT)**              | **6+ (MIT)**           | **Yes**             | **Yes**              |    **Yes** |

## Features

### Core (MIT, free forever)

- Virtual scrolling (10M+ cells at 141 FPS)
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

### AI-Native (coming soon)

- **MCP Server** — AI-assisted column config, schema inference, migration from other grids
- **AI Plugin** — natural language filtering, data summarization, smart suggestions

## Quick Start

```bash
npm install @better-grid/core @better-grid/react @better-grid/plugins
```

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
        { id: 'name', header: 'Name', width: 200 },
        { id: 'amount', header: 'Amount', width: 150, cellType: 'currency', align: 'right' },
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

## Design Philosophy

Inspired by [Better Auth](https://better-auth.com):

- **Plugin architecture** — features as composable, tree-shakeable plugins
- **`$Infer` pattern** — full TypeScript inference from config
- **Framework-agnostic** — vanilla TS core, thin framework adapters
- **Works out of the box** — sensible defaults, zero config needed
- **AI-native** — built for the AI era with MCP and runtime AI plugins
- **Performance first** — 10M cells, 141 FPS, ~200 DOM elements

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

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the full feature roadmap, tier strategy, and competitive analysis.

## License

MIT (core + free plugins). Commercial license for pro plugins.
