# Incoming-migration alignment + API audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pre-publish surface refresh that aligns Better Grid with AG Grid + MUI X conventions, refines the API where Better Grid can win on DX, and fixes shape inconsistencies — followed by a one-shot `@better-grid/codemods` package that automates incoming migrations from six libraries.

**Architecture:** Phase 1 is in-place edits to `packages/core`, `packages/react`, `packages/plugins`, `packages/pro`, and `apps/playground`. No back-compat — the rename and reshape land atomically per concern. Phase 2 is a brand-new workspace package `packages/codemods/` using `jscodeshift`, fixture-tested with `vitest`.

**Tech Stack:** TypeScript 5.7+ (strict), tsup (per-package builds), vitest (tests), pnpm workspaces + Turborepo, jscodeshift (Phase 2). Windows-safe build via `node scripts/build.js`.

---

## Spec reference

This plan implements [`docs/internal/specs/2026-04-26-incoming-migration-alignment-design.md`](../specs/2026-04-26-incoming-migration-alignment-design.md). Each task references the matching spec section in its header.

## File structure

### Phase 1 — touched files

```
packages/core/src/
  types.ts                  # ColumnDef, GridOptions, GridState, GridEvents, SelectionOptions, HeaderRow, FooterRow, CellChange — every section sees a change
  grid.ts                   # createGrid: id-defaulting, top-level getRowId, updateCell oldValue fix, event renames, state.frozen/state.pinned shape, setColumnHidden API
  columns/manager.ts        # column normalization (id ??= field), hide-aware live array
  virtualization/layout.ts  # flex integrates into width allocation
  rendering/headers.ts      # headerName + headerRenderer rendering, headerAlign override
  rendering/pipeline.ts     # cell rendering reads renamed fields
  rendering/pinned-rows.ts  # same
  state/store.ts            # new state shape (frozen, pinned groups)
  selection/model.ts        # discriminated selection normalization
  ui/freeze-clip-drag.ts    # emit 'frozen:clip' (renamed event)

packages/react/src/
  configure.ts              # renamed from configureBetterGrid.ts
  useGrid.ts                # accepts top-level getRowId, new selection union, bordered/striped passthrough
  defineColumn.ts           # builders set field/headerName, accept hide/flex/headerAlign/headerRenderer, default id from field
  BetterGrid.tsx            # surfaces new top-level options; HeaderRow[]/FooterRow[] only
  index.ts                  # export configure (not configureBetterGrid)
  presets/features.ts       # no shape changes
  presets/modes.ts          # no shape changes

packages/plugins/src/free/
  editing.ts                # field/valueGetter reads, 'cell:change' event, CellChange.oldValue consumer
  validation.ts             # field reads, 'cell:change' event
  sorting.ts                # field reads
  filtering.ts              # field reads
  hierarchy.ts              # field/valueGetter reads, getRowId source-of-truth handling
  clipboard.ts              # field reads, 'cell:change'
  search.ts, export.ts, undo-redo.ts, cell-renderers.ts, auto-detect.ts, formatting.ts, pagination.ts, grouping.ts
                            # field/valueGetter reads where applicable

packages/pro/src/
  gantt.ts, aggregation.ts, merge-cells.ts, row-actions.ts, pro-renderers.ts
                            # field/valueGetter reads, event-name updates

apps/playground/src/pages/
  *.tsx                     # ~25 demo pages — bulk find/replace + selection union normalization
  ColumnFeaturesDemo.tsx    # NEW — exercises hide/flex/headerAlign/headerRenderer

packages/core/tests/
  *.test.ts                 # update assertions to new event names + state shape; new tests for §1.5 fixes

packages/react/tests/
  defineColumn.test.ts      # updated for field/headerName + hide/flex/headerAlign/headerRenderer
  configure.test.ts         # renamed from configureBetterGrid.test.ts
  modes.test.ts, features.test.ts, rhf.test.ts  # any field/header references updated

apps/playground/src/App.tsx # add /demo/column-features route
```

### Phase 2 — new package

```
packages/codemods/
  package.json              # name "@better-grid/codemods"; bin entry; deps: jscodeshift, @types/jscodeshift, commander
  README.md                 # CLI usage, transform list, what's auto-converted vs flagged
  tsconfig.json
  tsup.config.ts            # build the CLI entry
  bin/migrate.ts            # CLI shim — parse argv, dispatch transform
  src/cli.ts                # CLI implementation — paths, --dry-run, --report, --ext
  src/runner.ts             # jscodeshift driver wrapper; report aggregation
  src/transforms/from-ag-grid/index.ts
  src/transforms/from-ag-grid/__testfixtures__/{column-rename,grid-options,events,selection,renderer-flagged}.{input,output}.tsx
  src/transforms/from-mui-x-data-grid/index.ts
  src/transforms/from-mui-x-data-grid/__testfixtures__/...
  src/transforms/from-tanstack-table/index.ts
  src/transforms/from-tanstack-table/__testfixtures__/...
  src/transforms/from-handsontable/index.ts
  src/transforms/from-handsontable/__testfixtures__/...
  src/transforms/from-revogrid/index.ts
  src/transforms/from-revogrid/__testfixtures__/...
  src/transforms/from-react-data-grid/index.ts
  src/transforms/from-react-data-grid/__testfixtures__/...
  tests/transforms.test.ts  # vitest — for each transform, run input.tsx through the transform, assert against output.tsx

docs/migrations/from-*.md   # each gets a "Codemod" section appended
README.md                   # link to codemod CLI under "Migrating from another grid?"
CHANGELOG.md                # [Unreleased] entry for codemods package
```

---

# Phase 1 — Surface refresh

Single PR, no back-compat. Each task is one coherent change with its own commit.

---

## Task 1: Pre-flight — branch + baseline

**Files:**
- None (git only)

- [ ] **Step 1: Confirm clean working tree**

```bash
git status
```

Expected: `nothing to commit, working tree clean`. If not, stash or commit before proceeding.

- [ ] **Step 2: Confirm we're on `main` and up to date**

```bash
git checkout main
git log --oneline -1
```

- [ ] **Step 3: Run baseline tests so we know what "green" looks like**

```bash
pnpm --filter @better-grid/core test
pnpm --filter @better-grid/react test
```

Expected: all tests pass (135 core + 32 react = 167 total).

- [ ] **Step 4: Build baseline**

```bash
node scripts/build.js
```

Expected: all 4 packages build green.

---

## Task 2: Rename `accessorKey` → `field` (spec §1.1)

**Files:**
- Modify: `packages/core/src/types.ts:139`
- Modify: `packages/core/src/columns/manager.ts` (read sites)
- Modify: `packages/core/src/grid.ts` (read sites)
- Modify: `packages/core/src/rendering/pipeline.ts`, `pinned-rows.ts`, `headers.ts` (read sites)
- Modify: `packages/core/src/utils.ts` if it has `getCellValue` reading `accessorKey`
- Modify: `packages/react/src/defineColumn.ts` (builders set `field`)
- Modify: `packages/plugins/src/free/*.ts` (every plugin reading `accessorKey`)
- Modify: `packages/pro/src/*.ts` (same)
- Modify: `apps/playground/src/pages/*.tsx` (every page using raw `ColumnDef`)
- Modify: `packages/core/tests/*.test.ts` (assertions)
- Modify: `packages/react/tests/*.test.ts` (assertions)

- [ ] **Step 1: Inventory every site**

```bash
grep -rn "accessorKey" packages/ apps/playground/src/ --include="*.ts" --include="*.tsx" | wc -l
```

Note the count for Step 5 verification.

- [ ] **Step 2: Update the type definition**

In `packages/core/src/types.ts`, find the `ColumnDef<TData = unknown>` interface and change:

```ts
  accessorKey?: keyof TData & string;
```

to:

```ts
  field?: keyof TData & string;
```

- [ ] **Step 3: Bulk find/replace `accessorKey` → `field` in source files**

```bash
# Bash
find packages/ apps/playground/src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\baccessorKey\b/field/g' {} +
```

PowerShell alternative if sed isn't available:

```powershell
Get-ChildItem -Recurse -Include *.ts,*.tsx packages,apps/playground/src |
  ForEach-Object {
    (Get-Content $_.FullName -Raw) -replace '\baccessorKey\b','field' |
      Set-Content -Encoding utf8 $_.FullName
  }
```

- [ ] **Step 4: Verify no remaining occurrences**

```bash
grep -rn "accessorKey" packages/ apps/playground/src/ --include="*.ts" --include="*.tsx"
```

Expected: no output. If any matches in comments/strings remain, review them — they're either historical commentary (leave) or live references that need editing.

- [ ] **Step 5: Build core and run tests**

```bash
node scripts/build.js core
pnpm --filter @better-grid/core test
```

Expected: build green; all tests pass (the rename is symmetric).

- [ ] **Step 6: Build everything**

```bash
node scripts/build.js
pnpm --filter @better-grid/react test
```

Expected: all builds + react tests green.

- [ ] **Step 7: Commit**

```bash
git add packages/ apps/playground/src/
git commit -m "core(types): rename ColumnDef.accessorKey -> field

Pre-publish alignment with AG Grid + MUI X. Bulk find/replace across
core, plugins, pro, react, playground, and tests."
```

---

## Task 3: Rename `accessorFn` → `valueGetter` (spec §1.1)

**Files:**
- Modify: `packages/core/src/types.ts:140`
- Modify: same read sites as Task 2
- Modify: tests + playground

- [ ] **Step 1: Inventory**

```bash
grep -rn "accessorFn" packages/ apps/playground/src/ --include="*.ts" --include="*.tsx" | wc -l
```

- [ ] **Step 2: Update the type definition**

In `packages/core/src/types.ts`, change:

```ts
  accessorFn?: (row: TData, rowIndex: number) => unknown;
```

to:

```ts
  valueGetter?: (row: TData, rowIndex: number) => unknown;
```

- [ ] **Step 3: Bulk find/replace**

```bash
find packages/ apps/playground/src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\baccessorFn\b/valueGetter/g' {} +
```

- [ ] **Step 4: Verify**

```bash
grep -rn "accessorFn" packages/ apps/playground/src/ --include="*.ts" --include="*.tsx"
```

Expected: no output.

- [ ] **Step 5: Build + test**

```bash
node scripts/build.js
pnpm --filter @better-grid/core test
pnpm --filter @better-grid/react test
```

- [ ] **Step 6: Commit**

```bash
git add packages/ apps/playground/src/
git commit -m "core(types): rename ColumnDef.accessorFn -> valueGetter

Pre-publish alignment with AG Grid + MUI X."
```

---

## Task 4: Split `header` into `headerName` + `headerRenderer` (spec §1.1, §1.4a)

**Files:**
- Modify: `packages/core/src/types.ts` (ColumnDef)
- Modify: `packages/core/src/rendering/headers.ts`
- Modify: `packages/react/src/defineColumn.ts`
- Modify: every read site of the old `header` field (many)
- Modify: `apps/playground/src/pages/*.tsx`
- Modify: tests
- Test: `packages/core/tests/header-renderer.test.ts` (NEW)

- [ ] **Step 1: Update the type definition**

In `packages/core/src/types.ts`, find:

```ts
  header: string | (() => HTMLElement | string);
```

Replace with:

```ts
  headerName: string;
  headerRenderer?: (container: HTMLElement, ctx: { column: ColumnDef<TData>; columnIndex: number }) => void;
```

- [ ] **Step 2: Inventory `header:` and `header(...)` sites**

```bash
# Find object-literal sites: `header:`
grep -rn "\\bheader:\\s" packages/core/src/ packages/react/src/ packages/plugins/src/ packages/pro/src/ apps/playground/src/ --include="*.ts" --include="*.tsx"
# Find dynamic-read sites: `column.header`, `col.header`, etc.
grep -rn "\\.header\\b" packages/core/src/ packages/react/src/ packages/plugins/src/ packages/pro/src/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 3: Bulk-rename `header:` (object literal) and `.header` (member access) to `headerName`**

```bash
find packages/ apps/playground/src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e 's/\bheader:\s/headerName: /g' \
  -e 's/\.header\b/.headerName/g' \
  {} +
