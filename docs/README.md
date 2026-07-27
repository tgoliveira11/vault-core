# Documentation Index

Use this page as the documentation router for `@tgoliveira/vault-core`.

## Consumers

- [`IMPLEMENTATION_GUIDE.md`](IMPLEMENTATION_GUIDE.md): complete greenfield implementation from
  setup through password, recovery phrase, passkey PRF, persistence boundaries, and sessions.
- [`ADOPTING_VAULT_CORE_IN_EXISTING_APPS.md`](ADOPTING_VAULT_CORE_IN_EXISTING_APPS.md): phased
  migration for an application that already has vault code or stored ciphertext.
- [`ADOPTING_VAULT_CORE_1_1_0.md`](ADOPTING_VAULT_CORE_1_1_0.md): upgrade from 1.0.x — passkey PRF
  epic (#8–#16), duplicate removal, dock wiring, legacy AAD sunset.
- [`MIGRATING_PASSKEYS_FROM_1_2_0.md`](MIGRATING_PASSKEYS_FROM_1_2_0.md): correct 1.2.0 passkey
  integrations for synced credentials, opaque bindings, envelope variants, strict scoping, typed PRF
  capability, and explicit transports.
- [`MIGRATING_SESSION_OWNERSHIP_FROM_1_4_0.md`](MIGRATING_SESSION_OWNERSHIP_FROM_1_4_0.md): prevent
  stale async browser vault work from crossing account switches with opaque owner/epoch operations.
- [`INTEGRATING_EMERGENCY_DURESS_MODE.md`](INTEGRATING_EMERGENCY_DURESS_MODE.md): emergency / duress
  mode — decoy vault enrollment, unlock routing, dock long-press, exit flow.
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
- [`RELEASING.md`](RELEASING.md): redirect to `publishing.md`.
- [`../CHANGELOG.md`](../CHANGELOG.md): released and unreleased consumer-visible changes.
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md): package layers and cryptographic data flow.

## Architecture decisions

- [`adr/README.md`](adr/README.md): ADR index and format.
- [`adr/0001-emergency-duress-mode.md`](adr/0001-emergency-duress-mode.md): emergency / duress mode
  (accepted) — crypto decoy vault, activation triggers, session lifecycle.

## Topic references

- [`../PASSWORD_ENVELOPES.md`](../PASSWORD_ENVELOPES.md)
- [`../RECOVERY_PHRASE.md`](../RECOVERY_PHRASE.md)
- [`../PASSKEY_PRF_ENVELOPES.md`](../PASSKEY_PRF_ENVELOPES.md)
- [`../MIGRATION_FROM_LIQSENSE.md`](../MIGRATION_FROM_LIQSENSE.md)

If documentation and implementation disagree, treat the TypeScript declarations and runtime tests as
the immediate source of truth, then fix the documentation in the same change.
