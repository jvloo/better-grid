# Better Grid

Framework-agnostic, TypeScript-first data grid & spreadsheet library with plugin architecture.

## Architecture

Monorepo with pnpm workspaces + Turborepo.

### Packages

| Package | Description | License |
|---------|-------------|---------|
| `@better-grid/core` | Framework-agnostic grid engine | MIT |
| `@better-grid/react` | React adapter (hooks + component) | MIT |
| `@better-grid/plugins` | Free plugins (editing, sorting, filtering, formatting, validation) | MIT |
| `@better-grid/pro` | Paid plugins (clipboard, grouping, undo/redo, export) | Commercial (future) |
| `@better-grid/mcp` | AI-native MCP server for developer tooling | MIT (future) |
| `@better-grid/plugin-ai` | End-user AI features (NL filtering, summarization) | Commercial (future) |

### Core Design (Better Auth-inspired)

- **Plugin architecture** — features as composable plugins with `$types` for TypeScript inference
- **`$Infer` pattern** — `typeof grid.$Infer.Row` flows column schema to full type inference
- **Config-driven DX** — works out of the box with `createGrid()`, one function call
- **Framework adapters** — thin reactivity wrappers (~50 lines each)

### Key Internals

- **Virtual scrolling**: prefix-sum arrays + binary search for O(log n) visible range
- **Rendering**: DOM-based cell pooling with `transform: translate3d()` for GPU compositing
- **Frozen columns**: separate overlay outside scroll container (no lag)
- **Selection**: overlay layer (avoids re-rendering all cells on selection change)
- **State**: fine-grained slice subscriptions + batching

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

## TypeScript

- `strict: true` required (type inference depends on it)
- Typecheck: `node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc --noEmit --project packages/core/tsconfig.json`

## Project Structure

```
packages/core/src/
  grid.ts              # createGrid() factory — main entry point
  types.ts             # All type definitions
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

packages/plugins/src/
  editing.ts            # Cell editing
  sorting.ts            # Column sorting
  filtering.ts          # Column filtering
  formatting.ts         # Number/currency/percent/date via Intl
  validation.ts         # Cell validation rules

apps/playground/        # Vite + React dev playground
```
