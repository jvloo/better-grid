# Better Grid — Roadmap

> Best-in-class UX & DX. Best performance. Most feature-rich free tier.
> Simple as bare core, rich when plugins added (free + pro).

## Phase status

| Phase                                              | Status        | Notes                                                                                  |
| -------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------- |
| Phase 0A — Row hierarchy                           | ✓ Shipped     | `hierarchy()` free plugin + core `getRowId`/`getParentId`/expanded state               |
| Phase 0B — Pinned rows (footer/summary)            | ✓ Shipped     | `pinned: { top, bottom }` in `GridOptions`                                             |
| Phase 0C — Additional editor types + editor mode   | ✓ Shipped     | `cellEditor: 'text' \| 'dropdown' \| 'select' \| 'selectWithInput' \| 'number' \| 'date' \| 'autocomplete' \| 'masked'`; `editing({ editorMode: 'float' \| 'inline' })`; `column.alwaysInput` for permanent live inputs |
| Phase 0D — Clipboard (free)                        | ✓ Shipped     | `clipboard()` plugin + `'clipboard'` feature                                            |
| Phase 0E — Filter UI overhaul                      | ✓ Shipped     | Floating filter panel replaces `prompt()`                                              |
| Phase 0F — Row aggregation in hierarchy            | ✓ Shipped     | `aggregation()` in `@better-grid/pro`                                                  |
| Phase 0G — Bug fixes & cleanup                     | ✓ Shipped     | Multi-range Ctrl+click, key binding dispatch, `precision` promotion, etc.              |
| Phase 1 — Built-in cell renderers                  | ✓ Shipped     | `cellRenderers()` plugin registers `badge`, `progress`, `boolean`, `rating`, `change`, `link`, `timeline`, `tooltip`, `loading`, `custom`. React `defineColumn` (`col.<type>`) wraps them. |
| v1 init API redesign                               | ✓ Shipped     | `mode` presets, `features` registry, `defineColumn`, `useGrid`, `configureBetterGrid`, `context` ref. See `docs/migration-v0-to-v1.md`. |
| RHF bridge (`useGridForm`)                         | ✓ Shipped     | `@better-grid/react/rhf` sub-export                                                    |
| Validation `messageRenderer`                       | ✓ Shipped     | Per-rule + per-column callback returning HTMLElement or string                         |
| MUI theme integration                              | ✓ Shipped     | `docs/mui-theme-integration.md` wires palette/typography/density/dark mode             |
| Phase 2 — Data type auto-detection                 | Planned       | `autoDetect()` plugin scaffolding exists; full inference engine TODO                   |
| Phase 3 — Pro plugins (full catalog)               | In progress   | gantt, aggregation, merge-cells, row-actions, pro-renderers shipped; clipboard-pro, formulas, pivot pending |
| Phase 4 — AI integration (`mcp` + `plugin-ai`)     | Planned       | See "Our Differentiation Angle" below                                                  |

The detailed sections below are kept verbatim as historical planning context. Where they describe a feature now shipped, the implementation may have evolved — treat the API examples as illustrative, not authoritative.

## Architecture: 3-Layer Model

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: @better-grid/pro (Commercial)                     │
│  Advanced renderers + power features                        │
│  sparkline, heatmap, avatar, grouping (aggregation),        │
│  clipboard (fill-down/series), export, undo/redo, formulas  │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: @better-grid/plugins (MIT)                        │
│  DX layer — makes the grid useful out of the box            │
│  formatting, editing, sorting, filtering, validation,       │
│  hierarchy, clipboard (copy/paste), built-in renderers      │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: @better-grid/core (MIT)                           │
│  The engine. No renderers, no formatters. Just the machine. │
│  Virtual scroll, cell pooling, fake scrollbar, frozen cols, │
│  pinned rows, multi-headers, selection, keyboard nav,       │
│  cellType registry, row hierarchy model                     │
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
Free hierarchy / collapse  ✗ ($$$)    ✗              ✗ (Pro)      ✗ (Pro)     ✓  ← unique free
Free clipboard (copy/paste)✗ ($$$)    ✓              ✗ (Pro)      ✗ (Pro)     ✓  ← unique free
Free pinned rows (footer)  ✓          ✓              ✗            ✓           ✓
Plugin system              Modules    Plugins        BasePlugin   Slots       Composable plugins
Type-safe plugin DX        ✗          ✗              ✗            ✗           ✓  ← unique
Framework-agnostic         ✓          ✓              ✓            ✗ (React)   ✓
MCP server (dev)           ✓ (free)   ✗              ✗            ✓ (free)    Planned
AI toolkit (runtime)       ✓ ($$$)    ✗              ✗            ✓ ($$$)     Planned (free tier)

