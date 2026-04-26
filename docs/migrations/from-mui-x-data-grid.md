# Migrating from MUI X Data Grid

A cheat-sheet for translating MUI X Data Grid (`@mui/x-data-grid` and the Pro/Premium tiers) to Better Grid. The mental shift is small for column definitions; the bigger differences are around (a) features (MUI X uses props + slots, Better Grid uses a `mode`/`features` registry), and (b) renderers (MUI X cells are React; Better Grid cells are DOM mutations).

## Column definition mapping

| MUI X Data Grid                                | Better Grid                                                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `field: 'amount'`                              | `accessorKey: 'amount'` (or use the builder: `col.currency('amount', {...})`)                                                            |
| `headerName: 'Amount'`                         | `header: 'Amount'`                                                                                                                       |
| `type: 'number'` / `'date'` / `'singleSelect'` | `cellType: 'number'` / `'date'` / `'select'` — or the builder: `col.number(...)`, `col.date(...)`                                        |
| `valueGetter: ({ row }) => row.x + row.y`      | `accessorFn: (row) => row.x + row.y`                                                                                                     |
| `valueFormatter: ({ value }) => string`        | `valueFormatter: (value) => string` — flat signature, no `params` object                                                                 |
| `valueParser: ({ value }) => parsed`           | `valueParser: (str) => unknown` — flat signature                                                                                         |
| `renderCell: (params) => <Cell />`             | `cellRenderer: (container, ctx) => void` — DOM-first; mutate `container` directly. Use `ctx.context` to read latest closure-over-scope values without re-init. |
| `renderEditCell: (params) => <Edit />`         | Pick a built-in `cellEditor` (`'text' \| 'number' \| 'date' \| 'select' \| 'autocomplete' \| 'masked'`). For fully custom editors, drop into the editing plugin's hook surface. |
| `editable: true`                               | `editable: true` (same — or function `(row, column) => boolean`)                                                                         |
| `width: 150`, `minWidth`, `flex: 1`            | `width: 150`, `minWidth`. (Better Grid doesn't have a flex-grow column today; use `width` or omit for default.)                          |
| `align: 'right'`, `headerAlign: 'left'`        | `align: 'right'` on the column. Header alignment isn't separately configurable today — open a feature request if you need it.            |
| `sortable: true`                               | `sortable: true` (same) — also requires the `'sort'` feature (in any preset other than `null`)                                           |
| `filterable: true`                             | Filtering comes from the `'filter'` feature (in `mode="view"` and richer presets). No per-column opt-in flag.                            |
| `pinned: 'left'` (Pro)                         | **Global**: `frozen={{ left: N }}` on grid options — freezes the first N columns of your `columns` array. There is no per-column `pinned`. |
| `groupable: true` (Premium)                    | Use the `grouping` plugin (Pro). Behavior is similar but configured at the grid level.                                                   |
| `cellClassName: 'red'` / `getCellClassName`    | `cellClass: (value, row) => 'red'` — function form only                                                                                  |
| `colSpan: 2` (per cell)                        | Use the `mergeCells` plugin (Pro) — span configured globally, not per-cell-callback.                                                     |

## Grid options mapping

| MUI X Data Grid                                | Better Grid                                                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `rows`                                         | `data`                                                                                                                                   |
| `columns`                                      | `columns`                                                                                                                                |
| `getRowId={(row) => row.id}`                   | `hierarchy: { getRowId: (row) => row.id }` (only needed when using hierarchy or stable selection across data swaps)                      |
| `rowHeight: 32`                                | `rowHeight: 32` (same) — also accepts `(rowIndex) => number`                                                                             |
| `columnHeaderHeight`                           | `headerHeight`                                                                                                                           |
| `pinnedRows={{ top: [...], bottom: [...] }}`   | `pinned={{ top: [...], bottom: [...] }}`                                                                                                 |
| `checkboxSelection` + `rowSelectionModel`      | `selection: { mode: 'row', multiRange: true }` + `onSelectionChange`                                                                     |
| `disableRowSelectionOnClick`                   | `selection: { mode: 'none' }` if you want no selection at all; otherwise selection is click-driven by default                            |
| `pagination` + `paginationModel`               | Use the `pagination()` plugin                                                                                                            |
| `slots={{ toolbar: GridToolbar }}` / `slotProps` | Reserved seam — `slots`/`slotProps` props exist on `<BetterGrid>` but the v1 slot catalog is empty. Build chrome around the grid for now.|
| `processRowUpdate` / `onRowEditStop`           | `onCellChange={(changes) => ...}` — receives `CellChange[]`                                                                              |
| `apiRef`                                       | `const grid = useGrid({...})` — `grid.api` is the imperative handle                                                                      |
| `density: 'compact' \| 'comfortable'`          | Drive via CSS variables: set `--bg-cell-padding` / `--bg-font-size` per density tier. See [`../guides/theming-with-mui.md`](../guides/theming-with-mui.md) for the recipe. |
| MUI theme integration                          | First-class — see [`../guides/theming-with-mui.md`](../guides/theming-with-mui.md).                                                      |
| Form integration with react-hook-form          | First-class via `useGridForm({ grid, baseName })` from `@better-grid/react/rhf`.                                                         |

## What's different philosophically

**Renderers run as DOM, not React.** MUI X Data Grid wraps every cell renderer in a React subtree, which means each scroll frame can reconcile thousands of cells. Better Grid renderers are `(container, ctx) => void` — you mutate `container` directly. You lose JSX ergonomics inside cells, but you gain the cell-pooling performance that lets the grid sustain 60 FPS at 10M cells. For the 90% case (text, currency, date, badge, rating, boolean, progress), you don't write a renderer — you set `cellType` (or use the matching `defineColumn` builder) and the `cellRenderers` plugin does the work.

**No tier ladder.** MUI X has Community / Pro / Premium tiers. Better Grid has Free (`@better-grid/plugins`, MIT) and Pro (`@better-grid/pro`, source-available, commercial license for production). Pinned rows, multi-level headers, range selection, clipboard, validation, hierarchy, and CSV/Excel export are all in the free tier — features MUI X gates behind Pro.

**Framework-agnostic core.** MUI X Data Grid is React-only. `@better-grid/core` runs in vanilla TS, with `@better-grid/react` as a thin adapter (~50 LOC of reactivity). If you have a non-React surface to support later, you keep the same column definitions.

**No `apiRef` — handle pattern instead.** `useGrid({...})` returns a `GridHandle` with `api`, `containerRef`, and a ref-based `context` you can read inside cell renderers. The handle is stable across renders and behaves the same whether you mount with `<BetterGrid grid={grid} />` (advanced) or pass options inline to `<BetterGrid columns data ... />` (sugar).
