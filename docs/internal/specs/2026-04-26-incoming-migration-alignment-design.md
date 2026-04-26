# Incoming-migration alignment + API audit — Design

> Reduce the cost of migrating to Better Grid from the most-adopted data-grid libraries (AG Grid, MUI X Data Grid, TanStack Table, Handsontable, RevoGrid, react-data-grid), and tighten the rest of the surface where Better Grid can win on DX. Pre-publish breaking changes; no back-compat.

## Goal

A developer copying a column definition or a grid options object from AG Grid or MUI X into a Better Grid project hits the smallest possible diff. Where Better Grid can express the same idea more cleanly than the major libs, it does so on its own terms. Mechanical migrations are absorbed by a one-shot codemod package; non-mechanical ones are flagged.

## Non-goals

- Aliasing two names for the same property at runtime — adds permanent API bloat.
- Aligning renderer signatures to JSX — DOM-first is intentional for the cell-pooling perf model.
- Aligning the plugin/feature opt-in model to AG Grid's `ModuleRegistry` — the typed `mode`/`features` registry is intentional.
- Per-column `headerClass` / `description` (AG and MUI disagree on the name) — defer.
- Plugin-augmented prop reorganization (e.g. `editing` plugin's flat field bag) — out of scope this cycle.

## Phase 1 — Surface refresh

Five sub-blocks, all pre-publish, no back-compat. Single PR.

### 1.1 Renames (alignment with AG + MUI X)

| Concept                            | AG / MUI X     | Better Grid (now)         | Better Grid (after)                              |
| ---------------------------------- | -------------- | ------------------------- | ------------------------------------------------ |
| Bind a column to a row field       | `field`        | `accessorKey`             | `field`                                          |
| Column header label                | `headerName`   | `header` (overloaded)     | `headerName: string` (see split in §1.4)         |
| Computed column value              | `valueGetter`  | `accessorFn`              | `valueGetter`                                    |
| Top-level row-id resolver          | `getRowId`     | `hierarchy.getRowId`      | top-level `getRowId` (still mirrored at `hierarchy.getRowId` for hierarchy-only consumers) |

`valueGetter` keeps the flat signature `(row: TData, rowIndex: number) => unknown`. AG passes `({data,node,…})`; MUI X passes `({row,…})`. The codemod (Phase 2) unwraps both into our flat shape.

`getRowId` becomes a top-level `GridOptions` field. When both `getRowId` and `hierarchy: { getRowId }` are set, the hierarchy field wins for hierarchy state; selection-stability and data-swap defaults use the top-level resolver.

### 1.2 New column props (additive — same name as the source lib)

| Property              | Source     | Type                                | Behavior                                                                                                                                |
| --------------------- | ---------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `column.hide`         | AG + MUI X | `boolean`                           | When `true`, column excluded from the rendered layout but stays in `columns`. Runtime toggle via `grid.api.setColumnHidden(id, hide)`. |
| `column.flex`         | MUI X      | `number`                            | Flex-grow share. `width` is treated as `flex-basis`; remaining viewport width distributes by `flex` ratio; respects `minWidth` / `maxWidth`. |
| `column.headerAlign`  | MUI X      | `'left' \| 'center' \| 'right'`     | Header-cell alignment, independent of cell `align`. Defaults to `align` when unset (today's behavior).                                  |

### 1.3 Signature extensions (richer context, no rename)

All extensions are positional appendices — existing call sites compile unchanged.

| Property          | Before                                  | After                                              |
| ----------------- | --------------------------------------- | -------------------------------------------------- |
| `valueFormatter`  | `(value) => string`                     | `(value, row) => string`                           |
| `valueParser`     | `(value: string) => unknown`            | `(value: string, row: TData) => unknown`           |
| `cellStyle`       | `(value, row) => Record<string,string>` | `(value, row, rowIndex) => Record<string,string>` |
| `cellClass`       | `(value, row) => string`                | `(value, row, rowIndex) => string`                 |
| `comparator`      | `(a, b) => number`                      | `(a, b, rowA?, rowB?) => number`                  |

Rationale: `cellStyle`/`cellClass` already get `(value, row)`; `rowIndex` rounds them out symmetrically with `rowStyle`. `valueFormatter`/`valueParser` getting `row` enables cross-field formatting (e.g. format `amount` per-row with the row's `currency` field).

### 1.4 Cleaner-than-major-libs refinements

| # | Refinement                                                                                  | Rationale                                                                                                       |
| - | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| a | **Split `header` into `headerName` + `headerRenderer`.** `headerName: string` always; `headerRenderer: (container, ctx?) => void` for custom DOM. | The current overloaded `header: string \| (() => DOM)` reads weirdly post-rename ("name" implies string). Splitting matches the `cellRenderer` pattern. |
| b | **`id?: string`** — default to `field` when omitted.                                       | Most callers use the same value for both. AG Grid's `colId` defaults to `field` already.                        |
| c | **Drop `cellEditor: 'dropdown'`.** Keep `'select'` only.                                   | Two names for the same editor; `'select'` matches AG (`agSelectCellEditor`) and MUI X (`singleSelect`).         |
| d | **Drop the object form for `headers` / `footers`.** Accept `HeaderRow[]` / `FooterRow[]` only. | The `{ layout, height }` form duplicates top-level `headerHeight`. Single shape. |
| e | **Replace `tableStyle` enum with two booleans.** `bordered?: boolean` (default `true`), `striped?: boolean` at top-level options. | Bordered + striped is a real combo; the enum forced single-pick. |
| f | **`selection?: false \| { mode: 'cell' \| 'row' } \| { mode: 'range'; multiRange?; fillHandle? }`** — discriminated union. | `'none'` sentinel string is awkward; `false` disables. `multiRange`/`fillHandle` only appear when meaningful (range mode). Default = `{ mode: 'cell' }`. |

### 1.5 Bug / clarity fixes

| # | Fix                                                                                                | Why                                                                                          |
| - | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| a | `CellChange.oldValue` is the previous **cell value** (currently it holds the old row object).      | Asymmetric with `newValue` (already a cell value). Bug-disguised-as-naming. `row` continues to hold the new row. |
| b | `GridState` mirrors `GridOptions` shape: `state.frozen: { top, left }`, `state.pinned: { top, bottom }`. | Today: `state.frozenTopRows`, `state.frozenLeftColumns`, `state.pinnedTopRows`, `state.pinnedBottomRows`. Two shapes for one concept. |
| c | Rename event `'data:change'` → `'cell:change'`.                                                    | It fires per-cell on `updateCell`; lives more correctly with `cell:click` / `cell:dblclick` / `cell:focus` / `cell:blur`. Matches the React `onCellChange` prop. |
| d | Rename event `'freezeClip:change'` → `'frozen:clip'`.                                              | Camel-cased namespace breaks the lowercase pattern (`cell:click`, `column:resize`). Matches the `frozen` option name. |

### Files touched

**Core (`packages/core/src/`):**

- `types.ts` — apply every rename + new-prop addition + signature extension + B-block reshapes; rewrite `CellChange`, `GridState`, `SelectionOptions`, `ColumnDef`, `GridOptions`, `HeaderRow`/`FooterRow` (drop object form), `GridEvents` (event renames).
- `grid.ts` — wire top-level `getRowId`; default `id` to `field` in column normalization; surface `setColumnHidden`; emit `'cell:change'` (not `'data:change'`) in `updateCell`; populate `state.frozen`/`state.pinned` shape; fix `CellChange.oldValue` to be the previous cell value (read pre-mutation).
- `columns/manager.ts` — read renamed fields; honor `hide`; default `id ??= field`.
- `virtualization/layout.ts` — `flex` enters the width allocation pass.
- `rendering/headers.ts`, `pipeline.ts`, `pinned-rows.ts` — `headerName` (string only), `headerRenderer` (DOM mutator); `headerAlign` overrides `align` for the header.
- `state/store.ts` — new state shape (`frozen`, `pinned` groups); migrate any sites that read the old field names.
- `selection/`, `events/` — event-name updates; selection discriminated union normalization.
- `ui/freeze-clip-drag.ts` — emit `'frozen:clip'`.

**React (`packages/react/src/`):**

- `useGrid.ts` — accept top-level `getRowId`; pass through new selection shape; pass through `bordered`/`striped`.
- `defineColumn.ts` — builders set `field`, `headerName`; accept `hide`, `flex`, `headerAlign`, `headerRenderer`; default `id` from `field`.
- `BetterGrid.tsx` — surface the new top-level options; `headers`/`footers` accept the array shape only.

**Plugins (`packages/plugins/src/free/`, `packages/pro/src/`):**

- All plugins that read column fields — bulk find/replace `accessorKey` → `field`, `accessorFn` → `valueGetter`, `header` → `headerName`/`headerRenderer`.
- `editing.ts` — emit/listen `'cell:change'`; consume the fixed `CellChange.oldValue`.
- `validation.ts`, `sorting.ts`, `filtering.ts` — same.

**Docs / playground / tests:**

- `apps/playground/src/pages/*.tsx` — every page touching raw `ColumnDef` (the FSBT pages and a few inline examples).
- `apps/playground/src/pages/AlwaysInputDemo.tsx`, `RhfBridgeDemo.tsx` — refresh to use the new shapes.
- New `apps/playground/src/pages/ColumnFeaturesDemo.tsx` — exercises `hide` / `flex` / `headerAlign` / `headerRenderer` end-to-end.
- `docs/migrations/from-*.md` — every rename row updated; rows that flip from "flagged" to "no change — adopted" rewritten.
- `docs/internal/v1-init-api-history.md` — historical paragraphs mentioning `accessorKey` etc.
- `docs/guides/theming-with-mui.md`, `README.md`, `AGENTS.md`, `CHANGELOG.md` — any prose mention.
- `packages/core/tests/`, `packages/react/tests/` — assertions for `hide` toggling, `flex` width allocation, `headerAlign`/`headerRenderer` rendering, the discriminated `selection` union, the `bordered`/`striped` flags, the fixed `CellChange.oldValue` semantics, the new event names, the new `state.frozen`/`state.pinned` shape.

### Verification

- `node scripts/build.js` — all 4 packages build green.
- `pnpm --filter @better-grid/core test`, `pnpm --filter @better-grid/react test` — all existing tests pass post-update plus the new tests for the §1.2/§1.4/§1.5 surface.
- Visual check `/demo/*` and `/demo-realworld/*` — no regressions.
- New `/demo/column-features` page renders `hide` / `flex` / `headerAlign` correctly under viewport resize.

### Out of scope for Phase 1

- Codemod package (Phase 2).
- Per-column header-class hook (`headerClass` / `headerClassName`) — AG and MUI disagree on the name; defer.
- Per-column tooltip / `description` — same disagreement.
- `cellType` → `type` rename (semantic precision wins).
- `data` → `rows` rename (only matches MUI X; AG uses `rowData`).
- Plugin-augmented prop reorganization.
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

Each transform handles four layers, in order: per-column property renames + signature unwraps, grid-level option renames + reshapes (e.g. `selection` discriminated union, `bordered`/`striped` from `tableStyle`), event-name renames, then imperative-API renames. Renderer signature changes are detected and **not** auto-converted — they're tagged with `// @better-grid/migrate: review — JSX renderer needs DOM port`.

The transform tables below reflect the post-§1 surface: `valueGetter` / `getRowId` / `hide` / `flex` / `headerAlign` are direct adopts; `header` splits into `headerName: string` (string source) or `headerRenderer: …` (function source).

#### `from-ag-grid`

| Source                                                     | Output                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `cellEditor: 'agTextCellEditor'`                           | `cellEditor: 'text'`                                                     |
| `cellEditor: 'agSelectCellEditor'`                         | `cellEditor: 'select'`                                                   |
| `cellEditor: 'agNumberCellEditor'`                         | `cellEditor: 'number'`                                                   |
| `cellEditor: 'agDateCellEditor'`                           | `cellEditor: 'date'`                                                     |
| `cellEditorParams: { values: [...] }`                      | column-level `options: [...]`                                            |
| `valueGetter: ({ data, node }) => …`                       | `valueGetter: (row) => …` (unwrap params; `data` → `row`)                |
| `headerName: 'Amount'`                                     | `headerName: 'Amount'` (no change)                                       |
| `headerComponent: MyHeader` (React)                        | flagged — manual port to `headerRenderer: (container) => void`           |
| `hide: true`                                               | `hide: true` (no change — adopted)                                       |
| `cellRenderer: MyReactComponent`                           | flagged — manual port to `(container, ctx) => void`                      |
| `cellRendererParams: {...}`                                | flagged — usually unused after manual port                               |
| `pinned: 'left'` (per column)                              | flagged — move to grid-level `frozen: { left: N }`                       |
| `rowData`                                                  | `data`                                                                   |
| `columnDefs`                                               | `columns`                                                                |
| `getRowId`                                                 | `getRowId` (no change — adopted top-level)                               |
| `pinnedTopRowData`                                         | `pinned: { top: [...] }`                                                 |
| `pinnedBottomRowData`                                      | `pinned: { bottom: [...] }` (merges if both present)                     |
| `rowSelection: 'multiple'` + `enableRangeSelection: true`  | `selection: { mode: 'range', multiRange: true }`                         |
| `rowSelection: 'single'`                                   | `selection: { mode: 'cell' }`                                            |
| `suppressCellSelection: true`                              | `selection: false`                                                       |
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
| `hide: true`                                               | `hide: true` (no change — adopted)                                       |
| `flex: 1`                                                  | `flex: 1` (no change — adopted)                                          |
| `headerAlign: 'left'`                                      | `headerAlign: 'left'` (no change — adopted)                              |
| `renderHeader: (params) => <Header />`                     | flagged — manual port to `headerRenderer: (container) => void`           |
| `checkboxSelection` + `rowSelectionModel`                  | `selection: { mode: 'row', multiRange: true }` + `onSelectionChange`     |
| `disableRowSelectionOnClick`                               | `selection: false` if no selection at all                                |
| `apiRef.current.method()`                                  | flagged — `grid.api.method()` after `useGrid({...})` refactor            |

#### `from-tanstack-table`

| Source                                                     | Output                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `accessorKey: 'amount'`                                    | `field: 'amount'`                                                        |
| `accessorFn: (row) => row.x + row.y`                       | `valueGetter: (row) => row.x + row.y`                                    |
| `header: 'Amount'` (string)                                | `headerName: 'Amount'`                                                   |
| `header: () => <Header />` (JSX function)                  | flagged — manual port to `headerRenderer: (container) => void`           |
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
| `renderer: fn(instance, td, row, col, prop, value, …)`     | flagged — manual port to `cellRenderer: (container, ctx) => void`        |
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

- Per-column header-class hook (`headerClass` AG / `headerClassName` MUI X disagree).
- Per-column tooltip / `description` (AG `headerTooltip` + `tooltipField` vs MUI X `description`).
- `cellType` → `type` rename (semantic precision wins over alignment).
- `data` → `rows` rename (only matches MUI X; AG uses `rowData`).
- Plugin-augmented prop reorganization.
- Aliasing of any kind.
- Renderer signature alignment to JSX.

## Success criteria

- **Phase 1:**
  - All existing tests pass post-update. Existing playground demos render identically.
  - New tests cover `hide` toggling, `flex` width allocation across viewport-resize, `headerAlign` rendering vs `align` fallback, the `selection` discriminated-union normalization, the `bordered`/`striped` flags, the symmetric `CellChange.oldValue`, the new event names (`'cell:change'`, `'frozen:clip'`), the new `state.frozen`/`state.pinned` shape, the `id ??= field` default, the `headerName` + `headerRenderer` split, and the extended signatures for `valueFormatter`/`valueParser`/`cellStyle`/`cellClass`/`comparator`.
  - New `/demo/column-features` page exercises `hide` / `flex` / `headerAlign` / `headerRenderer` end-to-end.
  - Migration cheat sheets list `field`, `headerName`, `valueGetter`, `getRowId`, `hide`, `flex`, `headerAlign` as direct copy-paste rows (no rename column needed) for AG Grid and MUI X where applicable.
- **Phase 2:**
  - Per-transform fixture tests pass for every documented mapping.
  - `npx @better-grid/migrate from-ag-grid` on a hand-written 10-column AG Grid sample converts the auto-convert rows and flags exactly the rows the spec says should be flagged.
  - Same for the other 5 transforms with their respective fixtures.
