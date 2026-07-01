# API Reference

The package exposes four supported entry points. Internal `dist/*` paths are not public APIs.

For complete workflows, use [`docs/IMPLEMENTATION_GUIDE.md`](docs/IMPLEMENTATION_GUIDE.md).

## Core: `@tgoliveira/vault-core`

### Protocol constants and profile

| Export | Purpose |
| --- | --- |
| `ENCRYPTION_VERSION` | Stored payload version, currently `enc-v1` |
| `ENCRYPTION_ALG` | Stored algorithm identifier, currently `AES-GCM` |
| `VAULT_CRYPTO_VERSION` | Vault protocol version, currently `vault-v1` |
| `DEFAULT_VAULT_AUTO_LOCK_MINUTES` | Default browser inactivity timeout |
| `VaultCryptoProfile` | Stable application AAD contexts |
| `VaultAadScope`, `VaultAadField` | Authenticated user/resource/field scope |
| `RecoveryPhraseWordCount` | `12 | 24` |
| `resolveAadContext(scope, profile)` | Resolves explicit or profile-derived AAD context |

### User Vault Key and AES-GCM

| Export | Purpose |
| --- | --- |
| `createUserVaultKey()` | Generates an extractable 256-bit AES-GCM UVK for initial envelope setup |
| `importUserVaultKey(bytes, options?)` | Imports raw UVK bytes; `extractable` defaults to `false` |
| `exportUserVaultKey(key)` | Exports raw UVK bytes when extractable; throws `VaultKeyNotExtractableError` after envelope unlock |
| `generateAesKey()`, `importAesKey()`, `exportAesKey()` | Low-level AES key primitives |
| `encryptVaultPayload(payload, key, scope, profile)` | Serializes and encrypts generic JSON |
| `decryptVaultPayload(encrypted, key, expectedScope, profile)` | Validates expected AAD, decrypts, and parses JSON |
| `decryptVaultPayloadWithSchema(encrypted, key, expectedScope, profile, schema)` | Same as above, then validates parsed JSON with a Zod schema |
| `encryptField(plaintext, key, aad, profile)` | Low-level string encryption |
| `decryptField(encrypted, key)` | Low-level compatibility decrypt without expected-scope validation |
| `canonicalAadString(aad)` | Produces canonical AAD JSON |
| `aadByteCandidates(aad)` | Produces canonical and legacy AAD byte candidates |

Use the high-level payload APIs for application data. `decryptField()` is appropriate only when the
caller separately validates expected AAD, such as a bounded legacy migration.

### Encoding, random, and serialization utilities

- `bytesToBase64Url(bytes)` / `base64UrlToBytes(value)`
- `stringToBytes(value)` / `bytesToString(bytes)`
- `toBufferSource(bytes)`
- `randomBytes(length)`
- `serializeVaultPayload(payload)` / `parseVaultPayload<T>(json)`

### Argon2id

| Export | Purpose |
| --- | --- |
| `DEFAULT_ARGON2ID_PARAMS` | Recommended creation defaults (`kdf-v2`) |
| `LEGACY_ARGON2ID_PARAMS` | Legacy `kdf-v1` parameters still used to unlock old envelopes |
| `RECOMMENDED_ARGON2ID_PARAMS` | Current recommended Argon2id profile |
| `ARGON2ID_LIMITS` | Accepted persisted resource bounds |
| `assertSafeArgon2idParams(params)` | Validates memory, iteration, and parallelism bounds |
| `assertSafeArgon2idSalt(salt)` | Validates salt size |
| `serializeArgon2idMetadata(salt, params?)` | Builds persisted metadata |
| `parseArgon2idMetadata(metadata)` | Decodes and validates persisted metadata |
| `deriveArgon2idAesKey(...)` | Low-level byte-based derivation |
| `deriveArgon2idAesKeyFromMetadata(...)` | Low-level derivation from stored metadata |
| `deriveVaultPasswordKey(password, salt?)` | NFKC-normalized password derivation |
| `deriveVaultPasswordKeyFromMetadata(password, metadata)` | Password derivation from stored metadata |

Applications normally use envelope APIs instead of direct derivation functions.

### Crypto policy and rotation

