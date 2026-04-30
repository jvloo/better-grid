# Changelog

All notable changes to Better Grid are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/spec/v2.0.0.html).

The same `1.x` version applies across `@better-grid/core`, `@better-grid/react`, `@better-grid/plugins`, and `@better-grid/pro` until the packages diverge.

## [1.0.14] — 2026-04-30

Bug-fix follow-up to 1.0.13 — three issues surfaced during in-app
verification of the new tooltip / scrollbar features:

### Free plugins (`@better-grid/plugins`) / Core

- **Cell tooltip — utility cells now hard-skipped.** The `text.trim()`
  empty-content check in `handleCellMouseOver` was a soft filter:
  cells whose content is purely an icon button (kebab, hierarchy
  toggle, selection checkbox) could still end up triggering a tooltip
  if the icon rendered a glyph that survived as text content. The
  handler now early-returns when the cell contains
  `.bg-row-actions-trigger`, `.bg-hierarchy-toggle`, or
  `.bg-selection-checkbox`, regardless of textContent. Gantt cells
  also short-circuit — the gantt plugin owns its own bar tooltip.

### Core (`@better-grid/core`)

- **Floating scrollbar honors its offset rectangle.** The base
  `.bg-grid__scroll { width: 100%; height: 100% }` cascade was beating
  the inline `left` / `right` (and `top` / `bottom`) offsets in
  floating mode, so a scrollbar configured to span only the
  time-series area was instead stretched across the full grid width.
  `.bg-grid__scroll--floating` now sets `width: auto` and
  `height: auto` so the four offset properties resolve to the
  intended sub-region.

### Pro plugins (`@better-grid/pro`)

- **Gantt resize handle copy** updated from "Drag to change start
  date" / "Drag to change end date" to "Drag left/right to adjust
  Start" / "Drag left/right to adjust End" — clearer about the
  direction of the gesture.

## [1.0.13] — 2026-04-30

Versions 1.0.9–1.0.12 were published in rapid succession from a working
tree that was never committed back to source, and the surviving fixes
caused regressions in downstream consumers (focus flicker on click-edit,
stale-value commits in masked editors, host-input box-shadow leaking
onto floating editors). 1.0.13 is the consolidated, source-committed
re-ship: it keeps the *intents* of those releases but trims the brittle
parts and adds the tooltip / scrollbar features that were attempted in
1.0.9 then reverted in 1.0.10.

### Free plugins (`@better-grid/plugins`)

- **Editing — input-style anchor mirroring is now opt-in.** Previously,
  whenever an editable cell rendered a `.bg-input-box` wrapper the
  floating editor would silently mirror the wrapper's `backgroundColor`,
  `borderRadius`, and `boxShadow` so the open editor matched the closed
  cell. In real apps this leaked host-input rules (MUI/Antd shadows,
  wide radii) onto the editor and looked wrong. The mirror is now gated
  behind `editing({ matchAnchorStyle: true })` and defaults to off.
- **Editing — single-frame focus deferral on click-to-edit.** Earlier
  versions called `focusEditor()` synchronously *and* again via
  `requestAnimationFrame` to survive the originating click sequence.
  The double call produced a visible focus flicker. 1.0.13 collapses to
  one deferred focus when a click event opened the editor; non-click
  paths focus synchronously.
- **Editing — masked editor section selection reverts to mouseup.** The
  v1.0.11 attempt used `mousedown.preventDefault() + manual focus +
  syncInputDisplay` so the section selection survived the native click.
  That combination suppressed the focus handoff some commit paths
  expected, producing stale-value commits when the cell-blur committer
  fired before the manual focus settled. 1.0.13 reverts to a `mouseup`
  handler that re-establishes the section range after the browser
  places the caret, and only re-renders the display layer when the
  active section actually changed.

### Core (`@better-grid/core`)

- **`GridOptions.tooltip`** — `TooltipOptions` is now a public type:
  `{ enabled, delay, clippedText, columnResize }`. All defaults preserve
  prior behavior.
  - Empty / whitespace-only header and cell text no longer triggers a
    blank tooltip on hover. Utility cells (chevron, action menu,
    selection checkbox) are silent.
  - The clipped-text probe now prefers `.bg-input-box__value` over the
    cell box when present, so input-style cells show the value text in
    the tooltip instead of an empty cell box.
  - Column-resize tooltip — while dragging a header resize grip, a
    `"{n}px"` readout follows the cursor. Default on; disable with
    `tooltip: { columnResize: false }`.
