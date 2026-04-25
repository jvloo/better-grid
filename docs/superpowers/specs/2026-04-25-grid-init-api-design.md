# Grid Init API Redesign

**Date**: 2026-04-25
**Status**: Approved (pending implementation plan)
**Scope**: Breaking redesign of how a Better Grid table is initialized. No back-compat (pre-release).

## Goal

Best-in-class init DX. The current API leaks four kinds of friction into every page that uses Better Grid:

- **A — React noise**: `useMemo(() => [...], [])` wrappers around `columns` and `plugins` on every page.
- **B — Column-type repetition**: `{ cellType: 'currency', precision: 0, align: 'right' }` repeated 11× in one file (`FinanceDashboard.tsx`).
- **C — Plugin ceremony**: 10 imports + `plugins={[formatting({...}), cellRenderers(), editing(), clipboard(), undoRedo(), ...]}` on a single line.
- **D — Flat prop sprawl**: ~20 flat props on `<BetterGrid>` with no grouping; siblings like `frozenTopRows` / `frozenLeftColumns` / `freezeClip` separated; `rowStyles` and `getRowStyle` two ways to do the same job.

This redesign solves all four with patterns synthesized from research into TanStack Table v8, AG Grid, Handsontable, Glide Data Grid, MUI X DataGrid, Mantine React Table, and react-data-grid (Adazzle).

## Design summary

| Axis | Decision | Inspired by |
|---|---|---|
| **A** useMemo | Hoist columns at module scope. Internal id-based diff handles late-binding cases. `useGrid()` returns a stable handle. | TanStack `createColumnHelper` hoist + AG Grid internal diff |
| **B** column repetition | `col.<type>(field, opts)` builders. `col.custom()` always available. `registerColumn(name, defaults)` for app-wide reusable types (TS module augmentation gives autocomplete). | Handsontable `type:` field |
| **C** plugin ceremony | `features: ['edit', 'clipboard']` strings. 3-layer config: app-wide → per-grid string OR object → `plugins:` escape hatch. | MUI default-on + TanStack opt-in |
| **D** prop sprawl | `useGrid({...}) → <BetterGrid grid={grid} />` primary. `<BetterGrid {...options} />` sugar for trivial cases. Group siblings: `frozen`, `pinned`, `headers`, `size`. `on*` stay flat (React idiom). | Mantine / TanStack |
| **closure-over-scope** | `context` prop on `useGrid`, ref-based, read-through at render. Available as `ctx.context` in `cellRenderer`. | AG Grid `context`, fixing AG Grid's "doesn't refresh" gotcha via ref reads |
| **modes** | `mode: 'view' \| 'interactive' \| 'spreadsheet' \| 'dashboard' \| null`. `null` = zero defaults. `registerMode(name, {...})` for user-defined modes. | MUI default-on, made explicit |
| **dependencies** | Auto-include with dev-mode warn. Documented dependency map. | Common-sense default |
| **migration** | Binary cutover. ~25 playground pages rewritten in same PR. | No back-compat (pre-release) |

## Target user-facing shape

```tsx
// columns.ts — hoisted at module scope, NO useMemo needed
import { defineColumn as col } from '@better-grid/react';

export const columns = [
  col.text('department',   { header: 'Department', width: 200 }),
  col.badge('status',      { options: BUDGET_STATUSES }),
  col.currency('q1Actual', { header: 'Actual', precision: 0 }),
  col.currency('q1Budget', { header: 'Budget', precision: 0 }),
  col.currency('q2Actual', { header: 'Actual', precision: 0 }),
  col.currency('q2Budget', { header: 'Budget', precision: 0 }),
  // ...
  col.change('variance'),
];

// FinanceDashboard.tsx
import { BetterGrid, useGrid } from '@better-grid/react';
import { columns } from './columns';

function FinanceDashboard() {
  const grid = useGrid<BudgetRow, { onCellClick: (row: BudgetRow) => void }>({
    data,
    columns,
    mode: 'spreadsheet',                         // edit + clipboard + undo + interactive
    features: ['export'],                        // additive on top of mode
    frozen:  { left: 2, clip: true },
    pinned:  { top: [totalsRow] },
    headers: multiHeaders,
    context: { onCellClick: handleCellClick },
    onCellChange: handleData,
    onSelectionChange: handleSel,
  });

  return <BetterGrid grid={grid} height={480} />;
}
```