| Export | Purpose |
| --- | --- |
| `VAULT_CRYPTO_POLICY` | Canonical recommended encryption and KDF settings |
| `RECOMMENDED_KDF_VERSION` / `LEGACY_KDF_VERSION` | Current and legacy KDF labels |
| `isRecommendedArgon2idMetadata(metadata)` | Detects current-strength envelopes |
| `isEnvelopeKdfUpgradeRecommended(metadata)` | True when unlock should re-wrap with `kdf-v2` |
| `rotateVaultPassword(options)` | Changes vault password while keeping the same UVK |
| `rotateRecoveryPhrase(options)` | Re-wraps UVK with a new BIP39 phrase after password or passkey authorization |
| `maybeUpgradePasswordEnvelopeAfterUnlock(options)` | Returns a stronger password envelope after legacy unlock |
| `maybeUpgradeRecoveryEnvelopeAfterUnlock(options)` | Returns a stronger recovery envelope after legacy unlock |
| `assertVaultRotationAuthorized(...)` | Shared authorization gate for sensitive changes |
| `userVaultKeysEqual(a, b)` | Constant-time UVK comparison |
| `VaultAuthorizationError` / `VaultPasswordUnchangedError` | Rotation failures |

Rotation helpers require the UVK to already be in memory. The app persists returned envelopes;
encrypted payloads and unrelated envelopes stay unchanged unless the app chooses to replace them.

### Password envelopes

- `createPasswordEnvelope(vaultKey, password, scope, profile, salt?)`
- `unlockWithPasswordEnvelope(password, envelope, expectedScope, profile)`

### Recovery phrases and envelopes

- `createRecoveryPhrase({ wordCount })`
- `normalizeRecoveryPhrase(phrase)`
- `validateRecoveryPhraseFormat(phrase)`
- `getRecoveryPhraseWordCount(phrase)`
- `parseRecoveryPhraseWordCount(publicMetadata)`
- `assertRecoveryPhraseUnlockInput(phrase, expectedWordCount?)`
- `getRecoveryConfirmationPromptCount(wordCount)`
- `pickRecoveryConfirmationIndices(wordCount, count?)`
- `assertRecoveryPhraseConfirmation(original, confirmation)`
- `assertRecoveryPhraseWordConfirmation(phrase, answers, requiredIndices?)`
- `deriveRecoveryPhraseKey(...)` / `deriveRecoveryPhraseKeyFromMetadata(...)`
- `createRecoveryEnvelope(vaultKey, phrase, scope, profile, publicMetadata?, salt?)`
- `unlockWithRecoveryEnvelope(phrase, envelope, expectedScope, profile, options?)`
- `createRecoveryKitText(input)`
- `RECOVERY_PHRASE_WORDLIST_SOURCE`, `DEFAULT_RECOVERY_PHRASE_WORD_COUNT`

Word confirmation requires all deterministic default indices unless explicit required indices are
provided.

### Passkey PRF envelopes

- `createPasskeyPrfEnvelope(vaultKey, prfOutput, scope, profile, publicMetadata?)`
- `unlockWithPasskeyPrfEnvelope(envelope, prfOutput, expectedScope, profile, options?)`
- `unwrapVaultKeyFromPasskey(encryptedVaultKey, prfOutput, expectedScope, profile)`
- `extractPasskeyPrfOutput(extensionResults)`
- `isPasskeySupported()` / `isPrfExtensionSupported()`

The application owns WebAuthn ceremonies. Capability probes are preliminary; the actual ceremony may
still return no PRF output. PRF output must remain client-only.

### Runtime schemas and types

| Export | Runtime contract |
| --- | --- |
| `encryptedPayloadSchema` | `enc-v1` AES-GCM payload with UUID AAD identifiers |
| `argon2idKdfMetadataSchema` / `kdfMetadataSchema` | Bounded `kdf-v1` or `kdf-v2` Argon2id metadata |
| `passwordEnvelopeSchema` | Password method plus required Argon2id metadata |
| `recoveryPhraseEnvelopeSchema` | Recovery method plus required Argon2id metadata |
| `passkeyPrfEnvelopeSchema` | Passkey PRF method plus null KDF metadata |
| `storedEnvelopeSchema` | Method-discriminated union of all envelopes |
| `vaultSetupEnvelopeFieldsSchema` | Complete encrypted setup record |

