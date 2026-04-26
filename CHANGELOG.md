# Changelog

All notable changes to Better Grid are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/spec/v2.0.0.html).

The same `1.x` version applies across `@better-grid/core`, `@better-grid/react`, `@better-grid/plugins`, and `@better-grid/pro` until the packages diverge.

## [Unreleased]

_(no changes yet)_

## [1.0.0] — 2026-04-26

First public release.

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
