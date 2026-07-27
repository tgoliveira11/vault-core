# Current product surface

Living inventory of what `@tgoliveira/vault-core` exposes today. Update this file when exports, admin screens, published artifacts, or shipped/planned status changes.

Last reviewed: **2026-07-27** (package version **1.4.0**, session operation ownership in Unreleased)


## Package entry points (shipped)

| Export | Status | Purpose |
| --- | --- | --- |
| `@tgoliveira/vault-core` | Shipped | Crypto, envelopes, recovery, rotation, admin config helpers, validation |
| `@tgoliveira/vault-core/browser` | Shipped | Session lifecycle, auto-lock, storage inspection, PRF salt, recovery kit DOM |
| `@tgoliveira/vault-core/react` | Shipped | Session provider/hooks, client status, **vault admin UI pages** |
| `@tgoliveira/vault-core/testing` | Shipped | Plaintext sentinels and leak-detection helpers |
| `@tgoliveira/vault-core/vault-admin.css` | Shipped | Styles for vault admin pages and vault status dock |

## Consumer integration docs (shipped)

- [docs/CONSUMER_SECURITY_REQUIREMENTS.md](./CONSUMER_SECURITY_REQUIREMENTS.md) — mandatory checklist
  for apps and agents (auth/RBAC, rate limits, CSP, plaintext guards, unlock access control)
- [docs/ADOPTING_VAULT_CORE_1_1_0.md](./ADOPTING_VAULT_CORE_1_1_0.md) — 1.0.x → 1.1.0 upgrade:
  package vs consumer matrix, phased duplicate removal, dock/React wiring

## Core capabilities (shipped)

- AES-256-GCM encrypted payloads with canonical AAD
- Argon2id password and recovery envelopes (`kdf-v1` legacy, `kdf-v2` recommended)
- Passkey PRF envelope wrap/unwrap, including bounded local candidate-variant matching (no WebAuthn ceremony)
- Robust `extractPasskeyPrfOutput` with Safari `evalByCredential` preference and byte coercion
- Typed `sanitizeWebAuthnResponseForServer` removal of PRF extension results before server serialization
- WebAuthn PRF ceremony prep (`prepareWebAuthnPrfExtensions`, `alignPrfExtensionsForCredential`,
  `applyVaultUnlockTransportPolicy`, `prepareVaultUnlockAuthenticationOptions`,
  `prepareVaultPasskeyPrfAuthenticationOptions`)
- Typed PRF capability (`resolvePasskeyPrfCapability`) separating heuristic/API availability from
  registration `prf.enabled`, authentication `prf.results`, and incompatible/missing results
- BIP39 12/24-word recovery phrases and recovery kit text
- Password rotation (`rotateVaultPassword`)
- Recovery phrase rotation (`rotateRecoveryPhrase`)
- Vault deletion after authorization (`deleteVaultAfterAuthorization`, `deleteVaultWithPasswordAuthorization` on browser entry)
- Account-owned browser operation epochs (`beginVaultSessionOperation`, `clearVaultSessionOwner`,
  current-operation guards, typed cancellation) prevent stale async A→B session/cache mutations
- Owner/epoch/role/key session leases (`captureVaultSessionLease`, lease guards, safe snapshot) bind
  post-unlock saves, hydration, and timer renewal to the exact installed session
- Runtime vault payload validation (`decryptVaultPayloadWithSchema`, `VaultPayloadValidationError`)
- `normalizeEnvelopeAadContext` for passkey envelopes missing `aad.context`, plus fail-closed legacy
  AAD allowlisting through `legacyVaultKeyAadContexts`
- Auto-upgrade legacy KDF on unlock
- Plaintext rejection / sentinel validation
- Canonical crypto policy (`VAULT_CRYPTO_POLICY`) + CI guard
- Vault-key envelope helpers (`assertInnerVaultKeyBlobMatchesVaultKey`, `extractInnerVaultKeyBlob`,
  `rewrapInnerVaultKeyMaterialForDerivedKeys`, `rewrapInnerVaultKeyMaterialForPrfOutput`,
  `rewrapEncryptedVaultKeyForDerivedKeys`, `wrapUserVaultKeyWithPrfOutput`,
  `unwrapUserVaultKeyWithPrfOutput`, `WrapUserVaultKeyOptions`)
