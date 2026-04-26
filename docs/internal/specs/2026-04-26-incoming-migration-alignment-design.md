# Incoming-migration alignment — Design

> Reduce the cost of migrating to Better Grid from the most-adopted data-grid libraries (AG Grid, MUI X Data Grid, TanStack Table, Handsontable, RevoGrid, react-data-grid). Two pre-publish property renames + a one-shot codemod package.

## Goal

A developer copying a column definition or a grid options object from AG Grid or MUI X into a Better Grid project should hit the smallest possible diff. For mechanical changes that aren't pure renames (event names, plugin instantiation, value-getter param-unwrapping), a codemod runs in seconds across a whole codebase and reports what it couldn't auto-convert.

## Non-goals

- Aliasing two names for the same property at runtime — adds permanent API bloat.
- Aligning renderer signatures to JSX — DOM-first is intentional for the cell-pooling perf model.
- Aligning the plugin/feature opt-in model to AG Grid's `ModuleRegistry` — the typed `mode`/`features` registry is intentional.
- Adding new column features (`flex`, `headerAlign`, `hidden`) — handled separately as additive PRs when adoption signals demand.

## Phase 1 — Pre-publish renames + small additive props

### Renames

Where AG Grid + MUI X agree and Better Grid currently differs:

| Concept                            | AG / MUI X     | Better Grid (now)         | Better Grid (after)                              |
| ---------------------------------- | -------------- | ------------------------- | ------------------------------------------------ |
| Bind a column to a row field       | `field`        | `accessorKey`             | `field`                                          |
| Column header label / renderer     | `headerName`   | `header`                  | `headerName`                                     |
| Computed column value              | `valueGetter`  | `accessorFn`              | `valueGetter`                                    |
| Top-level row-id resolver          | `getRowId`     | `hierarchy.getRowId`      | top-level `getRowId` (still mirrored at `hierarchy.getRowId` for hierarchy users) |

`headerName` keeps the union shape Better Grid already uses: `string | (() => HTMLElement | string)`. AG Grid users who only set strings copy-paste verbatim; users who want a custom-rendered header use the function form.

`valueGetter` keeps the existing signature: `(row: TData, rowIndex: number) => unknown`. AG Grid passes a `params` object; MUI X passes `({ row, …})`. The codemod (Phase 2) unwraps both into our flat shape.

`getRowId` becomes a top-level `GridOptions` field accepting `(row: TData) => string | number`. When `hierarchy: { getRowId }` is also set, the hierarchy field wins for hierarchy state, but selection / data-swap stability uses the top-level resolver. Documenting both paths keeps the hierarchy-only consumers' code identical.

### New column props (additive)

Properties that AG Grid and/or MUI X have and Better Grid currently doesn't — adopting them under the same name removes a migration site:

