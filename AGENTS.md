# Better Grid

Framework-agnostic, TypeScript-first data grid & spreadsheet library with composable plugin architecture. Monorepo: pnpm workspaces + Turborepo.

## Rules for Claude / coding agents

These apply to every coding agent in this repo (Claude Code, Cursor, Copilot, etc.). Treat them as load-bearing.

- **`docs/private/` is off-limits.** Gitignored; contains the maintainer's strategy, commercialization, internal roadmap, competitor analysis, release playbook. Do not read, copy, summarize, paraphrase, or reference its contents in any tracked file (commit, PR, issue, doc, code comment). Do not stage or commit anything under it. Do not move files into or out of it without explicit per-task user direction. Never remove the `.gitignore` rule for it.
- If asked to publish content originating from `docs/private/`, refuse and ask the user to either restate it as a non-private input or move it out themselves.
- Everything else under `docs/` is fair game and tracked normally.

## Packages

| Package                  | Purpose                                                                                                              | License      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------ |
| `@better-grid/core`      | Framework-agnostic engine                                                                                            | MIT          |
| `@better-grid/react`     | React adapter (`useGrid`, `BetterGrid`, `defineColumn`, `configureBetterGrid`, mode/feature resolver). Sub-export `@better-grid/react/rhf` (`useGridForm`). | MIT          |
| `@better-grid/plugins`   | Free plugins (editing, sorting, filtering, formatting, validation, hierarchy, clipboard, grouping, pagination, search, export, undoRedo, cellRenderers, autoDetect) + built-in cell renderers | MIT          |
| `@better-grid/pro`       | Commercial plugins (gantt, aggregation, merge-cells, row-actions, pro-renderers)                                    | Source-available |

## Init API (v1)

`@better-grid/react` ships a layered init API:

- **Sugar** — `<BetterGrid columns data mode="spreadsheet" />`. Inline options, no `useGrid` needed.
- **Handle** — `const grid = useGrid({...}); <BetterGrid grid={grid} />`. Required for imperative access (`grid.api.scrollToCell`), the `context` ref, or `useGridForm`.
- **Vanilla** — `createGrid({...}).mount(el)` from `@better-grid/core`. Plugin instances directly; no mode/features registry.

**Mode presets:**

| Mode          | Features included                              |
| ------------- | ---------------------------------------------- |
| `null`        | —                                              |
| `view`        | sort, filter, resize, select                   |
| `interactive` | view + reorder                                 |
| `spreadsheet` | interactive + edit + clipboard + undo          |
| `dashboard`   | view + export                                  |

`features` is additive on top of mode. Object form passes options: `features={{ edit: { editTrigger: 'click' } }}`. `plugins` is the escape hatch for plugins not in the registry. App-wide defaults: `configureBetterGrid({ features: { format: { locale: 'en-US' } } })`.

## Core design

- **Plugin architecture** — features as composable plugins declaring exposed APIs (`$api`) and error codes (`$errorCodes`). Consumer types extend via `declare module '@better-grid/core'`.
- **Inference helpers** — `InferRow<typeof grid>` / `InferState<typeof grid>` / `InferPluginApis<Plugins>` / `InferPluginErrorCodes<Plugins>`.
- **Typed plugin accessor** — `grid.api.plugins.sorting.toggleSort(...)` is statically typed via the `$api` phantom field on each plugin.
- **Context ref** — `useGrid({ context })` stores on a ref; cell renderers read `ctx.context` and always see the latest closure.
- **Framework adapters** — thin reactivity wrappers (~50 LOC each).
- **`cellType` registry** — plugins register renderers via `registerCellType()`; core dispatches.

### Typed plugins

```ts
export function sorting(...): GridPlugin<'sorting', SortingApi> { ... }
export function validation(...): GridPlugin<'validation', ValidationApi> {
  return {
    id: 'validation',
    $errorCodes: { REQUIRED_FIELD: 'REQUIRED_FIELD', VALIDATION_FAILED: 'VALIDATION_FAILED' } as const,
    init(ctx) { ... ctx.expose(api); },
  };
}

const grid = createGrid({ plugins: [sorting(), validation()], ... });
grid.plugins.sorting.toggleSort('name');           // typed
grid.plugins.validation.isValid();                 // typed
if (err.code === grid.$errorCodes.REQUIRED_FIELD)  // typed
```

`grid.plugins` is a lazy `Proxy`. Hot-added plugins (via `grid.addPlugin`) appear at runtime but aren't reflected in `InferPluginApis<TPlugins>` — read via `(grid.plugins as Record<string, MyApi>).foo`.

### Extension points (module augmentation)

Plugins augment three core interfaces via `declare module '@better-grid/core'`:

