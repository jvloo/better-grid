# Better Grid — Roadmap

> Best-in-class UX & DX. Best performance. Most feature-rich free tier.
> Simple as bare core, rich when plugins added (free + pro).

## Architecture: 3-Layer Model

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: @better-grid/pro (Commercial)                     │
│  Advanced renderers + data operations                       │
│  sparkline, heatmap, avatar, clipboard, grouping, export    │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: @better-grid/plugins (MIT)                        │
│  DX layer — makes the grid useful out of the box            │
│  formatting, editing, sorting, filtering, validation        │
│  + built-in renderers: checkbox, badge, progress, etc.      │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: @better-grid/core (MIT)                           │
│  The engine. No renderers, no formatters. Just the machine. │
│  Virtual scroll, cell pooling, fake scrollbar, frozen cols, │
│  multi-headers, selection, keyboard nav, cellType registry  │
└─────────────────────────────────────────────────────────────┘
```

## Competitive Position

```
                    AG Grid    Handsontable   RevoGrid Pro  Better Grid
Free editing          ✗ ($$$)    ✓*             ✓             ✓
Free checkbox         ✓          ✓              ✗             ✓
Free badge            ✗          ✗              ✗ (Pro)       ✓  ← unique
Free progress bar     ✗          ✗              ✗ (Pro)       ✓  ← unique
Free rating           ✗          ✗              ✗ (Pro)       ✓  ← unique
Free sparkline        ✗ ($$$)    ✗              ✗ (Pro)       ✗ (Pro)
Free validation       ✗          ✓              ✗ (Pro)       ✓
Free sorting          ✓          ✓              ✓             ✓
Plugin architecture   ✗          ✗              ✗             ✓  ← unique
AI-native (MCP)       ✗          ✗              ✗             ✓  ← unique

* Handsontable: free for non-commercial only
```

## Phase 1: Built-in Cell Renderers (Free Plugin)

Extract the 20 custom cellRenderers already in demo pages into reusable, registered cellTypes in `@better-grid/plugins`.

### New cellTypes to register

| cellType | Renders as | Config | Demo usage |
|----------|-----------|--------|------------|
| `checkbox` | Toggle checkbox | — | New (AG Grid has it free) |
| `badge` | Colored pill/chip | `options` with `{label, value, color, bg}` | TaskTracker Status, ComplexGrid Status, LargeDataset Status |
| `progress` | Horizontal bar + % | min/max/thresholds | TaskTracker Progress |
| `boolean` | ✓/✗ or Yes/No | `booleanDisplay: 'check' \| 'yesno'` | BasicGrid Active, FormatEdit InStock, EditableGrid Active |
| `rating` | Stars or numeric | `max`, `precision` | LargeDataset Score |
| `change` | +/- with color | `positiveColor`, `negativeColor` | ComplexGrid YoY Variance |

### New ColumnDef props to support

| Prop | Type | Purpose |
|------|------|---------|
| `cellStyle` | `(value, row) => CSSProperties` | Conditional inline styles without full cellRenderer |
| `cellClass` | `(value, row) => string` | Conditional CSS classes without full cellRenderer |

### Implementation approach

Each cellType is registered via the existing `registerCellType()` API:

```ts
// In @better-grid/plugins
export function cellRenderers(): GridPlugin {
  return {
    name: 'cell-renderers',
    init(ctx) {
      ctx.registerCellType('checkbox', { render, getStringValue, parseStringValue });
      ctx.registerCellType('badge', { render, getStringValue, parseStringValue });
      ctx.registerCellType('progress', { render, getStringValue, parseStringValue });
      ctx.registerCellType('boolean', { render, getStringValue, parseStringValue });
      ctx.registerCellType('rating', { render, getStringValue, parseStringValue });
      ctx.registerCellType('change', { render, getStringValue, parseStringValue });
    },
  };
}
```

Usage stays clean:

```ts
{ id: 'status', header: 'Status', cellType: 'badge', options: [...] }
{ id: 'active', header: 'Active', cellType: 'boolean' }
{ id: 'progress', header: 'Progress', cellType: 'progress' }
```

## Phase 2: Data Type Auto-Detection

Like AG Grid's data type system — infer cellType, editor, filter, and alignment from data:

```ts
// User writes:
{ id: 'active', header: 'Active' }
// Grid sees boolean values → auto-assigns:
//   cellType: 'boolean', editor: 'dropdown', align: 'center'