* Handsontable: free for non-commercial only ($899/dev/yr commercial)
```

---

## Phase 0: Enterprise Foundation ★ PRIORITY

> Migration-critical features for replacing ReactVirtualized + ReactGrid in production apps.
> These unblock real adoption — everything else is polish until these ship.

### 0A. Row Hierarchy (Core + Free Plugin)

**Why:** Both Feasibility (cost hierarchy) and Dev Mgmt (forecast parent→child1→child2) modules
need parent-child rows with collapse/expand. ReactGrid's lack of virtualization for collapsed
rows is the primary performance problem we're solving.

**Core engine (`@better-grid/core`):**

Row hierarchy model — virtual scroll engine understands parent-child relationships and skips
collapsed subtrees in prefix-sum calculation.

```ts
// New grid config option
createGrid({
  data: rows,
  getRowId: (row) => row.id,            // Stable row identity
  getParentId: (row) => row.parentId,    // null = root row
  defaultExpanded: true,                 // Start expanded or collapsed
});

// Core state: expandedRows set
// Virtual engine: builds flat visible list by walking tree, skipping collapsed subtrees
// Row offsets recalculated on expand/collapse (prefix-sum rebuild, O(n))
```

New ColumnDef props:

| Prop | Type | Purpose |
|------|------|---------|
| `indent` | `boolean` | Auto-indent cell content based on tree depth |

New state slice: `expandedRows: Set<string | number>` with `toggleRow(id)`, `expandAll()`, `collapseAll()`.

**Free plugin (`@better-grid/plugins`):**

`hierarchy()` plugin — UI layer for tree interactions.

```ts
import { hierarchy } from '@better-grid/plugins';

plugins: [
  hierarchy({
    expandColumn: 'name',       // Which column shows the expand toggle
    indentSize: 20,             // px per depth level
    expandIcon: '▸',            // Collapsed icon (or custom renderer)
    collapseIcon: '▾',          // Expanded icon
  }),
]
```

Features:
- Expand/collapse toggle in designated column
- Indent rendering based on tree depth
- Keyboard: Arrow Right to expand, Arrow Left to collapse
- CSS classes: `bg-cell--parent`, `bg-cell--leaf`, `bg-cell--depth-{n}`
- Row styling hooks: parent rows can have bold/grey background via `cellClass`

**Wise-frontend-app mapping:**
- Feasibility cost tables: `parentId` links cost items to parent categories
- DM forecast tables: `parentCode` → child1 → child2 hierarchy
- DM timeline tables: `parentCode` + `isParent` flag with collapse state
- DM summary tables: multi-level parent > child1 > child2 > cashflow

### 0B. Pinned Rows — Footer & Summary (Core)

**Why:** Feasibility module uses separate synced MultiGrid instances for footer/total rows.
Core needs native pinned row support to eliminate this hack.

```ts
createGrid({
  data: rows,
  pinnedTopRows: [summaryRow],      // Pinned above scrollable area
  pinnedBottomRows: [totalsRow],    // Pinned below scrollable area (footer)
});
```

Implementation: Pinned rows render outside the virtual scroll viewport but share column
layout and horizontal scroll position. Similar to frozen header rows but for data rows.

**Frozen vs Pinned — they coexist:**
- `frozenTopRows: N` — freeze first N rows **from the main data array** (stays in place while scrolling). Same concept as `frozenLeftColumns`.
- `pinnedTopRows: [row]` — **separate data** pinned above the scrollable area (not in the data array).
- `pinnedBottomRows: [row]` — **separate data** pinned below the scrollable area (footer/totals).

No deprecation. `frozen` = lock N items from main array. `pinned` = attach separate data outside main array.

**Wise-frontend-app mapping:**
- Cost tables: footer row with column totals synced via ScrollSync
- Summary tables: aggregation rows pinned at bottom

### 0C. Additional Editor Types + Editor Mode (Free Plugin)

**Why:** Dev Mgmt module uses date pickers, autocomplete with "create new" capability,
and number inputs with accounting format. Current editing plugin only has text and dropdown.

Extend the `editing()` plugin with new editor types and configurable editor mode:

| Editor | Trigger | Config | Wise-app usage |
|--------|---------|--------|----------------|
| `date` | Calendar popup | `dateFormat`, `min`, `max` | Cost start/end dates, timeline phases |
| `autocomplete` | Searchable dropdown | `options`, `allowCreate`, `onCreateOption` | Account selection with "create new item" |
| `number` | Formatted number input | `precision`, `min`, `max`, `accounting` | Monthly amounts, rates, percentages |

```ts
const columns = [
  { id: 'start', header: 'Start', editor: 'date', dateFormat: 'short' },
  { id: 'account', header: 'Account', editor: 'autocomplete',
    options: accounts, meta: { allowCreate: true } },
  { id: 'amount', header: 'Amount', editor: 'number', precision: 2 },
];
```

New EditorType union: `'text' | 'dropdown' | 'date' | 'autocomplete' | 'number'`

**Editor mode** — configurable floating vs inline editing:

```ts
editing({
  editorMode: 'float',   // 'float' = floating overlay (current default, auto-resizes)
                          // 'inline' = edit inside cell bounds (simpler, no overflow)
})
```

- `float` (default): Editor appears as a floating box anchored to the cell, can grow wider/taller for long content. Current behavior.
- `inline`: Editor renders inside the cell element itself. Simpler UX, no z-index issues, but content is clipped to cell bounds. Better for dense data-entry grids.

### 0D. Clipboard — Copy & Paste (Free Plugin)

**Why:** Dev Mgmt module uses copy/paste heavily for monthly data entry (filling 24+ month
columns). AG Grid gates clipboard behind Enterprise ($999/yr). Making basic clipboard free
is a competitive differentiator.

```ts
import { clipboard } from '@better-grid/plugins';