- **`GridOptions.scrollbar`** — `ScrollbarOptions` is now a public type:
  `{ mode: 'fixed' | 'floating', horizontalOffsetLeft, horizontalOffsetRight,
  verticalOffsetTop, verticalOffsetBottom }`.
  - `fixed` (default) is the prior behavior: a gutter strip on the
    right/bottom holds native scrollbar tracks.
  - `floating` overlays the scrollbar on top of cells without reserving
    gutter space. Offsets accept px numbers or symbolic values:
    `'after-frozen-left'` (resolves to the live frozen-left clip width
    so the track starts where time-series cells begin) and `'header'`
    (vertical offset only — starts the track below the header). Symbolic
    offsets re-resolve on `frozen:clip` and on `ResizeObserver` ticks,
    so freeze-clip drag and viewport resize stay synchronized.
  - **Browser support note**: floating mode relies on
    `pointer-events: none` on the scroll host plus a
    `::-webkit-scrollbar { pointer-events: auto }` rule to keep the
    native scrollbar interactive. Works on Chromium, Edge, and modern
    WebKit. On Firefox, native scrollbar tracks remain interactive only
    on platforms where the OS draws overlay scrollbars. Use fixed mode
    if cross-platform parity matters.

### Pro plugins (`@better-grid/pro`)

- **Gantt** — left/right resize handles now show "Drag to change start
  date" / "Drag to change end date" tooltips on hover. Tooltips suppress
  themselves while a drag is in progress so they don't follow the
  cursor through the move.
- **Row actions — `triggerSize`** is documented and unchanged from
  1.0.11. Default 32, min 20.

## [1.0.8] — 2026-04-29

### Free plugins (`@better-grid/plugins`)

- **Editing** — masked editors now use placeholder labels in the hidden input value so browser selection aligns with the visible `MM/YY` display.

## [1.0.7] — 2026-04-29

### Free plugins (`@better-grid/plugins`)

- **Editing** — input-style floating editors now inherit the input box background, radius, and shadow so focused cells can match host app input styling.

## [1.0.6] — 2026-04-29

### Free plugins (`@better-grid/plugins`)

- **Editing** — floating text editors opened from input-style cells now use the same transparent, borderless focus treatment as masked editors.

## [1.0.5] — 2026-04-29

### Free plugins (`@better-grid/plugins`)

- **Editing** — masked editor section clicks now preserve the intended selected section instead of collapsing the native input selection.

## [1.0.4] — 2026-04-29

### Free plugins (`@better-grid/plugins`)

- **Editing** — masked editors now use input-style transparent focus treatment when opened from input-style cells.
- **Editing** — empty masked placeholders no longer duplicate their `MM` or `YY` labels while a section is selected.

## [1.0.3] — 2026-04-29

### Free plugins (`@better-grid/plugins`)

- **Editing** — floating text editors now re-focus after the opening click cycle so single-click editing leaves the caret active and ready for immediate typing.

## [1.0.2] — 2026-04-28

### Pro plugins (`@better-grid/pro`)

- **Row actions** — action trigger cells now remove inherited grid cell padding so kebab buttons stay centered in compact columns.
- **Row actions** — added `triggerSize` to tune the menu trigger button size for dense table layouts.

## [1.0.0] — 2026-04-27

First public release. The same `1.x` version applies across `@better-grid/core`, `@better-grid/react`, `@better-grid/plugins`, `@better-grid/codemods`, and `@better-grid/pro` until the packages diverge.

### React-adapter defaults

- The default `mode` for `useGrid` / `<BetterGrid>` is `null` (no preset features) when `mode` is omitted. Pass `mode="view"` for sort + filter + resize + select.

### ColumnDef surface

- `field` (rename of `accessorKey`), `valueGetter` (rename of `accessorFn`), `headerName` + `headerRenderer` (split of `header`).
- New props: `hide`, `flex`, `headerAlign`.
- DX: `id` is optional (defaults to `field`).
- Signatures: `valueFormatter(value, row)`, `valueParser(value, row)`, `cellStyle(value, row, rowIndex)`, `cellClass(value, row, rowIndex)`, `comparator(a, b, rowA?, rowB?)`.

### GridOptions / GridState

- Top-level `getRowId`.
- `bordered` + `striped` boolean flags (replaces `tableStyle` enum).
- `headers` / `footers` accept `HeaderRow[]` / `FooterRow[]` only.
- `selection` is a discriminated union (`false` disables, no `'none'` sentinel).
- GridState mirrors GridOptions shape: `state.frozen.{top,left}` / `state.pinned.{top,bottom}`.
- `grid.setColumnHidden(columnId, hide)` toggles column visibility at runtime; `grid.getSelectionMode()` returns the resolved mode.
- `CellChange.oldValue` is the previous CELL value.
- Events: `'cell:change'` (per-cell write), `'frozen:clip'` (frozen-area clip change).
- React: app-wide defaults via `configure({...})`.
- `headerRenderer` mutates the header label area (`.bg-header-cell__text`) — filter button, resize handle, and ARIA wiring on the cell are preserved automatically.

