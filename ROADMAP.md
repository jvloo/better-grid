# Better Grid — Roadmap

> Best-in-class UX & DX. Best performance. Most feature-rich free tier.
> Simple as bare core, rich when plugins added (free + pro).

## Architecture: 3-Layer Model

```
┌──────────────────────────────────────────────────────────────────┐
│  Layer 3: @better-grid/pro (Commercial, source-available)        │
│  gantt, aggregation, merge-cells, row-actions, pro-renderers     │
│  (sparkline, heatmap, mini-chart, advanced commercial cells)     │
├──────────────────────────────────────────────────────────────────┤
│  Layer 2: @better-grid/plugins (MIT)                             │
│  editing (incl. alwaysInput), sorting, filtering, formatting,    │
│  validation (incl. messageRenderer), hierarchy, clipboard,       │
│  grouping, pagination, search, export, undo/redo, cellRenderers, │
│  autoDetect                                                      │
├──────────────────────────────────────────────────────────────────┤
│  Layer 1: @better-grid/core (MIT)                                │
│  Virtual scroll, cell pooling, fake scrollbar, frozen cols,      │
│  pinned rows, multi-headers, selection, keyboard nav,            │
│  cellType registry, row hierarchy model                          │
└──────────────────────────────────────────────────────────────────┘
```

## Phase status

| Phase                                              | Status        | Notes                                                                                  |
| -------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------- |
| Phase 0A — Row hierarchy                           | ✓ Shipped     | `hierarchy()` plugin + core `getRowId`/`getParentId`/expanded state                    |
| Phase 0B — Pinned rows (footer/summary)            | ✓ Shipped     | `pinned: { top, bottom }` in `GridOptions`                                             |
| Phase 0C — Editor types + editor mode              | ✓ Shipped     | `cellEditor: 'text' \| 'dropdown' \| 'select' \| 'selectWithInput' \| 'number' \| 'date' \| 'autocomplete' \| 'masked'`; `editing({ editorMode: 'float' \| 'inline' })`; `column.alwaysInput` for permanent live inputs |
| Phase 0D — Clipboard (free)                        | ✓ Shipped     | `clipboard()` plugin + `'clipboard'` feature                                           |
| Phase 0E — Filter UI overhaul                      | ✓ Shipped     | Floating filter panel replaces `prompt()`                                              |
| Phase 0F — Row aggregation in hierarchy            | ✓ Shipped     | `aggregation()` in `@better-grid/pro`                                                  |
| Phase 0G — Bug fixes & cleanup                     | ✓ Shipped     | Multi-range Ctrl+click, key binding dispatch, `precision` promotion, etc.              |
| Phase 1 — Built-in cell renderers                  | ✓ Shipped     | `cellRenderers()` plugin: `badge`, `progress`, `boolean`, `rating`, `change`, `changeIndicator`, `link`, `timeline`, `tooltip`, `loading`, `custom`. React `defineColumn` (`col.<type>`) wraps them. |
| v1 init API redesign                               | ✓ Shipped     | `mode` presets, `features` registry, `defineColumn`, `useGrid`, `configure`, `context` ref. See [`docs/internal/v1-init-api-history.md`](docs/internal/v1-init-api-history.md). |
| RHF bridge (`useGridForm`)                         | ✓ Shipped     | `@better-grid/react/rhf` sub-export                                                    |
| Validation `messageRenderer`                       | ✓ Shipped     | Per-rule + per-column callback returning `HTMLElement` or string                       |
| MUI theme integration                              | ✓ Shipped     | [`docs/guides/theming-with-mui.md`](docs/guides/theming-with-mui.md)                   |
| Phase 1.5 — API surface refresh                    | ✓ Shipped     | `accessorKey → field`, `accessorFn → valueGetter`, `header → headerName + headerRenderer`, optional `id`, `column.hide` / `flex` / `headerAlign`, `bordered` + `striped` booleans, discriminated `selection`, `cell:change` event, `frozen.clip` event, top-level `getRowId`, `(value, row)` formatter sigs. Tagged `pre-release-phase1`. |
| `@better-grid/codemods`                            | ✓ Shipped     | jscodeshift transforms for migration from AG Grid, MUI X, TanStack Table, Handsontable, RevoGrid, react-data-grid. Tagged `pre-release-phase2`. |
| Phase 2 — Data type auto-detection                 | ✓ Shipped     | `autoDetect()` infers `cellType`, alignment from data values; survives `setColumns` via `'columns:set'` re-application |
| Phase 3 — Pro plugins (full catalog)               | In progress   | gantt, aggregation, merge-cells, row-actions, pro-renderers shipped; clipboard-pro, formulas, pivot pending |
| Phase 4 — AI integration (`mcp` + `plugin-ai`)     | Planned       |                                                                                        |

