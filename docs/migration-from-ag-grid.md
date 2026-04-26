# Migrating from AG Grid

A cheat-sheet for translating AG Grid column definitions and grid options to Better Grid. Most names survive the move; the main shifts are (a) renderers are DOM-based rather than JSX, and (b) features ship as plugins you opt into via a `mode` preset or a `features` list rather than modules you register on a singleton.

## Column definition mapping

| AG Grid                                  | Better Grid                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `field: 'amount'`                        | `accessorKey: 'amount'` (or `accessorFn: (row) => ...` for derived values). The `defineColumn` builder fills this in for you: `col.currency('amount', {...})`. |
| `headerName: 'Amount'`                   | `header: 'Amount'`                                                                                                                               |
| `valueFormatter: params => string`       | `valueFormatter: (value) => string` — **same name, different signature**: no `params` object, you get the raw value directly                      |
| `valueParser: params => any`             | `valueParser: (str) => unknown` — **same name, different signature**: flat, no `params`                                                          |
| `cellRenderer: MyReactComponent`         | `cellRenderer: (container, ctx) => void` — **same name, different contract**: DOM-first, no JSX. Mutate `container` directly; optionally return a cleanup function. Use `ctx.context` to read closure-over-component-scope values without re-init. |
| `cellRendererParams: { ... }`            | Pass via `meta: { ... }` or via a closure around your `cellRenderer`                                                                             |
| `filter: true` (per column)              | Add `'filter'` to `features` (or use `mode="view"` / `mode="interactive"` / `mode="spreadsheet"`); filtering UI then appears on all columns      |
| `sortable: true`                         | `sortable: true` (same) — also requires the `'sort'` feature (included in every mode except `null`)                                              |
| `editable: true`                         | `editable: true` (same — or a function `(row, column) => boolean`) — requires the `'edit'` feature (included in `mode="spreadsheet"`)            |
| `editable: true` + always-on input       | `editable: true` + `alwaysInput: true` (per-column flag in the `editing` plugin). Renders a real `<input>` permanently in every cell.            |
| `resizable: true`                        | `resizable: true` (same)                                                                                                                         |
| `cellEditor: 'agSelectCellEditor'`       | `cellEditor: 'select'` (or `'selectWithInput'` for option + sibling input). Other editors: `'text' \| 'dropdown' \| 'number' \| 'date' \| 'autocomplete' \| 'masked'`. |
| `cellEditorParams: { values: [...] }`    | `options: [...]` on the column (array of `string` or `{ label, value }`)                                                                         |
| `cellStyle: { color: 'red' }`            | `cellStyle: (value, row) => ({ color: 'red' })` — function-form only; returns a style object                                                     |
| `cellClass: 'my-class'`                  | `cellClass: (value, row) => 'my-class'` — function-form only                                                                                     |
| `width: 120`, `minWidth`, `maxWidth`     | `width`, `minWidth`, `maxWidth` (same)                                                                                                           |
| `align: 'right'` (via class)             | `align: 'left' \| 'center' \| 'right'` (built-in prop) and `verticalAlign: 'top' \| 'middle' \| 'bottom'`                                        |
| `pinned: 'left'` (per column)            | **Global**: `frozen={{ left: N }}` on grid options — freezes the first N columns of your `columns` array. There is no per-column `pinned` flag.  |

## Grid options mapping

| AG Grid                                  | Better Grid                                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `rowData`                                | `data`                                                                                                                                   |
| `columnDefs`                             | `columns`                                                                                                                                |
| `pinnedTopRowData`                       | `pinned={{ top: [...] }}`                                                                                                                |
| `pinnedBottomRowData`                    | `pinned={{ bottom: [...] }}`                                                                                                             |
| `rowHeight: 32`                          | `rowHeight: 32` (same — or `(rowIndex) => number` for per-row heights)                                                                   |
| `headerHeight: 40`                       | `headerHeight: 40` (same)                                                                                                                |
| `rowSelection: 'multiple'`               | `selection: { mode: 'range', multiRange: true, fillHandle: true }`                                                                       |
| `enableRangeSelection: true`             | `selection: { mode: 'range' }`                                                                                                           |
| `onSelectionChanged`                     | `onSelectionChange` (receives a `Selection` object with `active` cell + `ranges`)                                                        |
| `onCellValueChanged`                     | `onCellChange` (receives `CellChange[]`)                                                                                                 |
| `onColumnResized`                        | `onColumnResize(columnId, width)`                                                                                                        |
| `ModuleRegistry.registerModules([...])`  | `mode="spreadsheet"` (or `mode="view"` / `"interactive"` / `"dashboard"`), or `features={['edit', 'sort', 'clipboard', ...]}`. The `plugins` array is the escape hatch when you need a plugin not in the registry or finer control. |
| Reactive form integration                | `useGridForm({ grid, baseName: 'rows' })` from `@better-grid/react/rhf` — bridges cell commits into a surrounding `<FormProvider>` (react-hook-form) |
| `GridOptions.api.exportDataAsCsv()`      | `grid.api.plugins.export?.exportToCsv()` — plugins expose APIs on `grid.api.plugins.<id>`, fully typed from the `plugins` tuple          |
| `gridOptions.api.undoRedo...`            | `grid.api.plugins.undoRedo?.undo()` / `.redo()` (requires the `'undo'` feature, included in `mode="spreadsheet"`)                        |

## What's different philosophically

**DOM-first renderers.** AG Grid lets you pass a React component as `cellRenderer`, and the grid wraps it in a React portal. Better Grid renderers are `(container: HTMLElement, ctx: CellRenderContext) => void` — you mutate the container's DOM directly. This costs you JSX ergonomics but buys back the cell-pooling performance that makes 10M-cell scrolling possible (no React reconciliation per cell on every scroll frame). The `ctx` object gives you `{ rowIndex, colIndex, row, column, value, isSelected, isActive, style, context }` where `context` is the value you passed to `useGrid({ context })` (always the latest closure, no re-init). For the 90% case you don't write a renderer at all — `cellType: 'currency'` (or `col.currency(...)`) routes through the `formatting` plugin's built-in renderer.

**Feature opt-in via mode/features.** AG Grid ships one bundle and tree-shakes through a module registry. Better Grid ships a tiny core (selection, virtualization, rendering, keyboard nav) and you opt into capabilities via a string `mode` preset or a `features` list. No module registration, no hidden enterprise flags inside the MIT plugin package. When you need raw control (a custom plugin, a third-party plugin, or fine-tuned options), drop down to the `plugins` escape hatch.

**Clear free/pro package boundary.** Everything in `@better-grid/plugins` is MIT. Commercial Pro plugins live in the separate public/source-available `@better-grid/pro` package under the Better Grid Pro Source-Available License. v1 has no hard runtime DRM, but commercial production use of `@better-grid/pro` still requires a Better Grid Pro license.