- Passkey enroll after unlock: `createPasskeyPrfEnvelope` options, `createPasskeyPrfEnvelopeWithSessionCache`,
  browser `VaultInnerKeyMaterialCache` (memory-only, cleared on lock)
- Passkey credential/binding/variant model (`VaultPasskeyBindingStore`, runtime state schemas,
  `scopeAuthenticationOptionsToCredential`, `PasskeyCredentialSelection`,
  `resolvePasskeyUnlockAvailable`, `parsePasskeyBindingId`; deprecated device aliases retained)
- Passkey PRF envelope candidates (`unlockWithPasskeyPrfEnvelopeCandidates`, maximum 5) and
  emergency-aware `unlockVaultWithPasskeyCandidateRouting`
- Passkey crypto failure classifier (`classifyPasskeyCryptoError`, `getDefaultPasskeyCryptoErrorMessage`, `PasskeyCryptoFailureKind`)

## Emergency / duress mode (shipped)

- Decoy vault record schemas (`vaultDecoyRecordSchema`, `vaultSetupWithDecoySchema`)
- Server metadata schema (`vaultEmergencyServerMetadataSchema`)
- Constant-time duress detection (`containsDuressSequence`)
- Decoy enrollment (`createDecoyVaultSetup`)
- Emergency unlock routing (`resolveVaultUnlockTarget`, `decryptVaultPayloadForSession`)
- Browser session mode (`VaultSessionMode`, `getVaultSessionMode`, `isVaultEmergencyMode`)
- Emergency unlock/exit (`unlockVaultWithPasswordRouting`, `unlockVaultWithPasskeyRouting`, `exitEmergencyMode`)
- React long-press hook (`useLongPressDuressSignal`)
- Dock 2 s passkey auto-start delay (`passkeyAutoStartDelayMs`)
- Testing fixtures (`assertVaultSessionMode`, `createPrimaryDecoyVaultFixture`)

See [ADR 0001](./adr/0001-emergency-duress-mode.md).

## Admin config helpers (shipped)

Exported from main entry — app maps `process.env`; package never reads env directly:

- `buildVaultAdminConfigFromEnv`, `listVaultAdminConfigEntries`
- `applyVaultAdminOverrides`, `validateVaultAdminOverride`, `VAULT_OVERRIDABLE_CONFIG_KEYS`, `VAULT_CONFIG_KEY_DEFINITIONS`
- Persistence contract: `getVaultAdminConfigOverrideSchemaSql()`, `VAULT_ADMIN_CONFIG_OVERRIDES_TABLE`,
  `docs/schemas/vault_admin_config_overrides.sql` (PostgreSQL reference for app-owned migrations)
- Rate limiting: `createVaultUnlockRateLimiter()`, `createVaultApiRateLimiter()`, `VaultRateLimitError`, `withVaultUnlockRateLimit()`, `buildVaultRateLimitHttpResponse()`
- `VAULT_ADMIN_ENV_CATALOG`, `buildVaultEnvLocalTemplate`
- `resolveVaultAdminPaths`, `listVaultAdminScreens`, `DEFAULT_VAULT_ADMIN_PATHS`

Documented env groups: admin, crypto profile, session, password policy, rate limit, features. See [VAULT_ADMIN.md](./VAULT_ADMIN.md).

## Vault admin UI screens (shipped)

Mounted by consuming apps under configurable base path (default `/admin/vault`):

| Screen | Component | Default path |
| --- | --- | --- |
| Panel | `VaultAdminPanelPage` | `/admin/vault` |
| Configuration | `VaultAdminConfigPage` | `/admin/vault/config` |
| Environment template | `VaultAdminEnvTemplatePage` | `/admin/vault/env-template` |
| Crypto policy | `VaultAdminCryptoPolicyPage` | `/admin/vault/crypto-policy` |
| Crypto profile | `VaultAdminProfilePage` | `/admin/vault/profile` |
| Session & auto-lock | `VaultAdminSessionPage` | `/admin/vault/session` |
| Vault password policy | `VaultAdminPasswordPolicyPage` | `/admin/vault/password-policy` |
| Security boundaries | `VaultAdminSecurityPage` | `/admin/vault/security` |

Editable when the consuming app provides `configApiBase` (runtime overrides via app-owned API/DB).
Read-only display otherwise. Crypto policy constants remain read-only. No account auth or vault
decryption in admin pages.

