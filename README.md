# Better Grid

A framework-agnostic, TypeScript-first, AI-native data grid & spreadsheet library — built for the AI era.

> **Status**: Early development (v0.0.1). API is unstable.

## Why Better Grid?

The data grid market has a gap:

| Library         | Free spreadsheet features?   | Framework-agnostic? | AI-native? |
| --------------- | ---------------------------- | ------------------- | ---------: |
| AG Grid         | Paywalled ($999/dev/yr)      | Yes                 |         No |
| Handsontable    | Paywalled ($999/dev/yr)      | Yes                 |         No |
| Glide Data Grid | Yes (MIT)                    | React only          |         No |
| RevoGrid        | Partially                    | Yes                 |         No |
| TanStack Table  | Headless (build it yourself) | Yes                 |         No |
| **Better Grid** | **Yes (MIT core)**           | **Yes**             |    **Yes** |

## Features

### Core (MIT, free forever)

- Virtual scrolling (10K+ rows, 100+ columns)
- Frozen rows & columns (no visual lag)
- Cell selection (single, range, multi-range)
- Keyboard navigation (arrow, tab, enter, escape)
- Column headers (sticky, multi-level)
- Column resizing (drag handles)
- Custom cell renderers (DOM-based)
- CSS custom properties for theming

### Free Plugins (MIT)

- **Editing** — type-to-edit, double-click, commit/cancel
- **Sorting** — single/multi-column, custom comparators
- **Filtering** — column filters, custom functions
- **Formatting** — currency, percent, dates via Intl
- **Validation** — rules per column, error state

### Pro Plugins (Commercial, coming soon)

- Clipboard (copy/cut/paste, fill-down)
- Row grouping with collapse
- Undo/redo history
- CSV/Excel export

### AI-Native (coming soon)

- **MCP Server** — AI-assisted column config generation, schema inference, migration from other grids
- **AI Plugin** — natural language filtering, data summarization, smart suggestions

## Quick Start

```bash
npm install @better-grid/core @better-grid/react @better-grid/plugins
```

```tsx
import { BetterGrid } from '@better-grid/react';
import { formatting } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface Row {
  id: number;
  name: string;
  amount: number;
}

function MyGrid({ data }: { data: Row[] }) {
  return (
    <BetterGrid<Row>
      columns={[
        { id: 'id', accessorKey: 'id', header: 'ID', width: 60 },
        { id: 'name', accessorKey: 'name', header: 'Name', width: 200 },
        { id: 'amount', accessorKey: 'amount', header: 'Amount', width: 150, cellType: 'currency' },
      ]}
      data={data}
      frozenLeftColumns={1}
      selection={{ mode: 'range' }}
      plugins={[formatting({ locale: 'en-US', currencyCode: 'USD' })]}
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

## Packages

| Package                | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| `@better-grid/core`    | Framework-agnostic grid engine                          |
| `@better-grid/react`   | React adapter (`useGrid` hook + `BetterGrid` component) |
| `@better-grid/plugins` | Official free plugins                                   |

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

## License

MIT (core + free plugins). Commercial license for pro plugins.
