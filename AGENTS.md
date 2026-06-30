# Agent and Contributor Guide

Operational entry point for AI agents and human contributors working on `@tgoliveira/vault-core`.

## Workflow docs (read first for process)

| Doc | Purpose |
| --- | --- |
| [docs/contributing.md](docs/contributing.md) | Branches, PRs, commits, changelog, pre-PR checklist |
| [docs/publishing.md](docs/publishing.md) | Manual publish, release invariant, recovery mode |
| [docs/repo-settings.md](docs/repo-settings.md) | GitHub branch protection and `npmjs` environment |
| [docs/CURRENT_PRODUCT_SURFACE.md](docs/CURRENT_PRODUCT_SURFACE.md) | Live inventory of exports and shipped features |
| [CONTRIBUTING.md](CONTRIBUTING.md) | One-line pointer to contributing doc |

Cursor agents: `.cursor/rules/branch-pr-publish.mdc` (always applied).

## Language

- Source code, identifiers, error messages, tests, comments, and documentation must be written in English.
- Consumer-facing API examples must be complete TypeScript that reflects the current signatures.

## Technical read order

1. `README.md` for package scope and the shortest working example.
2. `docs/IMPLEMENTATION_GUIDE.md` for the complete consumer workflow.
3. `SECURITY.md` before changing crypto, persistence, validation, or session behavior.
4. `API_REFERENCE.md` for public entry points and security preconditions.
5. `CHANGELOG.md` before modifying a public contract.

## Branch and PR rules (summary)

- Work on `feature/`, `fix/`, `docs/`, or `chore/` branches from `main`.
- Do not commit to `main`, open/merge PRs, push to `main`, or publish without **explicit owner approval**.
- Commit only when the owner asks.
- Prefer squash merge. Conventional Commits for messages.

## Public package boundaries

| Import | Responsibility |
| --- | --- |
| `@tgoliveira/vault-core` | Crypto, envelopes, recovery, rotation, admin config, schemas, AAD, validation |
| `@tgoliveira/vault-core/browser` | Browser session lifecycle, storage inspection, PRF salt, recovery kit DOM helpers |
| `@tgoliveira/vault-core/react` | React session provider, hooks, client status, vault admin UI pages |
| `@tgoliveira/vault-core/testing` | Plaintext sentinels and leak-detection helpers |
| `@tgoliveira/vault-core/vault-admin.css` | Styles for vault admin pages |

Do not add framework, persistence, database, route, authentication, or product payload concerns to the core entry.

## Non-negotiable security invariants

- Vault passwords, recovery phrases, UVKs, PRF output, and decrypted payloads never go to the server.
- Decrypted vault state is never persisted to localStorage or IndexedDB.
- High-level decrypt and unlock calls always receive and validate the expected scope and profile.
- Persisted KDF metadata is untrusted and bounded before work begins.
- Session key changes use lifecycle-aware lock and unlock APIs; public direct setters are forbidden.
- Account authentication and vault unlock remain separate security domains.

## Change protocol

For every user-visible change:

1. Update implementation and tests together.
2. Add an entry under the appropriate `CHANGELOG.md` `Unreleased` heading.
3. Update `docs/CURRENT_PRODUCT_SURFACE.md` when exports, admin screens, or shipped/planned status changes.
4. Update every affected example and signature in consumer documentation.
5. Preserve deprecated aliases only when the migration path remains safe and explicit.
6. Run `npm run validate`.
7. Run `npm pack --dry-run` when exports, package files, or documentation change.

The test suite enforces that the current `package.json` version has a released changelog entry. A version bump without a changelog release section must fail validation.

## Publishing (agents)

- **Never** run `npm publish` or dispatch the publish workflow without explicit owner approval.
- **Never** bump versions or create release tags manually.
- Release invariant: `@tgoliveira/vault-core@X.Y.Z` ⟺ `vault-core-vX.Y.Z` tag ⟺ GitHub Release `vault-core-vX.Y.Z`.
- Only the publish workflow (`workflow_dispatch` on `main`) may commit release metadata as `github-actions[bot]`.

See [docs/publishing.md](docs/publishing.md).

## Required validation

```bash
npm ci
npm run validate
npm pack --dry-run
```

Coverage thresholds are enforced per production file at 90% for statements, branches, functions, and lines. Do not lower or bypass thresholds to merge a change.

## Definition of done

- Public types and runtime schemas agree.
- Security failures have regression tests.
- All code and documentation are in English.
- `CHANGELOG.md` describes the consumer-visible effect.
- `docs/CURRENT_PRODUCT_SURFACE.md` updated when the product surface changed.
- Documentation examples typecheck conceptually against current APIs.
- `npm run validate` and package dry-run pass.
