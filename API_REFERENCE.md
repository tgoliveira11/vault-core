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
| `VaultCryptoProfile` | Stable AAD contexts; legacy missing/null routing plus explicit `legacyVaultKeyAadContexts?` allowlist |
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

### Vault-key envelope helpers

Low-level helpers for wrapping and re-wrapping the user vault key (UVK) inside password, recovery,
and passkey envelopes. Use these when rotating credentials, upgrading KDF parameters, or creating a
passkey envelope after unlock when the session UVK is non-extractable.

| Export | Purpose |
| --- | --- |
| `WrapUserVaultKeyOptions` | Optional `{ innerVaultKeyBlob? }` to re-wrap without exporting the UVK |
| `assertInnerVaultKeyBlobMatchesVaultKey(inner, vaultKey, wrappingKey)` | Validates reused inner material against the session UVK |
| `extractInnerVaultKeyBlob(encryptedVaultKey, encryptionKey)` | Decrypts the outer envelope layer and returns inner AES-KW or legacy raw bytes |
| `rewrapInnerVaultKeyMaterialForDerivedKeys(inner, oldDerivedKeys, newDerivedKeys, sessionVaultKey)` | Re-wraps inner material for password/recovery KDF rotation |
| `rewrapInnerVaultKeyMaterialForPrfOutput(inner, oldPrfOutput, newPrfOutput, sessionVaultKey)` | Re-wraps inner material for passkey PRF credential rotation |
| `rewrapEncryptedVaultKeyForDerivedKeys(encryptedVaultKey, oldDerivedKeys, newDerivedKeys, sessionVaultKey, scope, profile)` | Full encrypted `vault_key` re-wrap for derived-key rotation |
| `wrapUserVaultKeyWithPrfOutput(vaultKey, prfOutput, scope, profile, prfEncryptionKey, options?)` | Wraps UVK for passkey PRF envelopes; accepts `innerVaultKeyBlob` when UVK is non-extractable |
| `unwrapUserVaultKeyWithPrfOutput(encryptedVaultKey, prfOutput, prfEncryptionKey)` | Unwraps UVK from a passkey PRF `vault_key` payload |

Prefer high-level envelope APIs (`createPasswordEnvelope`, `createPasskeyPrfEnvelope`, rotation
helpers) unless you need explicit control over inner blob reuse during re-wrap.

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

- `createPasskeyPrfEnvelope(vaultKey, prfOutput, scope, profile, publicMetadata?, options?)` — optional `WrapUserVaultKeyOptions` for re-wrap with `innerVaultKeyBlob`
- `createPasskeyPrfEnvelopeWithSessionCache(...)` — uses in-memory inner-key cache when `innerVaultKeyBlob` is omitted
- `createPasskeyPrfEnvelopeAfterIndependentAuthorization(input)` — locally reopens a password or
  recovery envelope and returns `{ vaultKey, envelope }` for append-only no-match repair; it accepts
  no binding/passkey authorization and has no persistence side effects. Defer it when
  emergency/duress candidate routing has not resolved primary vs decoy.
- `unlockWithPasskeyPrfEnvelope(envelope, prfOutput, expectedScope, profile, options?)`
- `unlockWithPasskeyPrfEnvelopeCandidates(input)` — tries at most
  `MAX_PASSKEY_PRF_ENVELOPE_CANDIDATES` (5) variants for one verified credential; returns matched
  opaque ID + non-extractable UVK or typed no-match/malformed/crypto status
- `unwrapVaultKeyFromPasskey(encryptedVaultKey, prfOutput, expectedScope, profile)`
- `isLegacyVaultKeyEnvelope(payload, profile)` / `isVaultKeyAadContextAllowed(context, profile)` / `unwrapVaultKeyWithLegacyAadFallback(...)` / `unlockVaultKeyEnvelopeWithAadRouting(...)`
- `normalizeEnvelopeAadContext(payload, profile)`
- `extractPasskeyPrfOutput(extensionResults, options?)` — prefers `evalByCredential[credentialId]` on Safari; coerces ArrayBuffer, views, base64url, and number arrays
- `prfBytesForAes256Import(bytes)` — returns an owned 32-byte PRF snapshot for AES import
- `resolvePasskeyPrfCapability(input?)` — typed heuristic, registration-confirmed,
  authentication-confirmed, unavailable, or incompatible state; never returns PRF material
- `isPasskeySupported()` / `isPrfExtensionHeuristicallyAvailable(options?)` — preliminary API/UA
  heuristic; `isPrfExtensionSupported()` is a deprecated alias