Associated inferred types include `EncryptedVaultPayload`, `Argon2idKdfMetadata`, `VaultEnvelope`,
`PasswordEnvelope`, `RecoveryPhraseEnvelope`, `PasskeyPrfEnvelope`, and `VaultEnvelopeMethod`.

### AAD and plaintext validation

- `assertVaultKeyAad(expectedScope, payload, profile)`
- `assertVaultPayloadAad(expectedScope, payload, profile)`
- `rejectVaultPlaintextFields(body)`
- `assertNoVaultPlaintextFields(body)`
- `isVaultPlaintextForbiddenField(field)` — case-insensitive check for a single property name
- `validateNoPlaintextLeak(data)`
- `scanForSentinels(data, sentinels?)`
- `containsSentinel(value, sentinels?)`
- `PLAINTEXT_FORBIDDEN_VAULT_FIELDS`, `ALL_SENTINELS`, and named `SENTINEL_*` constants

The plaintext field guard is recursive and cycle-safe. Field names are matched case-insensitively
(`VaultPassword`, `mnemonic`, `seed`, `passphrase`, etc.). It is defense in depth; closed API schemas
are still required.

### Errors

- `VaultPlaintextRejectionError`
- `VaultConflictError`
- `VaultNotFoundError`
- `PasskeyPrfRequiredError`
- `PasskeyUnlockError`
- `RecoveryPhraseConfirmationError`
- `VaultAuthorizationError`
- `VaultPasswordUnchangedError`
- `VaultRateLimitError`
- `VaultKeyNotExtractableError`
- `VaultPayloadSizeError` — IV/ciphertext exceeds bounded decode limits
- `VaultPayloadValidationError` — decrypted vault JSON failed Zod schema validation
- `VaultCoreError`

### Deprecated migration aliases

- `generateUserVaultKey`
- `generateRecoveryPhrase`
- `wrapVaultKeyForPassword` / `unwrapVaultKeyFromPassword`
- `wrapVaultKeyForRecoveryPhrase` / `unwrapVaultKeyFromRecoveryPhrase`
- `wrapVaultKeyForPasskey` / `unlockVaultFromPasskeyEnvelope`
- `buildRecoveryKitContent`
- `EncryptedPayload`, `StoredEnvelope`

New code should use the canonical APIs. Deprecated unlock aliases use the current secure signatures.

## Browser: `@tgoliveira/vault-core/browser`

### Session lifecycle

- `configureVaultSession(config)`
- `await unlockVaultSession(vaultKey)` / `lockVaultSession()` — session UVK must be **non-extractable** (keys from envelope unlock satisfy this; do not pass `createUserVaultKey()` output directly)
- `lockVaultSessionManually()` / `isVaultManuallyLocked()`
- `touchVaultSession()` / `scheduleVaultAutoLock()` / `clearVaultAutoLockTimer()`
- `getVaultAutoLockRemainingMs()`
- `getVaultAutoLockMinutes()` — resolved session auto-lock duration in minutes
- `suppressVaultActivity(ms?)` — when activity-based renewal is enabled, briefly suppresses guard listeners so vault dock toggles do not reset inactivity
- `getSessionVaultKey()` / `isVaultUnlocked()`
- `subscribeVaultSession(listener)`
- `registerVaultActivityGuard(events?)` — opt-in; renews the countdown on pointer, keyboard, touch, and focus events
- `registerVaultUnloadGuard()`
- `resetVaultSessionLockState()`
- Per-user auto-lock preference (localStorage): `readUserVaultAutoLockMinutes()`,
  `writeUserVaultAutoLockMinutes()`, `clearUserVaultAutoLockMinutes()`,
  `resolveVaultAutoLockMinutesPreference({ userMinutes, adminMinutes, envMinutes, defaultMinutes })`,
  `clampVaultAutoLockMinutes()`, `VAULT_USER_AUTO_LOCK_MIN_MINUTES` (1)
- `deleteVaultAfterAuthorization(options)` / `deleteVaultWithPasswordAuthorization(options)` — prefer password authorization; `deleteVaultAfterAuthorization` requires the caller to verify authorization first (emits a one-time browser warning)
- `VaultSessionConfig`

Direct session-key setters are intentionally not exported.

### Storage inspection

- `VaultStorageInspectionResult`: `"clear" | "found" | "unavailable"`
- `inspectLocalStoragePrefix(prefix)`
- `inspectIndexedDBPrefix(prefix)`
- `persistVaultRecordLocally()` always throws to prevent accidental plaintext persistence

