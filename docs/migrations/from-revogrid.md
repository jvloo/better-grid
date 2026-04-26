# Migrating from RevoGrid

A cheat-sheet for translating RevoGrid (`@revolist/revogrid` and `@revolist/revogrid-pro`) to Better Grid. The two libraries have similar shapes — both are framework-agnostic Web Components / vanilla cores with thin React/Vue/Angular adapters, both ship a plugin model, both lean spreadsheet-y. The main migration cost is plugin shape and renderer contract.

## Column definition mapping

| RevoGrid                                       | Better Grid                                                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `prop: 'amount'`                               | `field: 'amount'` (or `valueGetter` for derived) — `defineColumn` builder fills both: `col.currency('amount', {...})`               |
| `name: 'Amount'`                               | `headerName: 'Amount'`                                                                                                                       |
| `cellTemplate: (h, props) => h('span', ...)`   | `cellRenderer: (container, ctx) => void` — DOM mutation, no JSX/h(). For built-ins set `cellType` and skip writing a renderer.            |
| `cellProperties: () => ({ class: '...' })`     | `cellClass: (value, row) => string` and `cellStyle: (value, row) => Record<string, string>`                                              |
| `editor: 'select'` + custom editor classes     | `cellEditor: 'select'` (or `'selectWithInput'`) + `options: [...]`. Other editors: `'text' \| 'number' \| 'date' \| 'autocomplete' \| 'masked'`. |
| `readonly: true`                               | `editable: false` (or function `(row, column) => boolean`)                                                                               |
| `sortable: true`                               | `sortable: true` (same) — also requires the `'sort'` feature                                                                             |
| `filter: true \| 'string' \| 'number'`         | Filtering comes from the `'filter'` feature; the operator menu chooses the right ops based on the cell value type                        |
| `size: 100` / `minSize` / `maxSize`            | `width: 100`, `minWidth`, `maxWidth`                                                                                                     |
| `pin: 'colPinStart'`                           | **Global**: `frozen={{ left: N }}` (no per-column pin in v1)                                                                             |
| `cellCompare(a, b)`                            | `comparator: (a, b) => number`                                                                                                           |
| `columnGroup` / nested header groups           | `headers: [{ id: 'group', cells: [{ content: 'Group', colSpan: 3 }] }, { id: 'detail', cells: [...] }]`                                  |

## Grid options mapping

| RevoGrid                                       | Better Grid                                                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `source` (data array)                          | `data`                                                                                                                                   |
| `columns`                                      | `columns`                                                                                                                                |
| `pinnedTopSource` / `pinnedBottomSource`       | `pinned: { top: [...], bottom: [...] }`                                                                                                  |
| `rowHeaders: true`                             | Not directly supported; render a leftmost frozen column as a row-number column manually if needed                                        |
| `range: true`                                  | `selection: { mode: 'range' }`                                                                                                           |
| `canFocus: true`                               | Default; selection-driven                                                                                                                |
| `resize: true`                                 | Add `'resize'` to `features` (in any preset other than `null`)                                                                           |
| `autoSizeColumn`                               | Not built-in; set explicit widths or compute them from data                                                                              |
| `theme: 'compact' \| 'darkCompact' \| ...`     | Drive via CSS variables (e.g. `--bg-cell-padding: 0 6px`). See [`../guides/theming-with-mui.md`](../guides/theming-with-mui.md) for a full recipe. |
| Plugins via `revogrid-pro` (Pro)               | `plugins: [...]` escape hatch, or use `mode`/`features` for the registered ones                                                          |
| `@beforechange` / `@afteredit` events          | `onCellChange(changes)` — receives `CellChange[]`                                                                                        |
| `await grid.refresh()` / `getSource()`         | `grid.api.refresh()` / `grid.api.getState().data`                                                                                        |
| `async setSource(rows)`                        | `grid.api.setData(rows)` (synchronous)                                                                                                    |
| `groupBy: ['column']` (Pro)                    | Use the `grouping` plugin (Pro)                                                                                                          |
| Trim/filter ranges                             | Filtering operators in the `filter` feature                                                                                              |

## What's different philosophically

**Plugin contract.** RevoGrid's plugin system extends `BasePlugin` with lifecycle hooks. Better Grid plugins are factory functions returning `GridPlugin<id, Api>`; they expose typed APIs via `ctx.expose(api)`, augment `ColumnDef` via TypeScript module augmentation, and are looked up at `grid.api.plugins.<id>`. Both shapes are framework-agnostic, but Better Grid's typed plugin tuple gives you statically-checked plugin APIs without manual cast.

**Free tier coverage.** RevoGrid's Pro tier ships rating, badge, progress, sparkline, and bar chart cell renderers as paid renderers (Pro Lite $199/dev/yr; Pro Advanced $499/dev/yr). Better Grid ships the equivalents (`badge`, `progress`, `boolean`, `rating`, `change`, `link`, `timeline`, `tooltip`, `loading`, `custom`) in `@better-grid/plugins` under MIT — no purchase required. Pro-only renderers in `@better-grid/pro` are sparkline / heatmap / mini-chart / Gantt-cell shapes; the simple status/badge/rating renderers are free.

**Cell renderers are DOM, not Web Component templates.** RevoGrid uses Stencil h() pragma in `cellTemplate`. Better Grid renderers are plain DOM mutation — you receive an `HTMLElement` and assign children/text. For React-style ergonomics inside a cell renderer, render JSX into a detached node via `createRoot(detachedDiv).render(<JSX/>)` and `container.appendChild(detachedDiv)`. Most cells never need this — set `cellType` and the registered renderer handles the DOM.

**Framework adapters.** RevoGrid ships React/Vue/Angular/Svelte/vanilla wrappers from a single Stencil-compiled Web Component. Better Grid ships a vanilla TS core and a React adapter today (~50 LOC of reactivity); Vue, Solid, Svelte, and Angular adapters are planned and follow the same thin-wrapper pattern.
