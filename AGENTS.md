# Better Grid

Framework-agnostic, TypeScript-first data grid & spreadsheet library with composable plugin architecture.

## Architecture

Monorepo with pnpm workspaces + Turborepo.

### Packages

| Package | Description | License |
|---------|-------------|---------|
| `@better-grid/core` | Framework-agnostic grid engine | MIT |
| `@better-grid/react` | React adapter (hooks + component) | MIT |
| `@better-grid/plugins` | Free plugins (editing, sorting, filtering, formatting, validation, hierarchy, clipboard, grouping, pagination, search, export, undoRedo, cellRenderers, autoDetect) + built-in cell renderers | MIT |
| `@better-grid/pro` | Commercial plugins (gantt, aggregation, merge-cells, row-actions, pro-renderers) | Commercial |
| `@better-grid/mcp` | MCP server for developer tooling | MIT (future) |
| `@better-grid/plugin-ai` | AI features: free NL filtering + pro data intelligence | Tiered (future) |

### Core Design

- **Plugin architecture** — features as composable plugins that declare exposed APIs (`$api`) and error codes (`$errorCodes`); consumer types are extended via module augmentation (`declare module '@better-grid/core'`)
- **Inference helpers** — `InferRow<typeof grid>` / `InferState<typeof grid>` / `InferPluginApis<Plugins>` / `InferPluginErrorCodes<Plugins>` recover row, state, per-plugin API, and error-code types from the instance
- **Typed plugin accessor** — `grid.plugins.sorting.toggleSort(...)` is statically typed via the `$api` phantom field on each plugin; see "Typed plugins & error codes" below
- **Config-driven DX** — works out of the box with `createGrid()`, one function call
- **Framework adapters** — thin reactivity wrappers (~50 lines each)
- **cellType registry** — plugins register renderers via `registerCellType()`; core just dispatches

### Typed plugins & error codes

Each plugin factory declares its exposed API and optional error-code dictionary in
its return type:

```ts
export function sorting(...): GridPlugin<'sorting', SortingApi> { ... }
export function validation(...): GridPlugin<'validation', ValidationApi> {
  return {
    id: 'validation',
    $errorCodes: { REQUIRED_FIELD: 'REQUIRED_FIELD', VALIDATION_FAILED: 'VALIDATION_FAILED' } as const,
    init(ctx) { ... ctx.expose(api); },
  };
}
```

`createGrid`'s `const TPlugins` type-parameter preserves the plugins tuple's literal
types, so consumers get:

```ts
const grid = createGrid({ plugins: [sorting(), validation()], ... });
grid.plugins.sorting.toggleSort('name');           // typed SortingApi
grid.plugins.validation.isValid();                 // typed ValidationApi
if (err.code === grid.$errorCodes.REQUIRED_FIELD)  // typed 'REQUIRED_FIELD'
```

Runtime: `grid.plugins` and `grid.$errorCodes` are lazy `Proxy` objects that walk
the registry on lookup. Hot-added plugins (via `grid.addPlugin`) appear immediately
at runtime but aren't reflected in the static `InferPluginApis<TPlugins>` type —
read them through a cast: `(grid.plugins as Record<string, MyApi>).foo`.

When opting a new plugin in:
1. Export an `*Api` interface with the shape the plugin puts on `ctx.expose(...)`.
2. Change the factory return type to `GridPlugin<'id', FooApi>`.
3. If the plugin emits errors, add `$errorCodes: { CODE: 'CODE', ... } as const` to
   its returned object.

### Declaration-merging extension points

Three interfaces in `@better-grid/core` are designed to be augmented by plugin
packages via TypeScript's module-augmentation mechanism:

- **`ColumnDef`** — add fields the plugin reads off each column. Example:
  `editing` adds `precision`, `min`, `max`, `placeholder`, `mask`.
- **`PluginState`** — add a typed slice under `grid.getState().pluginState`.
  The base shape is an empty interface; each plugin fills its own slot.
- **`PluginContext`** — add methods plugins can call on the context passed to
  `init(ctx)`. Useful if one plugin wants to offer a lifecycle hook to other
  plugins.

Augmentation template (inside a plugin source file):

```ts
declare module '@better-grid/core' {
  interface ColumnDef<TData = unknown> {
    myPluginField?: string;
  }
  interface PluginState {
    myPlugin: { whatever: number };
  }
}
```

Augmentations flow globally, so only augment fields your plugin actually owns.
Consumers who import your plugin get the extra fields automatically; those who
don't still see the unextended base interfaces.

### Key Internals

