# Contributing to vault-core

Conservative workflow for humans and AI agents. Default base branch is **`main`** (no `develop`).

## Repository parameters

| Parameter | Value |
| --- | --- |
| Owner/repo | `tgoliveira11/vault-core` |
| Package | `@tgoliveira/vault-core` |
| Validate | `npm run validate` |
| Publish workflow | `.github/workflows/publish-vault-core.yml` |
| OIDC environment | `npmjs` |
| Release tag prefix | `vault-core-v` (e.g. `vault-core-v0.3.0`) |

Related docs: [publishing.md](./publishing.md), [repo-settings.md](./repo-settings.md), [CURRENT_PRODUCT_SURFACE.md](./CURRENT_PRODUCT_SURFACE.md).

## Branch-first workflow

Before substantive work, create a branch from up-to-date `main`:

| Prefix | Use for |
| --- | --- |
| `feature/…` | Behavior, API, UX |
| `fix/…` | Bug fixes |
| `docs/…` | Documentation only |
| `chore/…` | CI, tooling, dependencies, release plumbing |

Rules:

- **Do not commit directly to `main`**, except when the repository owner explicitly requests it.
- **Never push to `main`** without explicit owner approval.
- **Do not open, merge, or approve PRs** without explicit owner approval.
- Prefer **squash merge** when merging PRs.
- After merge: `git checkout main && git pull`, delete the merged local branch, confirm changelog/surface/tests before closing the task.

CI enforces branch prefixes on pull requests (`branch-name` job).

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `ci:`
- Optional scope: `feat(admin): …`

Subject line: clear and concise. Body only when it adds context.

**Commit only when the owner asks.** Otherwise leave work uncommitted or on a feature branch.

Never run destructive git commands (`push --force`, `reset --hard`, etc.) unless explicitly requested.

## Pre-PR checklist (code changes)

Before opening a PR or declaring a code task done:

1. Run `npm run validate` (typecheck, crypto policy guard, tests with coverage, build).
2. Add or update tests for changed behavior.
3. Update `CHANGELOG.md` → `## [Unreleased]` for behavior, API, schema, env vars, privacy, or visible UX changes.
4. Update [CURRENT_PRODUCT_SURFACE.md](./CURRENT_PRODUCT_SURFACE.md) when exports, published artifacts, admin screens, or shipped/planned status changes.
5. Confirm no secrets (`.env`, credentials) are staged.

Trivial documentation-only changes may skip `npm run validate`.

## Pull request cycle

Open a PR against `main` with `gh pr create` **only when the owner asks**. Include:

- **Summary** — consumer-visible effect and motivation.
- **Test plan** — what was run and what remains manual.

Use the PR template checklist. Address review feedback on the same branch.

Do **not** merge, approve, or push without explicit owner approval.

## Changelog

Work in progress lives under `CHANGELOG.md` → `## [Unreleased]`.

Sections: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`. Mark breaking changes with `**Breaking:**` and a migration path.

A new npm release requires a non-empty `[Unreleased]` section. See [publishing.md](./publishing.md) for release and recovery rules.

## Releases (summary)

- Publishing is **manual only** via GitHub Actions `workflow_dispatch`.
- Agents must **not** run the publish workflow or `npm publish` without explicit owner approval.
- Release invariant: `@tgoliveira/vault-core@X.Y.Z` ⟺ git tag `vault-core-vX.Y.Z` ⟺ GitHub Release `vault-core-vX.Y.Z`.

The publish workflow may commit release metadata to `main` as `github-actions[bot]`. That exception does **not** apply to human or agent contributors.

Full details: [publishing.md](./publishing.md).

## Agent-specific rules

See also `AGENTS.md` and `.cursor/rules/branch-pr-publish.mdc`.

- Read `SECURITY.md` before crypto, validation, or session changes.
- Do not bump versions, create release tags, or publish manually.
- Do not lower coverage thresholds to merge.