## Detailed design

### 1. Column builders — `defineColumn` (alias `col`)

A namespaced object with one method per built-in column type:

```ts
import { defineColumn as col } from '@better-grid/react';

col.text(field: string, opts?: Partial<ColumnDef>): ColumnDef
col.number(field, opts)
col.currency(field, opts)        // align right, formatted by formatting plugin if present
col.percent(field, opts)
col.date(field, opts)
col.badge(field, opts)           // requires `options: BadgeOption[]`
col.boolean(field, opts)
col.progress(field, opts)
col.rating(field, opts)
col.change(field, opts)
col.changeIndicator(field, opts)
col.link(field, opts)
col.timeline(field, opts)
col.tooltip(field, opts)
col.loading(field, opts)
col.custom(field, opts)          // escape hatch — opts MUST include cellRenderer
```

**Resolution**: Each builder produces a plain `ColumnDef` object — no runtime magic. The builder applies type-specific defaults (alignment, `cellType`, formatter wiring, editor wiring) which user `opts` then merge over. The output is typecheck-equivalent to writing the object by hand; the builder is purely an ergonomic layer.

**`field` argument**: First positional arg is the column id AND the accessorKey (the dual-string boilerplate today). If user needs a different accessor: pass `accessorFn` in `opts` and the field arg becomes id-only.

**Custom registration** — `registerColumn`:

```ts
// app boot, once
import { registerColumn } from '@better-grid/react';

registerColumn('avatar', {
  width: 60,
  align: 'center',
  cellRenderer: ({ value }) => <Avatar src={value as string} />,
});

// optional: TS module augmentation for autocomplete
declare module '@better-grid/react' {
  interface ColumnTypeRegistry {
    avatar: { /* opts type */ };
  }
}

// usage anywhere
col.avatar('user.avatarUrl', { width: 80 });
col.avatar('teamLead.avatar');
```

**Constraints**:
- Registering an existing built-in name (`registerColumn('currency', ...)`) throws.
- The defaults object has the same shape as `Partial<ColumnDef>`; user `opts` deep-merge over defaults at column-creation time.
- Registry is process-global; calling `registerColumn` more than once with the same name throws (registration is one-shot per app).

### 2. Features + 3-layer config

**Layer 1 — App-wide defaults** (one-time at boot):

```ts
import { configureBetterGrid } from '@better-grid/react';

configureBetterGrid({
  features: {
    edit:   { commitOn: ['blur'] },
    format: { locale: 'en-GB', currency: 'GBP' },
  },
});
```

**Layer 2 — Per-grid features** (string opts in with global defaults):

```ts
useGrid({ features: ['edit', 'format'] })
// edit uses global commitOn:['blur']; format uses en-GB/GBP
```

**Layer 3 — Per-grid features** (object form overrides global per-key):

```ts
useGrid({ features: { edit: { commitOn: ['enter'] }, format: true } })
// edit overrides global; format keeps global defaults
```

**Layer 4 — Plugin escape hatch** (bypasses both layers):

```ts
useGrid({ plugins: [editing({ commitOn: ['enter'], cancelOnEscape: false })] })
```

**Resolution order**: per-grid object > per-grid string + global > nothing. `plugins:` items are independent (additive). Two registrations of the same plugin (one via `features`, one via `plugins`) is a dev-mode error.

**Built-in feature strings** (one per official plugin):
`'format' | 'edit' | 'sort' | 'filter' | 'select' | 'resize' | 'reorder' | 'clipboard' | 'undo' | 'export' | 'search' | 'pagination' | 'grouping' | 'hierarchy' | 'validation'`

### 3. Modes

```ts
mode: 'view' | 'interactive' | 'spreadsheet' | 'dashboard' | null
```

| Mode | Features on | Other defaults | Use case |
|---|---|---|---|
| `null` | nothing | — | Pure read-only, zero overhead. Explicit "no defaults" |
| `view` | sort, filter, resize, select | — | Read-only browsing |
| `interactive` | view + reorder | — | Lightly interactive |
| `spreadsheet` | interactive + edit + clipboard + undo | — | Excel-like data entry |
| `dashboard` | view + export (no edit) | — | Read-heavy with snapshot export |