## React session helpers (shipped)

- `VaultSessionProvider`, `useVaultSession`, `useVaultUnlocked`, `useVaultLockState`
- `resolveVaultClientStatus`, `useVaultClientStatus` — includes `emergency_locked` / `emergency_unlocked`
- `useLongPressDuressSignal` — 1 s long-press duress latch for dock and passkey button
- `VaultAutoLockPreferenceField`, `useVaultAutoLockPreference` — per-user auto-lock slider (1 min …
  admin ceiling); priority **user → admin → env → default**. The hook accepts a server-resolved
  `initialUserMinutes` snapshot and exposes `hydrationStatus` when browser storage must be read after
  hydration; it never reads `localStorage` during render.
- `VaultPasswordStrengthFeedback` — read-only current-password strength (settings / awareness)

## Browser session preferences (shipped)

Exported from `@tgoliveira/vault-core/browser`:

| Export | Purpose |
| --- | --- |
| `resolveVaultAutoLockMinutesPreference` | Layered auto-lock resolution (user → admin → env → default) |
| `readUserVaultAutoLockMinutes` / `writeUserVaultAutoLockMinutes` / `clearUserVaultAutoLockMinutes` | Persist user auto-lock minutes in `localStorage` |
| `clampVaultAutoLockMinutes` / `VAULT_USER_AUTO_LOCK_MIN_MINUTES` | Clamp user choice to 1 … admin max |

Wire `VaultSessionProvider` `sessionConfig.resolveAutoLockMinutes` to return the user preference
when set (see consumer-demo `Providers`).

## Browser inner-key cache (shipped)

Memory-only cache for passkey enroll after unlock when the session UVK is non-extractable. Cleared
on `lockVaultSession()` / `lockVaultSessionManually()` — never persisted to storage.

| Export | Purpose |
| --- | --- |
| `VaultInnerKeyMaterialCache` | Grouped API: `clear`, `getCached`, `cacheFromEnvelopeDecrypt`, `cacheFromPasskeyEnvelope` |
| `cacheVaultInnerKeyMaterialAfterPasswordUnlock` | Populate cache after password unlock |
| `cacheVaultInnerKeyMaterialAfterRecoveryUnlock` | Populate cache after recovery unlock |
| `cacheVaultInnerKeyMaterialFromPasskeyUnlock` | Populate cache after passkey unlock |
| `createPasskeyPrfEnvelopeWithSessionCache` | Create passkey envelope using cache when `innerVaultKeyBlob` omitted |
| `INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE` | Actionable error when cached material is stale |

Inner-key `Uint8Array` bytes are zeroed before the cache entry is dropped on clear.

## Browser lock cleanup (shipped)

| Export | Purpose |
| --- | --- |
| `registerVaultLockCleanup` | Register sync handlers invoked on `lockVaultSession()` after UVK/cache clear |

## Testing lock hygiene (shipped)

| Export | Purpose |
| --- | --- |
| `assertNoVaultPlaintextInDocument` | Throws when testing sentinels appear in DOM text after lock |
| `scanDocumentForVaultPlaintextSentinels` | Non-throwing scan for integration tests |

## Vault status dock (shipped)

Exported from `@tgoliveira/vault-core/react` (styles: `vc-status-dock-*` in `vault-admin.css`):

| Export | Purpose |
| --- | --- |
| `VaultStatusDock` | Header-attached collapsible lock/unlock handle and expanded panel (`passkeyAutoStartDelayMs` default 2000, `onDuressSignalChange`, handle long-press) |
| `VaultDockQuickUnlock` | Compact password or passkey primary unlock for the dock (auto-focus password, expand-sync passkey auto-start via `bindAutoStartPasskey`, `passkeyOptionsReady`, passkey button long-press) |
| `classifyPasskeyUnlockFailure` / `PasskeyUnlockFailureKind` | Passkey failure classification for dock redirect and callbacks |
| `tryConsumePasskeyAutoStart` / `resetPasskeyAutoStartDedupe` | Short-TTL sessionStorage dedupe for dock passkey auto-start |
| `requestVaultDockExpand` / `subscribeVaultDockExpand` | Programmatic expand from locked-content gates |
| `useVaultAutoLockCountdown` / `useVaultAutoLockFraction` | Live auto-lock countdown and ring fraction |
| `resolveVaultDockPasskeyAvailability` | Passkey PRF quick-unlock eligibility (envelope + PRF + bound-browser flag) |
| Copy/preference helpers | `getVaultStatusDockExpandedCopy`, collapse `localStorage` preference |