Namespace inspection does not inspect record contents. Treat `"unavailable"` as a failed security
check. `assertNoDecryptedVaultInLocalStorage` and `assertNoDecryptedVaultInIndexedDB` are deprecated
boolean aliases that fail closed.

### Browser UX and passkey helpers

- `buildPrfSaltBytes(prefix, userId)`
- `createRecoveryKitDownload(content, filename)`
- `printRecoveryKitContent(content)`
- `extractPasskeyPrfOutput`, `isPasskeySupported`, `isPrfExtensionSupported`
- `createRecoveryKitText`, `buildRecoveryKitContent`

## React: `@tgoliveira/vault-core/react`

- `VaultSessionProvider` / `VaultSessionProviderProps`
- `useVaultSession(options)` / `UseVaultSessionOptions`
- `useVaultUnlocked()` / `useVaultLockState()`
- `resolveVaultClientStatus(status, unlocked, prfSupported)`
- `useVaultClientStatus(serverStatus, prfSupported)`
- `VaultClientStatus` / `VaultServerStatusSnapshot`

Provider and session hook guard options are `registerActivityGuard` (defaults to `false`) and
`registerUnloadGuard` (defaults to `true`). Set `registerActivityGuard` when the app should renew the
auto-lock countdown on user activity; otherwise call `touchVaultSession()` explicitly (for example from
the vault status dock **Stay unlocked** action).

### Vault password and session preferences

- `VaultPasswordStrengthFeedback` — read-only strength line for an existing password (settings flows)
- `VaultAutoLockPreferenceField` — range slider for per-user auto-lock minutes (1 … admin max)
- `useVaultAutoLockPreference(adminResolvedMinutes)` — read/write user preference and sync session

### Vault admin UI

Import styles once: `@import "@tgoliveira/vault-core/vault-admin.css";`

Pages (each accepts `config: VaultAdminConfig`, optional `paths`, `env`, `LinkComponent`):

- `VaultAdminPanelPage` — hub
- `VaultAdminConfigPage` — effective settings with source badges
- `VaultAdminEnvTemplatePage` — `.env.local` template and catalog
- `VaultAdminCryptoPolicyPage` — KDF and encryption policy
- `VaultAdminProfilePage` — AAD contexts and PRF prefix
- `VaultAdminSessionPage` — auto-lock settings
- `VaultAdminPasswordPolicyPage` — `VAULT_PASSWORD_*` rules
- `VaultAdminSecurityPage` — zero-knowledge boundaries

Helpers:

- `useVaultAdminPaths(config, paths?)`
- `VaultAdminPageProps`, `VaultAdminLinkProps`

See [`docs/VAULT_ADMIN.md`](docs/VAULT_ADMIN.md).

### Vault status dock

Import styles once (includes `vc-status-dock-*` classes).

- `VaultStatusDock` / `VaultStatusDockProps` — collapsible header dock (lock state, auto-lock countdown, lock now, quick-unlock slot)
- `VaultDockQuickUnlock` / `VaultDockQuickUnlockProps` — password or passkey primary unlock;
  `autoFocusPassword` and `autoStartPasskey` (default `true`) control focus and passkey auto-start
- `createVaultFullUnlockPageMatcher(unlockPath)` — detect full unlock route (dock stays collapsed, handle visible)
- `requestVaultDockExpand()` / `subscribeVaultDockExpand(listener)` — expand from elsewhere in the app
- `useVaultAutoLockCountdown(active, autoLockMinutes?)` / `useVaultAutoLockFraction(...)` /
  `useVaultAutoLockMinutes(overrideMinutes?)` / `resolveVaultAutoLockMinutes(overrideMinutes?)`
- `navigateToVaultFullUnlock(href, onNavigate?)` — SPA or hard redirect to full unlock
- `resolveVaultDockPasskeyAvailability(serverStatus)`
- `readVaultStatusDockCollapsedPreference(key?)` / `writeVaultStatusDockCollapsedPreference(collapsed, key?)`
- Copy helpers: `getVaultStatusDockExpandedCopy`, `getVaultStatusDockHandleLabel`, `DEFAULT_VAULT_STATUS_DOCK_LABELS`
- Icons: `VaultStatusIcon`, `VaultStatusDockChevron`, `VaultStatusDockLockIcon`

