# Grid Init API Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the breaking init-API redesign described in `docs/superpowers/specs/2026-04-25-grid-init-api-design.md` — column builders, features-string + mode presets, `useGrid` hook + `<BetterGrid grid={...} />` shape, hoisted-column `context` plumbing — and migrate all ~25 playground pages including `FsbtCost.tsx` (Wiseway success-criterion target).

**Architecture:** Mode/feature string resolution lives in the **react package** (`packages/react/src/presets/`); core stays string-agnostic and accepts only resolved `plugins: GridPlugin[]`. `useGrid` is the resolver entry point — it takes the new `GridOptions` shape, expands `mode → features → plugins`, then calls `createGrid`. Closure-over-scope is solved via a `context` ref that the rendering pipeline reads through every render so handler swaps don't invalidate column identity.

**Tech Stack:** TypeScript (strict), Vitest (unit tests in `packages/core/tests/`, new ones go in `packages/react/tests/`), tsup (build), Turbo (monorepo). React 18 + 19 compatible. No new runtime deps.

---

## File Structure

**New files:**
```
packages/react/src/
  defineColumn.ts          # col.* builders + registerColumn + ColumnTypeRegistry
  configureBetterGrid.ts   # global config + registerMode
  useGrid.ts               # hook returning GridHandle (replaces existing hooks/useGrid.ts)
  types.ts                 # react-package types: GridHandle, ReactGridOptions, GridSlots
  presets/
    features.ts            # feature-string registry, dep map, expandFeatures()
    modes.ts               # built-in modes + resolveMode()

packages/react/tests/
  defineColumn.test.ts
  features.test.ts
  modes.test.ts
  configureBetterGrid.test.ts

docs/migration-v0-to-v1.md  # consumer migration guide
```

**Modified files:**
```
packages/core/src/types.ts                 # GridOptions reshape, CellRenderContext<T,C>, drop rowStyles/getRowStyle dual, add context/slots/slotProps
packages/core/src/grid.ts                  # createGrid: new shape, context ref, state-on-data-swap defaults
packages/core/src/rendering/pipeline.ts    # inject context into CellRenderContext via ref
packages/react/src/BetterGrid.tsx          # accept grid={handle} OR flat options; size grouping
packages/react/src/index.ts                # export new APIs
packages/react/src/hooks/useGrid.ts        # DELETE (replaced by ../useGrid.ts)
packages/react/src/adapters/react-adapter.ts  # check for any GridOptions shape coupling
apps/playground/src/pages/*.tsx (~25 files)   # migrated in batches (Tasks 13–17)
apps/playground/src/App.tsx                # if it constructs grids inline
```

**Deleted files:**
```
packages/react/src/hooks/useGrid.ts        # superseded by packages/react/src/useGrid.ts
```

---

## Conventions

- **Test framework**: Vitest. Run a single test file with `npm --prefix packages/<pkg> test -- <file>`.
- **Typecheck**: `npx tsc --noEmit -p packages/<pkg>/tsconfig.json` from repo root.
- **Build**: `npm --prefix packages/<pkg> run build`.
- **Repo-wide check**: `npm test && npm run typecheck && npm run build` from repo root (Turbo handles graph).
- **Pre-existing errors**: 3 known TS errors in `packages/core/src/rendering/{layers,pipeline}.ts` (line numbers shift as you edit `pipeline.ts`). Don't introduce new ones; fixing them is bonus credit.
- **Commits**: one commit per task, prefixed by phase: `core:`, `react:`, `playground:`, `docs:`.
- **CRLF warnings**: ignore. Git's autocrlf will normalize on commit.
- **Each task ends with a working build at the package level it touched**, not necessarily repo-wide. Phase 4 (migration) is the only point where intermediate playground breakage is tolerated within the phase.

---

## Phase 1 — Core types reshape

### Task 1: Reshape `GridOptions` in core types

**Files:**
- Modify: `packages/core/src/types.ts` (lines ~322–367, the existing `GridOptions` interface)

**Spec section**: §6 "Prop organization" of `docs/superpowers/specs/2026-04-25-grid-init-api-design.md`.

- [ ] **Step 1: Read current `GridOptions` definition**

Run: `grep -n "export interface GridOptions" packages/core/src/types.ts`
Confirm: line ~322. Read lines 322–367 to see current shape.

- [ ] **Step 2: Replace `GridOptions` with the new grouped shape**

Replace lines 322–367 of `packages/core/src/types.ts` with:

```ts
export interface GridOptions<
  TData = unknown,
  TContext = unknown,
  const TPlugins extends readonly GridPlugin[] = readonly GridPlugin[],
> {
  // Required
  data: TData[];
  columns: ColumnDef<TData>[];

  // Mode + features (string opt-in resolved by the react package; core accepts only `plugins`)
  plugins?: TPlugins;

  // Layout (grouped)
  size?: { width?: number | string; height?: number | string };
  frozen?: { top?: number; left?: number; clip?: boolean | FreezeClipOptions };
  pinned?: { top?: TData[]; bottom?: TData[] };
  headers?: HeaderRow[] | { layout: HeaderRow[]; height?: number };
  footers?: FooterRow[] | { layout: FooterRow[]; height?: number };
  rowHeight?: number | ((rowIndex: number) => number);
  /**
   * Default header row height when `headers` is not provided as an object form.
   * Retained as a sibling for the single-header simple case (spec gap fix:
   * the spec's grouped shape only has height inside `headers.height`, but
   * tables without a `headers` array still need a way to set the row's height).
   */
  headerHeight?: number;
  tableStyle?: 'bordered' | 'borderless' | 'striped';

  // Behavior
  selection?: SelectionOptions;
  hierarchy?: HierarchyConfig<TData>;
  virtualization?: VirtualizationOptions;

  // Styling — single function form (replaces rowStyles + getRowStyle dual)
  rowStyle?: (row: TData, rowIndex: number) => Record<string, string> | undefined;

  // Closure-over-scope (read via ref every render so handler swaps don't re-init)
  context?: TContext;

  // Events (flat, React idiom)
  onCellChange?: (changes: CellChange<TData>[]) => void;
  onSelectionChange?: (selection: Selection) => void;
  onColumnResize?: (columnId: string, width: number) => void;

  // Reserved for v1.1 slots feature (see spec "Reserved extension points")
  slots?: Partial<GridSlots>;
  slotProps?: Partial<GridSlotProps>;
}

// v1: empty registries; v1.1 will populate via module augmentation.
export interface GridSlots {}
export interface GridSlotProps {}
```

Also: search the file for `RowStylesConfig` and remove its export and the `rowStyles?:` and `getRowStyle?:` references. Drop `RowStylesConfig` from `packages/core/src/index.ts` exports.

- [ ] **Step 3: Verify compile errors are localized to consumers**

Run: `npx tsc --noEmit -p packages/core/tsconfig.json 2>&1 | head -40`
Expected: errors in `grid.ts` (reads `options.frozenLeftColumns` etc., no longer exists) and `rendering/pipeline.ts` (rowStyles refs). These are fixed in Tasks 3 and 4.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/index.ts
git commit -m "core(types): reshape GridOptions — group frozen/pinned/headers/size, add mode/context/slots seam"
```

---

### Task 2: Add second generic to `CellRenderContext` + cell renderer types

**Files:**
- Modify: `packages/core/src/types.ts` (the existing `CellRenderContext`, `CellRenderer`, `CellTypeRenderer` definitions, lines ~78–105)

**Spec section**: §4 "Closure-over-scope — `context`".

- [ ] **Step 1: Locate the affected types**

Run: `grep -n "interface CellRenderContext\|type CellRenderer\|interface CellTypeRenderer" packages/core/src/types.ts`

- [ ] **Step 2: Add the `TContext` generic**

In `packages/core/src/types.ts`, change the three definitions:

```ts
export interface CellRenderContext<TData = unknown, TContext = unknown> {
  rowIndex: number;
  colIndex: number;
  row: TData;
  column: ColumnDef<TData>;
  value: unknown;
  isSelected: boolean;
  isActive: boolean;
  style: CellStyle;
  context: TContext;          // NEW — pass-through bag, read via ref every render
}