- `parseAppleMobileOsMajorVersion(userAgent)`, `DEFAULT_APPLE_MOBILE_PRF_MIN_MAJOR_VERSION`

### Passkey credential, binding, and envelope variants

| Export | Purpose |
| --- | --- |
| `VaultPasskeyBindingStore` / `VaultPasskeyBindingTarget` | App-owned opaque binding → credential/selected variant contract |
| `parsePasskeyBindingId(raw)` | Parses an opaque `v1.<bindingId>` or raw binding ID |
| `PasskeyCredentialSelection` | Explicit `exact`, `allow-list`, or `discoverable` selection |
| `scopeAuthenticationOptionsToCredential(...)` | Strictly filters to one credential or throws `PasskeyCredentialScopeError` |
| `selectAuthenticationCredentials(...)` | Applies explicit selection mode |
| `resolvePasskeyUnlockAvailable(...)` | Bound-browser quick-unlock status; missing binding fails closed |
| `resolvePasskeyUnlockPlan(...)` | Typed explicit-vs-quick plan; explicit defaults to allow-list without binding, quick requires exact binding target |
| Deprecated device-named aliases | Compatibility only; see migration guide |

Example: [`docs/examples/device-binding/README.md`](docs/examples/device-binding/README.md).

The application owns WebAuthn ceremonies. Capability probes are preliminary; the actual ceremony may
still return no PRF output. PRF output must remain client-only. On Apple mobile, pass `userAgent` in
Node/tests; the default is `navigator.userAgent` in the browser.

### Runtime schemas and types

| Export | Runtime contract |
| --- | --- |
| `encryptedPayloadSchema` | `enc-v1` AES-GCM payload with UUID AAD identifiers |
| `argon2idKdfMetadataSchema` / `kdfMetadataSchema` | Bounded `kdf-v1` or `kdf-v2` Argon2id metadata |
| `passwordEnvelopeSchema` | Password method plus required Argon2id metadata |
| `recoveryPhraseEnvelopeSchema` | Recovery method plus required Argon2id metadata |
| `passkeyPrfEnvelopeSchema` | Passkey PRF method plus null KDF metadata |
| `vaultPasskeyCredentialMetadataSchema` | Credential ID, stored transports, device/backup metadata |
| `vaultPasskeyBindingMetadataSchema` | Opaque binding → credential + optional selected variant |
| `vaultPasskeyEnvelopeVariantSchema` | Opaque variant + credential + PRF envelope |
| `vaultPasskeyCredentialStateSchema` | One credential with many bindings and one-or-more variants |
| `storedEnvelopeSchema` | Method-discriminated union of all envelopes |
| `vaultSetupEnvelopeFieldsSchema` | Complete encrypted setup record |
| `vaultDecoyRecordSchema` | Decoy (emergency) vault crypto record |
| `vaultSetupWithDecoySchema` | Primary record with optional `decoy` |
| `vaultEmergencyServerMetadataSchema` | Consumer-owned server emergency metadata |

Associated inferred types include `EncryptedVaultPayload`, `Argon2idKdfMetadata`, `VaultEnvelope`,
`PasswordEnvelope`, `RecoveryPhraseEnvelope`, `PasskeyPrfEnvelope`, `VaultEnvelopeMethod`,
`VaultPasskeyCredentialMetadata`, `VaultPasskeyBindingMetadata`, `VaultPasskeyEnvelopeVariant`,
`VaultPasskeyCredentialState`, `VaultDecoyRecord`, `VaultSetupWithDecoy`, and
`VaultEmergencyServerMetadata`.

### Emergency / duress mode

| Export | Purpose |
| --- | --- |
| `containsDuressSequence(password, sequence)` | Constant-time substring check (bounded by `MAX_DURESS_PASSWORD_LENGTH`) |
| `createDecoyVaultSetup(input)` | Generate decoy UVK, honey payload, duress password envelope |
| `resolveVaultUnlockTarget(input)` | Select `primary` vs `decoy` unlock routing |
| `decryptVaultPayloadForSession(input)` | Decrypt correct blob; refuses primary in emergency |
| `assertSessionPayloadDecryptAllowed(input)` | Guard primary blob decrypt in emergency mode |
| `DuressPasswordMissingSequenceError` | Enrollment rejected when duress password lacks sequence |
| `VaultEmergencyDecryptError` | Primary decrypt attempted while emergency active |

**Browser (`@tgoliveira/vault-core/browser`):**