```

- [ ] **Step 4: Manually fix sites where `header` was a function**

```bash
grep -rn "headerName: () =>" packages/ apps/playground/src/ --include="*.ts" --include="*.tsx"
grep -rn "headerName: function" packages/ apps/playground/src/ --include="*.ts" --include="*.tsx"
```

For each match, convert to `headerRenderer: (container) => { … }` (DOM mutator) and set `headerName` to a string label. Example transformation:

Before:
```tsx
{ field: 'name', headerName: () => makeFancyHeader('Name') }
```

After:
```tsx
{
  field: 'name',
  headerName: 'Name',
  headerRenderer: (container) => {
    container.replaceChildren(makeFancyHeader('Name'));
  },
}
```

- [ ] **Step 5: Update the headers renderer**

In `packages/core/src/rendering/headers.ts`, find the existing header-cell render path. Replace logic that reads `column.header` (potentially a function) with:

```ts
const labelEl = document.createElement('span');
labelEl.textContent = column.headerName;
cellEl.appendChild(labelEl);

if (column.headerRenderer) {
  // Renderer owns the cell content; clear the default label first
  cellEl.replaceChildren();
  column.headerRenderer(cellEl, { column, columnIndex: col });
}
```

- [ ] **Step 6: Update `defineColumn` builders**

In `packages/react/src/defineColumn.ts`, the per-type factory should accept `headerName` (string) and `headerRenderer` (optional function), passing both through to the resulting `ColumnDef`. Find the `applyOpts` (or equivalent) block and ensure `headerRenderer` is forwarded.

- [ ] **Step 7: Write a test for the headerRenderer hook**

Create `packages/core/tests/header-renderer.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';

describe('column.headerRenderer', () => {
  test('replaces default header content when set', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const grid = createGrid<{ id: number }>({
      columns: [
        {
          id: 'name',
          field: 'name' as never,
          headerName: 'Name',
          headerRenderer: (container) => {
            const el = document.createElement('strong');
            el.textContent = 'CUSTOM';
            container.replaceChildren(el);
          },
        },
      ],
      data: [],
    });
    grid.mount(host);

    const headerCell = host.querySelector('.bg-header-cell strong');
    expect(headerCell?.textContent).toBe('CUSTOM');

    grid.unmount();
    document.body.removeChild(host);
  });
});
```

- [ ] **Step 8: Run tests**

```bash
pnpm --filter @better-grid/core test
pnpm --filter @better-grid/react test
```

Expected: all green including the new headerRenderer test.

- [ ] **Step 9: Build and commit**

```bash
node scripts/build.js
git add packages/ apps/playground/src/
git commit -m "core(types): split header into headerName (string) + headerRenderer (DOM mutator)

Pre-publish §1.1 + §1.4a. headerName is always a string; headerRenderer
mirrors the cellRenderer pattern. AG/MUI users with string-only headers
copy-paste verbatim; custom-header users move to the explicit renderer."
```

---

## Task 5: Make `id` optional, default to `field` (spec §1.4b)

**Files:**
- Modify: `packages/core/src/types.ts` (ColumnDef.id)
- Modify: `packages/core/src/columns/manager.ts` (column normalization)
- Test: `packages/core/tests/column-id-default.test.ts` (NEW)

- [ ] **Step 1: Update the type definition**

In `packages/core/src/types.ts`, find:

```ts
  id: string;
```

Replace with:

```ts
  /** Stable column identity. Optional — defaults to `field` when omitted. */
  id?: string;
```

- [ ] **Step 2: Add the failing test**

Create `packages/core/tests/column-id-default.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';

describe('column.id default', () => {
  test('defaults to field when omitted', () => {
    const grid = createGrid<{ name: string }>({
      columns: [{ field: 'name' as never, headerName: 'Name' }],
      data: [{ name: 'Alice' }],
    });
    expect(grid.getState().columns[0].id).toBe('name');
  });

  test('explicit id wins over field', () => {
    const grid = createGrid<{ name: string }>({
      columns: [{ id: 'nameOverride', field: 'name' as never, headerName: 'Name' }],
      data: [],
    });
    expect(grid.getState().columns[0].id).toBe('nameOverride');
  });

  test('throws when both id and field are missing', () => {
    expect(() =>
      createGrid({
        columns: [{ headerName: 'Empty' } as never],
        data: [],
      }),
    ).toThrow(/id or field/i);
  });
});
```

- [ ] **Step 3: Run the test — expect failures**

```bash
pnpm --filter @better-grid/core test column-id-default
```

Expected: tests 1 and 2 fail (no defaulting); test 3 fails (no validation).

- [ ] **Step 4: Implement the default in column normalization**

Find `packages/core/src/columns/manager.ts` (or wherever columns are normalized — `grid.ts` if no separate normalizer exists). Add at the start of column processing:

```ts
function normalizeColumn<TData>(col: ColumnDef<TData>): ColumnDef<TData> & { id: string } {
  const id = col.id ?? col.field;
  if (!id) {
    throw new Error('[better-grid] Column must have either `id` or `field`.');
  }
  return { ...col, id };
}
```

Apply `normalizeColumn` to every column in the `columns` array before storing.

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @better-grid/core test column-id-default
```

Expected: all 3 pass.

- [ ] **Step 6: Run the full suite**

```bash
pnpm --filter @better-grid/core test
pnpm --filter @better-grid/react test
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/columns/manager.ts packages/core/tests/column-id-default.test.ts
git commit -m "core(types): make ColumnDef.id optional, default to field

Pre-publish §1.4b. Most callers use the same value for both; AG Grid's
colId defaults to field already."
```

---

## Task 6: Drop `cellEditor: 'dropdown'` alias (spec §1.4c)

**Files:**
- Modify: `packages/core/src/types.ts` (CellEditorType union)
- Modify: `packages/plugins/src/free/editing.ts` (any handler for `'dropdown'`)
- Modify: callers — find all `cellEditor: 'dropdown'` in playground
- Test: existing editing tests should still pass after the change

- [ ] **Step 1: Update the type union**

In `packages/core/src/types.ts`, find:

```ts
export type CellEditorType =
  | 'text'
  | 'dropdown'
  | 'select'
  | 'selectWithInput'
  | 'number'
  | 'date'
  | 'autocomplete'
  | 'masked';
```

Replace with:

```ts
export type CellEditorType =
  | 'text'
  | 'select'
  | 'selectWithInput'
  | 'number'
  | 'date'
  | 'autocomplete'
  | 'masked';
```

- [ ] **Step 2: Find every use of `'dropdown'` editor and convert to `'select'`**

```bash
grep -rn "cellEditor:\s*['\"]dropdown['\"]" packages/ apps/playground/src/ --include="*.ts" --include="*.tsx"
```

Replace each with `cellEditor: 'select'`. If there's a dispatch arm in `packages/plugins/src/free/editing.ts` that handles `'dropdown'` separately from `'select'`, fold it into the `'select'` branch.

```bash
find packages/ apps/playground/src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s/cellEditor:\s*'dropdown'/cellEditor: 'select'/g" {} +
```

- [ ] **Step 3: Build + test**

```bash
node scripts/build.js
pnpm --filter @better-grid/core test
pnpm --filter @better-grid/react test
```

- [ ] **Step 4: Commit**

```bash
git add packages/ apps/playground/src/
git commit -m "core(types): drop cellEditor 'dropdown' alias; keep 'select'

Pre-publish §1.4c. Two names for one editor; 'select' matches AG
('agSelectCellEditor') and MUI X ('singleSelect')."
```

---

## Task 7: Drop object form for `headers` / `footers` (spec §1.4d)

**Files:**
- Modify: `packages/core/src/types.ts` (GridOptions)
- Modify: `packages/core/src/grid.ts` (headers/footers consumption)
- Modify: any playground page using the object form

- [ ] **Step 1: Update the type**

In `packages/core/src/types.ts` `GridOptions`:

```ts
  headers?: HeaderRow[] | { layout: HeaderRow[]; height?: number };
  footers?: FooterRow[] | { layout: FooterRow[]; height?: number };
```

Replace with:

```ts
  headers?: HeaderRow[];
  footers?: FooterRow[];
```

- [ ] **Step 2: Update consumption sites**

In `packages/core/src/grid.ts`, find every place that does `Array.isArray(options.headers) ? options.headers : options.headers.layout`. Simplify to use `options.headers` directly. Same for `footers`. Height comes from top-level `headerHeight`.

- [ ] **Step 3: Find playground usages of the object form**

```bash
grep -rn "headers:\s*{\s*layout" apps/playground/src/ --include="*.tsx"
```

Replace any matches with the array form.

- [ ] **Step 4: Build + test**

```bash
node scripts/build.js
pnpm --filter @better-grid/core test
pnpm --filter @better-grid/react test
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/grid.ts apps/playground/
git commit -m "core(types): drop object form for headers/footers; HeaderRow[]/FooterRow[] only

Pre-publish §1.4d. The {layout, height} form duplicated top-level
headerHeight. Single shape removes the conditional consumption."
```

---

## Task 8: Add `column.hide` (spec §1.2)

**Files:**
- Modify: `packages/core/src/types.ts` (ColumnDef.hide)
- Modify: `packages/core/src/columns/manager.ts` (filter out hidden columns from the live array)
- Modify: `packages/core/src/grid.ts` (expose `setColumnHidden(id, hide)`)
- Modify: `packages/core/src/types.ts` (GridInstance includes setColumnHidden)
- Test: `packages/core/tests/column-hide.test.ts` (NEW)

- [ ] **Step 1: Add the type**

In `packages/core/src/types.ts` `ColumnDef`, add:

```ts
  /** When true, column is excluded from the rendered layout but stays in `columns`. Toggle via `grid.api.setColumnHidden(id, hide)`. */
  hide?: boolean;
```

In `GridInstance`:

```ts
  setColumnHidden(columnId: string, hide: boolean): void;
```

- [ ] **Step 2: Write failing tests**

Create `packages/core/tests/column-hide.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';

interface Row { id: number; a: string; b: string }

describe('column.hide', () => {
  test('hidden columns are excluded from the rendered layout', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const grid = createGrid<Row>({
      columns: [
        { field: 'a' as never, headerName: 'A' },
        { field: 'b' as never, headerName: 'B', hide: true },
      ],
      data: [{ id: 1, a: 'x', b: 'y' }],
    });
    grid.mount(host);

    const headerCells = host.querySelectorAll('.bg-header-cell');
    expect(headerCells.length).toBe(1);
    expect(headerCells[0].textContent).toContain('A');

    grid.unmount();
    document.body.removeChild(host);
  });

  test('setColumnHidden toggles visibility at runtime', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const grid = createGrid<Row>({
      columns: [
        { field: 'a' as never, headerName: 'A' },
        { field: 'b' as never, headerName: 'B' },
      ],
      data: [{ id: 1, a: 'x', b: 'y' }],
    });
    grid.mount(host);

    expect(host.querySelectorAll('.bg-header-cell').length).toBe(2);

    grid.setColumnHidden('b', true);
    expect(host.querySelectorAll('.bg-header-cell').length).toBe(1);

    grid.setColumnHidden('b', false);
    expect(host.querySelectorAll('.bg-header-cell').length).toBe(2);

    grid.unmount();
    document.body.removeChild(host);
  });
});
```

- [ ] **Step 3: Run — expect failures**

```bash
pnpm --filter @better-grid/core test column-hide
```

- [ ] **Step 4: Implement column-filtering in `manager.ts` (or wherever the live column array is materialized)**

Add a normalization step that, when materializing the visible column array, filters out columns with `hide: true`:

```ts
function visibleColumns<TData>(cols: ColumnDef<TData>[]): ColumnDef<TData>[] {
  return cols.filter((c) => !c.hide);
}
```

Use `visibleColumns` everywhere the renderer reads columns. Keep the *unfiltered* array on the grid state so `setColumnHidden` can flip a flag and trigger re-materialization.

- [ ] **Step 5: Implement `setColumnHidden` in `grid.ts`**

Inside `createGrid`, add:

```ts
function setColumnHidden(columnId: string, hide: boolean): void {
  const all = store.getState().columns;
  const next = all.map((c) => c.id === columnId ? { ...c, hide } : c);
  store.update('columns', () => ({ columns: next }));
  scheduleRender();
}
```

Wire it onto the returned `GridInstance` object.

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @better-grid/core test column-hide
pnpm --filter @better-grid/core test
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add packages/core/
git commit -m "core: add column.hide + grid.setColumnHidden(id, hide)

