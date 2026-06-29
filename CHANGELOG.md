# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Because the package is pre-1.0, breaking
API changes increment the minor version.

## [Unreleased]

### Added

- Vault password rotation via `rotateVaultPassword()` with current-password verification.
- Recovery phrase rotation via `rotateRecoveryPhrase()` authorized by current vault password or passkey PRF.
- Automatic legacy envelope upgrade helpers: `maybeUpgradePasswordEnvelopeAfterUnlock()` and
  `maybeUpgradeRecoveryEnvelopeAfterUnlock()`.
- Canonical crypto policy module (`VAULT_CRYPTO_POLICY`) with `kdf-v2` Argon2id parameters for new envelopes.
- CI guard `npm run verify:crypto-policy` that fails when recommended algorithms or KDF strength regress.

### Changed

- New password and recovery envelopes now use Argon2id `kdf-v2` (`memory: 131072`, `iterations: 4`).
- Legacy `kdf-v1` envelopes (`memory: 65536`, `iterations: 3`) remain decryptable and upgrade on unlock.

### Security

- Documented that `@tgoliveira/vault-core` ships no email/SMTP flows or optional mail integrations.

## [0.2.0] - 2026-06-19

### Added

- Per-file coverage enforcement at 90% for statements, branches, functions, and lines.
- Method-specific Zod schemas for password, recovery phrase, and passkey PRF envelopes.
- Explicit `clear`, `found`, and `unavailable` storage namespace inspection results.
- Automatic browser activity tracking for React session hooks and providers.
- Complete implementation, adoption, security, and release documentation for humans and agents.
- Continuous validation for pull requests and pushes, including the per-file coverage gate.
- Manually dispatched npm publication with changelog-based automatic versioning, provenance, release
  commits, generated Git tags, and GitHub release notes.

### Changed

- **Breaking:** high-level payload decrypt and envelope unlock APIs now require the expected AAD
  scope and crypto profile.
- **Breaking:** direct session-key mutation helpers are no longer exported from the browser entry.
- **Breaking:** recovery word confirmation now requires every expected answer.
- Deprecated boolean storage checks now fail closed when inspection is unavailable.
- The published package now includes the complete `docs` directory and this changelog.

### Security

- Plaintext request guards now inspect nested objects and arrays with cycle protection.
- Persisted Argon2id parameters, salt sizes, and hash length are bounded before derivation.
- High-level decrypt and unlock operations reject AAD belonging to another user, resource, field,
  or application context.
- Envelope schemas reject invalid method and KDF metadata combinations.

## [0.1.1] - 2026-06-18

### Added

- Initial public release of `@tgoliveira/vault-core`.
- AES-GCM payload encryption with canonical AAD.
- Password and BIP39 recovery phrase envelopes using Argon2id.
- Passkey PRF envelope primitives.
- Browser in-memory session and React integration helpers.
- Plaintext rejection and sentinel-based testing utilities.
- LiqSense compatibility fixtures and migration aliases.
