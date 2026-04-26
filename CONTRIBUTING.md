# Contributing to Better Grid

Bugfixes, plugins, docs, tests — all welcome. Maintained by [@jvloo](https://github.com/jvloo). By participating you agree to [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Quick links

- **Bug** → [bug report](https://github.com/jvloo/better-grid/issues/new?template=bug_report.yml)
- **Feature idea** → [feature request](https://github.com/jvloo/better-grid/issues/new?template=feature_request.yml)
- **Security** → [`SECURITY.md`](SECURITY.md) (do **not** open a public issue)
- **Stuck** → [`SUPPORT.md`](SUPPORT.md)

## Project layout

Monorepo — pnpm workspaces + Turborepo. Architecture in [`AGENTS.md`](AGENTS.md); plans in [`ROADMAP.md`](ROADMAP.md).

```
packages/core      Framework-agnostic engine (MIT)
packages/react     React adapter (MIT)
packages/plugins   Free plugins (MIT)
packages/pro       Source-available pro plugins
apps/playground    Vite + React dev playground
docs               Migration guides, theming, contributor reference
```

## Local setup

```bash
git clone https://github.com/jvloo/better-grid.git
cd better-grid
nvm use && pnpm install
node scripts/build.js                  # all packages (Windows-safe; raw turbo run build is buggy)
node scripts/playground-build.js dev   # http://localhost:8686
pnpm --filter @better-grid/core test
pnpm --filter @better-grid/react test
```

## PR flow

1. Branch from `main`. Naming is casual.
2. **One concern per PR.** Bugfix shouldn't carry a refactor; refactor shouldn't carry style changes.
3. **Tests for behavior changes.** Bug fixes need a regression test; new features need at least the happy path.
4. **TypeScript strict.** Don't loosen it — the inference helpers depend on it.
5. **Lint clean** — `pnpm format` (Prettier).
6. **Conventional-ish commit subjects** — `editing: add alwaysInput`, `react/rhf: bridge cell commits`. See `git log --oneline` for the style.
7. **Update docs** when public surface changes — README quick-start, AGENTS ColumnDef, the migration guides, the theming guide.
8. **Update CHANGELOG.md** under `[Unreleased]`.
9. **Never push to `main`.** Even maintainers go through PR.

## What we won't merge without discussion first

- New runtime dependencies (keep the bundle small).
- React-specific code in `@better-grid/core` (framework-agnostic by design).
- Backwards-compatibility shims for older internal API shapes.
- Changes to the plugin contract (`GridPlugin<id, Api>`) without an RFC issue.

## Plugin authoring

Third-party plugins don't need to land in the monorepo — `@better-grid/core` is designed for them. Contract:

1. Export a factory: `export function myPlugin(opts?): GridPlugin<'myPlugin', MyApi> { ... }`.
2. Augment `ColumnDef` / `PluginState` only with fields your plugin owns ([details](AGENTS.md#extension-points-module-augmentation)).
3. Expose your API via `ctx.expose(api)` inside `init`.
4. Publish under your own scope, or open a PR to add to `@better-grid/plugins` if it's broadly useful and MIT.

## Pro plugins (`@better-grid/pro`)

Source-available, not OSS. Commercial production use requires a Pro license, even though v1 has no runtime DRM. Bug reports + small fixes welcome; feature-level contributions go through a separate review path — open a feature request first.

## License

Contributions are licensed MIT for `@better-grid/core` / `@better-grid/react` / `@better-grid/plugins`, and under the Better Grid Pro Source-Available License for `@better-grid/pro`. No CLA required.