`VaultStatusDock` requires app-provided `serverStatus`, `pathname`, `unlockPath`, optional
`LinkComponent`, `buildUnlockHref` (defaults to `buildVaultUnlockHref(unlockPath, returnPath)`),
`renderQuickUnlock`, optional `autoLockMinutes` (override; when omitted, uses
`configureVaultSession()` / `VaultSessionProvider`), `onNavigateToUnlock`, and
`redirectOnPasskeyUnlockFailure` (default `true`). The quick-unlock slot receives
`fullUnlockHref` and `onPasskeyUnlockFailed` for passkey fallback to the full unlock page. Set `visible={false}`
when the user is signed out. Hide before vault setup via `serverStatus.configured === false`.

### Vault protected gate

Import styles once (includes `vc-vault-protected-gate*` and `vc-vault-lock-overlay` classes).

- `VaultProtectedGate` / `VaultProtectedGateProps` — wraps vault-protected page content; when the
  vault is locked, renders children under fixed blur overlay panel(s) that block interaction while
  excluded chrome (`VaultLockOverlayExclude`) and the status dock (`vc-status-dock-host`) stay usable.
- `VaultLockOverlayExclude` / `VaultLockOverlayExcludeProps` — wrap app chrome (header, nav, dock
  host) that must remain visible and clickable while the vault is locked. Mount as a **sibling**
  outside the gate's inert content. Sets `data-vault-lock-overlay-exclude="true"`.
- `VAULT_LOCK_OVERLAY_EXCLUDE_ATTR` / `VAULT_LOCK_OVERLAY_EXCLUDE_SELECTOR` — DOM marker constants.
- `computeVaultLockOverlayPanels(viewportWidth, viewportHeight, exclusions)` — pure helper for
  viewport-minus-hole overlay geometry.
- `useVaultLockOverlayPanels(active)` — tracks exclusion rects and returns overlay panel layout.
- `shouldVaultLockOverlayExpandDock(event)` — returns whether Enter should expand the dock (skips
  inputs, textareas, selects, and contenteditable targets).

**Security:** The lock overlay is visual UX only — it blurs content and blocks pointer interaction in
the browser, but it is not a security boundary. Consumers **must** gate vault-sensitive operations in
application code (for example `useVaultUnlocked()`, `useVaultSession()`, or equivalent checks before
decrypt, persist, or render secrets). Do not rely on the overlay or `inert` alone to protect data.

Props:

- `children` — protected page content (stays mounted while locked).
- `configured?: boolean | null` — when `false`, redirects to `redirectToSetup`; when `null`, shows
  `loadingFallback`; when omitted or `true`, only lock overlay applies.
- `redirectToSetup?` / `onRedirectToSetup?(path)` — setup redirect (no redirect on lock).
- `onExpandDock?` / `expandEventName?` — Enter-key quick unlock (defaults to `requestVaultDockExpand()`).
- `loadingFallback?` — shown while `configured === null` or during setup redirect.
- `overlayClassName?` — extra class names on each lock overlay panel element.
- `overlayBackground?` — sets `--vc-vault-lock-overlay-color` on each overlay panel (any CSS color or
  `color-mix()` expression). Omit for the default `color-mix(in srgb, var(--vc-background, canvas) 92%, transparent)`.
  Consumers may also set `--vc-vault-lock-overlay-color` in CSS on `.vc-vault-lock-overlay` or an ancestor.

**Layout:** Wrap persistent app chrome in `VaultLockOverlayExclude` (sibling above `VaultProtectedGate`).
Mount `VaultStatusDock` inside that excluded region (typically `vc-status-dock-host` in the header).
The overlay covers the viewport except carved-out exclusion rectangles; excluded regions use
`z-index: 55`, overlay panels `50`, dock host `60`.

Mount `VaultStatusDock` as a sibling in the app header (not inside the gate). Press **Enter** while
the overlay is active to expand the dock for quick unlock.

### Vault unlock page

Import styles once (includes `vc-vault-unlock-*` classes).

- `VaultUnlockPanel` / `VaultUnlockPanelProps` — password, recovery phrase, and optional passkey unlock
  (`autoFocusPassword` default `true`; `autoStartPasskey` default `false` on the full unlock page;
  passkey auto-start remains opt-in). Optional `unlockRateLimiter` + `rateLimitScopeKey` (default
  `"default"`) assert before unlock and record failures/successes. Customizable `labels`, `passkeyReady`, etc.
