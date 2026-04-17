# Migrating from AG Grid

A cheat-sheet for translating AG Grid column definitions and grid options to Better Grid. Most names survive the move; the main shifts are (a) renderers are DOM-based rather than JSX, and (b) features ship as plugins you opt into rather than modules you register on a singleton.

## Column definition mapping

| AG Grid                                  | Better Grid                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `field: 'amount'`                        | `accessorKey: 'amount'` (or `accessorFn: (row) => ...` for derived values)                                                                       |
| `headerName: 'Amount'`                   | `header: 'Amount'`                                                                                                                               |
| `valueFormatter: params => string`       | `valueFormatter: (value) => string` — **same name, different signature**: no `params` object, you get the raw value directly                      |
| `valueParser: params => any`             | `valueParser: (str) => unknown` — **same name, different signature**: flat, no `params`                                                          |
| `cellRenderer: MyReactComponent`         | `cellRenderer: (container, ctx) => void` — **same name, different contract**: DOM-first, no JSX. Mutate `container` directly; optionally return a cleanup function |
| `cellRendererParams: { ... }`            | Pass via `meta: { ... }` or via a closure around your `cellRenderer`                                                                             |
| `filter: true` (per column)              | Load `filtering()` plugin globally; filtering UI appears on all columns that pass a filterable value                                             |
| `sortable: true`                         | `sortable: true` (same) — also requires `sorting()` plugin                                                                                       |
| `editable: true`                         | `editable: true` (same — or a function `(row, column) => boolean`) — requires `editing()` plugin                                                 |
| `resizable: true`                        | `resizable: true` (same)                                                                                                                         |
| `cellEditor: 'agSelectCellEditor'`       | `cellEditor: 'dropdown'` — **same name**: `'text' \| 'dropdown' \| 'number' \| 'date' \| 'autocomplete' \| 'masked'`                             |
| `cellEditorParams: { values: [...] }`    | `options: [...]` on the column (array of `string` or `{ label, value }`)                                                                         |
| `cellStyle: { color: 'red' }`            | `cellStyle: (value, row) => ({ color: 'red' })` — function-form only; returns a style object                                                     |
| `cellClass: 'my-class'`                  | `cellClass: (value, row) => 'my-class'` — function-form only                                                                                     |
| `width: 120`, `minWidth`, `maxWidth`     | `width`, `minWidth`, `maxWidth` (same)                                                                                                           |
| `align: 'right'` (via class)             | `align: 'left' \| 'center' \| 'right'` (built-in prop) and `verticalAlign: 'top' \| 'middle' \| 'bottom'`                                        |
| `pinned: 'left'` (per column)            | **Global**: `frozenLeftColumns: N` on grid options — freezes the first N columns of your `columns` array. There is no per-column `pinned` flag. |

## Grid options mapping

| AG Grid                                  | Better Grid                                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `rowData`                                | `data`                                                                                                                                   |
| `columnDefs`                             | `columns`                                                                                                                                |
| `pinnedTopRowData`                       | `pinnedTopRows`                                                                                                                          |
| `pinnedBottomRowData`                    | `pinnedBottomRows`                                                                                                                       |
| `rowHeight: 32`                          | `rowHeight: 32` (same — or `(rowIndex) => number` for per-row heights)                                                                   |
| `headerHeight: 40`                       | `headerHeight: 40` (same)                                                                                                                |
| `rowSelection: 'multiple'`               | `selection: { mode: 'range', multiRange: true, fillHandle: true }`                                                                       |
| `enableRangeSelection: true`             | `selection: { mode: 'range' }`                                                                                                           |
| `onSelectionChanged`                     | `onSelectionChange` (receives a `Selection` object with `active` cell + `ranges`)                                                        |
| `onCellValueChanged`                     | `onDataChange` (receives `CellChange[]`)                                                                                                 |
| `onColumnResized`                        | `onColumnResize(columnId, width)`                                                                                                        |
| `ModuleRegistry.registerModules([...])`  | `plugins: [editing(), sorting(), filtering(), ...]` — passed as a grid option. No singleton registration.                                |
| `GridOptions.api.exportDataAsCsv()`      | `grid.getPlugin<{ exportToCsv: () => void }>('export')?.exportToCsv()` — plugins expose their API through `grid.getPlugin(id)`           |
| `gridOptions.api.undoRedo...`            | `grid.getPlugin<{ undo(): void; redo(): void }>('undoRedo')` (requires `undoRedo()` plugin)                                              |

## What's different philosophically

**DOM-first renderers.** AG Grid lets you pass a React component as `cellRenderer`, and the grid wraps it in a React portal. Better Grid renderers are `(container: HTMLElement, ctx: CellRenderContext) => void` — you mutate the container's DOM directly. This costs you JSX ergonomics but buys back the cell-pooling performance that makes 10M-cell scrolling possible (no React reconciliation per cell on every scroll frame). The `ctx` object gives you `{ rowIndex, colIndex, row, column, value, isSelected, isActive, style }`. If you need a richer renderer catalog, load `cellRenderers()` from `@better-grid/plugins` — it registers built-ins like `badge`, `rating`, `progress`, and `change` which you then reference via `cellType: 'badge'` on columns.

**Plugin-based feature loading.** AG Grid ships one bundle and tree-shakes through a module registry. Better Grid ships a tiny core (selection, virtualization, rendering, keyboard nav) and every other feature — sorting, filtering, editing, clipboard, undo, export — is a plugin factory you call and pass into `plugins: [...]`. No module registration, no feature flags, no runtime "this feature requires the Enterprise license" errors.

**No Community vs Enterprise fork.** Everything in `@better-grid/plugins` is MIT, including features AG Grid gates behind the $999/developer Enterprise tier (grouping with aggregation, clipboard, undo/redo, CSV/Excel export, multi-level headers, pinned rows). Commercial Pro plugins land in a separate `@better-grid/pro` package when released, so you always know what's free: if it's in `@better-grid/plugins`, it's MIT, forever.