| Export | Purpose |
| --- | --- |
| `VaultSessionMode` | `"normal"` \| `"emergency"` |
| `getVaultSessionMode()` / `isVaultEmergencyMode()` | Read session mode (includes server pin while locked) |
| `enterVaultEmergencyMode()` | Pin session to emergency routing |
| `clearEmergencyModePin()` | Clear pin after recovery-gated exit |
| `unlockVaultWithPasswordRouting(input)` | Password unlock with duress sequence routing |
| `unlockVaultWithPasskeyRouting(input)` | Passkey unlock with long-press latch routing |
| `unlockVaultWithPasskeyCandidateRouting(input)` | Bounded variant matching with the same primary/decoy session routing |
| `exitEmergencyMode(input)` | Primary recovery phrase gate (+ optional OTP param) |
| `hydrateVaultEmergencyModeFromServer(flag)` | Apply server `emergencyModeActive` on load |

**React (`@tgoliveira/vault-core/react`):**

| Export | Purpose |
| --- | --- |
| `useLongPressDuressSignal(options?)` | 1 s long-press latch for dock/passkey duress |
| `VaultServerStatusSnapshot.emergencyModeEnabled` | Explicit opt-in gate; false/omitted ignores emergency status |
| `VaultServerStatusSnapshot.emergencyModeActive` | Server-persisted emergency flag |
| `VaultServerStatusSnapshot.decoyConfigured` | Decoy enrollment completed |
| `VaultStatusDock.emergencyModeEnabled` | Enables emergency status and dock long-press; default false |
| `VaultDockQuickUnlock.emergencyModeEnabled` | Enables passkey-button long-press; default false |
| `VaultStatusDock.passkeyAutoStartDelayMs` | Default `0`, or `2000` while emergency mode is enabled |
| `VaultStatusDock.onDuressSignalChange` | Duress latch callback |
| `resolveVaultClientStatus` | Returns `emergency_locked` / `emergency_unlocked` when applicable |

**Testing (`@tgoliveira/vault-core/testing`):**

- `assertVaultSessionMode(expected)`
- `createPrimaryDecoyVaultFixture(input)` — deterministic primary + decoy pair
- `HONEY_VAULT_SENTINEL_NOTE`, `PRIMARY_VAULT_SENTINEL_NOTE`

**Security preconditions:** Never decrypt primary `encryptedBlob` in emergency mode. Exit requires
primary recovery phrase; normal password does not exit. Duress sequence is a signal, not a secret key.
Consumer must persist `emergencyModeActive` atomically and rate-limit `emergency_exit`.
The feature is disabled by default through `VAULT_EMERGENCY_MODE_ENABLED=false` and the admin key
`emergencyModeEnabled`.

**Integration guide:** [docs/INTEGRATING_EMERGENCY_DURESS_MODE.md](docs/INTEGRATING_EMERGENCY_DURESS_MODE.md)


### AAD and plaintext validation

- `assertVaultKeyAad(expectedScope, payload, profile)`
- `normalizeEnvelopeAadContext(payload, profile)` — injects `aadContextEnvelope` when `vault_key` context is null/undefined
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
- `PasskeyCredentialScopeError` — fail-closed selection error with typed `code` and descriptor index
- `RecoveryPhraseConfirmationError`
- `VaultAuthorizationError`
- `VaultPasswordUnchangedError`
- `VaultRateLimitError`
- `VaultKeyNotExtractableError`
- `classifyPasskeyCryptoError(error)` / `PasskeyCryptoFailureKind` — passkey unwrap/re-wrap crypto failure taxonomy
- `getDefaultPasskeyCryptoErrorMessage(kind, locale?)` — neutral English defaults (i18n-ready)
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
- `beginVaultSessionUnlock(ownerId)` / `beginVaultSessionOperation(ownerId)` — starts an opaque,
  last-operation-wins owner epoch; an owner change synchronously purges prior browser vault state
- `clearVaultSessionOwner()` — logout/account-removal boundary; cancels work, locks, clears cache,
  cleanup state, owner, session role, and emergency pin
- `isVaultSessionOperationCurrent(operation)` /
  `assertVaultSessionOperationCurrent(operation)` — guard app-owned async continuations
- `captureVaultSessionLease(ownerId)`, `isVaultSessionLeaseCurrent(lease)`, and
  `assertVaultSessionLeaseCurrent(lease)` — capture/validate the installed owner+epoch+role+key
  capability for saves, hydration, and other post-unlock work
- `getVaultSessionSnapshot()` — current `{ ownerId, epoch, role }` without exposing the key
- `VaultSessionLease`, `VaultSessionSnapshot`, `VaultSessionUnlockAttempt`
- `VaultSessionOperation`, `VaultSessionMutationOptions`, and
  `VaultSessionOperationCancelledError` (`missing_operation` / `stale_operation`)