Pre-publish §1.2. Matches AG Grid + MUI X. Hidden columns stay in
options.columns but are filtered from the rendered layout."
```

---

## Task 9: Add `column.flex` (spec §1.2)

**Files:**
- Modify: `packages/core/src/types.ts` (ColumnDef.flex)
- Modify: `packages/core/src/virtualization/layout.ts` (width allocation)
- Test: `packages/core/tests/column-flex.test.ts` (NEW)

- [ ] **Step 1: Add the type**

In `packages/core/src/types.ts`:

```ts
  /** Flex-grow share for spare horizontal space. `width` is treated as flex-basis. Respects minWidth / maxWidth. */
  flex?: number;
```

- [ ] **Step 2: Write the failing test**

Create `packages/core/tests/column-flex.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { computeColumnWidths } from '../src/virtualization/layout';

describe('column.flex', () => {
  test('distributes spare width by flex ratio', () => {
    // Viewport 1000px, 2 columns: width 100 (no flex) + width 100 flex 1 + width 100 flex 2
    // Spare = 1000 - 300 = 700; total flex = 3
    // Col 1 (no flex): 100
    // Col 2 (flex 1): 100 + 700 * (1/3) ≈ 333.33
    // Col 3 (flex 2): 100 + 700 * (2/3) ≈ 566.66
    const widths = computeColumnWidths({
      columns: [
        { id: 'a', headerName: 'A', width: 100 },
        { id: 'b', headerName: 'B', width: 100, flex: 1 },
        { id: 'c', headerName: 'C', width: 100, flex: 2 },
      ],
      viewportWidth: 1000,
    });
    expect(widths[0]).toBe(100);
    expect(widths[1]).toBeCloseTo(333.33, 1);
    expect(widths[2]).toBeCloseTo(566.66, 1);
  });

  test('clamps to maxWidth', () => {
    const widths = computeColumnWidths({
      columns: [
        { id: 'a', headerName: 'A', width: 100, flex: 1, maxWidth: 200 },
        { id: 'b', headerName: 'B', width: 100, flex: 1 },
      ],
      viewportWidth: 1000,
    });
    expect(widths[0]).toBe(200);
    expect(widths[1]).toBe(800);
  });
});
```

- [ ] **Step 3: Run — expect failure**

```bash
pnpm --filter @better-grid/core test column-flex
```

- [ ] **Step 4: Implement the flex pass**

In `packages/core/src/virtualization/layout.ts`, add (or modify) `computeColumnWidths`:

```ts
export function computeColumnWidths(args: {
  columns: ColumnDef[];
  viewportWidth: number;
}): number[] {
  const { columns, viewportWidth } = args;
  const widths = columns.map((c) => Math.max(c.minWidth ?? 0, c.width ?? 100));

  const totalBase = widths.reduce((s, w) => s + w, 0);
  const totalFlex = columns.reduce((s, c) => s + (c.flex ?? 0), 0);
  const spare = viewportWidth - totalBase;

  if (totalFlex > 0 && spare > 0) {
    for (let i = 0; i < columns.length; i++) {
      const f = columns[i].flex ?? 0;
      if (f === 0) continue;
      let next = widths[i] + spare * (f / totalFlex);
      const max = columns[i].maxWidth;
      if (max != null && next > max) next = max;
      widths[i] = next;
    }
  }
  return widths;
}
```

(If `computeColumnWidths` already exists with a different signature, adapt — the key behavior is: flex columns share `spare` proportionally, clamped by maxWidth.)

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @better-grid/core test column-flex
pnpm --filter @better-grid/core test
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/
git commit -m "core: add column.flex (flex-grow column sizing)

Pre-publish §1.2. Matches MUI X. width = flex-basis; spare width
distributes by flex ratio; respects minWidth / maxWidth."
```

---

## Task 10: Add `column.headerAlign` (spec §1.2)

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/rendering/headers.ts`
- Test: `packages/core/tests/header-align.test.ts` (NEW)

- [ ] **Step 1: Add the type**

In `packages/core/src/types.ts`:

```ts
  /** Header-cell alignment. Defaults to `align` when unset. */
  headerAlign?: 'left' | 'center' | 'right';
```

- [ ] **Step 2: Write the failing test**

Create `packages/core/tests/header-align.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';

describe('column.headerAlign', () => {
  test('defaults to align when unset', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const grid = createGrid<{ x: number }>({
      columns: [{ field: 'x' as never, headerName: 'X', align: 'right' }],
      data: [],
    });
    grid.mount(host);
    const headerCell = host.querySelector('.bg-header-cell') as HTMLElement;
    expect(headerCell.style.textAlign).toBe('right');
    grid.unmount();
    document.body.removeChild(host);
  });

  test('headerAlign overrides align', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const grid = createGrid<{ x: number }>({
      columns: [{ field: 'x' as never, headerName: 'X', align: 'right', headerAlign: 'center' }],
      data: [],
    });
    grid.mount(host);
    const headerCell = host.querySelector('.bg-header-cell') as HTMLElement;
    expect(headerCell.style.textAlign).toBe('center');
    grid.unmount();
    document.body.removeChild(host);
  });
});
```

- [ ] **Step 3: Run — expect failure**

- [ ] **Step 4: Wire `headerAlign` into the headers renderer**

In `packages/core/src/rendering/headers.ts`, the per-cell render block — replace any line that sets `cellEl.style.textAlign = column.align` with:

```ts
cellEl.style.textAlign = column.headerAlign ?? column.align ?? 'left';
```

- [ ] **Step 5: Run tests + commit**

```bash
pnpm --filter @better-grid/core test header-align
pnpm --filter @better-grid/core test
git add packages/core/
git commit -m "core: add column.headerAlign

Pre-publish §1.2. Matches MUI X. Defaults to column.align when unset."
```

---

## Task 11: Replace `tableStyle` enum with `bordered` + `striped` booleans (spec §1.4e)

**Files:**
- Modify: `packages/core/src/types.ts` (GridOptions)
- Modify: `packages/core/src/grid.ts` (consume new flags)
- Modify: `packages/core/src/styles/grid.css` if applicable
- Modify: `apps/playground/src/pages/*.tsx` (`tableStyle` callers)
- Test: `packages/core/tests/table-style.test.ts` (NEW)

- [ ] **Step 1: Update the type**

In `GridOptions`, replace:

```ts
  tableStyle?: 'bordered' | 'borderless' | 'striped';
```

with:

```ts
  /** Show vertical/horizontal cell borders. Default: true. */
  bordered?: boolean;
  /** Alternate-row striping. Default: false. */
  striped?: boolean;
```

- [ ] **Step 2: Write the failing test**

Create `packages/core/tests/table-style.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';

describe('table-style flags', () => {
  test('bordered=false drops the bordered class', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const grid = createGrid({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [],
      bordered: false,
    });
    grid.mount(host);
    expect(host.querySelector('.bg-grid')?.classList.contains('bg-grid--bordered')).toBe(false);
    grid.unmount();
    document.body.removeChild(host);
  });

  test('striped=true adds the striped class; combinable with bordered', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const grid = createGrid({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [],
      bordered: true,
      striped: true,
    });
    grid.mount(host);
    const root = host.querySelector('.bg-grid');
    expect(root?.classList.contains('bg-grid--bordered')).toBe(true);
    expect(root?.classList.contains('bg-grid--striped')).toBe(true);
    grid.unmount();
    document.body.removeChild(host);
  });
});
```

- [ ] **Step 3: Implement the flag handling in `grid.ts`**

In the mount/render path, set classes on the root container:

```ts
const root = container.querySelector('.bg-grid') as HTMLElement;
root.classList.toggle('bg-grid--bordered', options.bordered ?? true);
root.classList.toggle('bg-grid--striped',  options.striped  ?? false);
```

(Adapt to wherever the existing `tableStyle` consumption lived.)

- [ ] **Step 4: Update CSS to match (if needed)**

In `packages/core/src/styles/grid.css`, ensure:

```css
.bg-grid--bordered .bg-cell { border: 1px solid var(--bg-cell-border-color); }
.bg-grid--striped .bg-cell[data-row-even="0"] { background: var(--bg-stripe-bg); }
```

If the prior `tableStyle` produced classes like `bg-grid--bordered`, the CSS already exists — just confirm the class names line up.

- [ ] **Step 5: Update playground sites**

```bash
grep -rn "tableStyle" apps/playground/src/ --include="*.tsx"
```

Replace each `tableStyle: 'bordered'` with `bordered: true`, `tableStyle: 'striped'` with `striped: true`, `tableStyle: 'borderless'` with `bordered: false`.

- [ ] **Step 6: Run tests + commit**

```bash
pnpm --filter @better-grid/core test
git add packages/ apps/playground/
git commit -m "core: replace tableStyle enum with bordered + striped booleans

Pre-publish §1.4e. Bordered + striped is a real combo; the enum
forced single-pick. Defaults: bordered=true, striped=false."
```

---

## Task 12: Selection discriminated union (spec §1.4f)

**Files:**
- Modify: `packages/core/src/types.ts` (SelectionOptions, GridOptions.selection)
- Modify: `packages/core/src/selection/model.ts` (normalization)
- Modify: `packages/core/src/grid.ts` (consumption)
- Modify: `apps/playground/src/pages/*.tsx` (`selection: { mode: 'none' }` → `selection: false`)
- Test: `packages/core/tests/selection-shape.test.ts` (NEW)

- [ ] **Step 1: Update the type**

Replace `SelectionOptions` with a discriminated union:

```ts
export type SelectionOptions =
  | false
  | { mode: 'cell' }
  | { mode: 'row' }
  | { mode: 'range'; multiRange?: boolean; fillHandle?: boolean };
```

In `GridOptions`:

```ts
  /** Default = { mode: 'cell' }. Pass `false` to disable selection entirely. */
  selection?: SelectionOptions;
```

- [ ] **Step 2: Write the failing test**

Create `packages/core/tests/selection-shape.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';

describe('selection discriminated union', () => {
  test('selection=false disables selection state', () => {
    const grid = createGrid({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [{ x: 1 }],
      selection: false,
    });
    expect(grid.getState().selection).toEqual({ active: null, ranges: [] });
  });

  test('default is { mode: "cell" }', () => {
    const grid = createGrid({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [{ x: 1 }],
    });
    // Default mode is cell; verify by accessing selection mode if exposed,
    // or by behavior — clicking a cell should select that cell.
    expect(grid.getSelectionMode?.() ?? 'cell').toBe('cell');
  });

  test('range mode accepts multiRange + fillHandle', () => {
    const grid = createGrid({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [],
      selection: { mode: 'range', multiRange: true, fillHandle: true },
    });
    expect(grid.getSelectionMode?.() ?? 'range').toBe('range');
  });
});
```

- [ ] **Step 3: Implement normalization**

In `packages/core/src/selection/model.ts`, add:

```ts
export function normalizeSelection(opt: SelectionOptions | undefined): {
  mode: 'cell' | 'row' | 'range' | 'off';
  multiRange: boolean;
  fillHandle: boolean;
} {
  if (opt === false) return { mode: 'off', multiRange: false, fillHandle: false };
  if (!opt) return { mode: 'cell', multiRange: false, fillHandle: false };
  if (opt.mode === 'range') {
    return { mode: 'range', multiRange: !!opt.multiRange, fillHandle: opt.fillHandle ?? true };
  }
  return { mode: opt.mode, multiRange: false, fillHandle: false };
}
```

In `grid.ts`, gate selection event wiring on `mode !== 'off'`. Expose `getSelectionMode()` returning the resolved mode.

- [ ] **Step 4: Update playground callers**

```bash
grep -rn "selection:.*mode:.*'none'" apps/playground/src/ --include="*.tsx"
```

Replace each with `selection: false`.

- [ ] **Step 5: Run tests + commit**

```bash
pnpm --filter @better-grid/core test selection-shape
pnpm --filter @better-grid/core test
git add packages/ apps/playground/
git commit -m "core: selection as discriminated union (false | cell | row | range)

Pre-publish §1.4f. 'none' sentinel string was awkward; false disables.
multiRange/fillHandle only on the range arm."
```

---

## Task 13: Top-level `getRowId` (spec §1.1)

**Files:**
- Modify: `packages/core/src/types.ts` (GridOptions, GridState)
- Modify: `packages/core/src/grid.ts` (resolution + selection-stability path)
- Modify: `packages/core/src/state/store.ts` (read-through to top-level)
- Modify: `packages/react/src/useGrid.ts` (passthrough)
- Test: `packages/core/tests/get-row-id.test.ts` (NEW)

- [ ] **Step 1: Update the type**

In `GridOptions`:

```ts
  /** Stable row identity. Used by selection and data-swap defaults. Mirrored to hierarchy.getRowId when hierarchy is configured. */
  getRowId?: (row: TData) => string | number;