export type CellRenderer<TData = unknown, TContext = unknown> = (
  container: HTMLElement,
  context: CellRenderContext<TData, TContext>,
) => void;

export interface CellTypeRenderer<TData = unknown, TContext = unknown> {
  render(container: HTMLElement, context: CellRenderContext<TData, TContext>): void;
  getStringValue?(context: CellRenderContext<TData, TContext>): string;
  parseStringValue?(value: string): unknown;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p packages/core/tsconfig.json 2>&1 | grep -v "rendering/layers\|rendering/pipeline" | head -20`
Expected: a few errors in `grid.ts`, `cell-renderers.ts`, `pro-renderers.ts` where `CellRenderContext` is constructed without `context`. These fix in Task 4 (where the field is wired up).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "core(types): add TContext generic to CellRenderContext / CellRenderer / CellTypeRenderer"
```

---

## Phase 2 — Core engine adaptations

### Task 3: Update `createGrid` to consume the new `GridOptions` shape

**Files:**
- Modify: `packages/core/src/grid.ts` (the `createGrid` function body — references to dropped fields)

**Spec section**: §6 + state-on-data-swap default in "In scope but minimum viable".

- [ ] **Step 1: Identify all consumer sites**

Run: `grep -n "options\.frozenLeftColumns\|options\.frozenTopRows\|options\.freezeClip\|options\.pinnedTopRows\|options\.pinnedBottomRows\|options\.headerLayout\|options\.footerLayout\|options\.rowStyles\|options\.getRowStyle\|options\.headerHeight" packages/core/src/grid.ts`

Expected: ~15-25 hits. Note them.

- [ ] **Step 2: Replace each access with the grouped equivalent**

Apply the mapping below to every hit found in Step 1. Multiple files may be involved (`grid.ts` is the primary; `rendering/pipeline.ts` also reads `rowStyles`/`getRowStyle`).

| Old | New |
|---|---|
| `options.frozenTopRows` | `options.frozen?.top ?? 0` |
| `options.frozenLeftColumns` | `options.frozen?.left ?? 0` |
| `options.freezeClip` | `options.frozen?.clip` |
| `options.pinnedTopRows` | `options.pinned?.top` |
| `options.pinnedBottomRows` | `options.pinned?.bottom` |
| `options.headerLayout` | `Array.isArray(options.headers) ? options.headers : options.headers?.layout` |
| `options.headerHeight` (existing usage) | unchanged — `headerHeight?: number` is retained as a sibling for the single-header simple case. Multi-header height now lives in `options.headers.height`. Resolution: `(Array.isArray(options.headers) ? undefined : options.headers?.height) ?? options.headerHeight ?? DEFAULT_HEADER_HEIGHT` |
| `options.footerLayout` | `Array.isArray(options.footers) ? options.footers : options.footers?.layout` |
| `options.rowStyles` | DELETE — replaced by `options.rowStyle` (function only) |
| `options.getRowStyle` | DELETE — replaced by `options.rowStyle` |

For `rowStyle` consolidation: any code that referenced `options.rowStyles` (the static config) gets removed; any code referencing `options.getRowStyle(row, idx)` becomes `options.rowStyle?.(row, idx)`.

Also update `rendering.rowStyles = options.rowStyles;` and `rendering.getRowStyle = options.getRowStyle;` in `grid.ts`:
- Remove the `rendering.rowStyles = ...` and `frozenRendering.rowStyles = ...` lines (rowStyles config dropped).
- Replace `rendering.getRowStyle = options.getRowStyle` with `rendering.getRowStyle = options.rowStyle`.

Then in `packages/core/src/rendering/pipeline.ts` (and any other file with `rowStyles` references): remove the `rowStyles` field from the class entirely; rename `getRowStyle` field to keep the same name (`getRowStyle`) since that's the *internal* name even though the public option renamed.

- [ ] **Step 3: Add state-on-data-swap defaults**

In `createGrid`, locate the existing `data:set` event handler / `setData` path. After the data is replaced, add:

```ts
// State-on-data-swap defaults (spec §"In scope but minimum viable")
selection = createEmptySelection();
notifySelectionChange(selection);
store.setScroll({ scrollTop: 0, scrollLeft: 0 });
// In-progress edits commit-or-cancel per editing plugin's existing rules — no action here, the
// plugin owns this. Undo plugin clears its own history on data:set if it subscribes to that event.
```

If the file already does some of this, leave existing behavior; just confirm selection clears and scroll resets. Add a `// TODO(perf)` comment pointing at the future `resetOn` option.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p packages/core/tsconfig.json 2>&1 | grep -v "rendering/layers\|fillPreview" | head`
Expected: only the 3 known pre-existing errors in `pipeline.ts:151,201` (lines may shift) and `layers.ts:21`. No new errors.

- [ ] **Step 5: Build + run core tests**

Run: `npm --prefix packages/core run build && npm --prefix packages/core test`
Expected: build green; tests green (existing tests don't exercise the dropped options shape — they construct `GridOptions` with `data`/`columns` only).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/grid.ts packages/core/src/rendering/pipeline.ts
git commit -m "core(grid): consume grouped GridOptions; drop rowStyles dual; selection clears on data swap"
```

---

### Task 4: Inject `context` into `CellRenderContext` via ref

**Files:**
- Modify: `packages/core/src/grid.ts` (store the context ref)
- Modify: `packages/core/src/rendering/pipeline.ts` (read via ref when constructing `CellRenderContext`)

**Spec section**: §4 "Closure-over-scope — `context`".

- [ ] **Step 1: Add a context ref in `createGrid`**

In `packages/core/src/grid.ts`, near the top of `createGrid` body (after the `pluginRegistry` declaration):

```ts
// Closure-over-scope: store on a ref so option swaps don't invalidate column identity.
// Read at render time so handler swaps are picked up without re-init.
const contextRef: { current: unknown } = { current: options.context };
```

Add a public method on the `GridInstance` API for updating the ref (used by react adapter when `useGrid` re-runs):

```ts
function setContext(context: unknown): void {
  contextRef.current = context;
  // No notify — context reads happen on next render naturally.
}
```

Add `setContext` to the `GridInstance` interface in `packages/core/src/types.ts` (search for `interface GridInstance` and add the method signature).

Pass `contextRef` to the rendering pipeline:

```ts
rendering.contextRef = contextRef;
frozenRendering.contextRef = contextRef;
```

- [ ] **Step 2: Wire `context` into `CellRenderContext` in pipeline**

In `packages/core/src/rendering/pipeline.ts`:

1. Add a public field `contextRef?: { current: unknown }` near the top of `RenderingPipeline`.
2. Find every place a `CellRenderContext` is constructed (search: `isSelected:` usually marks the construction site). Add `context: this.contextRef?.current` to each constructed object.

Example:
```ts
const ctx: CellRenderContext = {
  rowIndex,
  colIndex,
  row,
  column,
  value,
  isSelected,
  isActive,
  style,
  context: this.contextRef?.current,   // NEW
};
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p packages/core/tsconfig.json 2>&1 | grep -v "fillPreview\|HTMLElement | null" | head`
Expected: no new errors beyond the 3 pre-existing ones.

- [ ] **Step 4: Add a test for context read-through**

Create `packages/core/tests/context-read-through.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';
import type { ColumnDef } from '../src/types';

describe('createGrid context ref', () => {
  test('cellRenderer receives the latest context value after setContext', () => {
    const seen: unknown[] = [];
    const columns: ColumnDef[] = [{
      id: 'name',
      header: 'Name',
      accessorKey: 'name' as never,
      cellRenderer: (container, ctx) => {
        seen.push(ctx.context);
        container.textContent = String(ctx.value);
      },
    }];
    const data = [{ name: 'a' }, { name: 'b' }];
    const grid = createGrid({ data, columns, context: { v: 1 } });

    const host = document.createElement('div');
    document.body.appendChild(host);
    grid.mount(host);

    expect(seen.every(c => (c as { v: number })?.v === 1)).toBe(true);

    seen.length = 0;
    grid.setContext({ v: 2 });
    grid.refresh();
    expect(seen.every(c => (c as { v: number })?.v === 2)).toBe(true);

    grid.unmount();
    host.remove();
  });
});
```

- [ ] **Step 5: Run the test**

Run: `npm --prefix packages/core test -- context-read-through`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/grid.ts packages/core/src/types.ts packages/core/src/rendering/pipeline.ts packages/core/tests/context-read-through.test.ts
git commit -m "core: wire context ref into CellRenderContext, read-through every render"
```

---

## Phase 3 — React layer

### Task 5: Create `presets/features.ts` — feature registry, dep map, expander

**Files:**
- Create: `packages/react/src/presets/features.ts`
- Create: `packages/react/tests/features.test.ts`

**Spec section**: §2 "Features + 3-layer config" + §5 "Feature dependency auto-include".

- [ ] **Step 1: Write the failing test first**

Create `packages/react/tests/features.test.ts`:

```ts
import { describe, test, expect, vi } from 'vitest';
import { expandFeatureDeps, FEATURE_DEPS, FEATURE_NAMES } from '../src/presets/features';

describe('expandFeatureDeps', () => {
  test('passes through features with no deps', () => {
    expect(expandFeatureDeps(['sort'])).toEqual(['sort']);
  });

  test('auto-includes edit when undo is requested', () => {
    expect(expandFeatureDeps(['undo']).sort()).toEqual(['edit', 'undo']);
  });

  test('auto-includes edit when clipboard is requested', () => {
    expect(expandFeatureDeps(['clipboard']).sort()).toEqual(['clipboard', 'edit']);
  });

  test('does not duplicate already-included deps', () => {
    expect(expandFeatureDeps(['edit', 'undo']).sort()).toEqual(['edit', 'undo']);
  });

  test('warns in dev when auto-including a missing dep', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expandFeatureDeps(['undo']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("'undo' requires 'edit'"));
    process.env.NODE_ENV = orig;
    warn.mockRestore();
  });

  test('FEATURE_DEPS and FEATURE_NAMES are consistent', () => {
    for (const dep of Object.keys(FEATURE_DEPS)) {
      expect(FEATURE_NAMES).toContain(dep);
    }
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm --prefix packages/react test -- features` *(this will fail at import since the file doesn't exist; that's the "red" state)*

- [ ] **Step 3: Implement `presets/features.ts`**

Create `packages/react/src/presets/features.ts`:

```ts
import type { GridPlugin } from '@better-grid/core';
import {
  formatting, editing, sorting, filtering, clipboard, undoRedo, exportPlugin,
  search, pagination, grouping, hierarchy, validation, cellRenderers,
} from '@better-grid/plugins';

export const FEATURE_NAMES = [
  'format', 'edit', 'sort', 'filter', 'select', 'resize', 'reorder',
  'clipboard', 'undo', 'export', 'search', 'pagination', 'grouping',
  'hierarchy', 'validation',
] as const;

export type FeatureName = typeof FEATURE_NAMES[number];

/**
 * Features that need other features. Auto-included with a dev-mode warning.
 * Source of truth — keep in sync with built-in plugin requirements.
 */
export const FEATURE_DEPS: Partial<Record<FeatureName, FeatureName[]>> = {
  undo: ['edit'],
  clipboard: ['edit'],
};

/**
 * Map a feature name + its options to a plugin instance.
 * Some features (`select`, `resize`, `reorder`) are not standalone plugins —
 * they're handled by core or no-op here.
 */
export function instantiateFeature(name: FeatureName, opts: unknown): GridPlugin | null {
  switch (name) {
    case 'format':     return formatting(opts as Parameters<typeof formatting>[0]);
    case 'edit':       return editing(opts as Parameters<typeof editing>[0]);
    case 'sort':       return sorting(opts as Parameters<typeof sorting>[0]);
    case 'filter':     return filtering(opts as Parameters<typeof filtering>[0]);
    case 'clipboard':  return clipboard(opts as Parameters<typeof clipboard>[0]);
    case 'undo':       return undoRedo(opts as Parameters<typeof undoRedo>[0]);
    case 'export':     return exportPlugin(opts as Parameters<typeof exportPlugin>[0]);
    case 'search':     return search(opts as Parameters<typeof search>[0]);
    case 'pagination': return pagination(opts as Parameters<typeof pagination>[0]);
    case 'grouping':   return grouping(opts as Parameters<typeof grouping>[0]);
    case 'hierarchy':  return hierarchy(opts as Parameters<typeof hierarchy>[0]);
    case 'validation': return validation(opts as Parameters<typeof validation>[0]);
    // Built-in cell renderers come bundled with `format`; no separate plugin string.
    case 'select':
    case 'resize':
    case 'reorder':
      return null;  // handled by core, no plugin instance
  }
}

/**
 * Expand a list of features by their dependencies. Warns in dev when a dep
 * is auto-included so the user knows to add it explicitly.
 */
export function expandFeatureDeps(features: FeatureName[]): FeatureName[] {
  const set = new Set<FeatureName>(features);
  for (const f of features) {
    const deps = FEATURE_DEPS[f];
    if (!deps) continue;
    for (const dep of deps) {
      if (!set.has(dep)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[better-grid] feature '${f}' requires '${dep}'; auto-included. ` +
            `Add '${dep}' explicitly to silence this warning.`,
          );
        }
        set.add(dep);
      }
    }
  }
  return Array.from(set);
}

// `cellRenderers` plugin (registers built-in cell types). Always included by useGrid
// when any feature is active, since the cell type renderers are universally needed.
export function getCellRenderersPlugin(): GridPlugin {
  return cellRenderers();
}
```

- [ ] **Step 4: Run tests**

Run: `npm --prefix packages/react test -- features`
Expected: all 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/presets/features.ts packages/react/tests/features.test.ts
git commit -m "react(presets): add features registry, dep expander, dev warnings"
```

---

### Task 6: Create `presets/modes.ts` — built-in mode definitions

**Files:**
- Create: `packages/react/src/presets/modes.ts`
- Create: `packages/react/tests/modes.test.ts`

**Spec section**: §3 "Modes".

- [ ] **Step 1: Write the failing test**

Create `packages/react/tests/modes.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { resolveMode, BUILT_IN_MODES } from '../src/presets/modes';

describe('resolveMode', () => {
  test('null returns empty defaults', () => {
    expect(resolveMode(null)).toEqual({ features: [], defaults: {} });
  });

  test('view returns sort/filter/resize/select', () => {
    expect(resolveMode('view').features.sort()).toEqual(['filter', 'resize', 'select', 'sort']);
  });

  test('interactive includes view features plus reorder', () => {
    const res = resolveMode('interactive');
    expect(res.features).toContain('reorder');
    expect(res.features).toContain('sort');
  });

  test('spreadsheet includes interactive features plus edit/clipboard/undo', () => {
    const res = resolveMode('spreadsheet');
    expect(res.features).toEqual(expect.arrayContaining(['edit', 'clipboard', 'undo', 'reorder', 'sort']));
  });

  test('dashboard includes view + export, NOT edit', () => {
    const res = resolveMode('dashboard');
    expect(res.features).toContain('export');
    expect(res.features).not.toContain('edit');
  });

  test('unknown mode throws', () => {
    expect(() => resolveMode('nonexistent' as never)).toThrow(/unknown mode/i);
  });

  test('BUILT_IN_MODES has all five', () => {
    expect(Object.keys(BUILT_IN_MODES).sort()).toEqual(['dashboard', 'interactive', 'spreadsheet', 'view']);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm --prefix packages/react test -- modes`
Expected: import error.

- [ ] **Step 3: Implement `presets/modes.ts`**

Create `packages/react/src/presets/modes.ts`:

```ts
import type { FeatureName } from './features';

export interface ModeDefinition {
  features: FeatureName[];
  defaults: {
    rowHeight?: number;
    selection?: { mode?: 'cell' | 'row' | 'range' | 'none'; multiRange?: boolean };
  };
}

export const BUILT_IN_MODES: Record<string, ModeDefinition> = {
  view: {
    features: ['sort', 'filter', 'resize', 'select'],
    defaults: {},
  },
  interactive: {
    features: ['sort', 'filter', 'resize', 'select', 'reorder'],
    defaults: {},
  },
  spreadsheet: {
    features: ['sort', 'filter', 'resize', 'select', 'reorder', 'edit', 'clipboard', 'undo'],
    defaults: { selection: { mode: 'range' } },
  },
  dashboard: {
    features: ['sort', 'filter', 'resize', 'select', 'export'],
    defaults: {},
  },
};

const customModes = new Map<string, ModeDefinition>();

/**
 * Register a user-defined mode at app boot. Throws on duplicate or built-in name collision.
 */
export function registerMode(name: string, def: ModeDefinition): void {
  if (name in BUILT_IN_MODES) {
    throw new Error(`[better-grid] mode '${name}' is built-in and cannot be re-registered`);
  }
  if (customModes.has(name)) {
    throw new Error(`[better-grid] mode '${name}' is already registered`);
  }
  customModes.set(name, def);
}

/**
 * Resolve a mode name to its features + defaults. `null` = no defaults.
 */
export function resolveMode(name: string | null): ModeDefinition {
  if (name === null) return { features: [], defaults: {} };
  const def = BUILT_IN_MODES[name] ?? customModes.get(name);
  if (!def) throw new Error(`[better-grid] unknown mode '${name}'. Built-in: view|interactive|spreadsheet|dashboard. Or register via registerMode().`);
  return def;
}

// Test helper — not exported from package index
export function _resetCustomModes(): void {
  customModes.clear();
}
```

- [ ] **Step 4: Run tests**

Run: `npm --prefix packages/react test -- modes`
Expected: 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/presets/modes.ts packages/react/tests/modes.test.ts
git commit -m "react(presets): add modes (view, interactive, spreadsheet, dashboard) + registerMode"
```

---

### Task 7: Create `configureBetterGrid` — global feature config

**Files:**
- Create: `packages/react/src/configureBetterGrid.ts`
- Create: `packages/react/tests/configureBetterGrid.test.ts`

**Spec section**: §2 "Features + 3-layer config" — Layer 1.

- [ ] **Step 1: Write the failing test**

Create `packages/react/tests/configureBetterGrid.test.ts`:

```ts
import { describe, test, expect, beforeEach } from 'vitest';
import {
  configureBetterGrid,
  getGlobalFeatureOptions,
  _resetGlobalConfig,
} from '../src/configureBetterGrid';

describe('configureBetterGrid', () => {
  beforeEach(() => _resetGlobalConfig());

  test('stores per-feature options', () => {
    configureBetterGrid({ features: { edit: { commitOn: ['blur'] } } });
    expect(getGlobalFeatureOptions('edit')).toEqual({ commitOn: ['blur'] });
  });

  test('returns undefined for unconfigured features', () => {
    expect(getGlobalFeatureOptions('edit')).toBeUndefined();
  });

  test('overwrites prior config (one-shot semantics)', () => {
    configureBetterGrid({ features: { edit: { commitOn: ['blur'] } } });
    configureBetterGrid({ features: { edit: { commitOn: ['enter'] } } });
    expect(getGlobalFeatureOptions('edit')).toEqual({ commitOn: ['enter'] });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm --prefix packages/react test -- configureBetterGrid`

- [ ] **Step 3: Implement**

Create `packages/react/src/configureBetterGrid.ts`:

```ts
import type { FeatureName } from './presets/features';

export interface GlobalGridConfig {
  features?: Partial<Record<FeatureName, unknown>>;
}

let globalConfig: GlobalGridConfig = {};

export function configureBetterGrid(config: GlobalGridConfig): void {
  globalConfig = { ...globalConfig, ...config, features: { ...globalConfig.features, ...config.features } };
}

export function getGlobalFeatureOptions(name: FeatureName): unknown {
  return globalConfig.features?.[name];
}

// Test helper — not exported from package index
export function _resetGlobalConfig(): void {
  globalConfig = {};
}
```

- [ ] **Step 4: Run tests**

Run: `npm --prefix packages/react test -- configureBetterGrid`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/configureBetterGrid.ts packages/react/tests/configureBetterGrid.test.ts
git commit -m "react: add configureBetterGrid for app-wide feature defaults"
```

---

### Task 8: Create `defineColumn` (col.*) + `registerColumn`

**Files:**
- Create: `packages/react/src/defineColumn.ts`
- Create: `packages/react/tests/defineColumn.test.ts`

**Spec section**: §1 "Column builders".

- [ ] **Step 1: Write the failing test**

Create `packages/react/tests/defineColumn.test.ts`:

```ts
import { describe, test, expect, beforeEach } from 'vitest';
import { defineColumn as col, registerColumn, _resetColumnRegistry } from '../src/defineColumn';

describe('defineColumn (col.*)', () => {
  beforeEach(() => _resetColumnRegistry());

  test('col.text returns a ColumnDef with id + accessorKey from field', () => {
    const c = col.text('name', { header: 'Name', width: 100 });
    expect(c.id).toBe('name');
    expect(c.accessorKey).toBe('name');
    expect(c.header).toBe('Name');
    expect(c.width).toBe(100);
  });

  test('col.currency wires cellType + right alignment', () => {
    const c = col.currency('q1Actual', { precision: 0 });
    expect(c.cellType).toBe('currency');
    expect(c.align).toBe('right');
    expect((c as { precision?: number }).precision).toBe(0);
  });

  test('col.custom requires cellRenderer and does not set cellType', () => {
    const renderer = () => {};
    const c = col.custom('foo', { cellRenderer: renderer });
    expect(c.cellRenderer).toBe(renderer);
    expect(c.cellType).toBeUndefined();
  });

  test('user opts override builder defaults', () => {
    const c = col.currency('q1', { align: 'left', precision: 2 });
    expect(c.align).toBe('left');
    expect((c as { precision?: number }).precision).toBe(2);
  });

  test('registerColumn adds a custom type usable as col.<name>', () => {
    registerColumn('avatar', { width: 60, align: 'center' });
    const c = (col as unknown as Record<string, (...a: unknown[]) => unknown>).avatar('user.avatarUrl', { width: 80 });
    expect((c as { width: number }).width).toBe(80);
    expect((c as { align: string }).align).toBe('center');
  });

  test('registerColumn rejects built-in name collisions', () => {
    expect(() => registerColumn('currency', { width: 80 })).toThrow(/built-in/);
  });

  test('registerColumn rejects duplicate registration', () => {
    registerColumn('avatar', { width: 60 });
    expect(() => registerColumn('avatar', { width: 80 })).toThrow(/already registered/);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm --prefix packages/react test -- defineColumn`

- [ ] **Step 3: Implement**

Create `packages/react/src/defineColumn.ts`:

```ts
import type { ColumnDef, CellType } from '@better-grid/core';

type ColumnOpts<TData = unknown> = Partial<Omit<ColumnDef<TData>, 'id'>> & Record<string, unknown>;

const BUILT_IN_TYPES = [
  'text', 'number', 'currency', 'percent', 'date', 'badge', 'boolean',
  'progress', 'rating', 'change', 'changeIndicator', 'link', 'timeline',
  'tooltip', 'loading', 'custom',
] as const;

type BuiltInType = typeof BUILT_IN_TYPES[number];

const customRegistry = new Map<string, ColumnOpts>();

/**
 * Register a custom column type at app boot. Throws on built-in name
 * collision or duplicate registration. Defaults merge into user opts at
 * column-creation time.
 */
export function registerColumn(name: string, defaults: ColumnOpts): void {
  if ((BUILT_IN_TYPES as readonly string[]).includes(name)) {
    throw new Error(`[better-grid] '${name}' is a built-in column type and cannot be re-registered`);
  }
  if (customRegistry.has(name)) {
    throw new Error(`[better-grid] column type '${name}' is already registered`);
  }
  customRegistry.set(name, defaults);
}

// Test helper — not exported from package index
export function _resetColumnRegistry(): void {
  customRegistry.clear();
}

const DEFAULTS_BY_TYPE: Record<BuiltInType, Partial<ColumnDef> & Record<string, unknown>> = {
  text:            {},
  number:          { align: 'right' },
  currency:        { align: 'right', cellType: 'currency' as CellType },
  percent:         { align: 'right', cellType: 'percent' as CellType },
  date:            { cellType: 'date' as CellType },
  badge:           { cellType: 'badge' as CellType },
  boolean:         { cellType: 'boolean' as CellType, align: 'center' },
  progress:        { cellType: 'progress' as CellType },
  rating:          { cellType: 'rating' as CellType },
  change:          { cellType: 'change' as CellType, align: 'right' },
  changeIndicator: { cellType: 'changeIndicator' as CellType, align: 'right' },
  link:            { cellType: 'link' as CellType },
  timeline:        { cellType: 'timeline' as CellType },
  tooltip:         { cellType: 'tooltip' as CellType },
  loading:         { cellType: 'loading' as CellType },
  custom:          {},  // user MUST supply cellRenderer
};

/**
 * Make a builder function for a given type. Field becomes id+accessorKey
 * (override accessor via opts.accessorFn for non-trivial paths).
 */
function makeBuilder<TData = unknown>(type: BuiltInType | string) {
  return (field: string, opts: ColumnOpts<TData> = {}): ColumnDef<TData> => {
    const defaults = (DEFAULTS_BY_TYPE as Record<string, ColumnOpts>)[type] ?? customRegistry.get(type) ?? {};
    return {
      id: field,
      accessorKey: opts.accessorFn ? undefined : (field as keyof TData & string),
      header: opts.header ?? field,
      ...defaults,
      ...opts,
    } as ColumnDef<TData>;
  };
}

type BuiltInBuilders<TData = unknown> = {
  [K in BuiltInType]: (field: string, opts?: ColumnOpts<TData>) => ColumnDef<TData>;
};

interface CustomBuilders {
  [name: string]: (field: string, opts?: ColumnOpts) => ColumnDef;
}

/**
 * Column builders. col.<type>(field, opts) returns a ColumnDef.
 * Custom types added via registerColumn() are accessible as col.<name>.
 */
export const defineColumn: BuiltInBuilders & CustomBuilders = new Proxy({} as BuiltInBuilders & CustomBuilders, {
  get(_target, prop: string) {
    if ((BUILT_IN_TYPES as readonly string[]).includes(prop) || customRegistry.has(prop)) {
      return makeBuilder(prop);
    }
    throw new Error(
      `[better-grid] col.${prop} is not a registered column type. ` +
      `Built-in: ${BUILT_IN_TYPES.join('|')}. Register custom types via registerColumn().`,
    );
  },
});
```

- [ ] **Step 4: Run tests**

Run: `npm --prefix packages/react test -- defineColumn`
Expected: 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/defineColumn.ts packages/react/tests/defineColumn.test.ts
git commit -m "react: add defineColumn (col.*) builders + registerColumn"
```

---

### Task 9: Rewrite `useGrid` hook (resolves mode/features → plugins)

**Files:**
- Create: `packages/react/src/useGrid.ts`
- Create: `packages/react/src/types.ts`
- Delete: `packages/react/src/hooks/useGrid.ts` (old hook)

**Spec section**: §6 + §7 "Component shape" + §8 "useGrid return shape".

- [ ] **Step 1: Read the existing hook**

Run: `cat packages/react/src/hooks/useGrid.ts`
Note: it currently exports `useGrid` returning `{ containerRef }`. Replace with the new GridHandle-returning version.

- [ ] **Step 2: Create `packages/react/src/types.ts`**

```ts
import type { GridInstance, GridOptions, GridPlugin } from '@better-grid/core';
import type { FeatureName } from './presets/features';

export interface ReactGridOptions<TData = unknown, TContext = unknown>
  extends Omit<GridOptions<TData, TContext>, 'plugins'> {
  /**
   * Mode preset. `null` = no defaults. Default if omitted: 'view'.
   * See spec §3.
   */
  mode?: 'view' | 'interactive' | 'spreadsheet' | 'dashboard' | (string & {}) | null;

  /**
   * Feature opt-in. String form uses global config (configureBetterGrid).
   * Object form overrides global per-key. Additive on top of `mode`.
   */
  features?: FeatureName[] | Partial<Record<FeatureName, boolean | object>>;

  /**
   * Escape hatch: full plugin instances. Additive. Bypasses mode + features
   * resolution for these plugins.
   */
  plugins?: GridPlugin[];
}

export interface GridHandle<TData = unknown, TContext = unknown> {
  /** Imperative API — same shape as core's GridInstance. */
  api: GridInstance<TData>;
  /** Ref to attach to a DOM element. */
  containerRef: (el: HTMLElement | null) => void;
  /** Internal — consumed by <BetterGrid>. Do not depend on the shape. */
  _internal: { contextRef: { current: TContext | undefined } };
}
```

- [ ] **Step 3: Create `packages/react/src/useGrid.ts`**

```ts
import { useEffect, useMemo, useRef } from 'react';
import { createGrid } from '@better-grid/core';
import type { GridInstance, GridPlugin } from '@better-grid/core';
import type { ReactGridOptions, GridHandle } from './types';
import { expandFeatureDeps, instantiateFeature, getCellRenderersPlugin, type FeatureName, FEATURE_NAMES } from './presets/features';
import { resolveMode } from './presets/modes';
import { getGlobalFeatureOptions } from './configureBetterGrid';

const DEFAULT_MODE = 'view';

function resolvePlugins<TData>(options: ReactGridOptions<TData>): GridPlugin[] {
  // Step A: mode → baseline features
  const modeName = options.mode === undefined ? DEFAULT_MODE : options.mode;
  const modeDef = resolveMode(modeName);

  // Step B: per-grid features layered onto mode
  const requested = new Set<FeatureName>(modeDef.features);
  const perFeatureOpts = new Map<FeatureName, unknown>();

  if (Array.isArray(options.features)) {
    for (const name of options.features) requested.add(name);
  } else if (options.features) {
    for (const [name, val] of Object.entries(options.features) as [FeatureName, unknown][]) {
      if (val === false) requested.delete(name);
      else if (val === true) requested.add(name);
      else { requested.add(name); perFeatureOpts.set(name, val); }
    }
  }

  // Step C: expand dependencies
  const expanded = expandFeatureDeps(Array.from(requested));

  // Step D: instantiate. Per-grid opts > global > undefined.
  const featurePlugins: GridPlugin[] = [];
  for (const name of expanded) {
    const opts = perFeatureOpts.get(name) ?? getGlobalFeatureOptions(name);
    const instance = instantiateFeature(name, opts);
    if (instance) featurePlugins.push(instance);
  }

  // Step E: cellRenderers (always needed — registers built-in cell types)
  const allPlugins: GridPlugin[] = [getCellRenderersPlugin(), ...featurePlugins];

  // Step F: escape-hatch plugins (additive, may dup-register — core warns in dev)
  if (options.plugins) allPlugins.push(...options.plugins);

  return allPlugins;
}

export function useGrid<TData = unknown, TContext = unknown>(
  options: ReactGridOptions<TData, TContext>,
): GridHandle<TData, TContext> {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Build the grid once. Columns + data are read live from optionsRef on the
  // grid's own update path; plugin set is computed at mount and locked in.
  const grid = useMemo<GridInstance<TData>>(() => {
    const plugins = resolvePlugins(options);
    return createGrid<TData>({
      ...options,
      plugins,
      context: options.context,
    });
    // Plugins resolution is intentionally NOT reactive — changing features
    // mid-grid would require unregistering plugins, out of scope for v1.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync context to grid on every render (cheap — just updates a ref)
  useEffect(() => {
    grid.setContext(options.context);
  });

  // Sync data + columns when their identity changes
  useEffect(() => {
    grid.setData(options.data);
  }, [grid, options.data]);

  useEffect(() => {
    grid.setColumns(options.columns);
  }, [grid, options.columns]);

  // Container ref: mount/unmount on attach
  const mountedRef = useRef<HTMLElement | null>(null);
  const containerRef = (el: HTMLElement | null) => {
    if (el === mountedRef.current) return;
    if (mountedRef.current) grid.unmount();
    mountedRef.current = el;
    if (el) grid.mount(el);
  };

  useEffect(() => () => {
    if (mountedRef.current) grid.unmount();
  }, [grid]);

  return {
    api: grid,
    containerRef,
    _internal: {
      contextRef: { current: options.context },
    },
  };
}
```

**Verify method names before coding**: `grid.setData(...)` and `grid.setColumns(...)` are the assumed names. Run `grep -n "setData\|setColumns" packages/core/src/grid.ts packages/core/src/types.ts` first. If the actual names differ (likely `updateData`, `updateColumns`, or event-based via `emitter.emit('data:set', ...)`), use whatever core exposes today. Do not add new methods to core in this task — that's a separate refactor.

- [ ] **Step 4: Delete old hook + update barrel**

```bash
rm packages/react/src/hooks/useGrid.ts
rmdir packages/react/src/hooks 2>/dev/null || true
```

Update `packages/react/src/index.ts` — remove the `./hooks/useGrid` export, add the new ones.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p packages/react/tsconfig.json 2>&1 | head -20`
Expected: errors in `BetterGrid.tsx` (next task fixes it). No errors in `useGrid.ts` itself.

- [ ] **Step 6: Commit**

```bash
git add packages/react/src/useGrid.ts packages/react/src/types.ts packages/react/src/index.ts
git rm packages/react/src/hooks/useGrid.ts 2>/dev/null
git commit -m "react: replace useGrid hook — resolves mode/features, returns GridHandle with imperative api + ref"
```

---

### Task 10: Update `<BetterGrid>` — accept `grid={handle}` OR flat options

**Files:**
- Modify: `packages/react/src/BetterGrid.tsx`
- Modify: `packages/react/src/index.ts`

**Spec section**: §7 "Component shape".

- [ ] **Step 1: Replace `BetterGrid.tsx` content**

```tsx
import { memo } from 'react';
import { useGrid } from './useGrid';
import type { GridHandle, ReactGridOptions } from './types';

export type BetterGridProps<TData = unknown, TContext = unknown> =
  | { grid: GridHandle<TData, TContext>; className?: string; style?: React.CSSProperties; height?: number | string; width?: number | string }
  | (ReactGridOptions<TData, TContext> & { grid?: undefined; className?: string; style?: React.CSSProperties });

function BetterGridInner<TData = unknown, TContext = unknown>(props: BetterGridProps<TData, TContext>) {
  // Two paths: precomputed grid handle (advanced) or inline options (sugar).
  const handle = 'grid' in props && props.grid
    ? props.grid
    // eslint-disable-next-line react-hooks/rules-of-hooks
    : useGrid<TData, TContext>(props as ReactGridOptions<TData, TContext>);

  const className = props.className;
  const style = props.style;
  const width = ('grid' in props ? props.width : props.size?.width) ?? '100%';
  const height = ('grid' in props ? props.height : props.size?.height) ?? '100%';

  return (
    <div
      ref={handle.containerRef}
      className={className}
      style={{ width, height, position: 'relative', overflow: 'hidden', ...style }}
    />
  );
}

export const BetterGrid = memo(BetterGridInner) as typeof BetterGridInner;
```

**Rules-of-hooks**: the implementation above conditionally calls `useGrid`, which violates rules-of-hooks. Replace it with a top-level dispatch into two internal components — each branch then has a stable hook count:

```tsx
import { memo } from 'react';
import { useGrid } from './useGrid';
import type { GridHandle, ReactGridOptions } from './types';

export type BetterGridProps<TData = unknown, TContext = unknown> =
  | ({ grid: GridHandle<TData, TContext> } & CommonProps)
  | (ReactGridOptions<TData, TContext> & { grid?: undefined } & CommonProps);

interface CommonProps {
  className?: string;
  style?: React.CSSProperties;
  height?: number | string;
  width?: number | string;
}

function BetterGridView<TData, TContext>(props: { handle: GridHandle<TData, TContext> } & CommonProps) {
  const width = props.width ?? '100%';
  const height = props.height ?? '100%';
  return (
    <div
      ref={props.handle.containerRef}
      className={props.className}
      style={{ width, height, position: 'relative', overflow: 'hidden', ...props.style }}
    />
  );
}

function BetterGridSelfManaging<TData, TContext>(props: ReactGridOptions<TData, TContext> & CommonProps) {
  const handle = useGrid<TData, TContext>(props);
  const width = props.width ?? props.size?.width ?? '100%';
  const height = props.height ?? props.size?.height ?? '100%';
  return <BetterGridView handle={handle} className={props.className} style={props.style} width={width} height={height} />;
}

function BetterGridInner<TData = unknown, TContext = unknown>(props: BetterGridProps<TData, TContext>) {
  if ('grid' in props && props.grid) {
    return <BetterGridView handle={props.grid} className={props.className} style={props.style} width={props.width} height={props.height} />;
  }
  return <BetterGridSelfManaging {...(props as ReactGridOptions<TData, TContext> & CommonProps)} />;
}

export const BetterGrid = memo(BetterGridInner) as typeof BetterGridInner;
```

Use this version, not the inline-conditional version above it.

- [ ] **Step 2: Update `packages/react/src/index.ts`**

```ts
export { BetterGrid, type BetterGridProps } from './BetterGrid';
export { useGrid } from './useGrid';
export type { GridHandle, ReactGridOptions } from './types';
export { defineColumn, registerColumn } from './defineColumn';
export { configureBetterGrid } from './configureBetterGrid';
export { registerMode } from './presets/modes';
export type { FeatureName } from './presets/features';
export type { ModeDefinition } from './presets/modes';
```

- [ ] **Step 3: Build the react package**

Run: `npm --prefix packages/react run build`
Expected: ESM/CJS/DTS all green.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p packages/react/tsconfig.json 2>&1 | head`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/BetterGrid.tsx packages/react/src/index.ts
git commit -m "react: <BetterGrid> accepts grid={handle} or inline ReactGridOptions; size grouping wired"
```

---

## Phase 4 — Migration

### Task 11: Write the migration doc

**Files:**
- Create: `docs/migration-v0-to-v1.md`

- [ ] **Step 1: Write the doc**

Create `docs/migration-v0-to-v1.md`:

```markdown
# Migrating from v0 to v1

The v1 release reshapes the Better Grid init API for better DX. Pre-release, no back-compat — every consumer must migrate. This doc lists every breaking change and shows the before/after.

## TL;DR

- `useMemo` around columns: usually no longer needed (hoist columns at module scope).
- `cellType: 'currency'` etc.: replace with `col.currency('field', { precision: 0 })`.
- Plugin instantiation: replace with `mode="spreadsheet"` or `features={['edit', 'clipboard']}` strings; full plugin instances still work via `plugins={[...]}`.
- `<BetterGrid columns={} data={} />` flat: still works. New advanced path: `const grid = useGrid({...}); <BetterGrid grid={grid} />`.

## Breaking changes

### 1. Column definitions

**Before:**
```tsx
{ id: 'q1Actual', accessorKey: 'q1Actual', header: 'Actual', cellType: 'currency', precision: 0, align: 'right' }
```

**After (recommended):**
```tsx
import { defineColumn as col } from '@better-grid/react';
col.currency('q1Actual', { header: 'Actual', precision: 0 })
```

The `col.<type>(field, opts)` builder sets `id`, `accessorKey`, `cellType`, and `align` for you. `field` becomes both `id` and `accessorKey`; pass `accessorFn` in opts for non-trivial paths.

Custom column types: `registerColumn('avatar', { ... })` at app boot, then `col.avatar(...)`.

### 2. Plugin opt-in

**Before:**
```tsx
import { formatting, editing, sorting, clipboard, undoRedo } from '@better-grid/plugins';
<BetterGrid plugins={[formatting({ locale: 'en-US' }), editing(), sorting(), clipboard(), undoRedo()]} />
```

**After (string features):**
```tsx
<BetterGrid mode="spreadsheet" />  // includes edit + clipboard + undo + interactive baseline
// or:
<BetterGrid features={['format', 'edit', 'sort', 'clipboard', 'undo']} />
// or with options:
<BetterGrid features={{ format: { locale: 'en-US' }, edit: true, sort: true, clipboard: true, undo: true }} />
```

For app-wide options:
```tsx
import { configureBetterGrid } from '@better-grid/react';
configureBetterGrid({ features: { format: { locale: 'en-US' } } });
```

Plugin escape hatch (for plugins not in the features registry, or when you need full control):
```tsx
<BetterGrid plugins={[gantt({ ...customOpts })]} />
```

### 3. Mode presets

| Mode | Features included | Use case |
|---|---|---|
| `null` | — | Zero defaults |
| `view` | sort, filter, resize, select | Read-only browsing |
| `interactive` | view + reorder | Lightly interactive |
| `spreadsheet` | interactive + edit + clipboard + undo | Excel-like data entry |
| `dashboard` | view + export | Read-heavy with snapshot export |

Default if `mode` omitted: `view`. Set `mode={null}` for zero defaults.

### 4. Grouped layout props

| Before | After |
|---|---|
| `frozenLeftColumns={2}` | `frozen={{ left: 2 }}` |
| `frozenTopRows={1}` | `frozen={{ top: 1 }}` |
| `freezeClip` | `frozen={{ clip: true }}` |
| `pinnedTopRows={[totals]}` | `pinned={{ top: [totals] }}` |
| `pinnedBottomRows={[]}` | `pinned={{ bottom: [] }}` |
| `headerLayout={[...]}` | `headers={[...]}` (shorthand) or `headers={{ layout: [...], height: 32 }}` |
| `footerLayout={[...]}` | `footers={[...]}` |
| `width={500}` | `size={{ width: 500 }}` |
| `height={400}` | `size={{ height: 400 }}` *(top-level `height` still works on `<BetterGrid>` as a sugar prop)* |
| `rowStyles={{ field, styles }}` | DROPPED. Use `rowStyle: (row, idx) => ({...})` |
| `getRowStyle` | RENAMED to `rowStyle` |

### 5. Component shape

**Before:**
```tsx
<BetterGrid columns={cols} data={data} plugins={plugins} />
```

**After (sugar — same shape, still works):**
```tsx
<BetterGrid columns={cols} data={data} mode="spreadsheet" />
```

**After (advanced — for handler refs, programmatic API):**
```tsx
const grid = useGrid({ columns: cols, data, mode: 'spreadsheet', context: { onRowClick } });
<BetterGrid grid={grid} height={500} />
// grid.api.scrollToCell(...) etc.
```

### 6. Closure-over-scope handlers

**Before:** had to inline columns inside the component + memoize everything to close over component-scope handlers.

**After:** hoist columns at module scope, read handlers from `ctx.context`:

```tsx
// columns.ts (hoisted)
export const columns = [
  col.text('name', {
    cellRenderer: (ctx) => (
      <a onClick={() => ctx.context.onRowClick(ctx.row)}>{ctx.value as string}</a>
    ),
  }),
];

// Component
function Page() {
  const grid = useGrid<Row, { onRowClick: (row: Row) => void }>({
    data, columns, context: { onRowClick: handleClick },
  });
  return <BetterGrid grid={grid} />;
}
```

The `context` is stored on a ref internally — swapping `onRowClick` doesn't re-init the grid.

## State persistence on data swap

When `data` reference changes, v1 default behavior:

- Selection clears.
- Scroll resets to (0, 0).
- In-progress edits commit-or-cancel per the editing plugin's existing rules.
- Undo history clears.

A future `resetOn: 'never' | 'data' | 'columns'` option may be added.

## Slots seam (reserved)

`<BetterGrid slots={...} slotProps={...} />` accepts these props but they're unused in v1. v1.1 will populate them. Don't pass them yet.
```

- [ ] **Step 2: Commit**

```bash
git add docs/migration-v0-to-v1.md
git commit -m "docs: add v0→v1 migration guide"
```

---

### Task 12: Migrate playground batch 1 — simple pages

**Files:**
- Modify: `apps/playground/src/pages/CoreOnly.tsx`
- Modify: `apps/playground/src/pages/CellTypes.tsx`
- Modify: `apps/playground/src/pages/EditorTypes.tsx`
- Modify: `apps/playground/src/pages/FrozenPinned.tsx`
- Modify: `apps/playground/src/pages/HierarchyDemo.tsx`

**Approach**: each page gets a mechanical rewrite. Pattern:

1. Replace `useMemo<ColumnDef[]>(() => [...], [])` with hoisted `const columns = [col.x(...), ...]`.
2. Replace `plugins={useMemo(() => [formatting(), editing(), ...], [])}` with `mode="..."` or `features={[...]}`.
3. Replace flat layout props with grouped: `frozenLeftColumns={2}` → `frozen={{ left: 2 }}`.
4. Update CodeBlock embedded snippets to match.

For each page in this batch, work through this checklist:

- [ ] **CoreOnly.tsx** (currently 3-prop init — minimal changes)
  - Hoist columns out of component (drop `useMemo`).
  - `frozenLeftColumns={2}` → `frozen={{ left: 2 }}`.
  - `selection={{ mode: 'range' }}` stays as-is.
  - Update CodeBlock if it still shows the old syntax.
  - Verify visual parity in browser (`npm --prefix apps/playground run dev`, navigate to /core-only).

- [ ] **CellTypes.tsx**
  - Hoist `columns` out of component (already const, move plugins out).
  - Replace `plugins = useMemo(() => [formatting({...}), cellRenderers()], [])` with `mode="view"` (already gets sort/filter/resize/select) + `features={{ format: { locale: 'en-US', currencyCode: 'USD' } }}`.
  - Note: `cellRenderers()` is auto-included by `useGrid` (it's in `getCellRenderersPlugin()` always).
  - Each column gets builder treatment: `{ id: 'status', cellType: 'badge', options: [...] }` → `col.badge('status', { options: [...] })`.

- [ ] **EditorTypes.tsx**, **FrozenPinned.tsx**, **HierarchyDemo.tsx**
  - Same pattern.
  - For HierarchyDemo, `hierarchy={{...}}` stays as a top-level option.

- [ ] **Verify each loads and functions**

Run: `npm --prefix apps/playground run dev`, open browser, click each migrated page, confirm:
- Renders identically.
- Sort/filter/select/edit (where applicable) still work.
- No console errors.

- [ ] **Commit**

```bash
git add apps/playground/src/pages/CoreOnly.tsx apps/playground/src/pages/CellTypes.tsx apps/playground/src/pages/EditorTypes.tsx apps/playground/src/pages/FrozenPinned.tsx apps/playground/src/pages/HierarchyDemo.tsx
git commit -m "playground: migrate simple pages to new init API"
```

---

### Task 13: Migrate playground batch 2 — finance & directory pages

**Files:**
- Modify: `apps/playground/src/pages/FinanceDashboard.tsx`
- Modify: `apps/playground/src/pages/HRDirectory.tsx`
- Modify: `apps/playground/src/pages/InventoryTracker.tsx`
- Modify: `apps/playground/src/pages/MultiHeaderDemo.tsx`
- Modify: `apps/playground/src/pages/MergeCellsDemo.tsx`

- [ ] **FinanceDashboard.tsx** *(spec target — must shrink ≥30% LOC)*
  - Hoist columns. Replace 11× `{ cellType: 'currency', precision: 0, align: 'right' }` with 11× `col.currency('q1Actual', { precision: 0 })` etc.
  - Replace plugin array with `mode="spreadsheet" features={['validation', 'export']}`.
  - `multiHeaders` stays as `headers={multiHeaders}` (shorthand form).
  - `pinned={{ top: [totalsRow] }}`.
  - Measure LOC before/after to confirm ≥30% shrink. If not, investigate why.

- [ ] **HRDirectory.tsx**, **InventoryTracker.tsx**, **MultiHeaderDemo.tsx**, **MergeCellsDemo.tsx**
  - Same mechanical pattern.
  - `MergeCellsDemo` uses the `mergeCells` pro plugin — passes via `plugins={[mergeCells()]}` (escape hatch, no string slot).

- [ ] **Verify each in browser**

- [ ] **Commit**

```bash
git add apps/playground/src/pages/FinanceDashboard.tsx apps/playground/src/pages/HRDirectory.tsx apps/playground/src/pages/InventoryTracker.tsx apps/playground/src/pages/MultiHeaderDemo.tsx apps/playground/src/pages/MergeCellsDemo.tsx
git commit -m "playground: migrate finance/directory pages to new init API"
```

---

### Task 14: Migrate playground batch 3 — DM + clipboard + perf

**Files:**
- Modify: `apps/playground/src/pages/ClipboardFill.tsx`
- Modify: `apps/playground/src/pages/PerformanceDemo.tsx`
- Modify: `apps/playground/src/pages/DmActuals.tsx`
- Modify: `apps/playground/src/pages/DmForecast.tsx`
- Modify: `apps/playground/src/pages/DmSummary.tsx`
- Modify: `apps/playground/src/pages/DmTimeline.tsx`

- [ ] Apply the same migration pattern as batches 1+2 to each.

- [ ] **PerformanceDemo.tsx**: this page tests render performance with large datasets. After migration, re-measure FPS in dev tools to confirm no regression vs pre-migration. If regression > 10%, file an issue and bisect (likely culprit: useMemo elimination changing identity behavior).

- [ ] **Commit**

```bash
git add apps/playground/src/pages/ClipboardFill.tsx apps/playground/src/pages/PerformanceDemo.tsx apps/playground/src/pages/Dm*.tsx
git commit -m "playground: migrate DM + clipboard + perf pages"
```

---

### Task 15: Migrate Wiseway pages — `FsbtCost.tsx` (success criterion)

**Files:**
- Modify: `apps/playground/src/pages/FsbtCost.tsx`
- Modify: `apps/playground/src/pages/FsbtRevenue.tsx`
- Modify: `apps/playground/src/pages/FsbtProgram.tsx`
- Modify: `apps/playground/src/pages/_FsbtProgramSummary.tsx`
- Modify: `apps/playground/src/pages/_fsbt-cell-styles.ts`
- Modify: `apps/playground/src/pages/_fsbt-dropdown.ts`
- Modify: `apps/playground/src/pages/_fsbt-program-data.ts`

**Spec § "Success criteria"**: `FsbtCost.tsx` migrates with **zero behavior change** — pinned-footer "Total Development Cost" layout, click-to-edit, currency formatting per column, freeze/clip configuration. **If FsbtCost doesn't migrate cleanly, the design needs another revision before merge.**

- [ ] **Step 1: Read `FsbtCost.tsx` end-to-end first**

Run: `cat apps/playground/src/pages/FsbtCost.tsx | head -100` then read the rest.

Map every option → new shape:
- `frozenLeftColumns` → `frozen.left`
- `pinnedBottomRows` → `pinned.bottom`
- All currency columns → `col.currency`
- Plugin array → `mode` + `features`

If the page uses a custom cellRenderer that closes over component state, **convert to use `context`**: hoist the column, accept `ctx.context.<handler>` in the renderer, pass handlers via `useGrid({ context: {...} })`.

- [ ] **Step 2: Migrate FsbtCost.tsx**

Apply the migration. Pay particular attention to:
- Pinned-footer "Total Development Cost" must render in the same position.
- Click-to-edit on cell must still trigger.
- Per-column currency formatting (different precisions per column?).
- Freeze/clip drag handle must still work.

- [ ] **Step 3: Visual parity check**

Run: `npm --prefix apps/playground run dev`. Open the FsbtCost page. Compare side-by-side with a screenshot of the pre-migration version (if available) or with `git stash; reload; git stash pop; reload`. Confirm:
- Layout identical.
- All interactions work.
- No console errors.
- Tab/Enter editing flow unchanged.

- [ ] **Step 4: Migrate FsbtRevenue + FsbtProgram + _FsbtProgramSummary**

Same pattern.

- [ ] **Step 5: Commit**

```bash
git add apps/playground/src/pages/Fsbt*.tsx apps/playground/src/pages/_Fsbt*.tsx apps/playground/src/pages/_fsbt-*.ts
git commit -m "playground: migrate Wiseway FSBT pages — Cost/Revenue/Program with zero behavior change"
```

---

### Task 16: Migrate remaining pages + App.tsx

**Files:**
- Modify: `apps/playground/src/pages/Landing.tsx`
- Modify: `apps/playground/src/App.tsx` (if it constructs grids inline)
- Modify: any remaining page in `apps/playground/src/pages/` not covered by 12-15.

- [ ] **Step 1: List remaining pages**

Run: `ls apps/playground/src/pages/*.tsx` and cross off the ones already migrated in Tasks 12-15.

- [ ] **Step 2: Migrate each**

Same mechanical pattern.

- [ ] **Step 3: Verify build**

Run: `npm --prefix apps/playground run build`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add apps/playground/
git commit -m "playground: migrate remaining pages + App"
```

---

## Phase 5 — Verification

### Task 17: Repo-wide verification + sign-off

**Files:** all touched in this PR.

- [ ] **Step 1: Repo-wide typecheck**

Run: `npm run typecheck`
Expected: only the 3 known pre-existing TS errors (`layers.ts:21` unused `fillPreview`, `pipeline.ts` 2 `HTMLElement | null` assignability errors). Line numbers may have shifted; the count must be 3.

- [ ] **Step 2: Repo-wide build**

Run: `npm run build`
Expected: all packages build green (core, plugins, pro, react, playground).

- [ ] **Step 3: Repo-wide test**

Run: `npm test`
Expected: all tests pass. Includes:
- `packages/core/tests/` (existing + new `context-read-through.test.ts`).
- `packages/react/tests/` (4 new test files).

- [ ] **Step 4: FsbtCost LOC delta check**

Run: `git diff main -- apps/playground/src/pages/FsbtCost.tsx | grep -E "^[+-]" | grep -v "^+++\|^---" | sort | uniq -c`
Visual: `wc -l apps/playground/src/pages/FsbtCost.tsx` vs the pre-PR version (`git show main:apps/playground/src/pages/FsbtCost.tsx | wc -l`).
Spec target: ≥30% LOC shrink for `FinanceDashboard.tsx` (the spec's named target). FsbtCost shrink is informational, not a hard target.

- [ ] **Step 5: Visual spot-check of all migrated pages**

Run: `npm --prefix apps/playground run dev`
Click through all ~25 pages in order. Confirm each one renders without errors and the user-visible behavior is unchanged.

- [ ] **Step 6: Commit any final fixups + tag**

```bash
git add -A  # only if there are fixups; commit a clean -A only after reviewing what's staged
git commit -m "playground: final visual fixups after API migration" 2>&1 | true
```

- [ ] **Step 7: Summary report**

Generate the migration summary for the PR description:

```bash
git log --oneline main..HEAD
git diff main --stat | tail -3
```

PR title: `Grid Init API redesign (v1) — column builders, mode/features presets, useGrid hook, hoisted-column context`

PR body should include:
- Link to spec at `docs/superpowers/specs/2026-04-25-grid-init-api-design.md`.
- Link to migration doc at `docs/migration-v0-to-v1.md`.
- LOC stat (FinanceDashboard before/after, FsbtCost before/after).
- List of breaking changes (mirror the migration doc's TL;DR).
- Confirmation that Wiseway FsbtCost page renders with zero behavior change (success criterion).

---

## Self-review notes (already applied)

- Spec §1 (column builders) → Task 8.
- Spec §2 (features 3-layer) → Tasks 5, 7 (and useGrid resolution in 9).
- Spec §3 (modes) → Task 6.
- Spec §4 (closure-over-scope context) → Tasks 2, 4 (core), 9 (react).
- Spec §5 (feature deps) → Task 5 (`expandFeatureDeps`).
- Spec §6 (prop organization) → Tasks 1, 3 (core types/grid), 9 (react types).
- Spec §7 (component shape) → Task 10.
- Spec §8 (useGrid return) → Task 9 (`GridHandle`).
- Spec "In scope but minimum viable" (state-on-data-swap) → Task 3 step 3.
- Spec "Reserved extension points" (slots seam) → Task 1 (interfaces in types.ts).
- Migration doc → Task 11.
- Wiseway success criterion (FsbtCost) → Task 15.
- Spec success criteria (typecheck/build/parity) → Task 17.