- **`ColumnDef`** — fields the plugin reads off each column (e.g. `editing` adds `precision`, `min`, `max`, `placeholder`, `mask`, `prefix`, `suffix`, `unit`, `inputEllipsis`, `inputEditCursor`, `alwaysInput`; `validation` adds `required`, `rules`, `validationMessageRenderer`).
- **`PluginState`** — typed slice under `grid.getState().pluginState`.
- **`PluginContext`** — methods plugins can call on the context passed to `init(ctx)`.

Augmentations flow globally; only augment fields your plugin owns. Consumers who import your plugin get the extra fields; those who don't see the unextended base interfaces.

## Key internals

- **Virtual scrolling:** prefix-sum + binary search (O(log n) visible range).
- **Rendering:** DOM cell pooling + `transform: translate3d()` for GPU compositing.
- **Scroll architecture:** fake-scrollbar pattern — viewport (`overflow:hidden`) + sibling fakeScrollbar (`overflow:auto`). Container-level transform shifts cells; old cells stay visible during JS update (no blank flash).
- **Frozen vs Pinned:** `frozen` locks first N items from the main array (`frozen.left`, `frozen.top`, `frozen.clip`); `pinned` attaches separate data outside the main array (`pinned.top`, `pinned.bottom`).
- **Selection:** overlay layer (no per-cell re-render on selection change).
- **State:** fine-grained slice subscriptions + batching; `data:change` fires per `updateCell`.
- **Data swap:** replacing `data` clears selection, resets scroll to (0, 0), clears undo history (when undo plugin loaded).

## ColumnDef

```
Identity:    id, accessorKey, accessorFn, header
Layout:      width, minWidth, maxWidth, resizable
Alignment:   align ('left'|'center'|'right'), verticalAlign ('top'|'middle'|'bottom')
Rendering:   cellType ('number'|'currency'|'percent'|'date'|'bigint'|'select'|'boolean'|'badge'|'progress'|'rating'|'change'|'changeIndicator'|'link'|'timeline'|'tooltip'|'loading'|'custom'),
             cellRenderer, cellStyle, cellClass
Editing:     editable, cellEditor ('text'|'dropdown'|'select'|'selectWithInput'|'number'|'date'|'autocomplete'|'masked'),
             options, valueParser
Sorting:     sortable, comparator
Formatting:  hideZero, valueFormatter
Extension:   meta
```

Plugin-only fields (added via module augmentation; only present when the plugin is bundled):

- `editing` → `precision`, `min`, `max`, `placeholder`, `mask`, `prefix`, `suffix`, `unit`, `inputEllipsis`, `inputEditCursor`, `alwaysInput`, `selectInput`, `selectValue`, `selectInputValue`, `parseSelectWithInputValue`
- `formatting` → `dateFormat`
- `validation` → `required`, `rules`, `validationMessageRenderer`

The React `defineColumn` builders (`col.text`, `col.currency`, etc.) wrap these with type-aware factories that set `id`, `accessorKey`, `cellType`, and default alignment.

## Build & dev

Windows env has a null-bytes-in-env-var bug — use the helpers, not raw `pnpm run build` / `turbo run build`:

```bash
node scripts/build.js          # all packages
node scripts/build.js core     # one package
node scripts/playground-build.js dev   # http://localhost:8686
```

The dev-server script uses `execSync`; when launched as a background task, the wrapper exits while Vite keeps running as an orphan. The task reports "completed" while the server is still up — `netstat -ano | grep 8686` to verify; kill orphans before restarting.

## TypeScript

`strict: true` required (inference helpers depend on it). Per-package: `pnpm --filter @better-grid/core typecheck`.

## Project structure

```
packages/core/src/
  grid.ts, types.ts, state/, virtualization/, rendering/, selection/,
  keyboard/, columns/, events/, plugin/, styles/grid.css

packages/react/src/
  BetterGrid.tsx, useGrid.ts, defineColumn.ts, configureBetterGrid.ts,
  presets/{features,modes}.ts, rhf.ts (sub-export at @better-grid/react/rhf),
  adapters/

packages/plugins/src/free/
  editing.ts (incl. alwaysInput + inputStyle), sorting.ts, filtering.ts,
  formatting.ts, validation.ts (incl. messageRenderer), hierarchy.ts,
  clipboard.ts, grouping.ts, pagination.ts, search.ts, export.ts,
  undo-redo.ts, cell-renderers.ts, auto-detect.ts

packages/pro/src/
  gantt.ts, aggregation.ts, merge-cells.ts, row-actions.ts, pro-renderers.ts

apps/playground/        # ~25 demo pages — /demo/* and /demo-realworld/*
.ref/                   # third-party reference material (gitignored)
```

## Reference docs

See [`docs/README.md`](docs/README.md) for the index. Highlights: [`ROADMAP.md`](ROADMAP.md), [`docs/migrations/`](docs/migrations/), [`docs/guides/theming-with-mui.md`](docs/guides/theming-with-mui.md), [`docs/internal/`](docs/internal/) (contributor reference).
