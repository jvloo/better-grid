# Migrating from TanStack Table

A cheat-sheet for translating TanStack Table column definitions and table options to Better Grid. Most column-definition keys survive verbatim; the biggest shift is that rendering is included — you don't pipe cells through `flexRender` anymore, and features ship via a `mode`/`features` preset instead of row-model functions.

## Column definition mapping

| TanStack Table                                     | Better Grid                                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `accessorKey: 'amount'`                            | `accessorKey: 'amount'` (same) — or `accessorFn: (row, rowIndex) => unknown` for derived values. The `defineColumn` builder fills both keys for you: `col.currency('amount', {...})`. |
| `id: 'amount'`                                     | `id: 'amount'` (same — required for every column; auto-set by `defineColumn` builders)                                                |
| `header: 'Amount'`                                 | `header: 'Amount'` (same — also accepts `() => HTMLElement \| string`)                                                                |
| `header: info => <strong>Amount</strong>`          | `header: () => { const el = document.createElement('strong'); el.textContent = 'Amount'; return el; }` — DOM, not JSX                 |
| `cell: info => <Badge>{info.getValue()}</Badge>`   | `cellType: 'badge'` + `options` on the column. Or, for fully custom: `cellRenderer: (container, ctx) => void` — mutate `container` directly, read value from `ctx.value`. |
| `cell: info => formatCurrency(info.getValue())`    | `col.currency('amount', { precision: 2 })` (or set `cellType: 'currency'` manually) + the `'format'` feature — no custom renderer needed |
| `flexRender(cell.column.columnDef.cell, ...)`      | Not needed — Better Grid owns rendering. You write `cellRenderer` (or pick a `cellType`) and the grid handles the pipeline.           |
| `meta: { className: 'right' }`                     | `meta: { ... }` (same — free-form extension bag for third-party plugins)                                                              |
| `size: 150`, `minSize: 60`, `maxSize: 300`         | `width: 150`, `minWidth: 60`, `maxWidth: 300`                                                                                         |
| `enableSorting: true` (per column)                 | `sortable: true` (per column) — comes for free in any mode that includes the `'sort'` feature (every preset except `null`)            |
| `enableColumnFilter: true` (per column)            | Filtering comes from the `'filter'` feature. There's no per-column opt-in; columns without a filterable value simply won't get useful filter ops. |
| `enableResizing: true`                             | `resizable: true`                                                                                                                     |
| `sortingFn: 'alphanumeric'`                        | `comparator: (a, b) => number` — bring your own, or omit and default comparators apply                                                |
| `filterFn: 'includesString'`                       | Not per-column. The `filtering` plugin exposes 9 operators (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `startsWith`, `endsWith`) in a column header menu. |

## Table options mapping

| TanStack Table                                        | Better Grid                                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `useReactTable({ data, columns, ... })`               | `useGrid({ data, columns, mode: 'spreadsheet' })` — returns a `GridHandle { api, containerRef }`                                            |
| `getCoreRowModel: getCoreRowModel()`                  | Built in. No row-model function needed.                                                                                                     |
| `getSortedRowModel: getSortedRowModel()`              | Add `'sort'` to `features` (or use `mode="view"` / higher)                                                                                  |
| `getFilteredRowModel: getFilteredRowModel()`          | Add `'filter'` to `features`                                                                                                                |
| `getPaginationRowModel: getPaginationRowModel()`      | Use the `pagination()` plugin via the `plugins` escape hatch (not in the default mode/features registry)                                    |
| `getGroupedRowModel: getGroupedRowModel()`            | Use the `grouping()` plugin via the `plugins` escape hatch (`@better-grid/pro`)                                                             |
| `getExpandedRowModel: getExpandedRowModel()`          | Use the `hierarchy()` plugin via the `plugins` escape hatch + top-level `hierarchy: { getRowId, getParentId }` option                       |
| `state: { sorting, columnFilters, ... }`              | Plugin-local state. Query via `grid.api.plugins.sorting?.getSortState()` etc. (typed from the plugins tuple)                                |
| `onSortingChange`                                     | `features={{ sort: { onSortChange: (state) => ... } }}` — feature options pass through to the underlying plugin                             |
| `onColumnFiltersChange`                               | `features={{ filter: { onFilterChange: (filters) => ... } }}`                                                                               |
| `manualSorting: true`                                 | `features={{ sort: { manualSorting: true } }}`                                                                                              |
| `manualFiltering: true`                               | `features={{ filter: { manualFiltering: true } }}`                                                                                          |
| `flexRender(header.column.columnDef.header, ...)`     | Not needed. Better Grid renders the header itself.                                                                                          |
| `table.getRowModel().rows.map(row => ...)`            | Not needed. You mount the grid once (`<BetterGrid grid={handle} />`) and it renders itself virtually.                                       |
| External form state (RHF)                             | `useGridForm({ grid: handle, baseName: 'rows' })` from `@better-grid/react/rhf` — bridges cell commits into a surrounding `<FormProvider>` |

## React-first vs headless-first

**TanStack Table is headless** — it manages state (sort, filter, pagination, grouping) and hands you data you render yourself with JSX, a `<table>`, or whatever you want. That's the point. You pay for that flexibility by writing every `<tr>`, `<td>`, `flexRender` call, sticky-header CSS, virtualizer integration, and cell-editor state machine yourself.

**Better Grid is rendering-included** — the core ships a virtualized DOM pipeline, frozen-column overlay, selection layer, keyboard navigation, and cell editors. You style with CSS custom properties (`--bg-cell-bg`, `--bg-header-bg`, `--bg-selection-bg`, etc.) and extend with plugins. You can still drop into custom `cellRenderer` functions when you need them, but for the 90% case (text / currency / date / badge / rating / boolean / progress cells) you just set `cellType` on a column (or call the matching `defineColumn` builder) and the grid handles the pixels.

**v1 init API ergonomics.** Where TanStack Table requires you to compose row-model functions explicitly, Better Grid v1 picks defaults via `mode` presets (`view`, `interactive`, `spreadsheet`, `dashboard`) — string-based opt-in into curated feature bundles. `features={['edit', 'sort']}` is the finer-grained equivalent; `features={{ edit: { editTrigger: 'click' } }}` passes per-feature options. Drop down to `plugins={[...]}` only when you need an off-registry plugin or full control.

The migration cost is real in one direction: if your TanStack table is already a rich custom `<table>` with bespoke hover states and inline JSX everywhere, Better Grid's DOM-first renderers will feel constrained. In the other direction — if you're building TanStack + `@tanstack/react-virtual` + a custom cell editor + sticky columns + clipboard and the complexity is crushing you — Better Grid gives you all of that out of the box, in one package, for free.
