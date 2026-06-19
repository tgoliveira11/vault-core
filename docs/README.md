# Documentation Index

Use this page as the documentation router for `@tgoliveira/vault-core`.

## Consumers

- [`IMPLEMENTATION_GUIDE.md`](IMPLEMENTATION_GUIDE.md): complete greenfield implementation from
  setup through password, recovery phrase, passkey PRF, persistence boundaries, and sessions.
- [`ADOPTING_VAULT_CORE_IN_EXISTING_APPS.md`](ADOPTING_VAULT_CORE_IN_EXISTING_APPS.md): phased
  migration for an application that already has vault code or stored ciphertext.
- [`../API_REFERENCE.md`](../API_REFERENCE.md): public entry points and their security preconditions.
- [`../SECURITY.md`](../SECURITY.md): threat model, secret boundaries, and storage rules.

## Maintainers and agents

- [`../AGENTS.md`](../AGENTS.md): repository operating rules and definition of done.
- [`RELEASING.md`](RELEASING.md): versioning, changelog, tag, validation, and publication procedure.
- [`../CHANGELOG.md`](../CHANGELOG.md): released and unreleased consumer-visible changes.
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md): package layers and cryptographic data flow.

## Topic references

- [`../PASSWORD_ENVELOPES.md`](../PASSWORD_ENVELOPES.md)
- [`../RECOVERY_PHRASE.md`](../RECOVERY_PHRASE.md)
- [`../PASSKEY_PRF_ENVELOPES.md`](../PASSKEY_PRF_ENVELOPES.md)
- [`../MIGRATION_FROM_LIQSENSE.md`](../MIGRATION_FROM_LIQSENSE.md)

If documentation and implementation disagree, treat the TypeScript declarations and runtime tests as
the immediate source of truth, then fix the documentation in the same change.