**Default if `mode` omitted**: `'view'`.

**Resolution**: `mode` provides a baseline; per-grid `features:` is **additive** on top (`mode="view" features={['edit']}` adds editing). `features: { x: false }` disables a mode-included feature.

**Custom modes** — `registerMode`:

```ts
import { registerMode } from '@better-grid/react';

registerMode('finance', {
  features: ['edit', 'clipboard', 'undo', 'export'],
  defaults: {
    rowHeight: 32,
    selection: { mode: 'range' },
  },
});

<BetterGrid mode="finance" {...} />
```

**Constraints**: Same as `registerColumn` — global registry, one-shot per name, built-in names reserved.

### 4. Closure-over-scope — `context`

Hoisted columns can't close over component-scope handlers. Solution: pass a `context` object on `useGrid` options; columns receive it as `ctx.context` in `cellRenderer`.

```tsx
type GridContext = {
  onAvatarClick: (row: BudgetRow) => void;
  formatCurrency: (n: number) => string;
};

// column hoisted, reads handlers from ctx.context at render time
export const columns = [
  col.text('name', {
    cellRenderer: (ctx) => (
      <a onClick={() => ctx.context.onAvatarClick(ctx.row)}>{ctx.value as string}</a>
    ),
  }),
];

// component — handlers live here, swapped freely without re-init
function Page() {
  const grid = useGrid<BudgetRow, GridContext>({
    data, columns,
    context: { onAvatarClick: handleAvatarClick, formatCurrency },
  });
  return <BetterGrid grid={grid} />;
}
```

**Mechanics**:
- `context` is stored on a ref internally. Identity changes do **not** trigger re-init or column-array invalidation.
- Read at render time via the ref → always gets the latest closure (no `useCallback` required on individual handlers).
- Typed via the second generic on `useGrid<TData, TContext>`. `ctx.context` is typed `TContext` (or `unknown` if generic omitted).
- For app-wide context shape, optional module augmentation:
  ```ts
  declare module '@better-grid/react' {
    interface DefaultGridContext { /* shape */ }
  }
  ```