- **Virtual scrolling**: prefix-sum arrays + binary search for O(log n) visible range
- **Rendering**: DOM-based cell pooling with recycling + `transform: translate3d()` for GPU compositing
- **Scroll architecture**: fake scrollbar pattern — viewport (`overflow:hidden`) + sibling fakeScrollbar (`overflow:auto`). Container-level transform shifts cells. Old cells stay visible during JS update (no blank flash).
- **Frozen vs Pinned**:
  - `frozen` = lock first N items from the main array in place while scrolling. `frozenLeftColumns`, `frozenTopRows`.
  - `pinned` = attach separate data outside the main array. `pinnedTopRows`, `pinnedBottomRows` (footer/totals).
  - Frozen columns: separate overlay outside scroll container, synced via same transform offset.
- **Selection**: overlay layer (avoids re-rendering all cells on selection change)
- **State**: fine-grained slice subscriptions + batching
- **Alignment**: `align` and `verticalAlign` props on ColumnDef, applied before cellRenderer (renderer can override)

### ColumnDef Props

```
Identity:    id, accessorKey, accessorFn, header
Layout:      width, minWidth, maxWidth, resizable
Alignment:   align ('left'|'center'|'right'), verticalAlign ('top'|'middle'|'bottom')
Rendering:   cellType ('number'|'currency'|'percent'|'date'|'bigint'|'select'|'boolean'), cellRenderer
Editing:     editable, cellEditor ('text'|'dropdown'), options, valueParser
Sorting:     sortable, comparator
Formatting:  hideZero, valueFormatter
Extension:   meta, cellStyle, cellClass
```

Plugin-only fields (added via `declare module '@better-grid/core'` augmentation —
they only exist when the relevant plugin is bundled):

- `editing` → `precision`, `min`, `max`, `placeholder`, `mask`
- `formatting` → `dateFormat`
- `validation` → `required`, `rules`

## Build

Windows env has a null-bytes-in-env-var bug. Use the helper scripts:

```bash
node scripts/build.js          # Build all packages
node scripts/build.js core     # Build core only
node scripts/playground-build.js dev   # Start playground dev server
```

Do NOT use `pnpm run build` or `turbo run build` directly — they fail due to the env var issue.

## Dev Server

```bash
node scripts/playground-build.js dev
# Opens at http://localhost:8686
```

**Note:** The script uses `execSync` so when launched via background task, the wrapper
shell exits immediately while Vite keeps running as an orphan process. The task will
report "completed" even though the server is still up. Check `netstat -ano | grep 8686`
to verify. Kill orphan processes before restarting to avoid port conflicts (Vite
auto-increments to 8687, 8688, etc.).

## TypeScript

- `strict: true` required (type inference depends on it)
- Typecheck: `node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc --noEmit --project packages/core/tsconfig.json`

## Project Structure

```
packages/core/src/
  grid.ts              # createGrid() factory — main entry point
  types.ts             # All type definitions (ColumnDef, Selection, etc.)
  state/store.ts       # Reactive state store with batching
  virtualization/      # Virtual scrolling engine + 9-zone layout
  rendering/           # Cell rendering pipeline + selection overlay
  selection/           # Selection model (cell/range/multi-range)
  keyboard/            # Arrow/tab/enter/escape navigation
  columns/             # Column manager (widths, value access)
  events/              # Typed event emitter
  plugin/              # Plugin registry + lifecycle
  styles/grid.css      # Base CSS with custom properties

packages/react/src/
  BetterGrid.tsx        # React component
  hooks/useGrid.ts      # Main hook (useSyncExternalStore)

packages/plugins/src/free/
  editing.ts            # Cell editing (text, dropdown, boolean)
  sorting.ts            # Column sorting (header click, indicators)
  filtering.ts          # Column filtering (9 operators, context menu)
  formatting.ts         # Number/currency/percent/date via Intl
  validation.ts         # Cell validation (required, rules, error UI)
  hierarchy.ts, clipboard.ts, grouping.ts, pagination.ts, search.ts,
  export.ts, undo-redo.ts, cell-renderers.ts, auto-detect.ts

packages/pro/src/
  gantt.ts              # Timeline/Gantt chart cellType
  aggregation.ts        # Pinned totals/averages with rules
  merge-cells.ts        # Row/column cell spanning
  row-actions.ts        # Per-row action menu (⋮)
  pro-renderers.ts      # Sparklines, heatmaps, mini charts

apps/playground/        # Vite + React dev playground (12 demo pages + landing)

.ref/                   # Third-party reference material (gitignored, see .ref/CLAUDE.md)

```

See `ROADMAP.md` for strategic tier analysis and feature roadmap.