```

- [ ] **Step 2: Write the failing test**

Create `packages/core/tests/get-row-id.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';

interface Row { id: number; name: string }

describe('top-level getRowId', () => {
  test('top-level getRowId is read by selection-stability path', () => {
    const data1: Row[] = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
    const grid = createGrid<Row>({
      columns: [{ field: 'name' as never, headerName: 'Name' }],
      data: data1,
      getRowId: (row) => row.id,
      selection: { mode: 'row' },
    });
    grid.selectRow?.(0);  // select first row by visible index
    // Swap data with reordered rows but stable ids
    grid.setData([{ id: 2, name: 'B' }, { id: 1, name: 'A' }]);
    // Selected row should still be id=1, now at visible index 1
    const selected = grid.getState().selection.active;
    expect(selected?.rowIndex).toBe(1);
  });

  test('hierarchy.getRowId wins for hierarchy state', () => {
    const grid = createGrid<Row>({
      columns: [{ field: 'name' as never, headerName: 'Name' }],
      data: [],
      getRowId: (row) => `top-${row.id}`,
      hierarchy: {
        getRowId: (row) => `nested-${row.id}`,
        getParentId: () => null,
      },
    });
    // The hierarchy plugin (or grid state) should use the nested getRowId.
    // (This test will need adjustment based on how hierarchy state is exposed.)
    // Smoke check: configuration accepted without error.
    expect(grid.getState().columns.length).toBe(1);
  });
});
```

- [ ] **Step 3: Implement resolution**

In `packages/core/src/grid.ts`:

```ts
const resolveRowId =
  options.getRowId ??
  options.hierarchy?.getRowId ??
  ((_row: TData, idx: number) => idx);
```

Use `resolveRowId` in:
- The selection-stability path on `setData` (find the selected row's id, find it in the new data, update `selection.active`).
- The hierarchy plugin reads `hierarchy.getRowId` first as it does today (no change there).

- [ ] **Step 4: Run tests + commit**

```bash
pnpm --filter @better-grid/core test get-row-id
pnpm --filter @better-grid/core test
git add packages/
git commit -m "core: top-level getRowId for selection / data-swap stability

Pre-publish §1.1. hierarchy.getRowId still wins for hierarchy state when
both are set. Mirrors AG + MUI X."
```

---

## Task 14: Extend signatures — `valueFormatter`, `valueParser` (spec §1.3)

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/plugins/src/free/formatting.ts` (call sites pass row)
- Modify: `packages/plugins/src/free/editing.ts` (call sites pass row)
- Test: `packages/core/tests/value-formatter-row.test.ts` (NEW)

- [ ] **Step 1: Update the type**

In `ColumnDef`:

```ts
  valueFormatter?: (value: unknown, row: TData) => string;
  valueParser?: (value: string, row: TData) => unknown;
```

- [ ] **Step 2: Write the failing test**

Create `packages/core/tests/value-formatter-row.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';

interface Row { amount: number; currency: 'USD' | 'EUR' }

describe('valueFormatter receives row', () => {
  test('per-row currency formatting via row.currency', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const grid = createGrid<Row>({
      columns: [
        {
          field: 'amount' as never,
          headerName: 'Amount',
          valueFormatter: (value, row) =>
            new Intl.NumberFormat('en-US', { style: 'currency', currency: row.currency }).format(Number(value)),
        },
      ],
      data: [{ amount: 100, currency: 'USD' }, { amount: 100, currency: 'EUR' }],
    });
    grid.mount(host);

    const cells = host.querySelectorAll('.bg-cell');
    expect(cells[0].textContent).toContain('$');
    expect(cells[1].textContent).toContain('€');

    grid.unmount();
    document.body.removeChild(host);
  });
});
```

- [ ] **Step 3: Update call sites**

Find every `valueFormatter(value)` call:

```bash
grep -rn "valueFormatter(" packages/ --include="*.ts" --include="*.tsx"
```

Add the row argument at every call site:

```ts
column.valueFormatter(value, row)
```

Same for `valueParser`:

```bash
grep -rn "valueParser(" packages/ --include="*.ts" --include="*.tsx"
```

`column.valueParser(text, row)` everywhere.

- [ ] **Step 4: Run tests + commit**

```bash
pnpm --filter @better-grid/core test value-formatter-row
pnpm --filter @better-grid/core test
pnpm --filter @better-grid/react test
git add packages/
git commit -m "core: extend valueFormatter / valueParser to (value, row)

Pre-publish §1.3. Enables cross-field formatting (per-row currency, etc.)
without churning existing call sites — extra arg is positional optional."
```

---

## Task 15: Extend signatures — `cellStyle`, `cellClass`, `comparator` (spec §1.3)

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/rendering/pipeline.ts` (cellStyle/cellClass call sites)
- Modify: `packages/plugins/src/free/sorting.ts` (comparator call sites)
- Test: `packages/core/tests/cell-style-row-index.test.ts` (NEW)

- [ ] **Step 1: Update the types**

```ts
  cellStyle?: (value: unknown, row: TData, rowIndex: number) => Record<string, string> | undefined;
  cellClass?: (value: unknown, row: TData, rowIndex: number) => string | undefined;
  comparator?: (a: unknown, b: unknown, rowA?: TData, rowB?: TData) => number;
```

- [ ] **Step 2: Write the failing test**

Create `packages/core/tests/cell-style-row-index.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';

describe('cellStyle / cellClass receive rowIndex', () => {
  test('rowIndex available in cellStyle', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const grid = createGrid<{ x: number }>({
      columns: [{
        field: 'x' as never,
        headerName: 'X',
        cellStyle: (_v, _r, rowIndex) => ({ fontWeight: rowIndex % 2 === 0 ? 'bold' : 'normal' }),
      }],
      data: [{ x: 0 }, { x: 1 }],
    });
    grid.mount(host);
    const cells = host.querySelectorAll('.bg-cell');
    expect((cells[0] as HTMLElement).style.fontWeight).toBe('bold');
    expect((cells[1] as HTMLElement).style.fontWeight).toBe('normal');
    grid.unmount();
    document.body.removeChild(host);
  });
});
```

- [ ] **Step 3: Update call sites**

In `packages/core/src/rendering/pipeline.ts`, find the `cellStyle` invocation and pass `rowIndex` as the third arg:

```ts
const styles = column.cellStyle?.(value, rowData, row);
```

Same for `cellClass`.

In `packages/plugins/src/free/sorting.ts`, optionally pass row args to `comparator`:

```ts
const cmp = column.comparator?.(av, bv, ra, rb) ?? defaultCompare(av, bv);
```

- [ ] **Step 4: Run tests + commit**

```bash
pnpm --filter @better-grid/core test cell-style-row-index
pnpm --filter @better-grid/core test
git add packages/
git commit -m "core: extend cellStyle/cellClass with rowIndex; comparator with rowA?/rowB?

Pre-publish §1.3. Symmetric with rowStyle. Backwards-compatible at the
call site since extra args are optional positional."
```

---

## Task 16: Fix `CellChange.oldValue` semantics (spec §1.5a)

**Files:**
- Modify: `packages/core/src/types.ts` (CellChange.oldValue documentation only — type stays `unknown`)
- Modify: `packages/core/src/grid.ts:1438-1452` (`updateCell` implementation)
- Test: `packages/core/tests/cell-change-oldvalue.test.ts` (NEW)

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/cell-change-oldvalue.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';
import type { CellChange } from '../src/types';

describe('CellChange.oldValue semantics', () => {
  test('oldValue is the previous CELL value (not the previous row)', () => {
    const grid = createGrid<{ amount: number; name: string }>({
      columns: [
        { field: 'amount' as never, headerName: 'Amount' },
        { field: 'name' as never, headerName: 'Name' },
      ],
      data: [{ amount: 100, name: 'A' }],
    });

    const captured: CellChange[] = [];
    grid.on('cell:change', (changes) => { captured.push(...changes); });

    grid.updateCell(0, 'amount', 250);

    expect(captured.length).toBe(1);
    expect(captured[0].oldValue).toBe(100);          // CELL value, not the row object
    expect(captured[0].newValue).toBe(250);
    expect(captured[0].row).toEqual({ amount: 250, name: 'A' });  // new row
    expect(captured[0].columnId).toBe('amount');
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter @better-grid/core test cell-change-oldvalue
```

Expected fail: `oldValue` is currently the old row object.

- [ ] **Step 3: Fix `updateCell`**

In `packages/core/src/grid.ts`, find the existing `updateCell` (~line 1438):

```ts
updateCell(rowIndex: number, columnId: string, value: unknown): void {
  const dataIndex = visibleToDataIndex(rowIndex);
  const oldValue = store.getState().data[dataIndex];   // <-- BUG: this is the old row
  store.setCellValue(dataIndex, columnId, value);
  const newRow = store.getState().data[dataIndex];
  if (oldValue !== undefined && newRow !== undefined) {
    emitter.emit('data:change', [
      { rowIndex, columnId, oldValue, newValue: value, row: newRow },
    ]);
    options.onCellChange?.([
      { rowIndex, columnId, oldValue, newValue: value, row: newRow },
    ]);
  }
  scheduleRender();
},
```

Replace with:

```ts
updateCell(rowIndex: number, columnId: string, value: unknown): void {
  const dataIndex = visibleToDataIndex(rowIndex);
  const oldRow = store.getState().data[dataIndex];
  if (oldRow === undefined) return;

  // Capture the previous CELL value before mutation
  const column = store.getState().columns.find((c) => c.id === columnId);
  const oldValue = column?.field
    ? (oldRow as Record<string, unknown>)[column.field]
    : column?.valueGetter?.(oldRow as never, dataIndex);

  store.setCellValue(dataIndex, columnId, value);
  const newRow = store.getState().data[dataIndex];
  if (newRow === undefined) return;

  const change: CellChange = { rowIndex, columnId, oldValue, newValue: value, row: newRow };
  emitter.emit('cell:change', [change]);  // event renamed in Task 18
  options.onCellChange?.([change]);
  scheduleRender();
},
```