// User writes:
{ id: 'salary', header: 'Salary' }
// Grid sees numbers → auto-assigns:
//   align: 'right', filter: 'number'
```

9 data types: `text`, `number`, `boolean`, `date`, `dateString`, `currency`, `percent`, `email`, `url`

## Phase 3: Pro Plugins (`@better-grid/pro`)

### Data Operations

| Plugin | Description | Competitor status |
|--------|------------|-------------------|
| `clipboard()` | Copy/paste, fill-down, cut | AG Grid Enterprise, Handsontable included |
| `grouping()` | Row grouping with collapse/expand, aggregation | AG Grid Enterprise, RevoGrid Pro |
| `undoRedo()` | Ctrl+Z/Y history stack | AG Grid Enterprise, Handsontable included |
| `export()` | CSV + Excel (.xlsx) export | AG Grid Enterprise, RevoGrid Pro |
| `search()` | Find & highlight across all cells | AG Grid Enterprise |
| `formulas()` | =SUM, =IF, =VLOOKUP (HyperFormula?) | AG Grid Enterprise, Handsontable included |
| `pagination()` | Page-based navigation | RevoGrid Pro |
| `mergeCells()` | Span rows/columns | RevoGrid Pro |
| `pivotTable()` | Pivot/cross-tab configuration | RevoGrid Pro |

### Advanced Cell Renderers (Pro)

| cellType | Renders as | Competitor |
|----------|-----------|------------|
| `sparkline` | Line/bar/area mini chart | AG Grid Enterprise ($$$) |
| `heatmap` | Color intensity by value | RevoGrid Pro |
| `circularProgress` | Donut/ring indicator | RevoGrid Pro |
| `avatar` | Circular image with fallback | RevoGrid Pro |
| `miniChart` | Pie/donut in cell | RevoGrid Pro |
| `slider` | Inline range control | RevoGrid Pro |
| `timeline` | Date range bar | RevoGrid Pro |
| `changeIndicator` | Arrow icon with +/- | RevoGrid Pro |
| `tooltip` | Rich hover (warning/error/info) | RevoGrid Pro |
| `loading` | Shimmer skeleton state | AG Grid Community |

## Phase 4: AI-Native

### `@better-grid/mcp` (MIT)

Developer tooling via MCP server:
- Column config generation from data schema
- Migration from AG Grid / Handsontable config
- Natural language → filter/sort expressions
- Schema inference from CSV/JSON

### `@better-grid/plugin-ai` (Commercial)

End-user AI features:
- Natural language filtering ("show me overdue tasks assigned to Alice")
- Data summarization
- Smart column suggestions
- Anomaly highlighting

## Framework Adapters

| Adapter | Status |
|---------|--------|
| `@better-grid/react` | ✓ Shipped |
| `@better-grid/vue` | Planned |
| `@better-grid/svelte` | Planned |
| `@better-grid/solid` | Planned |
| `@better-grid/angular` | Planned |

## Principles

1. **Core is the machine** — no opinions about rendering, formatting, or editing
2. **Plugins add opinions** — each plugin is one concern, composable, tree-shakeable
3. **Free tier beats competitors** — more built-in renderers than AG Grid Community
4. **Pro tier has visual wow** — sparklines, heatmaps, charts that sell the upgrade
5. **AI-native is the moat** — no competitor has MCP or runtime AI features
6. **Performance is non-negotiable** — 10M cells, 141 FPS, ~200 DOM elements
