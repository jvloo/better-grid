# Migrating from TanStack Table

A cheat-sheet for translating TanStack Table column definitions and table options to Better Grid. Most column-definition keys survive verbatim; the biggest shift is that rendering is included — you don't pipe cells through `flexRender` anymore, and features ship as plugins instead of row-model functions.

## Column definition mapping

| TanStack Table                                     | Better Grid                                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `accessorKey: 'amount'`                            | `accessorKey: 'amount'` (same) — or `accessorFn: (row, rowIndex) => unknown` for derived values                                       |
| `id: 'amount'`                                     | `id: 'amount'` (same — required for every column)                                                                                     |
| `header: 'Amount'`                                 | `header: 'Amount'` (same — also accepts `() => HTMLElement \| string`)                                                                |
| `header: info => <strong>Amount</strong>`          | `header: () => { const el = document.createElement('strong'); el.textContent = 'Amount'; return el; }` — DOM, not JSX                 |
| `cell: info => <Badge>{info.getValue()}</Badge>`   | `cellRenderer: (container, ctx) => void` — mutate `container` directly, read value from `ctx.value`; OR use a built-in `cellType`     |
| `cell: info => formatCurrency(info.getValue())`    | `cellType: 'currency'` + the `formatting()` plugin — no custom renderer needed for common types                                       |
| `flexRender(cell.column.columnDef.cell, ...)`      | Not needed — Better Grid owns rendering. You write `cellRenderer` (or pick a `cellType`) and the grid handles the pipeline.           |
| `meta: { className: 'right' }`                     | `meta: { ... }` (same — free-form extension bag for third-party plugins)                                                              |
| `size: 150`, `minSize: 60`, `maxSize: 300`         | `width: 150`, `minWidth: 60`, `maxWidth: 300`                                                                                         |
| `enableSorting: true` (per column)                 | `sortable: true` (per column) + `sorting()` plugin                                                                                    |
| `enableColumnFilter: true` (per column)            | Column filters come from loading the `filtering()` plugin globally. There's no per-column opt-in; columns without a filterable value simply won't get useful filter ops. |
| `enableResizing: true`                             | `resizable: true`                                                                                                                     |
| `sortingFn: 'alphanumeric'`                        | `comparator: (a, b) => number` — bring your own, or omit and default comparators apply                                                |
| `filterFn: 'includesString'`                       | Not per-column. `filtering()` plugin exposes 9 operators (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `startsWith`, `endsWith`) in a column header menu. |

## Table options mapping

| TanStack Table                                        | Better Grid                                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `useReactTable({ data, columns, ... })`               | `useGrid({ data, columns, plugins, ... })`                                                                                                  |
| `getCoreRowModel: getCoreRowModel()`                  | Built in. No row-model function needed.                                                                                                     |
| `getSortedRowModel: getSortedRowModel()`              | `plugins: [sorting()]`                                                                                                                      |
| `getFilteredRowModel: getFilteredRowModel()`          | `plugins: [filtering()]`                                                                                                                    |
| `getPaginationRowModel: getPaginationRowModel()`      | `plugins: [pagination({ pageSize: 20 })]`                                                                                                   |
| `getGroupedRowModel: getGroupedRowModel()`            | `plugins: [grouping({ groupBy: ['dept'] })]`                                                                                                |
| `getExpandedRowModel: getExpandedRowModel()`          | `plugins: [hierarchy({ indentColumn: 'name' })]` + top-level `hierarchy: { getRowId, getParentId }` option                                  |
| `state: { sorting, columnFilters, ... }`              | Plugin-local state. Query via `grid.plugins.sorting?.getSortState()` etc. (typed from the plugins tuple)                                    |
| `onSortingChange`                                     | `sorting({ onSortChange: (state) => ... })`                                                                                                 |
| `onColumnFiltersChange`                               | `filtering({ onFilterChange: (filters) => ... })`                                                                                           |
| `manualSorting: true`                                 | `sorting({ manualSorting: true })`                                                                                                          |
| `manualFiltering: true`                               | `filtering({ manualFiltering: true })`                                                                                                      |
| `flexRender(header.column.columnDef.header, ...)`     | Not needed. Better Grid renders the header itself.                                                                                          |
| `table.getRowModel().rows.map(row => ...)`            | Not needed. You mount the grid once (`<div ref={containerRef} />`) and it renders itself virtually.                                         |

## React-first vs headless-first

**TanStack Table is headless** — it manages state (sort, filter, pagination, grouping) and hands you data you render yourself with JSX, a `<table>`, or whatever you want. That's the point. You pay for that flexibility by writing every `<tr>`, `<td>`, `flexRender` call, sticky-header CSS, virtualizer integration, and cell-editor state machine yourself.

**Better Grid is rendering-included** — the core ships a virtualized DOM pipeline, frozen-column overlay, selection layer, keyboard navigation, and cell editors. You style with CSS custom properties (`--bg-cell-bg`, `--bg-header-bg`, `--bg-selection-bg`, etc.) and extend with plugins. You can still drop into custom `cellRenderer` functions when you need them, but for the 90% case (text / currency / date / badge / rating / boolean / progress cells) you just set `cellType` on a column and the `formatting()` + `cellRenderers()` plugins handle the pixels.

The migration cost is real in one direction: if your TanStack table is already a rich custom `<table>` with bespoke hover states and inline JSX everywhere, Better Grid's DOM-first renderers will feel constrained. In the other direction — if you're building TanStack + `@tanstack/react-virtual` + a custom cell editor + sticky columns + clipboard and the complexity is crushing you — Better Grid gives you all of that out of the box, in one package, for free.
