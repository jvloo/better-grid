# v1 Release Playbook

Future-me note: this is the commercial and release decision record for Better Grid v1. It exists so the next release does not depend on remembering a chat thread.

## Current v1 decision

- `@better-grid/core`, `@better-grid/react`, and `@better-grid/plugins` stay public MIT packages.
- `@better-grid/pro` stays public and source-available on npm, not private npm.
- Pro is not open source. Commercial production use requires a Better Grid Pro license.
- No hard DRM, no private registry, and no license key system for v1.
- A sponsor / coffee link is welcome, but it is appreciation/support, not the license gate.

This follows the AG Grid / MUI shape structurally: free community packages plus a paid pro package. It intentionally skips their heavier enforcement machinery for now.

## Why not private npm for v1

Private npm would make `@better-grid/pro` a real access gate, but it adds friction:

- paid npm org/private package setup;
- manual user/team access;
- auth tokens in local dev and CI;
- harder public demos and examples;
- less aligned with source-available adoption.

Private npm can still be used later if access control becomes more important than adoption.

## If adoption grows

Move toward an AG Grid / MUI-style commercial model in stages:

1. Keep the package split exactly as-is.
2. Add a soft license API in `@better-grid/pro`, for example `setBetterGridLicense(key)`.
3. Verify offline signed license keys with a public key bundled in the package.
4. Start with console warnings or an optional watermark only.
5. Add pricing, EULA, key generation, renewal rules, and support terms before stricter gating.

The code effort is moderate because pro is already a separate package. The heavier work is business/legal/support.

## v1 pre-release checklist

Use this when preparing the real npm release.

1. Decide whether this is a final v1 or an npm prerelease.
   - Final v1: keep package versions at `1.0.0` and publish to the default `latest` tag.
   - Prerelease / release candidate: change package versions to `1.0.0-rc.0` and publish with `--tag next`.
2. Confirm package metadata.
   - `@better-grid/pro` should have `publishConfig.access: "public"` for the source-available v1 plan.
   - MIT packages should keep `license: "MIT"`.
   - MIT packages should include package-local `LICENSE` files so npm tarballs carry the MIT text.
   - Pro should keep `license: "SEE LICENSE IN LICENSE"` and include `packages/pro/LICENSE`.
3. Build with the repo helper:

```powershell
node scripts/build.js
```

4. Run focused tests:

```powershell
pnpm --filter @better-grid/core test
pnpm --filter @better-grid/react test
```

5. Dry-run packages:

```powershell
npm pack --dry-run --json packages/core
npm pack --dry-run --json packages/plugins
npm pack --dry-run --json packages/pro
npm pack --dry-run --json packages/react
```

6. Verify workspace dependency rewriting with `pnpm publish` semantics, not raw `npm publish`.
   - Use `pnpm publish`; it rewrites `workspace:*` dependencies in packed manifests.
   - Do not publish with plain `npm publish` from package folders unless the manifests have already been rewritten.
7. Confirm npm auth and scope access:

```powershell
pnpm whoami
npm view @better-grid/core version
```

An `E404` from `npm view` is fine before the first publish. `ENEEDAUTH` means login is still required.

8. Publish in dependency order:

```powershell
pnpm --dir packages/core publish --access public --no-git-checks
pnpm --dir packages/plugins publish --access public --no-git-checks
pnpm --dir packages/pro publish --access public --no-git-checks
pnpm --dir packages/react publish --access public --no-git-checks
```

For an rc build, add `--tag next` to each publish command.

9. After publish, smoke-check from a clean temp app:

```powershell
npm view @better-grid/core version
npm view @better-grid/plugins version
npm view @better-grid/pro version
npm view @better-grid/react version
```

10. Tag and release after npm succeeds:

```powershell
git tag v1.0.0
git push origin main --tags
```

For an rc, use a matching tag such as `v1.0.0-rc.0`.

## Changes still needed before v1 publish

As of this note, the codebase has already been prepared for v1 package metadata and pro licensing. No further runtime code change is required just to publish v1.

Remaining non-code release work:

- create or gain access to the `@better-grid` npm scope;
- run `npm login` / `pnpm whoami` successfully;
- decide final `1.0.0` vs `1.0.0-rc.0 --tag next`;
- publish packages in dependency order;
- push commits and tags;
- create the GitHub release;
- replace placeholder sponsor / coffee wording when the link exists.

If future-me is tired: do not add DRM before v1. Ship the clean public split first.