## Phase 1.5 — API surface refresh + codemods (shipped)

Pre-publish breaking changes consolidated for v1.0.0. See `docs/internal/specs/2026-04-26-incoming-migration-alignment-design.md` and `CHANGELOG.md` for the full diff.

Highlights:
- ColumnDef renames: `accessorKey → field`, `accessorFn → valueGetter`, `header` split into `headerName` + `headerRenderer`.
- Optional `id` (defaults to `field`); object form for headers/footers dropped.
- New: `column.hide`, `column.flex`, `column.headerAlign`, `column.precision`, `column.alwaysInput`.
- Replaced `tableStyle` enum with `bordered` + `striped` booleans.
- `selection` is now a discriminated union (`false | { mode: 'cell' | 'range', multiRange?, fillHandle? }`); default is `{ mode: 'cell' }`.
- Top-level `getRowId`; `valueFormatter` / `valueParser` extended to `(value, row)`; `cellStyle` / `cellClass` extended with `rowIndex`; `comparator` extended with `(a, b, rowA?, rowB?)`.
- `CellChange.oldValue` is now the cell value (not the whole row).
- Events renamed: `data:change → cell:change`, `freezeClip:change → frozen:clip`.
- `configureBetterGrid` renamed to `configure`.

`@better-grid/codemods` ships 6 jscodeshift transforms to migrate from popular grid libraries; see the codemod CLI in the package README.

## Phase 2 — Data type auto-detection (shipped)

Infer `cellType`, editor, filter, alignment from data values:

```ts
{ id: 'active', headerName: 'Active' }     // → cellType: 'boolean', editor: 'select', align: 'center'
{ id: 'salary', headerName: 'Salary' }     // → align: 'right', filter: 'number'
```

Types: `text`, `number`, `boolean`, `date`, `dateString`, `currency`, `percent`, `email`, `url`.

## Phase 3 — Pro plugins (remaining)

| Plugin             | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `clipboard()` pro  | Fill-down, fill-series, Excel-rich paste                |
| `formulas()`       | `=SUM`, `=IF`, `=VLOOKUP` (HyperFormula?)               |
| `pivotTable()`     | Pivot/cross-tab configuration                            |
| `mergeCells()`     | Already shipped — enhance with cross-frozen-boundary spans |

### Export plugin (in progress)

```ts
import { exportPlugin } from '@better-grid/pro';

const api = grid.api.plugins.export;
await api.exportToFile('xlsx', { filename: 'report.xlsx' });
const buffer = await api.exportToBuffer('xlsx');

// Structured data for external pipelines (existing ExcelJS/jsPDF integrations):
const gridData = api.getExportData({ includeHeaders: true, includePinnedRows: true });
// { headers, rows, pinnedTop, pinnedBottom } where each cell is { value, formattedValue, colSpan, rowSpan, style, columnDef }
```

### Pro renderers

`sparkline`, `heatmap`, `circularProgress`, `avatar`, `miniChart`, `slider`, `timeline`, `changeIndicator`, `tooltip`, `loading` (premium variants).

## Phase 4 — AI integration

### `@better-grid/mcp` (MIT, planned)

Developer-tooling MCP server: column config from TS types / data samples, migration from AG Grid / Handsontable / MUI X configs, NL → filter/sort, schema inference from CSV/JSON/API endpoints, plugin recommendation.

### `@better-grid/plugin-ai` (tiered, planned)

- **Free:** NL filtering ("show overdue tasks assigned to Alice"), NL sorting/grouping.
- **Pro:** data summarization on selected ranges, anomaly highlighting, smart column suggestions, formula generation from plain English.

## Framework adapters

| Adapter                | Status   |
| ---------------------- | -------- |
| `@better-grid/react`   | Shipped  |
| `@better-grid/vue`     | Planned  |
| `@better-grid/svelte`  | Planned  |
| `@better-grid/solid`   | Planned  |
| `@better-grid/angular` | Planned  |

## Principles

1. Core is the machine — no opinions about rendering, formatting, editing.
2. Plugins add opinions — one concern each, composable, tree-shakeable.
3. Free tier is rich — hierarchy, clipboard, validation, multi-level headers, pinned rows, ~10 cell renderers, all MIT.
4. Pro tier carries power features — aggregation, formulas, pivots, advanced renderers.
5. AI as a plugin, not a bolt-on.
6. Performance is non-negotiable — 10M cells, 60 FPS sustained, ~200 cell elements.
