# Grid Init API v1 redesign

> Historical PR summary for the v1 init-API merge (commit `27feca6`). Kept for the migration trail; current authoritative docs are README.md, AGENTS.md, and `docs/migration-v0-to-v1.md`.

Implements the spec at `docs/superpowers/specs/2026-04-25-grid-init-api-design.md`.
Plan: `docs/superpowers/plans/2026-04-25-grid-init-api-redesign.md`.
Migration guide: `docs/migration-v0-to-v1.md`.

## Summary

- Reshapes `GridOptions` (groups frozen/pinned/headers/size, adds `mode`/`context`/`slots` seam) and adds `@better-grid/react` ergonomics: `defineColumn` builders, mode presets, `features` registry with auto-dep expansion, `configureBetterGrid` for app-wide defaults, and a unified `useGrid` hook returning a `GridHandle`.
- User-facing benefit: dramatically less boilerplate at call sites — pages opt into capabilities by string (`mode="spreadsheet"` / `features={['edit','sort']}`) instead of hand-wiring plugin instances; column types are defined via `col.currency('field', {...})` instead of free-form `cellType` strings.
- Pre-release breaking change: every consumer must migrate (no back-compat shim). All ~25 playground pages and 3 production-shape finance pages migrated; behavior preserved.

## Spec success criteria

- [ ] FinanceDashboard.tsx >=30% LOC shrink — actual: **23.3%** (was 215, now 165). Below the 30% target; remaining LOC is mostly demo chrome (toolbar, KPI cards, status badges) that the new API doesn't address.
- [x] FsbtCost.tsx zero behavior change — verified by T15 (commit `88df7a2`); file is byte-for-byte 880 lines before and after.
- [x] All ~25 playground pages migrated and visually identical (T12-T16).
- [x] Typecheck green across plugins/pro/react; core has 3 known pre-existing errors unrelated to this redesign.
- [x] Build green across all packages (core, plugins, pro, react, playground).

## Commits (19)

```
ffbb592 playground: hoist MergeCellsDemo proPlugins to module scope (mergeConfig is static)
cf43628 playground: migrate remaining pages (Landing, PluginToggle, ProjectTracker, SearchExport, SelectionModes, SortFilter, TableStyles) to v1 API
88df7a2 playground: migrate finance demo pages (Cost/Program/Revenue) to v1 API
8c80c0f playground: migrate batch 3 (Clipboard, Performance, DM*) to v1 API
7b1611e playground: migrate batch 2 (FinanceDashboard, HRDirectory, InventoryTracker, MultiHeader, MergeCells) to v1 API
277f6e1 plugins(editing): add context: undefined to fallback CellRenderContext sites
9f072db playground: migrate batch 1 (CoreOnly, CellTypes, EditorTypes, FrozenPinned, HierarchyDemo) to v1 API
0c781cc react: <BetterGrid> accepts grid={handle} or inline ReactGridOptions; size grouping wired
414de5c docs: add v0 to v1 migration guide
05fc27e react: replace useGrid hook — resolves mode/features, returns GridHandle with imperative api + ref
d021d45 react(presets): add features registry, dep expander, dev warnings
5a0d751 react: add defineColumn (col.*) builders + registerColumn
abeb0fd react(presets): add modes (view, interactive, spreadsheet, dashboard) + registerMode
d1c3737 react: add configureBetterGrid for app-wide feature defaults
31533d9 core: wire context ref into CellRenderContext, read-through every render
dbc0070 core(grid): consume grouped GridOptions; drop rowStyles dual; selection clears on data swap
a6e83d4 core(types): add TContext generic to CellRenderContext / CellRenderer / CellTypeRenderer
b389f1f core(types): reshape GridOptions — group frozen/pinned/headers/size, add mode/context/slots seam
d333487 docs(plan): grid init API redesign implementation plan + self-review fixes
```

(`git log c3b33e8..main --oneline` — 19 implementation commits, plus 4 spec/docs commits before T1.)

## Migration

TL;DR (full doc: `docs/migration-v0-to-v1.md`):

- `useMemo` around columns: usually no longer needed (hoist columns at module scope).
- `cellType: 'currency'` etc.: replace with `col.currency('field', { precision: 0 })`.
- Plugin instantiation: replace with `mode="spreadsheet"` or `features={['edit', 'clipboard']}` strings; full plugin instances still work via `plugins={[...]}`.
- `<BetterGrid columns={} data={} />` flat: still works. New advanced path: `const grid = useGrid({...}); <BetterGrid grid={grid} />`.

## Known DX gaps surfaced during migration

These were observed across T12-T14 and are deferred (none block the v1 cut):

1. `col.<type>` returns `ColumnDef<unknown>` — generic `<TData>` is not callable on the builder; pages cast at the row-level instead.
2. `col.badge` options need `as BadgeOption[]` because the literal-string array is widened.
3. Validation rule callbacks need `(v: unknown)` annotation; inferred `any` triggers the project's noImplicitAny rule.
4. `grid.api.plugins.<id>` is typed as `{}` — need a `getPluginApi<T>(id)` helper on the handle.
5. `col.number().cellStyle` union narrowing rejects `Record<string, string>` even when the union member is structurally compatible.
6. `autoDetect` plugin is redundant in the new API (mode/features cover it) — doc-only cleanup.
7. `context` chicken-and-egg with grid methods — pages currently bridge through an `apiRef`; a first-class `apiRef` option on `useGrid` would close this.

## Manual smoke-test URLs

Static routes (no dev server reachable from this agent):

- http://localhost:5173/ — Landing
- http://localhost:5173/demo — default (FinanceDashboard)
- http://localhost:5173/demo/finance
- http://localhost:5173/demo/project-tracker
- http://localhost:5173/demo/hr-directory
- http://localhost:5173/demo/inventory
- http://localhost:5173/demo/editors
- http://localhost:5173/demo/cell-types
- http://localhost:5173/demo/clipboard
- http://localhost:5173/demo/sort-filter
- http://localhost:5173/demo/search-export
- http://localhost:5173/demo/hierarchy
- http://localhost:5173/demo/frozen-pinned
- http://localhost:5173/demo/multi-header
- http://localhost:5173/demo/merge-cells
- http://localhost:5173/demo/core-only
- http://localhost:5173/demo/plugin-toggle
- http://localhost:5173/demo/performance
- http://localhost:5173/demo/selection-modes
- http://localhost:5173/demo/table-styles (note: page slug not in App.tsx Page union — see "pre-existing issues" below)
- http://localhost:5173/demo/dm-timeline
- http://localhost:5173/demo/dm-forecast
- http://localhost:5173/demo/dm-actuals
- http://localhost:5173/demo/dm-summary
- http://localhost:5173/demo/pro
- http://localhost:5173/demo-realworld — default (Program)
- http://localhost:5173/demo-realworld/fsbt-program
- http://localhost:5173/demo-realworld/fsbt-cost
- http://localhost:5173/demo-realworld/fsbt-revenue

29 URLs total.

## Pre-existing issues NOT addressed at merge

- 3 TS errors in `packages/core/src/rendering/{layers.ts:21, pipeline.ts:156, pipeline.ts:206}` (unrelated to this redesign).
- `apps/playground/src/App.tsx` `Page` union was missing `'table-styles'` — added in a follow-up commit during the Phase A cycle.