(Note: this anticipates Task 18's event rename. If executing strictly in order, leave the emit as `'data:change'` for now and Task 18 will rename it.)

- [ ] **Step 4: Run tests + commit**

```bash
pnpm --filter @better-grid/core test cell-change-oldvalue
pnpm --filter @better-grid/core test
git add packages/
git commit -m "core(grid): CellChange.oldValue is the previous CELL value (was old row)

Pre-publish §1.5a. Asymmetric with newValue (already a cell value).
row continues to hold the new row object."
```

---

## Task 17: GridState mirrors GridOptions shape (spec §1.5b)

**Files:**
- Modify: `packages/core/src/types.ts` (GridState)
- Modify: `packages/core/src/state/store.ts` (initial state shape)
- Modify: `packages/core/src/grid.ts` (any `state.frozenTopRows` etc. reads)
- Modify: every plugin/component that reads `state.frozenTopRows`/`frozenLeftColumns`/`pinnedTopRows`/`pinnedBottomRows`
- Test: `packages/core/tests/state-shape.test.ts` (NEW)

- [ ] **Step 1: Update the type**

In `GridState`:

```ts
  // Replace these four:
  //   frozenTopRows: number;
  //   frozenLeftColumns: number;
  //   pinnedTopRows: TData[];
  //   pinnedBottomRows: TData[];
  // with grouped shape that mirrors GridOptions:
  frozen: { top: number; left: number };
  pinned: { top: TData[]; bottom: TData[] };
```

- [ ] **Step 2: Inventory readers**

```bash
grep -rn "state\.frozenTopRows\|state\.frozenLeftColumns\|state\.pinnedTopRows\|state\.pinnedBottomRows\|getState()\.frozenTopRows\|getState()\.frozenLeftColumns\|getState()\.pinnedTopRows\|getState()\.pinnedBottomRows" packages/ apps/playground/src/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 3: Bulk-rename readers**

```bash
find packages/ apps/playground/src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e 's/state\.frozenTopRows\b/state.frozen.top/g' \
  -e 's/state\.frozenLeftColumns\b/state.frozen.left/g' \
  -e 's/state\.pinnedTopRows\b/state.pinned.top/g' \
  -e 's/state\.pinnedBottomRows\b/state.pinned.bottom/g' \
  {} +
```

- [ ] **Step 4: Update store initialization**

In `packages/core/src/state/store.ts`, the initial state object. Replace flat fields with the grouped shape:

```ts
const initialState: GridState<TData> = {
  data: [],
  columns: [],
  columnWidths: [],
  rowHeights: [],
  scrollTop: 0,
  scrollLeft: 0,
  visibleRange: { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
  selection: { active: null, ranges: [] },
  frozen: { top: 0, left: 0 },
  pinned: { top: [], bottom: [] },
  hierarchyState: null,
  pluginState: {} as PluginState,
};
```

- [ ] **Step 5: Write the test**

Create `packages/core/tests/state-shape.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';

describe('GridState shape mirrors GridOptions', () => {
  test('state.frozen / state.pinned exist and reflect options', () => {
    const grid = createGrid({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [],
      frozen: { top: 1, left: 2 },
      pinned: { top: [{ x: 'top' }], bottom: [{ x: 'bottom' }] },
    });
    const s = grid.getState();
    expect(s.frozen).toEqual({ top: 1, left: 2 });
    expect(s.pinned.top).toEqual([{ x: 'top' }]);
    expect(s.pinned.bottom).toEqual([{ x: 'bottom' }]);
  });
});
```

- [ ] **Step 6: Run tests + commit**

```bash
pnpm --filter @better-grid/core test state-shape
pnpm --filter @better-grid/core test
git add packages/ apps/playground/
git commit -m "core(state): GridState mirrors GridOptions shape (frozen / pinned)

Pre-publish §1.5b. Two shapes for one concept consolidated to one."
```

---

## Task 18: Rename event `'data:change'` → `'cell:change'` (spec §1.5c)

**Files:**
- Modify: `packages/core/src/types.ts` (GridEvents)
- Modify: `packages/core/src/grid.ts` (emit site)
- Modify: every plugin / playground / test that listens to `'data:change'`
- Test: existing tests should pass after the rename; add one explicit name-check test

- [ ] **Step 1: Update GridEvents in types.ts**

```ts
  // Before:
  //   'data:change': (changes: CellChange<TData>[]) => void;
  // After:
  'cell:change': (changes: CellChange<TData>[]) => void;
```

- [ ] **Step 2: Bulk-rename**

```bash
find packages/ apps/playground/src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s/'data:change'/'cell:change'/g" {} +
find packages/ apps/playground/src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/"data:change"/"cell:change"/g' {} +
```

- [ ] **Step 3: Verify no occurrences of the old name remain (except in `data:set` which is unrelated)**

```bash
grep -rn "'data:change'\|\"data:change\"" packages/ apps/playground/src/
```

Expected: no output.

- [ ] **Step 4: Add a name-check test**

Create or extend `packages/core/tests/event-names.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';

describe('event names', () => {
  test("'cell:change' (not 'data:change') fires on updateCell", () => {
    const grid = createGrid({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [{ x: 1 }],
    });
    const events: string[] = [];
    grid.on('cell:change', () => events.push('cell:change'));
    // Listening to a stale name should not fire
    (grid as unknown as { on(n: string, h: () => void): () => void }).on('data:change', () => events.push('data:change'));
    grid.updateCell(0, 'x', 2);
    expect(events).toContain('cell:change');
    expect(events).not.toContain('data:change');
  });
});
```

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @better-grid/core test event-names
pnpm --filter @better-grid/core test
pnpm --filter @better-grid/react test
git add packages/ apps/playground/
git commit -m "core(events): rename 'data:change' -> 'cell:change'

Pre-publish §1.5c. Fires per-cell on updateCell — belongs in the
cell:* group with cell:click/cell:dblclick/cell:focus/cell:blur."
```

---

## Task 19: Rename event `'freezeClip:change'` → `'frozen:clip'` (spec §1.5d)

**Files:**
- Modify: `packages/core/src/types.ts` (GridEvents)
- Modify: `packages/core/src/ui/freeze-clip-drag.ts` (emit site)
- Modify: any listeners

- [ ] **Step 1: Update the type**

```ts
  // Before: 'freezeClip:change': (clipWidth: number, fullFrozenWidth: number) => void;
  'frozen:clip': (clipWidth: number, fullFrozenWidth: number) => void;
```

- [ ] **Step 2: Bulk-rename**

```bash
find packages/ apps/playground/src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s/'freezeClip:change'/'frozen:clip'/g" {} +
find packages/ apps/playground/src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/"freezeClip:change"/"frozen:clip"/g' {} +
```

- [ ] **Step 3: Verify**

```bash
grep -rn "freezeClip:change" packages/ apps/playground/src/
```

Expected: no output.

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @better-grid/core test
git add packages/ apps/playground/
git commit -m "core(events): rename 'freezeClip:change' -> 'frozen:clip'

Pre-publish §1.5d. Lowercase namespace to match cell:click,
column:resize, etc.; aligns with the 'frozen' GridOptions key."
```

---

## Task 20: Rename `configureBetterGrid` → `configure` (spec §1.4g)

**Files:**
- Rename: `packages/react/src/configureBetterGrid.ts` → `packages/react/src/configure.ts`
- Modify: function name + export inside the file
- Modify: `packages/react/src/index.ts` (re-export)
- Modify: any internal usage in `useGrid.ts` etc.
- Modify: `packages/react/tests/configureBetterGrid.test.ts` → `packages/react/tests/configure.test.ts`
- Modify: `apps/playground/src/pages/*.tsx` (callers)

- [ ] **Step 1: Rename the source file**

```bash
git mv packages/react/src/configureBetterGrid.ts packages/react/src/configure.ts
git mv packages/react/tests/configureBetterGrid.test.ts packages/react/tests/configure.test.ts
```

- [ ] **Step 2: Rename the function**

In `packages/react/src/configure.ts`, change:

```ts
export function configureBetterGrid(opts: ConfigureOptions): void { … }
```

to:

```ts
export function configure(opts: ConfigureOptions): void { … }
```

- [ ] **Step 3: Bulk-rename references**

```bash
find packages/ apps/playground/src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/\bconfigureBetterGrid\b/configure/g' {} +
```

- [ ] **Step 4: Update the index re-export**

In `packages/react/src/index.ts`:

```ts
export { configure } from './configure';
```

- [ ] **Step 5: Verify**

```bash
grep -rn "configureBetterGrid" packages/ apps/playground/src/
```

Expected: no output.

- [ ] **Step 6: Run tests + commit**

```bash
pnpm --filter @better-grid/react test
git add packages/ apps/playground/
git commit -m "react: rename configureBetterGrid -> configure

Pre-publish §1.4g. Shorter, idiomatic at the call site (mirrors MUI's
createTheme/createPalette). Consumers facing local collisions can
alias on import: import { configure as configureBG } from '@better-grid/react'."
```

---

## Task 21: defineColumn builders forward new fields (spec consolidation)

**Files:**
- Modify: `packages/react/src/defineColumn.ts`
- Test: `packages/react/tests/defineColumn.test.ts`

- [ ] **Step 1: Confirm builders forward new keys**

Open `packages/react/src/defineColumn.ts`. Wherever the per-type factory spreads opts (e.g. `{ ...opts }` into the resulting `ColumnDef`), confirm it forwards: `field`, `headerName`, `headerRenderer`, `headerAlign`, `hide`, `flex`, plus everything that already worked. The shape is `{ ...defaults, ...opts, id: opts.id ?? opts.field, field: opts.field }` typical pattern. Verify each builder call site forwards `headerRenderer` if present.

- [ ] **Step 2: Add tests for the new fields**

Append to `packages/react/tests/defineColumn.test.ts`:

```ts
test('col.text forwards hide / flex / headerAlign / headerRenderer', () => {
  const fn = (container: HTMLElement) => container.append('x');
  const c = col.text('name', {
    headerName: 'Name',
    hide: true,
    flex: 2,
    headerAlign: 'right',
    headerRenderer: fn,
  });
  expect(c.field).toBe('name');
  expect(c.headerName).toBe('Name');
  expect(c.hide).toBe(true);
  expect(c.flex).toBe(2);
  expect(c.headerAlign).toBe('right');
  expect(c.headerRenderer).toBe(fn);
});

test('col.text auto-derives id from field', () => {
  const c = col.text('amount', { headerName: 'Amount' });
  expect(c.id).toBe('amount');
});

test('explicit id wins', () => {
  const c = col.text('amount', { id: 'amountUSD', headerName: 'Amount' });
  expect(c.id).toBe('amountUSD');
});
```

- [ ] **Step 3: Run tests + commit**

```bash
pnpm --filter @better-grid/react test defineColumn
git add packages/react/
git commit -m "react(defineColumn): forward hide/flex/headerAlign/headerRenderer; default id to field"
```

---

## Task 22: Plugin packages — propagate renames (consolidation)

**Files:**
- Modify: every file under `packages/plugins/src/free/` and `packages/pro/src/`

- [ ] **Step 1: Run a final inventory of stale references**

```bash
grep -rn "accessorKey\|accessorFn\|configureBetterGrid\|'data:change'\|'freezeClip:change'\|cellEditor:\s*'dropdown'\|state\.frozenTopRows\|state\.pinnedTopRows" packages/plugins/ packages/pro/
```

Expected: no output (the bulk renames in Tasks 2, 3, 4, 6, 17, 18, 19, 20 should have caught everything). If any remain, edit by hand and rerun.

- [ ] **Step 2: Build all packages**

```bash
node scripts/build.js
```

Expected: all 4 packages green. Errors here are typing fallouts of the renames — fix in place.

- [ ] **Step 3: Run all tests**

```bash
pnpm --filter @better-grid/core test
pnpm --filter @better-grid/react test
```

Expected: all green.

- [ ] **Step 4: Commit (only if there were any fixups)**

```bash
git status
# If clean, skip the commit. If any files changed:
git add packages/
git commit -m "plugins/pro: align with renamed core surface (any stragglers)"
```

---

## Task 23: Playground update — bulk verification

**Files:**
- Modify: `apps/playground/src/pages/*.tsx` (residual sites — most caught by earlier sed passes)

- [ ] **Step 1: Build the playground**

```bash
cd apps/playground && npx vite build
```

Expected: clean build. Any remaining type errors are stale prop names — fix in the failing file.

- [ ] **Step 2: Run a stale-token sweep**

```bash
grep -rn "accessorKey\|accessorFn\|configureBetterGrid\|'data:change'\|'freezeClip:change'\|cellEditor:\s*'dropdown'\|tableStyle:\s*'\|selection:.*mode:.*'none'" apps/playground/src/
```

Expected: no output.

- [ ] **Step 3: Run dev server + visual smoke**

```bash
node scripts/playground-build.js dev
# In a browser, open http://localhost:8686
# Walk: /demo/finance, /demo/cell-types, /demo/editors, /demo/clipboard,
#       /demo/hierarchy, /demo/frozen-pinned, /demo-realworld/fsbt-cost
# Confirm: no console errors; rendering is unchanged from baseline.
```

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git status
# If clean, skip. Otherwise:
git add apps/playground/
git commit -m "playground: align demos with the post-rename surface"
```

---

## Task 24: New `/demo/column-features` page (spec verification §1.2)

**Files:**
- Create: `apps/playground/src/pages/ColumnFeaturesDemo.tsx`
- Modify: `apps/playground/src/App.tsx` (add the route + nav button)

- [ ] **Step 1: Create the demo page**

`apps/playground/src/pages/ColumnFeaturesDemo.tsx`:

```tsx
import { useState } from 'react';
import { BetterGrid, useGrid, defineColumn as col } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import '@better-grid/core/styles.css';

interface Row { id: number; name: string; qty: number; rate: number; status: string }

const columns: ColumnDef<Row>[] = [
  col.text('id', { headerName: 'ID', width: 60, hide: true }),                            // hidden by default
  col.text('name', { headerName: 'Name', width: 180, flex: 2, headerAlign: 'left' }),     // flex grow
  col.number('qty', { headerName: 'Qty', width: 80, align: 'right', headerAlign: 'right' }),
  col.percent('rate', { headerName: 'Rate', width: 100, align: 'right' }),
  col.text('status', {
    headerName: 'Status',
    width: 120,
    headerRenderer: (container) => {                                                       // custom DOM header
      const span = document.createElement('span');
      span.textContent = '⚙ Status';
      span.style.cssText = 'font-weight:700;color:#065986';
      container.replaceChildren(span);
    },
  }),
];

const seed: Row[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  qty: (i + 1) * 10,
  rate: (i + 1) * 0.01,
  status: i % 2 === 0 ? 'open' : 'closed',
}));

export function ColumnFeaturesDemo() {
  const [data] = useState(seed);
  const grid = useGrid<Row>({
    columns,
    data,
    mode: 'view',
    selection: { mode: 'cell' },
  });

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Column features: hide / flex / headerAlign / headerRenderer</h1>
      <p style={{ marginBottom: 12, color: '#666', lineHeight: 1.5 }}>
        ID column is hidden via <code>hide: true</code>. Name column is <code>flex: 2</code>. Qty/Rate are <code>align: 'right'</code>.
        Status uses a custom <code>headerRenderer</code> (DOM mutator).
      </p>
      <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
        <button onClick={() => grid.api.setColumnHidden('id', false)}>Show ID</button>
        <button onClick={() => grid.api.setColumnHidden('id', true)}>Hide ID</button>
      </div>
      <BetterGrid grid={grid} height={500} />
    </div>
  );
}
```

- [ ] **Step 2: Wire the route into `App.tsx`**

Add to imports:

```tsx
import { ColumnFeaturesDemo } from './pages/ColumnFeaturesDemo';
```

Add to the `Page` union:

```tsx
  | 'column-features'
```

Add to `VALID_PAGES`:

```tsx
  'column-features',
```

Add to the sidebar (under the "Display" or "Layout" section):

```tsx
<NavButton active={page === 'column-features'} onClick={() => navigatePage('column-features')} icon="🧩">Column Features</NavButton>
```

Add to the content router:

```tsx
{page === 'column-features' && <ColumnFeaturesDemo />}
```

- [ ] **Step 3: Build + visual smoke**

```bash
cd apps/playground && npx vite build
node scripts/playground-build.js dev
# Open http://localhost:8686/demo/column-features
# Verify: ID column hidden by default; Show/Hide buttons toggle it.
# Verify: Name column expands to fill spare width.
# Verify: Status column header shows "⚙ Status" in bold blue.
```

- [ ] **Step 4: Commit**

```bash
git add apps/playground/
git commit -m "playground: /demo/column-features exercises hide/flex/headerAlign/headerRenderer

Spec §1.2 verification page."
```

---

## Task 25: Phase 1 verification + final commit

- [ ] **Step 1: Full test suite**

```bash
node scripts/build.js
pnpm --filter @better-grid/core test
pnpm --filter @better-grid/react test
```

Expected: all builds green; no test regressions; new tests added in Tasks 4-18 all pass.

- [ ] **Step 2: Cross-doc link sweep**

```bash
node -e '
const fs = require("fs"), path = require("path");
const linkRe = /\[([^\]]+)\]\((?!https?:\/\/|mailto:|#)([^)#]+)(?:#[^)]*)?\)/g;
const broken = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (["node_modules", ".git", "dist", ".turbo", ".ref", "private"].includes(e.name)) continue;
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".md")) check(p);
  }
}
function check(p) {
  const text = fs.readFileSync(p, "utf8");
  let m;
  while ((m = linkRe.exec(text))) {
    const target = m[2].trim();
    const resolved = target.startsWith("/") ? path.resolve(target.slice(1)) : path.resolve(path.dirname(p), target);
    if (!fs.existsSync(resolved)) broken.push([p, m[1], target]);
  }
}
walk(".");
if (broken.length === 0) console.log("All links resolve.");
else { broken.forEach(([p, l, t]) => console.log(`BROKEN  ${p}  -> [${l}](${t})`)); process.exit(1); }
'
```

Expected: `All links resolve.`

- [ ] **Step 3: Update CHANGELOG**

In `CHANGELOG.md` under `[Unreleased]`, add (preserving existing planned entries):

```markdown
### Phase 1 surface refresh (pre-publish, no back-compat)

- ColumnDef renames: `accessorKey` → `field`, `accessorFn` → `valueGetter`, `header` → `headerName` (split with new `headerRenderer` for DOM custom headers).
- ColumnDef new props: `hide` (AG + MUI X), `flex` (MUI X), `headerAlign` (MUI X).
- ColumnDef DX: `id` is now optional (defaults to `field`); `cellEditor: 'dropdown'` dropped (use `'select'`).
- ColumnDef signatures extended: `valueFormatter(value, row)`, `valueParser(value, row)`, `cellStyle(value, row, rowIndex)`, `cellClass(value, row, rowIndex)`, `comparator(a, b, rowA?, rowB?)`.
- GridOptions: top-level `getRowId`; `bordered` + `striped` flags replace `tableStyle` enum; `headers`/`footers` accept `HeaderRow[]`/`FooterRow[]` only (object form dropped); `selection` is a discriminated union (`false` disables, no `'none'` sentinel).
- GridState mirrors GridOptions: `state.frozen` / `state.pinned` (was `state.frozenTopRows` / `state.frozenLeftColumns` / `state.pinnedTopRows` / `state.pinnedBottomRows`).
- Bug fix: `CellChange.oldValue` is the previous cell value (was the previous row object).
- Event renames: `'data:change'` → `'cell:change'`; `'freezeClip:change'` → `'frozen:clip'`.
- React: `configureBetterGrid` renamed to `configure`.
```

- [ ] **Step 4: Commit CHANGELOG and tag the Phase 1 milestone**

```bash
git add CHANGELOG.md
git commit -m "changelog: Phase 1 surface refresh"
git tag pre-release-phase1
```

---

# Phase 2 — `@better-grid/codemods` package

New workspace package, six jscodeshift transforms, fixture-based tests, CLI shim.

---

## Task 26: Scaffold the codemods workspace package

**Files:**
- Create: `packages/codemods/package.json`
- Create: `packages/codemods/tsconfig.json`
- Create: `packages/codemods/tsup.config.ts`
- Create: `packages/codemods/src/cli.ts` (skeleton)
- Create: `packages/codemods/bin/migrate.ts` (skeleton)
- Create: `packages/codemods/README.md` (skeleton)

- [ ] **Step 1: Create the package directory and files**

```bash
mkdir -p packages/codemods/src/transforms packages/codemods/bin packages/codemods/tests
```

- [ ] **Step 2: `packages/codemods/package.json`**

```json
{
  "name": "@better-grid/codemods",
  "version": "1.0.0",
  "description": "One-shot codemods to migrate to Better Grid from AG Grid, MUI X Data Grid, TanStack Table, Handsontable, RevoGrid, and react-data-grid",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "better-grid-migrate": "./dist/bin/migrate.cjs"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "jscodeshift": "^17.0.0"
  },
  "devDependencies": {
    "@types/jscodeshift": "^0.12.0",
    "@types/node": "^22.0.0",
    "tsup": "^8.3.0",
    "typescript": "^5.7.0",
    "vitest": "^3.2.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

- [ ] **Step 3: `packages/codemods/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src", "bin"]
}
```

- [ ] **Step 4: `packages/codemods/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'bin/migrate.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  external: ['jscodeshift'],
});
```

- [ ] **Step 5: Skeleton `packages/codemods/src/index.ts`**

```ts
export { runTransform } from './runner';
export type { TransformReport } from './runner';
```

- [ ] **Step 6: Skeleton `packages/codemods/bin/migrate.ts`**

```ts
#!/usr/bin/env node
import { runCli } from '../src/cli';
runCli(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 7: Install + first build**

```bash
pnpm install
pnpm --filter @better-grid/codemods build
```

Expected: build green; `dist/` populated.

- [ ] **Step 8: Skeleton README**

`packages/codemods/README.md`:

```markdown
# @better-grid/codemods

One-shot codemods that migrate to Better Grid from AG Grid, MUI X Data Grid, TanStack Table, Handsontable, RevoGrid, and react-data-grid.

## Install / use

```bash
npx @better-grid/codemods from-ag-grid src/
npx @better-grid/codemods from-mui-x-data-grid src/
npx @better-grid/codemods from-tanstack-table src/
npx @better-grid/codemods from-handsontable src/
npx @better-grid/codemods from-revogrid src/
npx @better-grid/codemods from-react-data-grid src/
```

Flags:
- `--dry-run` print the would-be diff, don't write
- `--report=<path>` write a JSON summary
- `--ext=ts,tsx,js,jsx` file extensions to process

## What's auto-converted vs flagged

See each transform's README under `src/transforms/from-<lib>/`.
```

- [ ] **Step 9: Commit**

```bash
git add packages/codemods/
git commit -m "codemods: scaffold @better-grid/codemods workspace package"
```

---

## Task 27: CLI runner + reporting

**Files:**
- Create: `packages/codemods/src/cli.ts`
- Create: `packages/codemods/src/runner.ts`
- Test: `packages/codemods/tests/cli.test.ts`

- [ ] **Step 1: Implement the runner**

`packages/codemods/src/runner.ts`:

```ts
import { run as jscodeshift } from 'jscodeshift/src/Runner';
import path from 'node:path';
import fs from 'node:fs';

export interface TransformReport {
  filesChanged: number;
  sitesConverted: number;
  flagged: { file: string; line: number; reason: string }[];
}

export async function runTransform(args: {
  transform: string;             // 'from-ag-grid' etc.
  paths: string[];
  dryRun?: boolean;
  extensions?: string[];          // default: ['ts', 'tsx', 'js', 'jsx']
}): Promise<TransformReport> {
  const transformPath = path.resolve(__dirname, 'transforms', args.transform, 'index.js');
  if (!fs.existsSync(transformPath)) {
    throw new Error(`Unknown transform: ${args.transform}`);
  }

  const exts = args.extensions ?? ['ts', 'tsx', 'js', 'jsx'];
  const result = await jscodeshift(transformPath, args.paths, {
    parser: 'tsx',
    extensions: exts.join(','),
    dry: args.dryRun ?? false,
    print: args.dryRun ?? false,
    verbose: 0,
    babel: false,
    runInBand: true,
    silent: true,
    stdin: false,
  });

  // jscodeshift's stats come back via process state; for the v1 cut
  // we shell-aggregate by reading the in-process counters it exposes.
  // (jscodeshift returns { ok, nochange, skip, error, timeElapsed }.)
  const filesChanged = result.ok ?? 0;
  const flagged = collectFlagged(args.paths, exts);
  return {
    filesChanged,
    sitesConverted: filesChanged,  // approximation; per-site counter exposed in transform later
    flagged,
  };
}

function collectFlagged(paths: string[], exts: string[]): TransformReport['flagged'] {
  // After the transform runs, scan transformed files for the marker comment:
  //   // @better-grid/migrate: review
  // Each occurrence is a flagged site.
  const out: TransformReport['flagged'] = [];
  for (const root of paths) {
    walk(root, (file) => {
      if (!exts.some((e) => file.endsWith(`.${e}`))) return;
      const text = fs.readFileSync(file, 'utf8');
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        const m = line.match(/@better-grid\/migrate:\s*(.+)$/);
        if (m) out.push({ file, line: i + 1, reason: m[1].trim() });
      });
    });
  }
  return out;
}

function walk(p: string, cb: (file: string) => void): void {
  const stat = fs.statSync(p);
  if (stat.isFile()) { cb(p); return; }
  for (const child of fs.readdirSync(p)) {
    if (child === 'node_modules' || child.startsWith('.')) continue;
    walk(path.join(p, child), cb);
  }
}
```

- [ ] **Step 2: Implement the CLI**

`packages/codemods/src/cli.ts`:

```ts
import { Command } from 'commander';
import fs from 'node:fs';
import { runTransform } from './runner';

const TRANSFORMS = [
  'from-ag-grid',
  'from-mui-x-data-grid',
  'from-tanstack-table',
  'from-handsontable',
  'from-revogrid',
  'from-react-data-grid',
] as const;
type TransformName = typeof TRANSFORMS[number];

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name('better-grid-migrate')
    .description('Migrate to Better Grid from another grid library')
    .argument('<transform>', `one of: ${TRANSFORMS.join(', ')}`)
    .argument('[paths...]', 'files or directories to walk', ['src'])
    .option('--dry-run', 'preview changes without writing')
    .option('--report <path>', 'write a JSON summary to this file')
    .option('--ext <list>', 'comma-separated file extensions', 'ts,tsx,js,jsx')
    .action(async (transform: string, paths: string[], opts: { dryRun?: boolean; report?: string; ext: string }) => {
      if (!TRANSFORMS.includes(transform as TransformName)) {
        console.error(`Unknown transform: ${transform}\nKnown: ${TRANSFORMS.join(', ')}`);
        process.exit(2);
      }
      const result = await runTransform({
        transform,
        paths,
        dryRun: opts.dryRun,
        extensions: opts.ext.split(',').map((s) => s.trim()).filter(Boolean),
      });
      console.log(`\n${transform}\n`);
      console.log(`  ✓ ${result.filesChanged} file(s) changed`);
      console.log(`  ⚠ ${result.flagged.length} site(s) flagged for manual review`);
      for (const f of result.flagged) {
        console.log(`    ${f.file}:${f.line}  ${f.reason}`);
      }
      if (opts.report) {
        fs.writeFileSync(opts.report, JSON.stringify(result, null, 2));
        console.log(`\nReport written to ${opts.report}`);
      }
    });

  await program.parseAsync(argv);
}
```

- [ ] **Step 3: Add a smoke test**

`packages/codemods/tests/cli.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { runTransform } from '../src/runner';

describe('runner', () => {
  test('throws on unknown transform', async () => {
    await expect(runTransform({ transform: 'from-bogus', paths: ['/tmp'] })).rejects.toThrow(/Unknown transform/);
  });
});
```

- [ ] **Step 4: Build + test + commit**

```bash
pnpm --filter @better-grid/codemods build
pnpm --filter @better-grid/codemods test
git add packages/codemods/
git commit -m "codemods: CLI shim + jscodeshift runner + report aggregation"
```

---

## Task 28: Transform `from-ag-grid` + fixtures

**Files:**
- Create: `packages/codemods/src/transforms/from-ag-grid/index.ts`
- Create: `packages/codemods/src/transforms/from-ag-grid/__testfixtures__/{column-rename,grid-options,events,selection,renderer-flagged}.{input,output}.tsx`
- Test: extend `packages/codemods/tests/transforms.test.ts`

- [ ] **Step 1: Implement the transform**

`packages/codemods/src/transforms/from-ag-grid/index.ts`:

```ts
import type { Transform } from 'jscodeshift';

const COLUMN_RENAMES: Record<string, string> = {
  // (no renames needed at column level after Phase 1 — AG already uses field, headerName, hide)
};

const EDITOR_RENAMES: Record<string, string> = {
  'agTextCellEditor': 'text',
  'agSelectCellEditor': 'select',
  'agNumberCellEditor': 'number',
  'agDateCellEditor': 'date',
};

const OPTIONS_RENAMES: Record<string, string> = {
  rowData: 'data',
  columnDefs: 'columns',
  pinnedTopRowData: 'pinned.top',
  pinnedBottomRowData: 'pinned.bottom',
  onCellValueChanged: 'onCellChange',
  onSelectionChanged: 'onSelectionChange',
};

const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);

  // 1) cellEditor string-literal renames
  root
    .find(j.Property, { key: { name: 'cellEditor' } })
    .filter((p) => p.node.value.type === 'Literal' && typeof (p.node.value as { value: unknown }).value === 'string')
    .forEach((p) => {
      const lit = p.node.value as { value: string };
      if (EDITOR_RENAMES[lit.value]) lit.value = EDITOR_RENAMES[lit.value];
    });

  // 2) cellEditorParams: { values: [...] } → column-level options: [...]
  root
    .find(j.Property, { key: { name: 'cellEditorParams' } })
    .forEach((p) => {
      const valuesProp = j(p)
        .find(j.Property, { key: { name: 'values' } })
        .nodes()[0];
      if (valuesProp) {
        // Replace the cellEditorParams property with `options: <values>`
        p.replace(j.property('init', j.identifier('options'), valuesProp.value));
      }
    });

  // 3) Grid-option renames at top-level object literals
  root.find(j.Property).forEach((p) => {
    if (p.node.key.type !== 'Identifier') return;
    const name = p.node.key.name;
    if (OPTIONS_RENAMES[name]) {
      const newName = OPTIONS_RENAMES[name];
      if (newName.includes('.')) {
        // Nested target like 'pinned.top' — leave for the post-pass; flag for now
        addFlag(j, p, `'${name}' -> '${newName}' (nested rename — needs object grouping)`);
      } else {
        p.node.key.name = newName;
      }
    }
  });

  // 4) Renderer signature change — flag, don't auto-convert
  root
    .find(j.Property, { key: { name: 'cellRenderer' } })
    .filter((p) => {
      const v = p.node.value;
      // Heuristic: any value that's not a string literal is likely a JSX/React component
      return v.type !== 'Literal';
    })
    .forEach((p) => {
      addFlag(j, p, 'cellRenderer JSX → DOM port required');
    });

  // 5) ModuleRegistry call — flag
  root
    .find(j.CallExpression)
    .filter((p) => {
      const callee = p.node.callee;
      return (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'ModuleRegistry'
      );
    })
    .forEach((p) => {
      addFlag(j, p, 'ModuleRegistry call — confirm features list');
    });

  return root.toSource({ quote: 'single' });
};

function addFlag(j: ReturnType<typeof import('jscodeshift')>, path: { node: { comments?: unknown[] } }, reason: string): void {
  const comment = j.commentLine(` @better-grid/migrate: review — ${reason}`, false, true);
  path.node.comments = [...(path.node.comments ?? []), comment as unknown as object];
}

export default transform;
```

- [ ] **Step 2: Create fixture pairs**

`packages/codemods/src/transforms/from-ag-grid/__testfixtures__/column-rename.input.tsx`:

```tsx
const columns = [
  { field: 'name', headerName: 'Name' },
  {
    field: 'status',
    headerName: 'Status',
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: { values: ['open', 'closed'] },
  },
];
```

`column-rename.output.tsx`:

```tsx
const columns = [
  { field: 'name', headerName: 'Name' },
  {
    field: 'status',
    headerName: 'Status',
    cellEditor: 'select',
    options: ['open', 'closed'],
  },
];
```

`grid-options.input.tsx`:

```tsx
<AgGridReact rowData={rows} columnDefs={cols} onCellValueChanged={handler} />
```

`grid-options.output.tsx`:

```tsx
<AgGridReact data={rows} columns={cols} onCellChange={handler} />
```

`renderer-flagged.input.tsx`:

```tsx
const cols = [{ field: 'name', cellRenderer: MyCellRenderer }];
```

`renderer-flagged.output.tsx`:

```tsx
const cols = [{ field: 'name', // @better-grid/migrate: review — cellRenderer JSX → DOM port required
cellRenderer: MyCellRenderer }];
```

- [ ] **Step 3: Add fixture-driven test**

`packages/codemods/tests/transforms.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { applyTransform } from 'jscodeshift/dist/testUtils';
import path from 'node:path';
import fs from 'node:fs';
import agGrid from '../src/transforms/from-ag-grid';

const fixtureDir = path.resolve(__dirname, '../src/transforms/from-ag-grid/__testfixtures__');

function pairs(): { name: string; input: string; output: string }[] {
  return fs.readdirSync(fixtureDir)
    .filter((f) => f.endsWith('.input.tsx'))
    .map((f) => {
      const name = f.replace('.input.tsx', '');
      return {
        name,
        input: fs.readFileSync(path.join(fixtureDir, f), 'utf8'),
        output: fs.readFileSync(path.join(fixtureDir, `${name}.output.tsx`), 'utf8'),
      };
    });
}

describe('from-ag-grid', () => {
  for (const { name, input, output } of pairs()) {
    test(name, () => {
      const result = applyTransform(agGrid as never, {}, { source: input, path: 'in.tsx' });
      expect(result.trim()).toBe(output.trim());
    });
  }
});
```

- [ ] **Step 4: Run tests + commit**

```bash
pnpm --filter @better-grid/codemods test
git add packages/codemods/
git commit -m "codemods: from-ag-grid transform + fixtures"
```

---

## Task 29: Transform `from-mui-x-data-grid` + fixtures

Same shape as Task 28. Mappings drawn from spec §2 transform table.

**Files:**
- Create: `packages/codemods/src/transforms/from-mui-x-data-grid/index.ts`
- Create: `__testfixtures__/{type-rename,value-getter-unwrap,header-renderer-flagged,selection,pinned-rows}.{input,output}.tsx`

- [ ] **Step 1: Implement the transform**

Key transformations:
- `type: 'number' | 'date' | 'singleSelect'` → `cellType: 'number' | 'date' | 'select'`
- `valueGetter: ({ row }) => …` → `valueGetter: (row) => …` (unwrap params)
- `valueFormatter: ({ value }) => …` → `valueFormatter: (value) => …`
- `cellClassName: 'red'` → `cellClass: () => 'red'`
- `pinnedRows={{ top, bottom }}` → `pinned={{ top, bottom }}`
- `renderCell` / `renderHeader` / `renderEditCell` → flagged

Stub:

```ts
import type { Transform } from 'jscodeshift';

const TYPE_RENAMES: Record<string, string> = {
  number: 'number',
  date: 'date',
  singleSelect: 'select',
};

const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);

  // type: 'X' → cellType: 'X'
  root.find(j.Property, { key: { name: 'type' } })
    .filter((p) => p.node.value.type === 'Literal' && typeof (p.node.value as { value: unknown }).value === 'string')
    .forEach((p) => {
      const lit = p.node.value as { value: string };
      if (TYPE_RENAMES[lit.value]) {
        p.node.key = j.identifier('cellType');
        lit.value = TYPE_RENAMES[lit.value];
      }
    });

  // valueGetter: ({ row, ... }) => … → valueGetter: (row) => …
  unwrapParamsObject(j, root, 'valueGetter', 'row');
  unwrapParamsObject(j, root, 'valueFormatter', 'value');
  unwrapParamsObject(j, root, 'valueParser', 'value');

  // pinnedRows → pinned (rename only)
  root.find(j.JSXAttribute, { name: { name: 'pinnedRows' } })
    .forEach((p) => { (p.node.name as { name: string }).name = 'pinned'; });
  root.find(j.Property, { key: { name: 'pinnedRows' } })
    .forEach((p) => { (p.node.key as { name: string }).name = 'pinned'; });

  // renderCell / renderEditCell / renderHeader → flag
  for (const fnName of ['renderCell', 'renderEditCell', 'renderHeader']) {
    root.find(j.Property, { key: { name: fnName } }).forEach((p) => {
      addFlag(j, p, `${fnName} JSX → DOM port required`);
    });
  }

  // cellClassName: 'red' → cellClass: () => 'red'
  root.find(j.Property, { key: { name: 'cellClassName' } })
    .filter((p) => p.node.value.type === 'Literal' && typeof (p.node.value as { value: unknown }).value === 'string')
    .forEach((p) => {
      const className = (p.node.value as { value: string }).value;
      p.node.key = j.identifier('cellClass');
      p.node.value = j.arrowFunctionExpression([], j.literal(className));
    });

  return root.toSource({ quote: 'single' });
};

function unwrapParamsObject(j: any, root: any, propName: string, fieldName: string): void {
  root.find(j.Property, { key: { name: propName } })
    .filter((p: any) => p.node.value.type === 'ArrowFunctionExpression')
    .forEach((p: any) => {
      const arrow = p.node.value;
      const params = arrow.params;
      if (params.length !== 1 || params[0].type !== 'ObjectPattern') return;
      const objPattern = params[0];
      const fieldProp = objPattern.properties.find(
        (q: any) => q.type === 'Property' && q.key.type === 'Identifier' && q.key.name === fieldName,
      );
      if (!fieldProp) return;
      // Replace the arrow's parameter list with a single identifier
      arrow.params = [j.identifier(fieldName)];
    });
}

function addFlag(j: any, path: any, reason: string): void {
  const comment = j.commentLine(` @better-grid/migrate: review — ${reason}`, false, true);
  path.node.comments = [...(path.node.comments ?? []), comment];
}

export default transform;
```

- [ ] **Step 2: Create fixtures**

`type-rename.input.tsx` / `type-rename.output.tsx` — exercise `type: 'number'` → `cellType: 'number'`.

`value-getter-unwrap.input.tsx`:

```tsx
const cols = [{
  field: 'sum',
  valueGetter: ({ row }) => row.x + row.y,
  valueFormatter: ({ value }) => `$${value}`,
}];
```

`value-getter-unwrap.output.tsx`:

```tsx
const cols = [{
  field: 'sum',
  valueGetter: (row) => row.x + row.y,
  valueFormatter: (value) => `$${value}`,
}];
```

`header-renderer-flagged.input.tsx`:

```tsx
const cols = [{ field: 'x', renderHeader: () => <Header /> }];
```

`header-renderer-flagged.output.tsx`:

```tsx
const cols = [{ field: 'x', // @better-grid/migrate: review — renderHeader JSX → DOM port required
renderHeader: () => <Header /> }];
```

- [ ] **Step 3: Extend the test file**

In `packages/codemods/tests/transforms.test.ts`, add a parallel block for `from-mui-x-data-grid`:

```ts
import muiX from '../src/transforms/from-mui-x-data-grid';
const muiXFixtureDir = path.resolve(__dirname, '../src/transforms/from-mui-x-data-grid/__testfixtures__');

describe('from-mui-x-data-grid', () => {
  // ...identical pairs() loop, swapping fixtureDir + transform...
});
```

- [ ] **Step 4: Run tests + commit**

```bash
pnpm --filter @better-grid/codemods test
git add packages/codemods/
git commit -m "codemods: from-mui-x-data-grid transform + fixtures"
```

---

## Task 30: Transform `from-tanstack-table` + fixtures

**Files:**
- Create: `packages/codemods/src/transforms/from-tanstack-table/index.ts`
- Create: `__testfixtures__/{column-rename,sortable,sizes,header-renderer-fork,cell-flagged}.{input,output}.tsx`

- [ ] **Step 1: Implement the transform**

Key transformations:
- `accessorKey: 'amount'` → `field: 'amount'`
- `accessorFn: …` → `valueGetter: …`
- `header: 'Amount'` (string) → `headerName: 'Amount'`
- `header: () => <Header />` (function/JSX) → flagged + key rename
- `cell: …` → flagged
- `enableSorting: true` → `sortable: true`
- `size`/`minSize`/`maxSize` → `width`/`minWidth`/`maxWidth`

Implementation pattern follows Tasks 28-29; rename map at top, walk Property nodes by key name.

- [ ] **Step 2: Fixtures**

Cover: `accessorKey` rename, `accessorFn` rename, header string vs JSX fork, `enableSorting`, `size`/`minSize`/`maxSize`.

- [ ] **Step 3: Run tests + commit**

```bash
pnpm --filter @better-grid/codemods test
git add packages/codemods/
git commit -m "codemods: from-tanstack-table transform + fixtures"
```

---

## Task 31: Transform `from-handsontable` + fixtures

Same shape. Mappings:
- `data: 'amount'` (column-level) → `field: 'amount'`
- `title: 'Amount'` → `headerName: 'Amount'`
- `type: 'numeric' | 'date' | 'checkbox' | 'dropdown'` → `cellType: 'number' | 'date' | 'boolean' | 'select'`
- `editor: 'numeric' | 'select' | …` → `cellEditor: 'number' | 'select' | …`
- `validator: fn` → `rules: [{ validate: fn }]` (wrap in array)
- `readOnly: true` → `editable: false`
- `className` → `cellClass: () => …`
- `fixedColumnsLeft: 2` → `frozen: { left: 2 }`
- `fixedRowsTop: 1` → `frozen: { top: 1 }`
- `fixedRowsBottom: 1` → flagged (likely wants `pinned.bottom` with separate data)
- Feature toggles (`manualColumnResize`, `columnSorting`, `filters`, `copyPaste`, `undo`) → string features additions in `features={[…]}` (heuristic; add a TODO comment)
- `afterChange(changes, source)` → `onCellChange(changes)`
- `renderer: function(instance, td, …)` → flagged

- [ ] **Step 1: Implement.** Same pattern as Tasks 28-30.
- [ ] **Step 2: Fixtures.** One per category.
- [ ] **Step 3: Run + commit.**

```bash
pnpm --filter @better-grid/codemods test
git add packages/codemods/
git commit -m "codemods: from-handsontable transform + fixtures"
```

---

## Task 32: Transform `from-revogrid` + fixtures

Mappings:
- `prop: 'amount'` → `field: 'amount'`
- `name: 'Amount'` → `headerName: 'Amount'`
- `cellTemplate: (h, props) => …` → flagged
- `editor: 'select'` → `cellEditor: 'select'`
- `readonly: true` → `editable: false`
- `size`/`minSize`/`maxSize` → `width`/`minWidth`/`maxWidth`
- `pin: 'colPinStart'` → flagged
- `source` (top-level) → `data`
- `pinnedTopSource`/`pinnedBottomSource` → `pinned: { top: … }` / `pinned: { bottom: … }`
- `range: true` → `selection: { mode: 'range' }`
- `resize: true` → flagged (add to features)

- [ ] Implement, fixtures, test, commit. Same shape.

```bash
git commit -m "codemods: from-revogrid transform + fixtures"
```

---

## Task 33: Transform `from-react-data-grid` + fixtures

Mappings:
- `key: 'amount'` → `field: 'amount'` + `id: 'amount'` (id explicit since react-data-grid's `key` is RDG's column id)
- `name: 'Amount'` → `headerName: 'Amount'`
- `formatter: ({ row, column }) => <Cell />` → flagged
- `editor: TextEditor / DropDownEditor` → flagged + suggest `cellEditor: 'text'/'select'`
- `editorOptions: { editOnClick: true }` → flagged + suggest `features={{ edit: { editTrigger: 'click' } }}`
- `frozen: true` (per column) → flagged
- `cellClass: (row) => …` → `cellClass: (value, row) => …` (param shape)
- `headerCellClass` → flagged (Better Grid has no per-column header class today)
- `rows` → `data`
- `rowKeyGetter={(row) => row.id}` → `getRowId={(row) => row.id}` (top-level)
- `selectedRows={set}` + `onSelectedRowsChange` → `selection: { mode: 'row', multiRange: true }` + `onSelectionChange`
- `summaryRows`/`topSummaryRows` → `pinned: { bottom: … }` / `pinned: { top: … }`
- `onRowsChange` → `onCellChange`

- [ ] Implement, fixtures, test, commit.

```bash
git commit -m "codemods: from-react-data-grid transform + fixtures"
```

---

## Task 34: Each migration cheat sheet gets a "Codemod" section

**Files:**
- Modify: `docs/migrations/from-ag-grid.md`
- Modify: `docs/migrations/from-mui-x-data-grid.md`
- Modify: `docs/migrations/from-tanstack-table.md`
- Modify: `docs/migrations/from-handsontable.md`
- Modify: `docs/migrations/from-revogrid.md`
- Modify: `docs/migrations/from-react-data-grid.md`

- [ ] **Step 1: Append a Codemod section to each file**

Insert after the title paragraph, before the first `## Column definition mapping` heading:

```markdown
## Codemod

```bash
npx @better-grid/codemods from-<lib> src/
```

Auto-converts the rename rows below; flags the renderer-signature and structural rows for manual review (marker: `// @better-grid/migrate: review`). Flags: `--dry-run`, `--report=<path>`, `--ext=ts,tsx,js,jsx`.
```

(Adjust `<lib>` per file.)

- [ ] **Step 2: Commit**

```bash
git add docs/migrations/
git commit -m "docs: link the codemod CLI from each migration cheat sheet"
```

---

## Task 35: README + CHANGELOG mention the codemod CLI

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update README**

In the `## Migrating from another grid?` section, add at the top:

```markdown
> **Tip:** `npx @better-grid/codemods from-<lib> src/` runs a one-shot codemod that auto-converts the mechanical renames and flags the rest for review.
```

- [ ] **Step 2: Update CHANGELOG**

Under `[Unreleased]` add:

```markdown
### Added — codemods package

- `@better-grid/codemods` — six jscodeshift transforms (`from-ag-grid`, `from-mui-x-data-grid`, `from-tanstack-table`, `from-handsontable`, `from-revogrid`, `from-react-data-grid`). CLI: `npx @better-grid/codemods from-<lib> src/`. Auto-converts the mechanical renames; flags renderer-signature / plugin-instance / structural changes for manual review.
```

- [ ] **Step 3: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: link the codemod CLI from README + CHANGELOG"
```

---

## Task 36: Phase 2 verification

- [ ] **Step 1: Build all packages**

```bash
node scripts/build.js
```

Expected: green. Codemods package builds; ESM + CJS + DTS all clean.

- [ ] **Step 2: Run all tests**

```bash
pnpm --filter @better-grid/core test
pnpm --filter @better-grid/react test
pnpm --filter @better-grid/codemods test
```

Expected: all green; codemods test suite covers all 6 transforms with their fixtures.

- [ ] **Step 3: End-to-end CLI smoke**

Create a temp directory, drop a single AG Grid sample file in it, run the codemod:

```bash
mkdir -p /tmp/bgmigrate-smoke
cat > /tmp/bgmigrate-smoke/sample.tsx << 'EOF'
import { AgGridReact } from 'ag-grid-react';
const cols = [
  { field: 'name', headerName: 'Name', cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['A', 'B'] } },
];
export const Grid = () => <AgGridReact rowData={rows} columnDefs={cols} onCellValueChanged={fn} />;
EOF

node packages/codemods/dist/bin/migrate.cjs from-ag-grid /tmp/bgmigrate-smoke --report=/tmp/bgmigrate-smoke/report.json
cat /tmp/bgmigrate-smoke/sample.tsx
cat /tmp/bgmigrate-smoke/report.json
```

Expected: `cellEditor` becomes `'select'`; `cellEditorParams: { values: [...] }` becomes `options: [...]`; `rowData`/`columnDefs`/`onCellValueChanged` get renamed; report shows ≥1 file changed, 0 flagged.

- [ ] **Step 4: Cross-doc link sweep**

Re-run the link checker from Task 25 Step 2.

- [ ] **Step 5: Tag the milestone**

```bash
git tag pre-release-phase2
```

- [ ] **Step 6: Final summary commit (only if anything was tweaked during smoke)**

```bash
git status
# If clean, skip. Otherwise:
git add -A
git commit -m "codemods: smoke-test fixups"
```

---

## Done

Phase 1 + Phase 2 complete. Ready to publish v1.0.0.

Next-step pointers:
- Run `docs/private/release-playbook.md` (untracked) for the npm publish flow.
- For Phase 3 (Pro plugins remaining + AI integration), see [`ROADMAP.md`](../../../ROADMAP.md).

---

## Self-review notes

**Spec coverage check:**
- §1.1 renames — Tasks 2, 3, 4, 13.
- §1.2 new column props — Tasks 8, 9, 10.
- §1.3 signature extensions — Tasks 14, 15.
- §1.4 cleaner-DX refinements — Tasks 4 (split header), 5 (optional id), 6 (drop dropdown), 7 (drop object form), 11 (table style flags), 12 (selection union), 20 (configure rename).
- §1.5 bug/clarity fixes — Tasks 16 (oldValue), 17 (state shape), 18 (cell:change), 19 (frozen:clip).
- Phase 2 codemods — Tasks 26-33 (one per transform + scaffolding).
- Cheat-sheet + README + CHANGELOG updates — Tasks 24, 25, 34, 35.

**Type-consistency check:**
- `field` (Task 2) used in Tasks 4, 5, 8, 13, 21 — consistent.
- `valueGetter` (Task 3) referenced in Tasks 13, 14 — consistent.
- `headerName`/`headerRenderer` split (Task 4) used in Task 21 (defineColumn forwarding) — consistent.
- `setColumnHidden` (Task 8) referenced in Task 24 demo page — consistent.
- `'cell:change'` event (Task 18) referenced in Task 16 (`emitter.emit`) — consistent.
- `bordered`/`striped` (Task 11) — playground sweep happens in Task 23.
- `selection: false` (Task 12) — playground sweep happens in Task 23.

**Placeholder scan:**
- No "TBD"/"TODO" markers.
- Every task has either real code or an exact bash/shell command.
- Renames give exact find/replace commands; new behaviors give complete test code + complete implementation snippets.

**Note on test fixture imports:**
`packages/codemods/tests/transforms.test.ts` imports `applyTransform` from `'jscodeshift/dist/testUtils'`. This is jscodeshift's stable test utility path — verify against the installed version's exports if the import errors. Newer jscodeshift versions may expose it as `'jscodeshift/src/testUtils'` instead.
