# Migrating from Handsontable

A cheat-sheet for translating Handsontable to Better Grid. Both are spreadsheet-style libraries; the surface concepts (cell types, validators, formula support, copy/paste) line up cleanly. The biggest shifts are (a) Better Grid is plugin-additive instead of monolithic option soup, and (b) renderers are DOM mutations instead of jQuery-style imperative renderers.

## Codemod

```bash
npx @better-grid/codemods from-handsontable src/
```

Auto-converts the rename rows below; flags renderer-signature and structural rows for manual review (marker: `// @better-grid/migrate: review`). Flags: `--dry-run`, `--report=<path>`, `--ext=ts,tsx,js,jsx`.

## Column definition mapping

| Handsontable                                   | Better Grid                                                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `data: 'amount'`                               | `field: 'amount'` (or `valueGetter: (row) => ...` for derived values) — the `defineColumn` builder fills both: `col.currency('amount', {...})` |
| `title: 'Amount'`                              | `headerName: 'Amount'`                                                                                                                       |
| `type: 'numeric'`                              | `cellType: 'number'` (or `col.number(...)`)                                                                                              |
| `type: 'date'` / `dateFormat`                  | `cellType: 'date'` (or `col.date(...)`); `dateFormat` is set on the formatting plugin                                                    |
| `type: 'checkbox'`                             | `cellType: 'boolean'` (or `col.boolean(...)`)                                                                                            |
| `type: 'dropdown'` / `source: [...]`           | `cellType: 'select'` (display) + `cellEditor: 'select'` + `options: [...]` — or the builder `col.badge('field', { options: [...] })`     |
| `type: 'autocomplete'`                         | `cellEditor: 'autocomplete'` + `options: [...]` (also accepts `meta: { allowCreate: true }`)                                              |
| `numericFormat: { pattern: '$0,0.00' }`        | `cellType: 'currency'` + the `format` feature (Intl-based formatter; pass locale/currency in feature options)                            |
| `renderer: customFn`                           | `cellRenderer: (container, ctx) => void` — DOM mutation, not the (instance, td, row, col, prop, value, cellProperties) signature         |
| `editor: 'numeric' \| 'text' \| 'select'`      | `cellEditor: 'number' \| 'text' \| 'select'` (also `'date'`, `'autocomplete'`, `'masked'`, `'selectWithInput'`)                           |
| `validator: fn` / `allowInvalid: false`        | `rules: [{ validate: (v, row) => boolean \| string, message?: string, messageRenderer?: (issue) => HTMLElement \| string }]`             |
| `readOnly: true`                               | `editable: false` (or function `(row, column) => boolean`)                                                                               |
| `width: 100`                                   | `width: 100`                                                                                                                             |
| `className: 'right-align'`                     | `cellClass: (value, row) => 'right-align'` — function form only                                                                          |
| `wordWrap: false`                              | Drive via CSS — `cellClass` returning a class with `white-space: nowrap`                                                                 |
| `placeholder: 'Type here'`                     | `placeholder: 'Type here'` (used by the editing plugin's `inputStyle` and `alwaysInput` modes)                                           |

## Grid options mapping

| Handsontable                                   | Better Grid                                                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `data: rows`                                   | `data: rows`                                                                                                                             |
| `colHeaders: true \| ['A', 'B']`               | `headers: [{ id: 'h1', cells: [...] }]` — multi-level supported via colSpan/rowSpan                                                      |
| `rowHeaders: true`                             | Not directly supported; render a leftmost frozen column as a row-number column manually if needed                                        |
| `fixedColumnsLeft: 2`                          | `frozen: { left: 2 }`                                                                                                                    |
| `fixedRowsTop: 1`                              | `frozen: { top: 1 }`                                                                                                                     |
| `fixedRowsBottom: 1`                           | `pinned: { bottom: [totalsRow] }` (separate data outside the main array)                                                                 |
| `manualColumnResize: true`                     | Add `'resize'` to `features` (in any preset other than `null`)                                                                           |
| `manualColumnMove: true`                       | Add `'reorder'` to `features` (in `mode="interactive"` or higher)                                                                        |
| `columnSorting: true`                          | Add `'sort'` to `features` (in any preset other than `null`)                                                                             |
| `filters: true` + `dropdownMenu`               | Add `'filter'` to `features`                                                                                                             |
| `contextMenu: true`                            | Filtering ships its own context menu. For a custom right-click menu, the `rowActions` plugin (Pro) provides the per-row hook.            |
| `comments: true`                               | Not built-in. Render via `column.tooltip` cellType or a custom `cellRenderer`.                                                           |
| `mergeCells: [{ row: 1, col: 1, rowspan: 2 }]` | Use the `mergeCells` plugin (Pro)                                                                                                        |
| `nestedHeaders: [...]`                         | `headers: [{ id: 'group', cells: [{ content: 'Group', colSpan: 3 }] }, { id: 'detail', cells: [...] }]`                                  |
| `nestedRows: true`                             | Use the `hierarchy` plugin + `hierarchy: { getRowId, getParentId }` option                                                               |
| `formulas: true` (HyperFormula)                | Not built-in in v1. Compute derived columns in `valueGetter`, or wire HyperFormula yourself in your data layer.                           |
| `copyPaste: true`                              | Add `'clipboard'` to `features` (in `mode="spreadsheet"` or higher) — Excel-compatible TSV + HTML rich paste                              |
| `undo: true`                                   | Add `'undo'` to `features` (in `mode="spreadsheet"`)                                                                                     |
| `afterChange(changes, source)`                 | `onCellChange(changes)` — receives `CellChange[]` (no source string; check via plugin events if needed)                                  |
| `Handsontable.hooks.add('afterCreateRow', fn)` | `grid.api.on('data:set', fn)` for the wholesale data updates; cell-level changes via `'cell:change'`                                     |
| Handsontable instance                          | `const grid = useGrid({...})` — `grid.api` is the imperative handle (or `createGrid({...})` for vanilla TS)                              |

## What's different philosophically

**Plugins instead of options.** Handsontable is famous for its enormous options object — everything is a flag on `new Handsontable(container, opts)`. Better Grid splits this into a tiny core (selection, virtualization, rendering, keyboard nav) and per-feature plugins. Most consumers never touch `plugins={[...]}` directly — they pick a `mode` preset (`view` / `interactive` / `spreadsheet` / `dashboard`) or a `features` list, and the relevant plugins load. When you need a non-registry plugin, drop into `plugins={[customPlugin({...})]}`.

**TypeScript is load-bearing.** Handsontable's TS types describe its options bag but don't carry plugin-API typing into your usage. Better Grid uses `const TPlugins` to preserve the literal type of the plugins tuple, so `grid.api.plugins.sorting.toggleSort(...)` is statically typed from your factory call. `InferRow<typeof grid>` and friends recover row/state types from the instance.

**MIT for everything that matters.** Handsontable's free Hobby license is non-commercial only — Standard / Priority licenses cost ~$999–$1,299/dev/yr. Better Grid's free packages (`core`, `react`, `plugins`) are MIT, including features Handsontable charges for (clipboard, validation, hierarchy, sort/filter UI). The `@better-grid/pro` package is source-available with a separate commercial license — see [`/LICENSE-PRO`](../../LICENSE-PRO).

**Renderer contract.** Handsontable's `renderer: function(instance, td, row, col, prop, value, cellProperties)` mutates `td` and may call `Handsontable.renderers.TextRenderer.apply(...)` to inherit defaults. Better Grid's `cellRenderer: (container, ctx) => void` mutates `container` directly. To inherit defaults, set `cellType` and let the registered renderer run; if you need to wrap it, write a custom renderer that calls `getCellType(...).render(container, ctx)` first.