- `await unlockVaultSession(vaultKey, { role?, operation? })` returns the committed lease (or `null`
  for a legacy unowned session); the UVK must be **non-extractable** and every lock invalidates both
  attempts and leases
- `lockVaultSessionManually()` / `isVaultManuallyLocked()`
- `registerVaultLockCleanup(handler)` — sync app cleanup on lock (returns unregister); invoked after UVK and inner-key cache are cleared
- `touchVaultSession(lease?)` / `scheduleVaultAutoLock(lease?)` / `clearVaultAutoLockTimer()` — lease
  is required for renewal after owner-scoped mode is enabled
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

Direct session-key setters are intentionally not exported. Once a consumer starts owner-scoped mode,
package session/cache/emergency mutations require a current operation. See
[`docs/MIGRATING_SESSION_OWNERSHIP_FROM_1_4_0.md`](docs/MIGRATING_SESSION_OWNERSHIP_FROM_1_4_0.md).

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
- `buildPasskeyPrfAuthenticationExtensionsJson(prefix, userId)` — builds JSON-safe public PRF input
  for a server-composed account-login ceremony; hydrate it in the browser with
  `prepareVaultUnlockAuthenticationOptions()` before WebAuthn
- `createRecoveryKitDownload(content, filename)`
- `printRecoveryKitContent(content)`
- `extractPasskeyPrfOutput`, `isPasskeySupported`, `isPrfExtensionHeuristicallyAvailable`,
  `resolvePasskeyPrfCapability`
- `unlockWithPasskeyPrfEnvelopeCandidates`, `MAX_PASSKEY_PRF_ENVELOPE_CANDIDATES`
- `createPasskeyPrfEnvelopeWithSessionCache`, `CreatePasskeyPrfEnvelopeOptions`,
  `CreatePasskeyPrfEnvelopeWithSessionCacheOptions`
- `VaultInnerKeyMaterialCache` — memory-only inner-key cache (`clear`, `getCached`, `cacheFromEnvelopeDecrypt`, `cacheFromPasskeyEnvelope`)
- `cacheVaultInnerKeyMaterialAfterPasswordUnlock`, `cacheVaultInnerKeyMaterialAfterRecoveryUnlock`, `cacheVaultInnerKeyMaterialFromPasskeyUnlock`
- `clearVaultInnerKeyMaterialCache`, `getCachedVaultInnerKeyMaterial`, `resolveInnerVaultKeyBlobForWrap`
- `INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE` — actionable error when cached material is stale
- `prepareWebAuthnPrfExtensions(extensions)` — coerce JSON PRF salts to `ArrayBuffer`
- `prepareVaultPasskeyPrfRegistrationOptions({ userId, prfSaltPrefix, serverOptions, prepareJson? })`
  — requests canonical PRF capability during creation; registration PRF output is not authoritative
  for durable vault envelopes
- `resolvePasskeyPrfEnrollmentAfterRegistration({ registrationCredentialId, verifiedCredentialId, clientExtensionResults })`
  — returns typed `authentication_required`, `unavailable`, or `rejected`; confirmed registrations
  require an exact `credentialSelection` authentication before the first durable envelope is created.
  The deprecated `ready` union member is retained for source compatibility but is not returned
- `alignPrfExtensionsForCredential(options, credentialId?)` — single-credential iOS `eval` parity
- `applyVaultUnlockTransportPolicy(options, policy?, userAgent?)` — preserve (default), platform-only,
  discoverable, or explicit Apple-mobile workaround
- `prepareVaultUnlockAuthenticationOptions(options, { credentialSelection?, transportPolicy?, ... })`
  — composed PRF ceremony prep with fail-closed explicit selection
- `prepareVaultPasskeyPrfAuthenticationOptions({ userId, prfSaltPrefix, serverOptions, prepareJson?, credentialSelection?, transportPolicy?, ... })`
  — full pipeline for unlock, enrollment fallback, disable, and re-wrap
- `sanitizeWebAuthnResponseForServer(response)` — returns a non-mutating response copy without
  `clientExtensionResults.prf`; call before JSON serialization to a server
- `isAppleMobileUserAgent(userAgent)`, `resolveVaultUnlockUserAgent(userAgent?)`
- `createRecoveryKitText`, `buildRecoveryKitContent`

## React: `@tgoliveira/vault-core/react`

- `VaultSessionProvider` / `VaultSessionProviderProps`
- `useVaultSession(options)` / `UseVaultSessionOptions`
- `useVaultUnlocked()` / `useVaultLockState()`
- `resolveVaultClientStatus(status, unlocked, prfSupported)`
- `useVaultClientStatus(serverStatus, prfSupported)`
- `VaultClientStatus` / `VaultServerStatusSnapshot` (`passkeyUnlockAvailableOnThisBrowser?`;
  deprecated device field retained)