| Property                       | Source       | Type                                       | Behavior                                                                                  |
| ------------------------------ | ------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `column.hide`                  | AG + MUI X   | `boolean`                                  | When `true`, column is excluded from the rendered layout but stays in `columns`. Toggleable at runtime via `grid.api.setColumnHidden(id, hide)`. |
| `column.flex`                  | MUI X        | `number`                                   | Flex-grow share for spare horizontal space. Mirrors flexbox: a column with `flex: 2` gets twice the share of `flex: 1`. Combines with `width` (treated as `flex-basis`) and respects `minWidth` / `maxWidth`. |
| `column.headerAlign`           | MUI X        | `'left' \| 'center' \| 'right'`            | Header-cell alignment, independent of cell `align`. Defaults to `align` when unset (preserving today's behavior).                |

These are additive; existing column definitions keep working unchanged.

### Files touched

**Renames:**

- `packages/core/src/types.ts` — rename the four fields (in `ColumnDef<TData>` and `GridOptions<TData>`).
- `packages/core/src/grid.ts` — wire top-level `getRowId` through `createGrid`; default to `hierarchy.getRowId` when only that is set.
- `packages/core/src/columns/manager.ts` — read sites for `accessorKey` → `field`, `accessorFn` → `valueGetter`.
- `packages/core/src/rendering/headers.ts`, `pipeline.ts`, `pinned-rows.ts` — read sites for `header` → `headerName`.
- `packages/core/src/selection/`, `packages/core/src/state/` — any selection-stability paths that previously relied on `hierarchy.getRowId` should now read the top-level `getRowId` (with the hierarchy mirror as fallback).
- `packages/react/src/defineColumn.ts` — builders set `field` and `headerName`; new builders accept `hide`, `flex`, `headerAlign`.
- `packages/react/src/useGrid.ts` — accepts top-level `getRowId` in options.
- `packages/plugins/src/free/*.ts` — every plugin that reads the renamed fields (editing, validation, hierarchy, sorting, filtering, etc.) — bulk find/replace.
- `packages/pro/src/*.ts` — same.

**New column props:**

- `packages/core/src/types.ts` — add `hide?: boolean`, `flex?: number`, `headerAlign?: 'left' | 'center' | 'right'` to `ColumnDef<TData>`.
- `packages/core/src/columns/manager.ts` — `hide` excludes the column from the live `columns` array consumed by the renderer; `setColumnHidden(id, hide)` API for runtime toggling.
- `packages/core/src/virtualization/layout.ts` — `flex` integrates into the column-width allocation pass (`flex-basis = width`, distribute remaining viewport width by `flex` ratio, clamp to `minWidth` / `maxWidth`).
- `packages/core/src/rendering/headers.ts` — `headerAlign` overrides `align` for the header cell; default falls back to `align`.

**Docs / playground / tests:**

- `apps/playground/src/pages/*.tsx` — every demo page that uses raw `ColumnDef` (the FSBT pages and the few non-`col.*` examples).
- `docs/migrations/from-*.md` — update the right column of every mapping table; rows that were previously "flagged" because we lacked `flex` / `headerAlign` / `hide` flip to "auto-converted".
- `docs/internal/v1-init-api-history.md` — historical paragraph mentioning `accessorKey`.
- `docs/guides/theming-with-mui.md`, `README.md`, `AGENTS.md`, `CHANGELOG.md` — any prose mention.
- `packages/core/tests/`, `packages/react/tests/` — fixtures and assertions; new tests for `hide` toggling, `flex` width allocation, `headerAlign` rendering.

### Verification

- All package builds green (`node scripts/build.js`).
- `pnpm --filter @better-grid/core test` and `pnpm --filter @better-grid/react test` green (existing tests + new ones for `hide` / `flex` / `headerAlign`).
- Visual check `/demo/*` and `/demo-realworld/*` in the playground — no regressions.
- A new `/demo/column-features` page exercises `hide` / `flex` / `headerAlign` end-to-end.

### Out of scope for Phase 1

- Codemod package (Phase 2).
- Per-column header-class hook (`headerClass` / `headerClassName`) — AG and MUI disagree on the name, defer until consistent need.
- Aliasing.

## Phase 2 — `@better-grid/codemods` package

### Distribution

- New workspace package `packages/codemods/` published to npm under `@better-grid/codemods`.
- Source-available MIT, like the rest of `@better-grid/*` non-pro packages.
- Bundles a CLI shim — usage:

```bash
npx @better-grid/migrate from-ag-grid src/
npx @better-grid/migrate from-mui-x-data-grid src/
npx @better-grid/migrate from-tanstack-table src/
npx @better-grid/migrate from-handsontable src/
npx @better-grid/migrate from-revogrid src/
npx @better-grid/migrate from-react-data-grid src/
```

The CLI accepts:
- `<paths…>` — files or directories to walk; defaults to `src/`.
- `--dry-run` — print the would-be diff, don't write.
- `--report=<path>` — write a JSON summary of files changed + sites flagged for manual review.
- `--ext=ts,tsx,js,jsx` — file extensions to process; default covers JS + TS + JSX/TSX.

### Tooling

[`jscodeshift`](https://github.com/facebook/jscodeshift) — the standard React-ecosystem codemod toolkit. Matches what AG Grid, MUI X, react-router, and Next.js use for their own migration codemods. Parses TypeScript via `@babel/parser`; preserves comments and formatting where it can; round-trips through `recast`.

Why jscodeshift over alternatives:
- AST-level matching catches `headerName` only when it appears as an object key in a column-shaped literal — not in unrelated strings/comments.
- The transform API is small enough that each `from-<lib>` transform fits in one ~150-line file.
- Familiar to anyone who's run a React or MUI codemod before; lower barrier for community contributions.

### Per-transform scope

Each transform handles three layers, in order: per-column property renames, grid-level option renames, then event-name and imperative-API renames. Renderer signature changes are detected and **not** auto-converted — they're tagged with `// @better-grid/migrate: review — JSX renderer needs DOM port`.

#### `from-ag-grid`

| Source                                                     | Output                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `cellEditor: 'agTextCellEditor'`                           | `cellEditor: 'text'`                                                     |
| `cellEditor: 'agSelectCellEditor'`                         | `cellEditor: 'select'`                                                   |
| `cellEditor: 'agNumberCellEditor'`                         | `cellEditor: 'number'`                                                   |
| `cellEditor: 'agDateCellEditor'`                           | `cellEditor: 'date'`                                                     |
| `cellEditorParams: { values: [...] }`                      | column-level `options: [...]`                                            |
| `valueGetter: ({ data, node }) => …`                       | `valueGetter: (row) => …` (unwrap params; `data` → `row`)                |
| `hide: true`                                               | `hide: true` (no change — adopted name)                                  |
| `cellRenderer: MyReactComponent`                           | flagged — manual port to `(container, ctx) => void`                      |
| `cellRendererParams: {...}`                                | flagged — usually unused after manual port                               |
| `pinned: 'left'` (per column)                              | flagged — move to grid-level `frozen: { left: N }`                       |
| `rowData`                                                  | `data`                                                                   |
| `columnDefs`                                               | `columns`                                                                |
| `getRowId`                                                 | `getRowId` (no change — adopted top-level)                               |
| `pinnedTopRowData`                                         | `pinned: { top: [...] }`                                                 |
| `pinnedBottomRowData`                                      | `pinned: { bottom: [...] }` (merges if both present)                     |
| `onCellValueChanged`                                       | `onCellChange`                                                           |
| `onSelectionChanged`                                       | `onSelectionChange`                                                      |
| `ModuleRegistry.registerModules([...])`                    | best-effort `mode`/`features` recommendation; flagged for confirmation   |
| `gridApi.exportDataAsCsv()`                                | flagged — `grid.api.plugins.export?.exportToCsv()` (handle access changes) |
| `gridApi.undoRedo*`                                        | flagged — `grid.api.plugins.undoRedo?.*`                                 |

#### `from-mui-x-data-grid`

| Source                                                     | Output                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `type: 'number' \| 'date' \| 'singleSelect'`               | `cellType: 'number' \| 'date' \| 'select'`                               |
| `valueGetter: ({ row }) => row.x + row.y`                  | `accessorFn: (row) => row.x + row.y` (unwrap `params`)                   |
| `valueFormatter: ({ value }) => …`                         | `valueFormatter: (value) => …` (unwrap `params`)                         |
| `valueParser: ({ value }) => …`                            | `valueParser: (value) => …` (unwrap `params`)                            |
| `renderCell: (params) => <Cell />`                         | flagged — manual port to DOM `cellRenderer`                              |
| `renderEditCell: (params) => <Edit />`                     | flagged — pick `cellEditor` or use editor hook                           |
| `cellClassName: 'red'`                                     | `cellClass: () => 'red'` (string → function form)                        |
| `cellClassName: ({ row }) => 'red'`                        | `cellClass: (value, row) => 'red'` (param shape change)                  |
| `pinnedRows={{ top, bottom }}`                             | `pinned={{ top, bottom }}`                                               |
| `valueGetter: ({ row }) => …`                              | `valueGetter: (row) => …` (unwrap params)                                |
| `getRowId={(row) => row.id}`                               | `getRowId: (row) => row.id` (no rename — top-level adopted)              |
| `hide: true`                                               | `hide: true` (no change — adopted name)                                  |
| `flex: 1`                                                  | `flex: 1` (no change — adopted)                                          |
| `headerAlign: 'left'`                                      | `headerAlign: 'left'` (no change — adopted)                              |
| `apiRef.current.method()`                                  | flagged — `grid.api.method()` after `useGrid({...})` refactor            |

#### `from-tanstack-table`

| Source                                                     | Output                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `accessorKey: 'amount'`                                    | `field: 'amount'`                                                        |
| `accessorFn: (row) => row.x + row.y`                       | `valueGetter: (row) => row.x + row.y`                                    |
| `header: 'Amount'`                                         | `headerName: 'Amount'`                                                   |
| `cell: ({ row, column }) => <Cell />`                      | flagged — manual port to DOM `cellRenderer`                              |
| `enableSorting: true`                                      | `sortable: true`                                                         |
| `enableColumnFilter`                                       | flagged — drop; filtering comes from the `'filter'` feature              |
| `enableHiding: true` + `column.getIsVisible()` state       | flagged — add `hide: false` initially; toggle via `grid.api.setColumnHidden(id, !visible)` |
| `size`, `minSize`, `maxSize`                               | `width`, `minWidth`, `maxWidth`                                          |
| `useReactTable({...})`                                     | flagged — refactor to `useGrid({...})` + `<BetterGrid grid={...} />`     |

#### `from-handsontable`

| Source                                                     | Output                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `data: 'amount'` (column-level)                            | `field: 'amount'`                                                        |
| `title: 'Amount'`                                          | `headerName: 'Amount'`                                                   |
| `type: 'numeric'` / `'date'` / `'checkbox'` / `'dropdown'` | `cellType: 'number'` / `'date'` / `'boolean'` / `'select'`               |
| `editor: 'numeric'` / `'select'`                           | `cellEditor: 'number'` / `'select'`                                      |
| `validator: fn` / `allowInvalid: false`                    | `rules: [{ validate: fn }]`                                              |
| `readOnly: true`                                           | `editable: false`                                                        |
| `className`                                                | `cellClass: () => '…'`                                                   |
| `colHeaders: ['A','B']`                                    | flagged — refactor into `headers: [{ id, cells: [...] }]`                |
| `fixedColumnsLeft: 2`                                      | `frozen: { left: 2 }`                                                    |
| `fixedRowsTop: 1`                                          | `frozen: { top: 1 }`                                                     |
| `fixedRowsBottom: 1`                                       | flagged — likely wants `pinned: { bottom: [...] }` with separate data    |
| `manualColumnResize: true`                                 | add `'resize'` to `features`                                             |
| `columnSorting: true`                                      | add `'sort'` to `features`                                               |
| `filters: true`                                            | add `'filter'` to `features`                                             |
| `copyPaste: true`                                          | add `'clipboard'` to `features`                                          |
| `undo: true`                                               | add `'undo'` to `features`                                               |
| `afterChange(changes, source)`                             | `onCellChange(changes)`                                                  |

#### `from-revogrid`

| Source                                                     | Output                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `prop: 'amount'`                                           | `field: 'amount'`                                                        |
| `name: 'Amount'`                                           | `headerName: 'Amount'`                                                   |
| `cellTemplate: (h, props) => h('span', …)`                 | flagged — manual port to `cellRenderer: (container, ctx) => void`        |
| `editor: 'select'`                                         | `cellEditor: 'select'`                                                   |
| `readonly: true`                                           | `editable: false`                                                        |
| `size`, `minSize`, `maxSize`                               | `width`, `minWidth`, `maxWidth`                                          |
| `pin: 'colPinStart'`                                       | flagged — move to grid-level `frozen: { left: N }`                       |
| `source`                                                   | `data`                                                                   |
| `pinnedTopSource` / `pinnedBottomSource`                   | `pinned: { top: [...] }` / `pinned: { bottom: [...] }`                   |
| `range: true`                                              | `selection: { mode: 'range' }`                                           |
| `resize: true`                                             | add `'resize'` to `features`                                             |

#### `from-react-data-grid`

| Source                                                     | Output                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `key: 'amount'`                                            | `field: 'amount'` + `id: 'amount'`                                       |
| `name: 'Amount'`                                           | `headerName: 'Amount'`                                                   |
| `formatter: ({ row, column }) => <Cell />`                 | flagged — manual port to `cellRenderer: (container, ctx) => void`        |
| `editor: TextEditor / DropDownEditor`                      | flagged — pick `cellEditor: 'text' \| 'select' \| …`                     |
| `editorOptions: { editOnClick: true }`                     | top-level `features={{ edit: { editTrigger: 'click' } }}`                |
| `frozen: true` (per column)                                | flagged — move to grid-level `frozen: { left: N }`                       |
| `cellClass: (row) => '…'`                                  | `cellClass: (value, row) => '…'` (param shape change)                    |
| `headerCellClass`                                          | flagged — Better Grid has no per-column header class today               |
| `rows`                                                     | `data`                                                                   |
| `rowKeyGetter={(row) => row.id}`                           | flagged — move to `hierarchy: { getRowId }` if hierarchy/stable selection used |
| `selectedRows={set}` + `onSelectedRowsChange`              | `selection: { mode: 'row', multiRange: true }` + `onSelectionChange`     |
| `summaryRows`, `topSummaryRows`                            | `pinned: { bottom: [...] }`, `pinned: { top: [...] }`                    |
| `onRowsChange`                                             | `onCellChange`                                                           |

### Reporting

After every run, the CLI prints:

```
@better-grid/migrate from-ag-grid

  ✓  src/components/CostsTable.tsx       8 sites converted, 1 flagged
  ✓  src/components/Reports/Pivot.tsx    3 sites converted, 0 flagged
  ⚠  src/grid/MyGrid.tsx                 12 sites converted, 4 flagged

Summary:
  3 files changed
  23 sites converted
  5 sites flagged for manual review
    src/grid/MyGrid.tsx:42  cellRenderer JSX → DOM port required
    src/grid/MyGrid.tsx:71  ModuleRegistry call — confirm features list
    src/grid/MyGrid.tsx:112 pinned: 'left' (per col) → grid-level frozen.left
    …

Re-run with --dry-run to preview.
```

`--report=<path>` writes the same data as JSON.

### Per-transform tests

Fixture-based:

```
packages/codemods/transforms/from-ag-grid/
  index.ts                     # the transform
  README.md                    # what's auto-converted vs flagged
  __testfixtures__/
    column-rename.input.tsx
    column-rename.output.tsx
    grid-options.input.tsx
    grid-options.output.tsx
    pinned-flagged.input.tsx
    pinned-flagged.output.tsx
    …
```

`vitest` runs each pair through the transform and asserts output equals expected (jscodeshift's standard testing pattern).

### Files touched

- New `packages/codemods/` workspace package — `package.json`, `tsconfig.json`, `tsup.config.ts` (for the CLI build), `bin/migrate.ts`, `transforms/from-*/index.ts`, `transforms/from-*/__testfixtures__/`.
- Updates to each existing `docs/migrations/from-*.md` — append a top-of-file "Codemod" section pointing at the matching transform.
- `README.md` — add a "Migrating from another grid?" link to the codemod CLI.
- `CHANGELOG.md` — `[Unreleased]` entry for the codemods package.

### Out of scope

- Migrations from other libraries (Glide Data Grid, fixed-data-table-2, BlueprintJS Table, etc.) — add later if requested.
- Auto-converting renderer JSX to DOM — too lossy; flagged instead.
- Auto-converting `ModuleRegistry` to a *correct* `features` list — heuristic does best-effort with low confidence; flagged for confirmation.
- Wiring the codemod CLI into the playground or any runtime path.

## Out-of-scope (whole spec)

- Per-column header-class hook (`headerClass` AG / `headerClassName` MUI X disagree on the name).
- Per-column tooltip / `description` (AG `headerTooltip` + `tooltipField` vs MUI X `description` — name disagreement).
- `cellType` → `type` rename (semantic precision wins over alignment).
- `data` → `rows` rename (only matches MUI X; AG uses `rowData`).
- Aliasing of any kind.
- Renderer signature alignment.

## Success criteria

- **Phase 1:**
  - All existing tests pass post-rename. Existing playground demos render identically.
  - New tests cover `hide` toggling, `flex` width allocation across viewport-resize, `headerAlign` rendering vs `align` fallback.
  - New `/demo/column-features` page exercises `hide` / `flex` / `headerAlign` end-to-end.
  - Migration cheat sheets list `field`, `headerName`, `valueGetter`, `getRowId`, `hide`, `flex`, `headerAlign` as direct copy-paste rows (no rename column needed) for AG Grid and MUI X where applicable.
- **Phase 2:**
  - Per-transform fixture tests pass for every documented mapping.
  - `npx @better-grid/migrate from-ag-grid` on a hand-written 10-column AG Grid sample converts the auto-convert rows and flags exactly the rows the spec says should be flagged.
  - Same for the other 5 transforms with their respective fixtures.
