# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Because the package is pre-1.0, breaking
API changes increment the minor version.

## [Unreleased]

### Added

- Runtime admin config overrides with resolution priority **admin → env → default**:
  `applyVaultAdminOverrides()`, `validateVaultAdminOverride()`, `VAULT_OVERRIDABLE_CONFIG_KEYS`, and
  `VAULT_CONFIG_KEY_DEFINITIONS`.
- `buildVaultAdminConfigFromEnv()` accepts optional `adminOverrides` for consuming apps that persist
  overrides in a database or other store.
- Editable `VaultAdminConfigPage` when `configApiBase` is set (GET/POST/DELETE `{apiBase}/admin/config`).
- Source badge `admin` on configuration entries overridden at runtime.
- `configApiBase` and `adminOverrides` props on `VaultAdminPageProps`.
- Vault password policy assessment helpers: `assessVaultPassword()`, `validateVaultPasswordAgainstPolicy()`,
  `validateVaultPasswordSetup()`, and related requirement/strength utilities.
- React components `VaultPasswordField` and `VaultPasswordSetupFields` exported from
  `@tgoliveira/vault-core/react` (strength score, enforcement mode, requirement checklist).
- Browser vault deletion helpers: `deleteVaultAfterAuthorization()` and
  `deleteVaultWithPasswordAuthorization()` — apps pass a `purgePersistedVault` callback for
  envelope/payload removal; vault-core clears in-memory session state.
- `VaultStatusDock` and `VaultDockQuickUnlock` React components exported from
  `@tgoliveira/vault-core/react` — header-attached vault lock/unlock UI with auto-lock countdown,
  quick unlock slot, collapse preference, and `requestVaultDockExpand()` integration.
- `VaultProtectedGate` React component — blur overlay on vault-protected pages while locked;
  blocks interaction, keeps content mounted, expands the status dock on Enter, and redirects only
  when the vault is not configured.
- `VaultProtectedGate` `overlayClassName` and `overlayBackground` props — customize lock overlay
  appearance via extra classes or the `--vc-vault-lock-overlay-color` CSS variable.
- `VaultLockOverlayExclude` — marks layout chrome (navigation, header) that stays interactive above
  the lock overlay; overlay panels are carved around registered exclusion regions.
- `computeVaultLockOverlayPanels()`, `useVaultLockOverlayPanels()`, and
  `VAULT_LOCK_OVERLAY_EXCLUDE_SELECTOR` for custom layouts.
- `shouldVaultLockOverlayExpandDock()` helper for Enter-key dock expansion guards.
- `VaultUnlockPanel` React component — full-page unlock UI with vault password, recovery phrase, and
  optional passkey unlock (`autoFocusPassword` defaults to `true`; `autoStartPasskey` defaults to
  `false` — passkey requires an explicit click on the full unlock page).
- Return-path helpers: `VAULT_UNLOCK_RETURN_QUERY_PARAM` (`next`), `resolveVaultUnlockReturnPath()`,
  `readVaultUnlockReturnPath()`, `buildVaultUnlockHref()`, and `useVaultUnlockPageNavigation()` for
  post-unlock redirects.
- `vc-vault-unlock-*` styles in `vault-admin.css` for the unlock page panel.
- `suppressVaultActivity()` on `@tgoliveira/vault-core/browser` — prevents dock interactions from
  resetting the inactivity timer; activity guard ignores `[data-vault-dock-ignore-activity]`.
- `vc-status-dock-*` styles in `vault-admin.css` for the status dock.

### Changed

- `VaultProtectedGate` lock overlay is rendered as one or more fixed panels that cover the viewport
  except regions marked with `VaultLockOverlayExclude` (for example the app header / navigation).
- `VaultProtectedGate` lock overlay is much heavier (24px blur, ~92% background opacity) so
  underlying page content is barely visible (~5–10%) while locked.
- `VaultStatusDock` locked collapsed handle reserves the same width as the unlocked handle (invisible
  countdown slot and matching label width) so the dock does not resize when the vault locks.
- `VaultStatusDock` keeps the collapsed locked handle visible on the full unlock page (no longer
  hidden when `isFullUnlockPage` matches).