plugins: [
  clipboard({
    includeHeaders: false,    // Copy column headers with data
    separator: '\t',          // TSV for Excel compatibility
  }),
]
```

**Free tier features:**
- Ctrl+C: serialize selected range to TSV (plain text) + HTML table (rich paste)
- Ctrl+V: parse TSV/CSV from clipboard, apply to selection via `onCellChange`
- Ctrl+X: copy + clear selected cells
- Multi-range copy support
- Paste size validation (warn if paste range exceeds data bounds)

**Wise-frontend-app mapping:**
- `rg-table.tsx` has custom copy handler that builds plain text + HTML tables manually
- Monthly data entry: paste 24 months of values from Excel in one operation

### 0E. Filter UI Overhaul (Free Plugin)

**Why:** Current filtering uses browser `prompt()` dialog — unacceptable for production.
All competitors use custom floating panels. This is a credibility issue.

Replace the `prompt()` call in `grid.ts` with a proper floating filter panel:

```
┌─────────────────────────┐
│  Filter: Column Name    │
│  ┌───────────────────┐  │
│  │ contains       ▼  │  │   ← operator dropdown
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │ search value...   │  │   ← text/number input
│  └───────────────────┘  │
│  [Apply]    [Clear]     │
└─────────────────────────┘
```

Triggered by: header right-click context menu → "Filter..." (current trigger, just better UI).
Future: add filter icon in header cell for direct access.

Operator set per column type:
- **Text**: contains, equals, starts with, ends with, not equals, is empty
- **Number**: equals, not equals, greater than, less than, between
- **Date**: before, after, between, equals

### 0F. Row Aggregation in Hierarchy (Pro Plugin)

**Why:** Summary tables need SUM/AVG/COUNT in parent rows computed from children.
Basic hierarchy (collapse/expand) is free. Aggregation is the Pro upsell.

```ts
import { grouping } from '@better-grid/pro';

