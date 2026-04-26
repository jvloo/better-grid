# Changelog

All notable changes to Better Grid are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The same `1.x` version applies across `@better-grid/core`, `@better-grid/react`, `@better-grid/plugins`, and `@better-grid/pro` until the packages diverge.

## [Unreleased]

### Planned

- Phase B — production-shape finance tables (cost / program / revenue) migrated behind a feature flag in a downstream app.

### Documentation

- Synced package-level license files so all npm tarballs include the correct MIT or Pro license text.

## [1.0.0] — 2026-04-26

### Added — Production-shape foundation (Phase A)

- **`column.alwaysInput: boolean | (row, col) => boolean`** on the `editing` plugin. Renders a real `<input>` permanently in every editable cell instead of opening a floating editor on click. Reuses the input across cell re-renders so focus and in-progress text survive grid refreshes.
- **`editing({ alwaysInputThreshold })`** — perf gate that warns once per init when `alwaysInput cols × visible rows` exceeds the threshold (default 1000).
- **`@better-grid/react/rhf`** sub-export with `useGridForm({ grid, baseName, getFieldPath?, transform?, shouldDirty?, shouldTouch?, shouldValidate? })`. Listens to `data:change` events on a grid handle and forwards each commit into a surrounding RHF `<FormProvider>`'s `setValue`. `react-hook-form` is an optional peer dep.
- **Validation `messageRenderer`** — per-rule (`ColumnValidationRule.messageRenderer`) and per-column (`ColumnDef.validationMessageRenderer`) callback that returns an `HTMLElement` or string. Lets the error tooltip body be rendered as an MUI Alert (or any other rich UI) while the wrapper still owns positioning.
- **`docs/mui-theme-integration.md`** — recipe wiring `theme.palette` / `theme.typography` / `theme.spacing` / dark mode through Better Grid's CSS custom properties via a single `styled()` wrapper.
- New playground demos: `/demo/always-input` (live inputs + validation rendering) and `/demo/rhf-bridge` (cell commits flowing into a FormProvider with live total/dirty state).

### Added — v1 init API redesign

- New layered React init API:
  - **Sugar** — `<BetterGrid columns data mode="spreadsheet" />` for the simple case.
  - **Handle** — `const grid = useGrid({...}); <BetterGrid grid={grid} />` for callers that need the imperative API or `context` ref.
  - **Vanilla** — `createGrid({...}).mount(el)` from `@better-grid/core` for non-React consumers.
- **Mode presets** — `null` / `view` / `interactive` / `spreadsheet` / `dashboard`. Extend with `registerMode`.
- **Feature registry** — `features={['edit', 'sort']}` (string opt-in) or `features={{ edit: { editTrigger: 'click' } }}` (with options). Auto-includes feature dependencies (e.g. `clipboard` and `undo` auto-add `edit`) with a one-time dev warning.
- **`defineColumn` builders** — `col.text` / `col.currency` / `col.percent` / `col.date` / `col.badge` / `col.boolean` / `col.progress` / `col.rating` / `col.change` / `col.changeIndicator` / `col.link` / `col.timeline` / `col.tooltip` / `col.loading` / `col.custom`. Extend with `registerColumn`.
- **`configureBetterGrid`** — app-wide feature option defaults, applied to every grid that uses the matching feature key.
- **`context` ref** — `useGrid({ context })` stores the value on a ref; cell renderers read it as `ctx.context` and always see the latest closure without re-init.
- **`GridSlots` / `GridSlotProps`** — empty interface seam reserved for v1.x slot extensions; passable as `slots` / `slotProps` props today, populated incrementally.

### Changed (breaking)

- v1.0.0 is the **first public release**. There is no v0 published; the items below describe the shape that landed in v1, captured for contributors who tracked the pre-release iterations. New consumers can ignore this section. Full design history: [`docs/v1-init-api-history.md`](docs/v1-init-api-history.md).
- Grouped layout props: `frozenLeftColumns` / `frozenTopRows` / `freezeClip` → `frozen: { left, top, clip }`. `pinnedTopRows` / `pinnedBottomRows` → `pinned: { top, bottom }`. `headerLayout` → `headers`. `footerLayout` → `footers`. `width` / `height` (on options) → `size: { width, height }` (top-level `height` on `<BetterGrid>` still works as sugar).
- `onDataChange` → `onCellChange`.
- `getRowStyle` → `rowStyle`. The dual `rowStyles={{ field, styles }}` shape is dropped — use `rowStyle: (row, idx) => ({...})`.
- State on data swap: replacing the `data` reference clears selection, resets scroll to (0, 0), and clears undo history (when the undo plugin is loaded). Edit-in-progress commit-or-cancels per the editing plugin's rules.

### Migrations

- All ~25 playground pages and 3 production-shape finance pages migrated to the v1 API.
- The most complex production-shape demo (cost table — `apps/playground/src/pages/FsbtCost.tsx`) migrated with zero behavior change as the success criterion.

### Documentation

- `README.md`, `AGENTS.md`, the migration cheat sheets in `docs/migrations/`, and `docs/internal/v1-init-api-history.md` describe the v1 surface.
- `docs/pr-summaries/grid-init-api-v1.md` — historical PR summary for the v1 redesign.
- `docs/pr-summaries/phase-a-foundation.md` — PR summary for the four Phase A commits.

[Unreleased]: https://github.com/jvloo/better-grid/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jvloo/better-grid/releases/tag/v1.0.0