- `VaultStatusDock` defaults `buildUnlockHref` to `buildVaultUnlockHref(unlockPath, returnPath)` when
  the app does not supply a custom builder.
- `VaultDockQuickUnlock` auto-focuses the vault password field, submits on Enter, and auto-starts
  passkey unlock on mount when passkey is primary (`autoFocusPassword` / `autoStartPasskey` default
  to `true`; passkey auto-start is best-effort — browsers may require a recent user gesture).
- `VaultStatusDock` collapses the expanded unlocked panel when auto-lock fires or the session
  becomes locked; locked handle copy is **Vault locked** (was **Vault closed**); `data-vault-state`
  uses `locked` instead of `closed` when the vault is locked.
- Vault auto-lock countdown no longer resets on pointer, keyboard, touch, or focus events by default.
  Only explicit `touchVaultSession()` (the vault status dock **Stay unlocked** action) renews the timer.
  Opt in to activity-based renewal with `registerVaultActivityGuard()` or
  `registerActivityGuard` on `VaultSessionProvider` / `useVaultSession`.
- `registerActivityGuard` on `VaultSessionProvider` and `useVaultSession` now defaults to `false`.
- `listVaultAdminConfigEntries()` accepts optional `adminOverrides` and includes all env-catalog password
  policy fields; each entry exposes `overridable`.
- `VaultAdminEnvSource` now includes `"admin"`.

### Changed

- `VaultStatusDock` **Lock now** uses the same subtle button style as **Stay unlocked** in the
  expanded open panel (was a text link).
- Locked quick-unlock panel width matches the open expanded dock (`15rem`) so passkey/password
  actions align with **Stay unlocked**.
- `VaultDockQuickUnlock` unlock and passkey buttons use the same subtle dock action style as
  **Stay unlocked** / **Lock now** in the expanded open panel (was accent primary).
- Dock passkey unlock cancellation or failure redirects to the full unlock page with the current
  return path (`redirectOnPasskeyUnlockFailure`, default `true`; `onNavigateToUnlock` for SPA apps).
- Expanded vault dock stays open for clicks and focus inside the dock region (handle + panel); it
  collapses on outside click or Escape only (handle no longer toggles closed while expanded).

### Fixed

- `VaultStatusDock` expanded panel stays open when interacting with password-manager autofill UI
  (for example Enpass) rendered outside the dock DOM while the vault password field remains focused.
- `VaultStatusDock` **Stay unlocked** label and circular countdown ring now use the active vault
  session auto-lock minutes (`configureVaultSession` / `VaultSessionProvider`) when
  `autoLockMinutes` is omitted, instead of always defaulting to 15 minutes.
- `getVaultAutoLockMinutes()` exported from `@tgoliveira/vault-core/browser` for the resolved
  session timeout.
- `VaultStatusDock` keeps the collapsed locked handle visible while the quick-unlock panel is
  expanded (password / passkey), matching unlocked expanded behavior.
- `VaultStatusDock` keeps the collapsed handle (lock icon and auto-lock countdown) visible while the
  unlocked expanded panel is open, instead of replacing it with the panel alone.

## [0.3.0] - 2026-06-29

### Added

- Vault password rotation via `rotateVaultPassword()` with current-password verification.
- Recovery phrase rotation via `rotateRecoveryPhrase()` authorized by current vault password or passkey PRF.
- Automatic legacy envelope upgrade helpers: `maybeUpgradePasswordEnvelopeAfterUnlock()` and
  `maybeUpgradeRecoveryEnvelopeAfterUnlock()`.
- Canonical crypto policy module (`VAULT_CRYPTO_POLICY`) with `kdf-v2` Argon2id parameters for new envelopes.
- CI guard `npm run verify:crypto-policy` that fails when recommended algorithms or KDF strength regress.
- Vault admin UI exported from `@tgoliveira/vault-core/react` (8 screens: panel, config, env template, crypto policy, profile, session, password policy, security).
- `buildVaultAdminConfigFromEnv()`, `VAULT_ADMIN_ENV_CATALOG`, and `buildVaultEnvLocalTemplate()` for app-owned env mapping.
- `@tgoliveira/vault-core/vault-admin.css` stylesheet for admin pages.

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
