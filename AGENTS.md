# Agent and Contributor Guide

This file is the operational entry point for AI agents and human contributors working on
`@tgoliveira/vault-core`.

## Language

- Source code, identifiers, error messages, tests, comments, and documentation must be written in
  English.
- Consumer-facing API examples must be complete TypeScript that reflects the current signatures.

## Read first

1. `README.md` for package scope and the shortest working example.
2. `docs/IMPLEMENTATION_GUIDE.md` for the complete consumer workflow.
3. `SECURITY.md` before changing crypto, persistence, validation, or session behavior.
4. `API_REFERENCE.md` for public entry points and security preconditions.
5. `CHANGELOG.md` before modifying a public contract.
6. `docs/RELEASING.md` before changing the package version or publishing.

## Public package boundaries

| Import | Responsibility |
| --- | --- |
| `@tgoliveira/vault-core` | Crypto, envelopes, recovery, schemas, AAD, and validation |
| `@tgoliveira/vault-core/browser` | Browser session lifecycle, storage inspection, PRF salt, recovery kit DOM helpers |
| `@tgoliveira/vault-core/react` | React session provider, hooks, and client status derivation |
| `@tgoliveira/vault-core/testing` | Plaintext sentinels and leak-detection helpers |

Do not add framework, persistence, database, route, authentication, or product payload concerns to
the core entry.

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
3. Update every affected example and signature in consumer documentation.
4. Preserve deprecated aliases only when the migration path remains safe and explicit.
5. Run `npm run validate`.
6. Run `npm pack --dry-run` when exports, package files, or documentation change.

The test suite enforces that the current `package.json` version has a released changelog entry. A
version bump without a changelog release section must fail validation.

Do not bump versions, create release tags, or publish manually. Start the `Publish package to npmjs`
workflow on `main`; it owns version selection, release metadata, npm publication, and tag creation.

## Required validation

```bash
npm ci
npm run validate
npm pack --dry-run
```

Coverage thresholds are enforced per production file at 90% for statements, branches, functions,
and lines. Do not lower or bypass thresholds to merge a change.

## Definition of done

- Public types and runtime schemas agree.
- Security failures have regression tests.
- All code and documentation are in English.
- `CHANGELOG.md` describes the consumer-visible effect.
- Documentation examples typecheck conceptually against current APIs.
- `npm run validate` and package dry-run pass.