plugins: [
  grouping({
    aggregations: {
      amount: 'sum',           // Built-in: sum, avg, count, min, max
      margin: (children) => {  // Custom aggregation function
        const total = children.reduce((s, r) => s + r.revenue, 0);
        return total > 0 ? children.reduce((s, r) => s + r.profit, 0) / total : 0;
      },
    },
    autoGroupColumn: true,     // Auto-generate group column from row values
  }),
]
```

**Pro-only features:**
- Auto-grouping by column value (drag column to group bar)
- Built-in aggregation functions (sum, avg, count, min, max, first, last)
- Custom aggregation functions per column
- Group header row rendering with expand/collapse + aggregated values
- Multi-level grouping (group by A, then by B within A)

### 0G. Bug Fixes & Cleanup (Core)

Fixes identified during review that should ship with Phase 0:

| Issue | Fix |
|-------|-----|
| Multi-range selection (Ctrl+click) not wired | Add `ctrlKey`/`metaKey` check in cell click handler → `addRangeToSelection()` |
| Key binding dispatch ignores `binding.key` | `handleKeyDown` calls every binding handler for every keypress. Enter binding doesn't check `event.key`, so it starts editing on Arrow/Tab/Escape too. Fix: check `binding.key === '*' \|\| binding.key === event.key` before calling handler. |
| `toggle` cellType in union but unimplemented | Remove `toggle` from `CellType` union, consolidate to `boolean` |
| `precision` buried in `meta` | Promote to first-class `ColumnDef.precision` prop |
| ~~`valueParser` / `valueFormatter` naming~~ | ~~Consolidated to `valueModifier: { format, parse }`~~ Done |

---

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

| Plugin | Description | Free equivalent | Competitor status |
|--------|------------|-----------------|-------------------|
| `clipboard()` pro | Fill-down, fill-series, Excel-rich paste | Basic copy/paste is free | AG Grid Enterprise |
| `grouping()` | Auto-group by column + aggregation | Basic hierarchy is free | AG Grid Enterprise, RevoGrid Pro |
| `undoRedo()` | Ctrl+Z/Y history stack | — | AG Grid Enterprise, Handsontable included |
| `export()` | CSV, Excel (.xlsx), PDF, PNG export | — | AG Grid Enterprise, RevoGrid Pro |
| `search()` | Find & highlight across all cells | — | AG Grid Enterprise |
| `formulas()` | =SUM, =IF, =VLOOKUP (HyperFormula?) | — | AG Grid Enterprise, Handsontable included |
| `pagination()` | Page-based navigation | — | RevoGrid Pro |
| `mergeCells()` | Span rows/columns | — | RevoGrid Pro |
| `pivotTable()` | Pivot/cross-tab configuration | — | RevoGrid Pro |

### Export Plugin Details

```ts
import { exportPlugin } from '@better-grid/pro';

plugins: [
  exportPlugin({ formats: ['csv', 'xlsx', 'pdf', 'png'] }),
]

// Programmatic API — download file
const api = grid.getPluginApi('export');
await api.exportToFile('xlsx', { filename: 'report.xlsx' });
await api.exportToFile('pdf', { orientation: 'landscape' });
await api.exportToFile('png', { scale: 2 });

// Programmatic API — get raw buffer (for custom pipelines)
const buffer: ArrayBuffer = await api.exportToBuffer('xlsx');
const blob: Blob = await api.exportToBlob('pdf');

// Programmatic API — get structured data (for external ExcelJS/jsPDF pipelines)
const gridData = api.getExportData({
  includeHeaders: true,
  includePinnedRows: true,
  visibleOnly: false,
});
// Returns: { headers: ExportCell[][], rows: ExportCell[][], pinnedTop: ExportCell[][], pinnedBottom: ExportCell[][] }
// ExportCell: { value, formattedValue, colSpan, rowSpan, style, columnDef }
```

`getExportData()` is designed for existing export pipelines (e.g., wise-frontend-app's
ExcelJS + jsPDF + html2canvas Web Worker architecture) — provides structured cell data
without requiring rewrite of the export logic.

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
3. **Free tier beats competitors** — hierarchy + clipboard + renderers, all free (AG Grid charges $999/yr)
4. **Pro tier has power features** — aggregation, fill-down, export, formulas that justify the upgrade
5. **AI as a plugin, not a bolt-on** — composable AI with free NL filtering (competitors gate behind $$)
6. **Performance is non-negotiable** — 10M cells, 60 FPS sustained, ~200 cell elements
