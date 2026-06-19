# Release Process

Releases are initiated manually, but version calculation, validation, npm publication, Git commit,
Git tag, and GitHub release creation are automated. Do not create release tags manually.

## Version policy

This package follows Semantic Versioning. While the major version is `0`:

- Patch releases contain backward-compatible fixes or documentation-only changes.
- Minor releases contain new features or any breaking public API change.
- After `1.0.0`, breaking changes increment the major version.

Every consumer-visible change belongs under `CHANGELOG.md` → `Unreleased` in one of these sections:

- `Added`
- `Changed`
- `Deprecated`
- `Removed`
- `Fixed`
- `Security`

Mark breaking changes with `**Breaking:**` and include a migration path.

## One-time repository and npm setup

1. Create a protected GitHub environment named `npmjs`.
2. Add required reviewers to that environment if publication needs human approval.
3. Allow the GitHub Actions bot to push the release commit and `vault-core-v*` tags to `main`, or
   provide an equivalently scoped GitHub App token if branch protection forbids `GITHUB_TOKEN` pushes.
4. In the npm package settings, configure a GitHub Actions trusted publisher with:
   - Repository owner: the GitHub owner of this repository.
   - Repository: `vault-core`.
   - Workflow filename: `publish-vault-core.yml`.
   - Environment: `npmjs`.
   - Allowed action: `npm publish`.
5. After one successful OIDC publication, remove the legacy `NPM_TOKEN` secret and disallow token
   publishing in npm package settings. The workflow retains token fallback only for migration.

Trusted publishing requires a GitHub-hosted runner, Node 22.14 or newer, npm 11.5.1 or newer, and
`id-token: write`. The workflow uses Node 24 and verifies the npm version before continuing.

## Start a release

Use the GitHub Actions UI:

1. Open **Actions** → **Publish package to npmjs**.
2. Select **Run workflow** on `main`.
3. Leave `version` blank for automatic versioning, or enter one of:
   - An exact stable version such as `0.3.0`.
   - `patch`, `minor`, or `major`.

Equivalent GitHub CLI commands:

```bash
# Automatic version
gh workflow run publish-vault-core.yml --ref main

# Exact or explicit bump
gh workflow run publish-vault-core.yml --ref main -f version=0.3.0
gh workflow run publish-vault-core.yml --ref main -f version=patch
```

## Automatic version calculation

When `version` is blank or `auto`, `scripts/prepare-release.mjs` reads the `Unreleased` changelog:

1. Any `**Breaking:**` entry selects major, or minor while the current major version is `0`.
2. Otherwise, at least one `Added` entry selects minor.
3. Otherwise, the release selects patch.

When `Unreleased` is empty, the workflow enters recovery mode for the current released version. It
completes missing npm, tag, or GitHub release state without publishing a duplicate.

## Publication gates and ordering

The workflow serializes releases so two versions cannot publish concurrently. It then:

1. Checks out `main` with full tag history.
2. Installs the exact lockfile with `npm ci`.
3. Runs `npm audit` at the `high` threshold, which also blocks critical vulnerabilities.
4. Calculates the version and moves `Unreleased` entries to a dated release section.
5. Runs typecheck, all tests, per-file coverage gates, and the production build.
6. Builds one tarball that becomes the exact validated publication artifact.
7. Rejects version collisions or inconsistent pre-existing tags.
8. Commits `package.json`, `package-lock.json`, and `CHANGELOG.md` as `Release x.y.z`.
9. Publishes to npm with OIDC/provenance when trusted publishing is configured.
10. Creates and pushes `vault-core-vx.y.z` only after npm publication succeeds.
11. Creates GitHub release notes and a workflow summary.

The npm registry is immutable: a published version cannot be overwritten. If publication succeeds
but tag or GitHub release creation fails, rerun the workflow with a blank version. Recovery mode
detects the released changelog version, skips duplicate npm publication, and completes missing Git
metadata.

## Post-release verification

- Confirm npmjs shows the expected version and provenance badge.
- Confirm all four package entry points resolve.
- Confirm README, changelog, and implementation guide render on npmjs.
- Confirm `vault-core-vx.y.z` and the GitHub release point to the release commit.
- Confirm `CHANGELOG.md` has a new empty `Unreleased` section.