**Why `context` over `meta`** (the TanStack/Mantine name): AG Grid's enterprise install base recognizes `context`. The migration story (`docs/migration-from-ag-grid.md`) becomes one-to-one. We **fix AG Grid's known wart** (their `context` updates don't auto-trigger refresh) by reading via ref every render.

### 5. Feature dependency auto-include

Documented dependency map (in core, version-pinned):

```ts
const FEATURE_DEPS: Record<string, string[]> = {
  undo:      ['edit'],
  clipboard: ['edit'],   // paste needs editing; pure-copy clipboards need only 'select'
  // expand as needed
};
```

**Behavior**:

```ts
features: ['undo']
// → resolved to ['edit', 'undo']
// + console.warn in dev:
//   "[better-grid] feature 'undo' requires 'edit'; auto-included.
//    Add 'edit' explicitly to silence this warning."
```

Production builds resolve silently. Dev warnings are gated by `process.env.NODE_ENV !== 'production'` (matches existing dev-warn convention in `grid.ts`).

### 6. Prop organization

Final `useGrid` / `BetterGrid` options shape (replacing today's flat `GridOptions`):

```ts
interface GridOptions<TData, TContext = unknown> {
  // Required
  data: TData[];
  columns: ColumnDef<TData>[];

  // Mode + features
  mode?: 'view' | 'interactive' | 'spreadsheet' | 'dashboard' | (string & {}) | null;
  // (`string & {}` admits user-registered mode names from registerMode while
  //  still showing the built-in literals in autocomplete)
  features?: FeatureName[] | Partial<Record<FeatureName, boolean | object>>;
  plugins?: GridPlugin[];        // escape hatch — additive

  // Layout (grouped)
  size?:    { width?: number | string; height?: number | string };
  frozen?:  { top?: number; left?: number; clip?: boolean | FreezeClipOptions };
  pinned?:  { top?: TData[]; bottom?: TData[] };
  headers?: HeaderRow[] | { layout: HeaderRow[]; height?: number };
  footers?: FooterRow[] | { layout: FooterRow[]; height?: number };
  rowHeight?: number | ((rowIndex: number) => number);
  tableStyle?: 'bordered' | 'borderless' | 'striped';

  // Behavior
  selection?: SelectionOptions;
  hierarchy?: HierarchyConfig<TData>;
  virtualization?: VirtualizationOptions;

  // Styling
  rowStyle?: (row: TData, rowIndex: number) => Record<string, string> | undefined;
  // (replaces both `rowStyles` and `getRowStyle` — pick the function form)

  // Closure-over-scope
  context?: TContext;

  // Events (flat, React idiom)
  onCellChange?:      (changes: CellChange<TData>[]) => void;
  onSelectionChange?: (selection: Selection) => void;
  onColumnResize?:    (columnId: string, width: number) => void;

  // Reserved for v1.1 slots feature (see "Reserved extension points")
  slots?:     Partial<GridSlots>;
  slotProps?: Partial<GridSlotProps>;
}

// v1: empty registries; v1.1 will populate via module augmentation.
export interface GridSlots {}
export interface GridSlotProps {}
```

**Notes**:
- `headers` accepts shorthand (`HeaderRow[]`) or full object — same trick as `<input value>` accepting string or number.
- `rowStyle` replaces `rowStyles` and `getRowStyle`. The static-config form (`rowStyles`) is rarely used and can be expressed as a function. Drop the dual API.
- `width`/`height` move from React-only props into the grouped `size` object (uniform with core options).

### 7. Component shape

Two consumption paths:

```tsx
// Primary — for grids with handlers, refs, or grid-instance access
function Page() {
  const grid = useGrid({...});
  return <BetterGrid grid={grid} />;
}

// Sugar — for trivial / static grids
function Page() {
  return <BetterGrid data={data} columns={columns} mode="view" />;
}
```

`<BetterGrid>` accepts EITHER `grid={GridHandle}` OR a flat spread of `GridOptions`. Internally, the spread form calls `useGrid` itself.

### 8. `useGrid` return shape

```ts
interface GridHandle<TData, TContext> {
  // Imperative API for advanced use
  api: GridApi<TData>;            // existing GridInstance methods
  state: GridState<TData>;        // current state snapshot
  // Internal — consumed by <BetterGrid>
  _internal: { /* opaque */ };
}
```

For 90% of pages, users never touch the handle — they pass it straight to `<BetterGrid>`. For ref-style needs (programmatic scroll, selection, refresh), `grid.api.scrollToCell(...)` etc.

## File-level architecture

New files:

```
packages/react/src/
  defineColumn.ts          # builders + registerColumn
  configureBetterGrid.ts   # global config + registerMode
  useGrid.ts               # hook returning GridHandle
  presets/
    modes.ts               # built-in mode definitions
    features.ts            # feature-string → plugin-instance mapping + dep map
```

Modified:

```
packages/core/src/types.ts
  - GridOptions: regrouped (frozen, pinned, headers, size)
  - CellRenderContext: add `context: TContext` (second generic)
  - drop rowStyles/getRowStyle dual; keep `rowStyle` function form

packages/core/src/grid.ts
  - createGrid: accept new GridOptions shape
  - apply mode resolution + feature dependency expansion
  - context ref + read-through pattern

packages/react/src/BetterGrid.tsx
  - accept either `grid={handle}` OR flat options
  - move size/width/height into options.size

packages/react/src/index.ts
  - export defineColumn, registerColumn, useGrid, configureBetterGrid, registerMode

apps/playground/src/pages/*.tsx (~25 files)
  - rewrite each to new API as part of the cutover PR

docs/migration-from-ag-grid.md
  - update with ag-grid `context` → better-grid `context` mapping
```

## Tradeoffs we're accepting

1. **Two ways to declare a column** (`col.x()` builders + raw `{ id, cellRenderer }` objects). Both stay forever — escape hatch is non-negotiable. Doc cost is real and ongoing.
2. **String features lose option autocomplete**. `features: ['edit']` shows nothing about what `edit` configures. Mitigated by 3-layer config (global config + per-grid object form give back type-safe configuration).
3. **Default-on features inflate bundle** for view-only pages. Tree-shaking can't easily drop registered plugins. Mitigated by `mode={null}` for true minimal cases.
4. **`useGrid` lifetime questions** — when `data` swaps, what state persists? Not solved in this spec; defer to a separate `resetOn` design after first usage data comes in.
5. **`col.*` couples react ↔ plugins types**. `col.currency` knows about `precision` from formatting. Either react imports plugin types (cycle risk) or duplicates them (drift risk). Pick: **react imports plugin types** — drift is worse than a one-way build dependency.
6. **Nested props (`frozen.left`) cost some discoverability** — can't see all knobs in flat autocomplete. Acceptable: TS still autocompletes, and grouping value > flat-autocomplete value once prop count exceeds ~10.
7. **Migration is binary per page**. No incremental path. ~25 playground pages cut over in one PR. Mitigated by mechanical nature of the rewrite — no behavior change per page.

## Out of scope

- **Server-side data sources** — Better Grid is client-side today; switching to server-driven row models is a separate architecture project, not part of this redesign.
- **Headless / render-prop / RSC compatibility** — Better Grid renders to the DOM imperatively. This redesign keeps that model. RSC and headless rendering would require a parallel adapter, out of scope here.
- **Concurrent rendering integration** (React 19 `useTransition` / Suspense around grid mutations) — the new API is compatible with React 18 and 19 hooks but does not introduce concurrent-mode-specific helpers.
- **Slot-based UI overrides** (MUI's `slots` / `slotProps` for swapping the toolbar, footer, no-rows overlay, etc.) — kept out to bound scope. See **Reserved extension points** below for how this v1 init API leaves room for slots without a second breaking change.
- **`pro/` and `react/`-only plugin features** that aren't part of `features:` strings (e.g. `gantt`, `merge-cells`, `row-actions`) — they continue to be consumed via the `plugins:` escape hatch unless/until they earn a string slot.

### In scope but minimum viable

- **`useGrid` lifetime / state persistence on `data` swap** — must be specified well enough that users aren't surprised. Default behavior for v1: when `data` reference changes, **selection clears, scroll resets to (0,0), in-progress edits commit-or-cancel per the editing plugin's existing rules, undo history clears**. A future `resetOn: 'never' | 'data' | 'columns'` option is deferred, but the default above is locked in this spec.

### Reserved extension points

The v1 init API reserves two namespaces for the v1.1 slots feature so it can ship without another breaking change:

- **`slots?: Partial<GridSlots>`** — for swapping built-in chrome (toolbar, footer, empty state, loading overlay, error state, etc.). v1 ships with `GridSlots = {}` (empty registry); v1.1 fills it in.
- **`slotProps?: Partial<GridSlotProps>`** — paired with `slots`, same convention as MUI X DataGrid.

Both are typed as optional and unused in v1. Resolution rules, default components, and the slot list are deferred to a focused v1.1 spec — that conversation can be purely about chrome, not API shape. Slot components will read grid state via the same ref-based `context` pattern designed in §4 of this spec, so the plumbing is already in place.

The seam reservation is the only commitment v1 makes. If v1.1 chooses a different shape (e.g. compound components instead of a slots map), the unused `slots`/`slotProps` props can be dropped without a breaking change since nothing reads them.

## Success criteria

- `FinanceDashboard.tsx` (worst-case synthetic page) shrinks by ≥30% LOC after migration with zero behavior change.
- **`FsbtCost.tsx` (real-world Wiseway Costs table) migrates with zero behavior change** — this is the production-shaped page that proves the redesign holds up beyond demos. Required parity points: pinned-footer "Total Development Cost" layout, click-to-edit cell behavior, currency formatting per column, and the existing freeze/clip configuration. If `FsbtCost.tsx` doesn't migrate cleanly, the design needs another revision before merge.
- New users can spin up a working grid with sort/filter/select in ≤10 lines (matches MUI's quick-start length).
- All ~25 playground pages migrated and visually identical.
- Typecheck + build green across `core`, `plugins`, `pro`, `react`.
- Migration doc updated (`docs/migration-from-ag-grid.md` plus a new `docs/migration-v0-to-v1.md` for existing Better Grid consumers).

## Open questions deferred to implementation plan

- Exact shape of `GridApi` exposed by `grid.api.*` (existing `GridInstance` is close — confirm no gaps).
- Whether `headers` shorthand should accept a single `HeaderRow` (one row, no array wrapper) or always the array.
- Whether `features: false` is a valid shorthand for "disable mode defaults entirely" (vs requiring `mode={null}`).