Apps inject routes (`unlockPath`, `buildUnlockHref`, `LinkComponent`), server status snapshot,
`renderQuickUnlock`, and unlock handlers — no product auth or note payloads in the package.

## Vault protected gate (shipped)

Exported from `@tgoliveira/vault-core/react` (styles: `vc-vault-protected-gate*` / `vc-vault-lock-overlay`
in `vault-admin.css`):

| Export | Purpose |
| --- | --- |
| `VaultProtectedGate` | Blur overlay on protected pages while locked; optional `lockedContentStrategy="unmount"` |
| `VaultSensitiveRegion` | Unmount sensitive subtree while locked |
| `useOnVaultLocked` | React hook wrapping lock cleanup registry |
| `VaultLockOverlayExclude` | Marks header/nav chrome that stays above the overlay while locked |
| `shouldVaultLockOverlayExpandDock` | Enter-key guard (skips editable fields) |
| `computeVaultLockOverlayPanels` | Viewport overlay geometry minus exclusion holes |
| `useVaultLockOverlayPanels` | Hook that tracks exclusion rects for overlay panels |
| `VAULT_LOCK_OVERLAY_EXCLUDE_SELECTOR` | Query selector for registered exclusion regions |

Props: `configured?`, `redirectToSetup?`, `onRedirectToSetup?`, `onExpandDock?`, `loadingFallback?`,
`overlayClassName?`, `overlayBackground?`, `lockedContentStrategy?` (`"overlay"` default | `"unmount"`),
`lockedFallback?`.
Redirect applies only when the vault is not configured — not when locked. Wrap app chrome in
`VaultLockOverlayExclude` (sibling above the gate); mount `VaultStatusDock` inside that excluded header.

**Security:** The overlay is visual UX only (blur + pointer blocking). Apps must check vault unlock
status in code (`useVaultUnlocked()`, session APIs) before decrypting or exposing secrets — do not
treat the overlay as a security boundary.

## Vault unlock page (shipped)

Exported from `@tgoliveira/vault-core/react` (styles: `vc-vault-unlock-*` in `vault-admin.css`):

| Export | Purpose |
| --- | --- |
| `VaultUnlockPanel` | Full-page unlock UI — password tab, recovery phrase tab, optional passkey button (explicit click; no auto-start by default) |
| `readVaultUnlockReturnPath` / `resolveVaultUnlockReturnPath` | Sanitize caller return paths from URL search params |
| `buildVaultUnlockHref` | Build unlock route href preserving return path (`next` query param by default) |
| `VAULT_UNLOCK_RETURN_QUERY_PARAM` | Default query key (`next`) |
| `useVaultUnlockPageNavigation` | Redirect to setup when unconfigured; redirect to return path after unlock |

Apps mount `VaultUnlockPanel` on a dedicated unlock route, wire crypto handlers
(`onUnlockPassword`, `onUnlockRecoveryPhrase`, optional `onUnlockPasskey`), and pass
`serverStatus` / `prfSupported` for passkey eligibility. Return URLs must be same-origin relative
paths only (`/vault`, not `//evil` or `https://…`).

## Published npm tarball includes

`dist/`, `vault-admin.css`, `README.md`, `CHANGELOG.md`, `AGENTS.md`, `LICENSE`, security/architecture docs, `API_REFERENCE.md`, `docs/`

## Explicitly out of scope (not shipped)

- Account authentication / OAuth / sessions for users
- Database, API routes, persistence adapters (package exports override helpers only; apps implement storage)
- Email / SMTP / notification flows
- Product-specific payload schemas on the default entry
- Automatic npm publish on merge or tag
- **`apps/consumer-demo/`** — local Next.js reference app in the git repo only (not in npm tarball); mounts all vault admin UI pages at `/admin/vault/*`, persists admin overrides in Postgres, exposes `/api/vault/admin/config`

## Planned / not yet shipped

- Consumer demo: vault setup and unlock flows (custom app UI — not exported as pages from vault-core;
  demo uses `VaultUnlockPanel` at `/vault/unlock` with `next` return-path support)
