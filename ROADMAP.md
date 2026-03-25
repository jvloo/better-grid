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
                         AG Grid    Handsontable   RevoGrid     MUI X       Better Grid
Free editing               ✓          ✓*             ✓ (MIT)      ✓           ✓
Free cell renderers        2          11             4            6           6+ (MIT)
Free badge/progress/rating ✗          ✗              ✗ (Pro)      ✗           ✓  ← unique free
Free sparkline             ✗ ($$$)    ✗              ✗ (Pro)      ✗           ✗ (Pro)
Free validation            ✓          ✓              ✗ (Pro)      ✓           ✓
Free clipboard             ✗ ($$$)    ✓              ✗ (Pro)      ✗ (Pro)     ✗ (Pro)
Plugin system              Modules    Plugins        BasePlugin   Slots       Composable plugins
Type-safe plugin DX        ✗          ✗              ✗            ✗           ✓  ← unique
Framework-agnostic         ✓          ✓              ✓            ✗ (React)   ✓
MCP server (dev)           ✓ (free)   ✗              ✗            ✓ (free)    Planned
AI toolkit (runtime)       ✓ ($$$)    ✗              ✗            ✓ ($$$)     Planned (free tier)

* Handsontable: free for non-commercial only ($899/dev/yr commercial)
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

## Phase 4: AI Integration

### Competitive Landscape (as of 2026-03)

AG Grid shipped both MCP server (free/MIT, Oct 2025) and AI Toolkit (Enterprise, Oct 2025).
MUI X shipped MCP server (free) and "Ask Your Table" (Premium tier, 2026).
Bryntum has MCP server + AIFilter (paid). Syncfusion has MCP server (free).
Handsontable, RevoGrid, Tabulator: no AI features.

**AG Grid's approach:** `getStructuredSchema()` → send to any LLM → `setState()` applies result.
Controls 7 features: filter, sort, group, pivot, aggregate, column visibility, column sizing.
No data sent to LLM (only schema/metadata). Enterprise only ($999/dev/yr).

**MUI X's approach:** Similar NL→state pattern. Premium tier (contact sales).

### Our Differentiation Angle

AG Grid and MUI X bolted AI onto mature products. Their MCP servers are doc-search wrappers.
Their runtime AI is state-manipulation only (filter/sort/group). No data intelligence.

Better Grid can differentiate by:
1. **Plugin-native AI** — AI as a composable plugin, not a monolithic API bolted onto the grid
2. **Data-aware AI** — go beyond state manipulation: anomaly detection, smart suggestions, summarization
3. **Open runtime AI** — free tier NL→filter/sort (AG Grid gates this behind Enterprise)
4. **Migration tooling** — MCP tools to convert AG Grid/Handsontable configs (competitors don't help you leave)
5. **Schema-first DX** — generate full grid config from TypeScript types or API responses

### `@better-grid/mcp` (MIT)

Developer tooling via MCP server:
- Column config generation from TypeScript types / data samples
- Migration from AG Grid / Handsontable / MUI X config → Better Grid
- Natural language → filter/sort expressions
- Schema inference from CSV/JSON/API endpoints
- Plugin recommendation based on use case

### `@better-grid/plugin-ai` (Tiered)

**Free tier** (differentiator vs AG Grid Enterprise):
- Natural language filtering ("show overdue tasks assigned to Alice")
- Natural language sorting/grouping

**Pro tier:**
- Data summarization on selected ranges
- Anomaly highlighting (outlier detection)
- Smart column suggestions (formatting, grouping based on data patterns)
- Formula/computed column generation from plain English

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
5. **AI as a plugin, not a bolt-on** — composable AI with free NL filtering (competitors gate behind $$)
6. **Performance is non-negotiable** — 10M cells, 60 FPS sustained, ~200 cell elements
