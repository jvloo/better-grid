# Contributing to Better Grid

Thanks for considering a contribution. Better Grid is an OSS-first data-grid library with source-available pro plugins, backed by a small team and a single primary maintainer ([@jvloo](https://github.com/jvloo)). The bar is high but the door is open — bugfixes, plugins, docs, and tests are all welcome.

## Code of conduct

By participating you agree to abide by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Be kind. Disagreement is fine; contempt is not.

## Quick links

- **Bug?** Use the [Bug report](https://github.com/jvloo/better-grid/issues/new?template=bug_report.yml) template.
- **Feature idea?** Use the [Feature request](https://github.com/jvloo/better-grid/issues/new?template=feature_request.yml) template.
- **Security finding?** Don't open a public issue — see [`SECURITY.md`](SECURITY.md).
- **Stuck?** See [`SUPPORT.md`](SUPPORT.md).

## Project layout

Monorepo with pnpm workspaces + Turborepo. See [`AGENTS.md`](AGENTS.md) for the full architecture overview.

```
packages/core      Framework-agnostic engine (MIT)
packages/react     React adapter (MIT)
packages/plugins   Free plugins (MIT)
packages/pro       Source-available commercial pro plugins
apps/playground    Vite + React dev playground (~25 pages)
docs               Migration guides, theme integration, PR summaries
```

## Local setup

```bash
git clone https://github.com/jvloo/better-grid.git
cd better-grid
pnpm install
```

Node version is pinned in `.nvmrc`. Use `nvm use` (or your equivalent) before installing.

### Build

```bash
node scripts/build.js          # all packages
node scripts/build.js core     # one package
```

> **Windows:** there's a null-bytes-in-env-var bug with `pnpm run build` / `turbo run build`. Use `node scripts/build.js` instead.

### Dev playground

```bash
node scripts/playground-build.js dev
# opens at http://localhost:8686
```

### Tests

```bash
pnpm --filter @better-grid/core test
pnpm --filter @better-grid/react test
```

CI runs the full matrix on every PR.

### Typecheck

```bash
pnpm --filter @better-grid/core typecheck
```

## Pull request flow

1. **Branch** from `main`. Branch names are casual — anything readable is fine.
2. **One concern per PR.** A bugfix shouldn't carry a refactor. A new feature shouldn't carry style changes. If you find yourself wanting to do both, open two PRs and let the second one rebase after the first lands.
3. **Tests for behavior changes.** Bug fixes need a regression test. New features need at least one test that exercises the happy path. The `tests/` folders next to each package show the conventions.
4. **TypeScript strict.** `strict: true` is required across the monorepo — it's load-bearing for the inference helpers (`InferRow`, `InferState`, etc.). Don't loosen it.
5. **Lint clean.** Run `pnpm format` (Prettier) before committing. The repo's Prettier config is in `.prettierrc`.
6. **Conventional commit subjects** are encouraged but not enforced — `editing: add alwaysInput flag`, `react/rhf: bridge cell commits` etc. Look at recent `git log --oneline` for the style.
7. **Update docs** when you change public surface. README quick-start, AGENTS.md ColumnDef Props table, the migration guides under `docs/migrations/`, and `docs/guides/theming-with-mui.md` are the surfaces most consumers touch.
8. **Update CHANGELOG.md** under the `[Unreleased]` section.
9. **Never push to `main` directly.** All changes go through PR review even from maintainers.

## What we won't merge (without discussion first)

- New runtime dependencies. Keep the bundle small.
- React-specific code in `@better-grid/core` (it's framework-agnostic by design).
- Backwards-compatibility shims for the v0 API. Pre-release era only.
- Changes to the plugin contract (`GridPlugin<id, Api>`) without an accompanying RFC issue.

## Plugin authoring

If you want to ship a plugin externally, you don't need to land it in the monorepo — `@better-grid/core` is designed for third-party plugins. The contract:

1. Export a factory: `export function myPlugin(opts?): GridPlugin<'myPlugin', MyApi> { ... }`.
2. Augment `ColumnDef` / `PluginState` only with fields your plugin owns (see [AGENTS.md → Declaration-merging extension points](AGENTS.md#declaration-merging-extension-points)).
3. Expose your API via `ctx.expose(api)` inside `init`.
4. Document any new feature in your README, then either publish under your own scope or open a PR to add it to `@better-grid/plugins` if it's broadly useful and MIT-licensed.

## Pro plugins (`@better-grid/pro`)

`@better-grid/pro` is source-available, not OSS. Commercial production use requires a Better Grid Pro license, even though v1 has no hard runtime DRM. We accept bug reports and small fixes against it, but feature-level contributions go through a different review path — open a feature request first so we can discuss licensing and roadmap fit before you write code.

## Security

If you find a vulnerability, **do not open a public issue**. See [`SECURITY.md`](SECURITY.md) for the disclosure process.

## License

By contributing, you agree your contributions will be licensed under the MIT license for code in `@better-grid/core`, `@better-grid/react`, and `@better-grid/plugins`, and under the Better Grid Pro Source-Available License for code in `@better-grid/pro`. We don't require a CLA.