- `VAULT_UNLOCK_RETURN_QUERY_PARAM` — default query key for post-unlock navigation (`"next"`)
- `resolveVaultUnlockReturnPath(raw, options?)` — sanitize a return path (relative `/…` only)
- `readVaultUnlockReturnPath(searchParams, options?)` — read and sanitize from URL search params
- `buildVaultUnlockHref(unlockPath, returnPath, options?)` — build unlock route with return path
- `useVaultUnlockPageNavigation({ configured, returnPath, setupPath?, onNavigate })` — redirect when
  setup is required or when the vault becomes unlocked

**Return URL contract:** Callers link to the unlock page with `buildVaultUnlockHref("/vault/unlock", currentPath)`.
After a successful unlock, navigate to the sanitized `returnPath`. Only same-origin relative paths are
accepted; `//host`, absolute URLs, encoded `/%2F%2F…` bypasses, backslashes, scheme-like `/https:…`
paths, and empty values fall back to `defaultPath` (default `/`).

## Admin config: `@tgoliveira/vault-core`

- `buildVaultAdminConfigFromEnv(input)` — resolve config from app-owned env record (never reads `process.env` in-package)
- `getVaultAdminConfigOverrideSchemaSql(options?)` — PostgreSQL DDL for the runtime overrides table
  (default table `vault_admin_config_overrides`: `key`, `value` jsonb, `updated_at`)
- `VAULT_ADMIN_CONFIG_OVERRIDES_TABLE` — default table name constant
- Reference SQL file: `docs/schemas/vault_admin_config_overrides.sql` (shipped in npm tarball)
- `listVaultAdminConfigEntries(config, env?)`
- `VAULT_ADMIN_ENV_CATALOG`, `buildVaultEnvLocalTemplate(productName?)`
- `DEFAULT_VAULT_ADMIN_PATHS`, `resolveVaultAdminPaths(basePath?)`, `listVaultAdminScreens()`, `VAULT_ADMIN_SECTIONS`
- Types: `VaultAdminConfig`, `VaultAdminConfigEntry`, `VaultAdminPaths`, `VaultAdminRateLimitConfig`, etc.

## Rate limiting: `@tgoliveira/vault-core`

In-memory fixed-window limiters for consuming apps (server routes and client unlock UI).

- `createFixedWindowRateLimiter(config)` — generic O(1) check/consume with lazy pruning and bounded bucket map (`maxBuckets`, default `DEFAULT_RATE_LIMIT_MAX_BUCKETS` = 10_000)
- `createVaultUnlockRateLimiter(config?)` / `createVaultUnlockRateLimiterFromAdminConfig(config)`
- `assertVaultUnlockAllowed(limiter, scopeKey, action)`, `recordVaultUnlockFailure()`, `recordVaultUnlockSuccess()`
- `withVaultUnlockRateLimit(limiter, scopeKey, action, attempt)` — assert, run, record outcome
- `createVaultApiRateLimiter(config?)` / `createVaultApiRateLimiterFromAdminConfig(config)`
- `consumeVaultApiRateLimit(limiter, namespace, clientKey)` — returns `RateLimitDecision`
- `buildVaultRateLimitHttpResponse(decision)` — `{ status: 429, headers, body }` for route handlers
- Defaults: **5** failed unlocks per **15 min** window, **30 min** lockout; **120** API requests per **60 s** window
- Env: `VAULT_UNLOCK_MAX_FAILURES`, `VAULT_UNLOCK_FAILURE_WINDOW_MINUTES`, `VAULT_UNLOCK_LOCKOUT_MINUTES`,
  `VAULT_API_RATE_LIMIT_MAX_REQUESTS`, `VAULT_API_RATE_LIMIT_WINDOW_SECONDS`
- `VaultDockQuickUnlock` accepts the same optional `unlockRateLimiter` / `rateLimitScopeKey` props

This entry exports the plaintext validation functions, forbidden field list, `ALL_SENTINELS`, and all
named `SENTINEL_*` values. Use it in network, persistence, logging, and fixture tests. It does not
export internal LiqSense compatibility fixtures.