Provider and session hook guard options are `registerActivityGuard` (defaults to `false`) and
`registerUnloadGuard` (defaults to `true`). Set `registerActivityGuard` when the app should renew the
auto-lock countdown on user activity; otherwise call `touchVaultSession()` explicitly (for example from
the vault status dock **Stay unlocked** action).
Both accept `lease?: VaultSessionLease`; pass it whenever activity/touch renewal runs after
owner-scoped mode is enabled.

### Vault password and session preferences

- `VaultPasswordStrengthFeedback` — read-only strength line for an existing password (settings flows)
- `VaultAutoLockPreferenceField` — range slider for per-user auto-lock minutes (1 … admin max)
- `useVaultAutoLockPreference(adminResolvedMinutes, options?)` — read/write user preference and sync
  session without reading browser storage during render. Pass
  `{ initialUserMinutes: number | null }` when the server has already resolved the account preference;
  explicit `null` means no override. When the option is omitted, render a neutral/loading state while
  `hydrationStatus === "checking"`; the hook reads local storage in an effect and then returns `"ready"`.
  Owner-scoped consumers must also pass `{ sessionLease: VaultSessionLease | null }`; current leases
  re-arm the timer, while `null`/stale leases configure preference without renewing a session.
- `UseVaultAutoLockPreferenceOptions` / `UseVaultAutoLockPreferenceResult`

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
  `autoFocusPassword` and `autoStartPasskey` (default `true`) control focus and passkey auto-start;
  `passkeyOptionsReady` gates auto-start until WebAuthn options are prepared; wire `bindAutoStartPasskey`
  from the dock `renderQuickUnlock` context (auto-start runs from expand, not `useEffect`)
- `classifyPasskeyUnlockFailure(error)` / `PasskeyUnlockFailureKind` — classify passkey failures for dock redirect policy (complements root `classifyPasskeyCryptoError` for crypto copy)
- `tryConsumePasskeyAutoStart(scopeKey)` / `resetPasskeyAutoStartDedupe(scopeKey)` — passkey auto-start dedupe helpers
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
`configureVaultSession()` / `VaultSessionProvider`), `onNavigateToUnlock`,
`onPasskeyUnlockCancelled`, `shouldRedirectOnPasskeyUnlockFailure`, and
`redirectOnPasskeyUnlockFailure` (default `["redirect_to_full_unlock"]`; user cancellation does not
redirect). The quick-unlock slot receives `fullUnlockHref`, `onPasskeyUnlockFailed`,
`onPasskeyUnlockCancelled`, `bindAutoStartPasskey`, and `autoStartConsumed`. Set `visible={false}`
when the user is signed out. Hide before vault setup via `serverStatus.configured === false`.
Pass `sessionLease` so **Stay unlocked** can renew an owner-scoped session.

### Vault protected gate

Import styles once (includes `vc-vault-protected-gate*` and `vc-vault-lock-overlay` classes).

- `VaultProtectedGate` / `VaultProtectedGateProps` — wraps vault-protected page content; when the
  vault is locked, renders children under fixed blur overlay panel(s) that block interaction while
  excluded chrome (`VaultLockOverlayExclude`) and the status dock (`vc-status-dock-host`) stay usable.
  Optional `lockedContentStrategy`: `"overlay"` (default, children stay mounted) or `"unmount"` (replace
  with `lockedFallback` while locked).
- `VaultSensitiveRegion` / `VaultSensitiveRegionProps` — renders `children` only while unlocked;
  unmounts sensitive subtree on lock (pair with gate overlay for page UX).
- `useOnVaultLocked(callback)` — registers a lock cleanup handler from React (wraps
  `registerVaultLockCleanup`).
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

- `children` — protected page content (stays mounted while locked unless `lockedContentStrategy="unmount"`).
- `lockedContentStrategy?` — `"overlay"` (default) or `"unmount"`.
- `lockedFallback?` — shown while locked when strategy is `"unmount"`.
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
  passkey auto-start remains opt-in and requires `quickPasskeyPlan` plus the separate exact-bound
  `onQuickUnlockPasskey`; `onUnlockPasskey` is explicit-only). Optional `unlockRateLimiter` +
  `rateLimitScopeKey` (default `"default"`) assert before unlock and record failures/successes.
  Customizable `labels`, `passkeyReady`, etc.
- `ReadyQuickPasskeyUnlockPlan` — ready `intent: "quick"` plan accepted by the full-page exact-bound
  auto-start callback
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
