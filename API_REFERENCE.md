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
| `createUserVaultKey()` | Generates an extractable 256-bit AES-GCM UVK |
| `importUserVaultKey(bytes)` | Imports raw UVK bytes |
| `exportUserVaultKey(key)` | Exports raw UVK bytes; keep client-only |
| `generateAesKey()`, `importAesKey()`, `exportAesKey()` | Low-level AES key primitives |
| `encryptVaultPayload(payload, key, scope, profile)` | Serializes and encrypts generic JSON |
| `decryptVaultPayload(encrypted, key, expectedScope, profile)` | Validates expected AAD, decrypts, and parses JSON |
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
- `validateNoPlaintextLeak(data)`
- `scanForSentinels(data, sentinels?)`
- `containsSentinel(value, sentinels?)`
- `PLAINTEXT_FORBIDDEN_VAULT_FIELDS`, `ALL_SENTINELS`, and named `SENTINEL_*` constants

The plaintext field guard is recursive and cycle-safe. It is defense in depth; closed API schemas are
still required.

### Errors

- `VaultPlaintextRejectionError`
- `VaultConflictError`
- `VaultNotFoundError`
- `PasskeyPrfRequiredError`
- `PasskeyUnlockError`
- `RecoveryPhraseConfirmationError`
- `VaultAuthorizationError`
- `VaultPasswordUnchangedError`
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
- `unlockVaultSession(vaultKey)` / `lockVaultSession()`
- `lockVaultSessionManually()` / `isVaultManuallyLocked()`
- `touchVaultSession()` / `scheduleVaultAutoLock()` / `clearVaultAutoLockTimer()`
- `getVaultAutoLockRemainingMs()`
- `getSessionVaultKey()` / `isVaultUnlocked()`
- `subscribeVaultSession(listener)`
- `registerVaultActivityGuard(events?)`
- `registerVaultUnloadGuard()`
- `resetVaultSessionLockState()`
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

Provider and session hook guard options are `registerActivityGuard` and `registerUnloadGuard`, both
defaulting to `true`.

## Testing: `@tgoliveira/vault-core/testing`

This entry exports the plaintext validation functions, forbidden field list, `ALL_SENTINELS`, and all
named `SENTINEL_*` values. Use it in network, persistence, logging, and fixture tests. It does not
export internal LiqSense compatibility fixtures.