### Codemods package

- `@better-grid/codemods` — six jscodeshift transforms (`from-ag-grid`, `from-mui-x-data-grid`, `from-tanstack-table`, `from-handsontable`, `from-revogrid`, `from-react-data-grid`). CLI: `npx @better-grid/codemods from-<lib> src/`. Flags: `--dry-run`, `--report=<path>`, `--ext=ts,tsx,js,jsx`.

### Packages

- `@better-grid/core` — framework-agnostic grid engine (MIT)
- `@better-grid/react` — React adapter (MIT)
- `@better-grid/plugins` — official free plugins + built-in cell renderers (MIT)
- `@better-grid/pro` — source-available pro plugins (Better Grid Pro Source-Available License)

### Core engine (`@better-grid/core`)

- Virtualized rendering pipeline with DOM cell pooling (~200 elements regardless of dataset size).
- Fake-scrollbar scroll architecture, multi-level headers, frozen rows/columns, separate pinned-row overlay, range/multi-range selection, keyboard navigation.
- `cellType` registry, custom `cellRenderer` API, CSS custom properties for theming.
- `createGrid<TData, TContext, const TPlugins>({...})` with grouped layout (`frozen`, `pinned`, `headers`, `footers`, `size`), ref-based `context`, and a typed plugin tuple.
- Inference helpers: `InferRow`, `InferState`, `InferPluginApis`, `InferPluginErrorCodes`.

### React adapter (`@better-grid/react`)

- `<BetterGrid>` accepts either inline options (sugar) or a `grid={handle}` from `useGrid({...})`.
- `useGrid` returns a `GridHandle { api, containerRef }` and stores `context` on a ref so cell renderers always read the latest closure.
- `defineColumn` builders: `col.text` / `col.currency` / `col.percent` / `col.date` / `col.badge` / `col.boolean` / `col.progress` / `col.rating` / `col.change` / `col.changeIndicator` / `col.link` / `col.timeline` / `col.tooltip` / `col.loading` / `col.custom`. Extend with `registerColumn`.
- Mode presets: `null` / `view` / `interactive` / `spreadsheet` / `dashboard`. Extend with `registerMode`.
- Feature registry: `features={['edit', 'sort']}` (string opt-in) or `features={{ edit: { editTrigger: 'click' } }}` (with options). Auto-includes feature dependencies with a one-time dev warning.
- `configure({...})` for app-wide feature-option defaults.
- `@better-grid/react/rhf` sub-export — `useGridForm({ grid, baseName })` bridges cell commits into a surrounding `<FormProvider>` (react-hook-form is an optional peer dep).

### Free plugins (`@better-grid/plugins`)

- **Formatting** — currency, percent, dates via the `Intl` API.
- **Editing** — text / dropdown / boolean / date / masked / autocomplete editors. Floating or inline editor mode. `inputStyle` for placeholder + prefix/suffix adornments. Per-column `alwaysInput` flag for permanent live `<input>` cells (with a perf gate).
- **Sorting** — single/multi-column, custom comparators, header click.
- **Filtering** — 9 operators with a column-header filter panel.
- **Validation** — required fields, custom rules, error tooltip UI. Per-rule and per-column `messageRenderer` callback returning `HTMLElement` or string.
- **Hierarchy** — parent/child rows with virtualized collapse/expand.
- **Clipboard** — Excel-compatible copy/cut/paste, fill-down.
- **Undo/redo** — history stack on cell commits.
- **Search & highlight**, **CSV/Excel export**, **pagination**, **grouping**, **cellRenderers** (badge, progress, boolean, rating, change, changeIndicator, link, timeline, tooltip, loading, custom).

### Pro plugins (`@better-grid/pro`)

- **Gantt** — timeline bars with drag-to-move and resize.
- **Aggregation** — summary rows and grouped totals.
- **Merge cells** — row/column spanning.
- **Row actions** — contextual per-row action menus.
- **Pro renderers** — sparkline, heatmap, mini-chart, advanced commercial renderers.

`@better-grid/pro` is source-available and ships under the Better Grid Pro Source-Available License — see [`/LICENSE-PRO`](LICENSE-PRO). Commercial production use requires a Pro license. There is no runtime DRM in v1.

[Unreleased]: https://github.com/jvloo/better-grid/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jvloo/better-grid/releases/tag/v1.0.0
