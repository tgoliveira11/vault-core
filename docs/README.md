# Documentation Index

Use this page as the documentation router for `@tgoliveira/vault-core`.

For new cross-device passkey vault unlock, start with
[`PORTABLE_PASSKEY_BROKER.md`](PORTABLE_PASSKEY_BROKER.md). PRF migration documents are historical
compatibility references and do not promise one stable key across devices.

## Consumers

- [`PORTABLE_PASSKEY_BROKER.md`](PORTABLE_PASSKEY_BROKER.md): canonical one-enrollment
  cross-device passkey architecture and explicit broker trust boundary.
- [`IMPLEMENTATION_GUIDE.md`](IMPLEMENTATION_GUIDE.md): complete greenfield implementation from
  setup through password, recovery phrase, passkey PRF, persistence boundaries, and sessions.
- [`ADOPTING_VAULT_CORE_IN_EXISTING_APPS.md`](ADOPTING_VAULT_CORE_IN_EXISTING_APPS.md): phased
  migration for an application that already has vault code or stored ciphertext.
- [`ADOPTING_UNIFIED_PASSKEY_UNLOCK_FROM_1_5_1.md`](ADOPTING_UNIFIED_PASSKEY_UNLOCK_FROM_1_5_1.md):
  make synced credentials usable without a binding while preserving exact bound quick unlock and
  password/recovery-authorized append-only variant repair.
- [`PASSKEY_ACCOUNT_AUTH_INTEROPERABILITY.md`](PASSKEY_ACCOUNT_AUTH_INTEROPERABILITY.md): optional
  reuse of one WebAuthn credential for account sign-in and vault PRF without merging authorization.
- [`INTEGRATING_EMERGENCY_DURESS_MODE.md`](INTEGRATING_EMERGENCY_DURESS_MODE.md): emergency / duress
  mode — opt-in, disabled-by-default decoy enrollment, unlock routing, dock long-press, and exit.
- [`../apps/consumer-demo/README.md`](../apps/consumer-demo/README.md): runnable local reference app
  (not published to npm).
- [`../API_REFERENCE.md`](../API_REFERENCE.md): public entry points and their security preconditions.
- [`../SECURITY.md`](../SECURITY.md): threat model, secret boundaries, and storage rules.

## Maintainers and agents

- [`../AGENTS.md`](../AGENTS.md): repository operating rules and definition of done.
- [`contributing.md`](contributing.md): branches, PRs, commits, changelog, pre-PR checklist.
- [`publishing.md`](publishing.md): manual publish, release invariant, recovery mode.
- [`repo-settings.md`](repo-settings.md): GitHub branch protection and `npmjs` environment.
- [`CURRENT_PRODUCT_SURFACE.md`](CURRENT_PRODUCT_SURFACE.md): live inventory of exports and shipped features.
- [`../CHANGELOG.md`](../CHANGELOG.md): released and unreleased consumer-visible changes.
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md): package layers and cryptographic data flow.

## Architecture decisions

- [`adr/README.md`](adr/README.md): ADR index and format.
- [`adr/0001-emergency-duress-mode.md`](adr/0001-emergency-duress-mode.md): emergency / duress mode
  (accepted) — crypto decoy vault, activation triggers, session lifecycle.

## Historical upgrade guides

These documents exist for applications migrating persisted data or contracts from the named older
release. New integrations should start with the implementation guide above.

- [`ADOPTING_VAULT_CORE_1_1_0.md`](ADOPTING_VAULT_CORE_1_1_0.md): 1.0.x → 1.1.x.
- [`MIGRATING_PASSKEYS_FROM_1_2_0.md`](MIGRATING_PASSKEYS_FROM_1_2_0.md): 1.2.x synced-passkey
  schema and envelope migration.
- [`MIGRATING_SESSION_OWNERSHIP_FROM_1_4_0.md`](MIGRATING_SESSION_OWNERSHIP_FROM_1_4_0.md): 1.4.x
  browser session ownership migration.
- [`MIGRATION_LEGACY_VAULT_KEY.md`](MIGRATION_LEGACY_VAULT_KEY.md): bounded legacy AAD fallback.
- [`../MIGRATION_FROM_LIQSENSE.md`](../MIGRATION_FROM_LIQSENSE.md): original extraction mapping.

## Topic references

- [`../PASSWORD_ENVELOPES.md`](../PASSWORD_ENVELOPES.md)
- [`../RECOVERY_PHRASE.md`](../RECOVERY_PHRASE.md)
- [`../PASSKEY_PRF_ENVELOPES.md`](../PASSKEY_PRF_ENVELOPES.md)

If documentation and implementation disagree, treat the TypeScript declarations and runtime tests as
the immediate source of truth, then fix the documentation in the same change.
