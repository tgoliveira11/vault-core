# Publishing and releases

Manual-only releases for `@tgoliveira/vault-core`. Nothing publishes on push, tag push, or GitHub Release creation.

## Release invariant

For every published version `X.Y.Z`:

```text
npm @tgoliveira/vault-core@X.Y.Z  ⟺  git tag vault-core-vX.Y.Z  ⟺  GitHub Release vault-core-vX.Y.Z
```

All three must exist after a successful publish run. The workflow verifies this at the end of each run.

Historical tags before this policy used the same `vault-core-v*` prefix.

## Manual only

| Action | Allowed trigger |
| --- | --- |
| npm publish | Publish workflow on `main` only |
| GitHub Release | Same workflow |
| Release tag | Same workflow |
| Version bump in git | Same workflow (`github-actions[bot]`) |

Agents and contributors must **not** run `npm publish` or dispatch the publish workflow without explicit owner approval.

Workflow file: `.github/workflows/publish-vault-core.yml`  
Trigger: **`workflow_dispatch` only** (no `push`, `release`, or `workflow_call` triggers).

## Changelog and version

| State | Meaning |
| --- | --- |
| `CHANGELOG.md` → `[Unreleased]` with entries | New release — workflow bumps version from notes |
| `[Unreleased]` empty | **Recovery mode** — complete missing npm/tag/release for the version already in `package.json` |
| Operator requests `patch`/`minor`/`major`/exact version with empty `[Unreleased]` | **Fail early** with a clear error |

Automatic bump (blank or `auto` input):

1. `**Breaking:**` → major (or minor while major is `0`)
2. Any `Added` entry → minor
3. Otherwise → patch

Implementation: `scripts/prepare-release.mjs`  
Pre-flight (before bump): `scripts/changelog-preflight.mjs`

## Start a release

GitHub UI: **Actions** → **Publish package to npmjs** → **Run workflow** on `main`.

```bash
# New release (requires non-empty [Unreleased])
gh workflow run publish-vault-core.yml --ref main

# Explicit bump or version
gh workflow run publish-vault-core.yml --ref main -f version=patch
gh workflow run publish-vault-core.yml --ref main -f version=0.4.0

# Recovery (empty [Unreleased] — completes missing tag/release/npm)
gh workflow run publish-vault-core.yml --ref main
```

The `npmjs` environment may require manual deployment approval depending on [repo-settings.md](./repo-settings.md).

## Workflow order

1. Checkout `main` with full tag history
2. `npm ci`
3. Security audit (`npm run audit:security`)
4. **Changelog pre-flight** — new release vs recovery; fail if operator requests new version with empty `[Unreleased]`
5. **Prepare release** — bump version and move `[Unreleased]` to dated section (skipped in recovery)
6. `npm run validate`
7. Build publication tarball (`npm pack`)
8. Detect existing npm version and git tag
9. Commit and push release metadata (`Release X.Y.Z`) when version changed
10. Publish tarball to npm (OIDC provenance when configured)
11. Create and push annotated tag `vault-core-vX.Y.Z` (with `git config user.*` set on runner)
12. Create GitHub Release if missing
13. **Verify release invariant** — registry, tag, and GitHub Release all present

## Recovery mode

Use when a prior run partially succeeded (e.g. npm published but tag failed):

1. Ensure `package.json` version matches the version you want to recover.
2. Ensure `[Unreleased]` is empty (or only whitespace).
3. Re-dispatch the workflow on `main` with blank `version`.

Recovery will:

- Skip version bump and changelog rewrite
- Skip npm publish if the version already exists
- Create missing tag and/or GitHub Release

It will **not** double-bump the version.

## npm trusted publishing (OIDC)

One-time npm package configuration:

- Repository: `tgoliveira11/vault-core`
- Workflow: `publish-vault-core.yml`
- Environment: `npmjs`

Requires `id-token: write`, Node ≥ 22.14, npm ≥ 11.5.1. The workflow uses Node 24.

`package.json` must include a `repository` field (required for provenance). This repo already sets:

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/tgoliveira11/vault-core.git"
}
```

## Post-release verification

- [ ] npm shows `@tgoliveira/vault-core@X.Y.Z` with provenance
- [ ] Tag `vault-core-vX.Y.Z` points at the release commit
- [ ] GitHub Release `vault-core-vX.Y.Z` exists
- [ ] All package exports resolve (`npm pack --dry-run`)
- [ ] `CHANGELOG.md` has an empty `[Unreleased]` section

## Bot exception

The publish workflow may push release commits to `main` as `github-actions[bot]`. Branch protection must allow that bot to bypass or satisfy push rules. See [repo-settings.md](./repo-settings.md).

Human contributors and AI agents must not push directly to `main`.

## Legacy doc

[RELEASING.md](./RELEASING.md) redirects here for the canonical release documentation.
