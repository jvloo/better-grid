# Migrating from v0 to v1

The v1 release reshapes the Better Grid init API for better DX. Pre-release, no back-compat — every consumer must migrate. This doc lists every breaking change and shows the before/after.

## TL;DR

- `useMemo` around columns: usually no longer needed (hoist columns at module scope).
- `cellType: 'currency'` etc.: replace with `col.currency('field', { precision: 0 })`.
- Plugin instantiation: replace with `mode="spreadsheet"` or `features={['edit', 'clipboard']}` strings; full plugin instances still work via `plugins={[...]}`.
- `<BetterGrid columns={} data={} />` flat: still works. New advanced path: `const grid = useGrid({...}); <BetterGrid grid={grid} />`.

## What's new in v1 (additive)

These features did not exist in v0. They aren't migration steps — adopt them when you're ready:

- **`column.alwaysInput: boolean | (row, col) => boolean`** — render a real `<input>` permanently in every visible cell (Wiseway-shape finance sheets). Commits via the standard parser path on change/blur/Enter. Plugin warns when `alwaysInput cols × rows > editing.alwaysInputThreshold` (default 1000).
- **`@better-grid/react/rhf` sub-export** — `useGridForm({ grid, baseName: 'rows' })` listens to `data:change` events from the grid and forwards each into `setValue('${baseName}.${rowIndex}.${columnId}', newValue)` so cells participate in a surrounding RHF `<FormProvider>`'s dirty/touched/validation state. `react-hook-form` is an optional peer dep.
- **`column.validationMessageRenderer`** and **`ColumnValidationRule.messageRenderer`** — return any HTMLElement (e.g. an MUI Alert mounted via `createRoot`) to control the error tooltip body. Falls back to the default text bubble when omitted.
- **MUI theme bridge** — see [`docs/mui-theme-integration.md`](mui-theme-integration.md) for the recipe wiring `palette` / `typography` / `mode` through Better Grid's CSS custom properties.

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

Default if `mode` is omitted: `view`. Set `mode={null}` for zero defaults.

`features` is additive on top of the chosen mode. To turn off something the mode includes, use the object form: `features={{ sort: false }}`.

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
| `height={400}` | `size={{ height: 400 }}` (top-level `height` still works on `<BetterGrid>` as a sugar prop) |
| `rowStyles={{ field, styles }}` | DROPPED. Use `rowStyle: (row, idx) => ({...})` |
| `getRowStyle` | RENAMED to `rowStyle` |
| `onDataChange` | RENAMED to `onCellChange` |

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
    cellRenderer: (container, ctx) => {
      container.innerHTML = '';
      const a = document.createElement('a');
      a.textContent = String(ctx.value ?? '');
      a.onclick = () => ctx.context.onRowClick(ctx.row);
      container.appendChild(a);
    },
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

The `context` is stored on a ref internally — swapping `onRowClick` doesn't re-init the grid, and the cell renderer always sees the latest closure.

## State persistence on data swap

When the `data` reference changes, v1 default behavior:

- Selection clears.
- Scroll resets to (0, 0).
- In-progress edits commit-or-cancel per the editing plugin's existing rules.
- Undo history clears (if using the undo plugin).

A future `resetOn: 'never' | 'data' | 'columns'` option may be added.

## Slots seam (reserved)

`<BetterGrid slots={...} slotProps={...} />` accepts these props but they're unused in v1. v1.1 will populate them. Don't pass them yet.

## Quick migration checklist

For each consumer file (typically a page component):

1. **Hoist `columns` out of the component** if it has no scope-dependent handlers. Drop the `useMemo` wrapper.
2. **Replace each `{ cellType: 'X', ... }` object** with the equivalent `col.X(field, opts)`.
3. **Replace `plugins={[plugin1(), plugin2(), ...]}`** with `mode="..."` or `features={[...]}`. Move custom plugin opts to `features={{ x: { ...opts } }}` or keep as `plugins={[customPlugin({...})]}`.
4. **Group flat layout props** per the table in §4.
5. **If columns reference component-scope handlers**, lift handlers into a `context` object and read via `ctx.context.<handler>` in the cell renderer.
6. **Rename event handlers**: `onDataChange` → `onCellChange`.
7. **Pick a component shape**: `<BetterGrid {...inline} />` for trivial cases, `useGrid({...}) → <BetterGrid grid={grid} />` for anything that needs the imperative API.
