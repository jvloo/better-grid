# Migrating from react-data-grid

A cheat-sheet for translating Adazzle's `react-data-grid` to Better Grid. Both render virtualized rows of cells with editing, frozen columns, and tree data. The migration cost is mostly mechanical — column key naming, renderer signature, and feature opt-in.

## Column definition mapping

| react-data-grid                                | Better Grid                                                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `key: 'amount'`                                | `id: 'amount'` + `accessorKey: 'amount'` (or just `col.currency('amount', {...})`)                                                       |
| `name: 'Amount'`                               | `header: 'Amount'`                                                                                                                       |
| `formatter: ({ row, column }) => <Cell />`     | `cellRenderer: (container, ctx) => void` — DOM mutation, no JSX. For built-in types, set `cellType` and skip writing a renderer.         |
| `editor: TextEditor / DropDownEditor`          | `cellEditor: 'text' \| 'select' \| 'number' \| 'date' \| 'autocomplete' \| 'masked'` + `options: [...]` for select editors               |
| `editorOptions: { editOnClick: true }`         | `features={{ edit: { editTrigger: 'click' } }}` (or `'dblclick' \| 'type'`)                                                              |
| `editable: true / fn`                          | `editable: true` (or function `(row, column) => boolean`)                                                                                |
| `width: 200`, `minWidth`, `maxWidth`           | `width`, `minWidth`, `maxWidth`                                                                                                          |
| `resizable: true`                              | `resizable: true` (also requires the `'resize'` feature, which is in every preset other than `null`)                                     |
| `sortable: true`                               | `sortable: true` (also requires the `'sort'` feature)                                                                                    |
| `frozen: true`                                 | **Global**: `frozen={{ left: N }}` on grid options (no per-column flag — frozen columns are the first N entries of `columns`)            |
| `cellClass: (row) => string`                   | `cellClass: (value, row) => string`                                                                                                      |
| `headerCellClass: 'right-align'`               | Header-cell styling isn't a per-column field today. Use a CSS rule scoped to a `cellClass`-tagged sibling, or open a feature request.    |
| `headerRenderer: () => <Header />`             | `header: () => HTMLElement \| string` — DOM, not JSX                                                                                     |
| `colSpan: ({ type }) => 2`                     | Use the `mergeCells` plugin (Pro) — global merge config, not per-cell-callback                                                           |
| `summaryFormatter`                             | Use `pinned: { bottom: [summaryRow] }` and render the bottom row with a normal `cellRenderer`                                            |

## Grid options mapping

| react-data-grid                                | Better Grid                                                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `rows`                                         | `data`                                                                                                                                   |
| `columns`                                      | `columns`                                                                                                                                |
| `rowKeyGetter={(row) => row.id}`               | `hierarchy: { getRowId: (row) => row.id }` (only required for hierarchy or stable selection across data swaps)                           |
| `rowHeight: 35`                                | `rowHeight: 35` (or `(rowIndex) => number`)                                                                                              |
| `headerRowHeight: 40`                          | `headerHeight: 40`                                                                                                                       |
| `selectedRows={set}` + `onSelectedRowsChange`  | `selection: { mode: 'row', multiRange: true }` + `onSelectionChange`                                                                     |
| `cellNavigationMode='LOOP_OVER_ROW'`           | Default cell navigation in v1 is single-cell; tab/enter behavior is built into the editing plugin and doesn't loop. Open an issue if you need explicit loop semantics. |
| `enableVirtualization`                         | Always-on; not a flag                                                                                                                    |
| `summaryRows={[summaryRow]}`                   | `pinned: { bottom: [summaryRow] }`                                                                                                       |
| `topSummaryRows`                               | `pinned: { top: [summaryRow] }`                                                                                                          |
| `groupBy + rowGrouper`                         | Use the `hierarchy` plugin (free) for parent-child collapse/expand, or the `grouping` plugin (Pro) for aggregation                       |
| `expandedGroupIds` + `onExpandedGroupIdsChange`| Hierarchy state is plugin-local; query via `grid.api.plugins.hierarchy?.getExpandedRows()`                                               |
| `onRowsChange`                                 | `onCellChange={(changes) => ...}` — receives `CellChange[]`                                                                              |
| `gridRef.current?.scrollToCell`                | `grid.api.scrollToCell({ rowIndex, colIndex })`                                                                                          |
| Pagination                                     | Use the `pagination()` plugin                                                                                                            |
| Cell selection / range                         | `selection: { mode: 'range' \| 'cell' \| 'row' \| 'none', multiRange: true, fillHandle: true }`                                          |

## What's different philosophically

**Renderers are DOM, not JSX.** `react-data-grid` cells are React components — every visible cell renders through React reconciliation. Better Grid renderers are `(container, ctx) => void` mutating an `HTMLElement` directly. You lose JSX inside cells but gain the cell-pooling pipeline that sustains 60 FPS at 10M cells. For the 90% case (text, currency, date, badge, rating, boolean, progress), set `cellType` and the registered renderer does the DOM work for you.

**Features via mode/features, not row-model functions.** `react-data-grid` is closer to "render-included headless" — you opt into behavior via component props and helper functions. Better Grid uses a `mode` preset (`view` / `interactive` / `spreadsheet` / `dashboard`) and an additive `features` list. Both let you opt out, but the surface area is smaller: `mode="spreadsheet"` is one prop covering sort + filter + edit + clipboard + undo.

**No `onRowsChange` re-render dance.** `react-data-grid` expects the parent to immutably replace `rows` after every edit — the parent's setter triggers a React re-render. Better Grid's grid owns its data internally and emits a `data:change` event; you can mirror back into your store via `onCellChange` (or auto-bridge into react-hook-form via `useGridForm({ grid, baseName })` from `@better-grid/react/rhf`) without rebuilding the row array on every keystroke.

**Stable handle pattern.** `gridRef.current?.method()` becomes `grid.api.method()` after `const grid = useGrid({...})`. The handle is stable across renders and doesn't need a ref dance.
