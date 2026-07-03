# Adopting @tgoliveira/vault-core 1.1.0

Upgrade guide for consuming applications that already integrate vault-core **1.0.x** (or carry
LiqSense-era duplicates). Use this document to decide what to import from the package, what to
delete from your repo, and what remains application-owned.

**Prerequisites:** pin `@tgoliveira/vault-core@^1.1.0`, read [CHANGELOG.md](../CHANGELOG.md)
`[1.1.0]`, and skim [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) §9 (passkey PRF).

---

## 1. Overview — what 1.1.0 adds vs 1.0.x

Version **1.1.0** closes the passkey PRF gap epic (items **#8–#16**): crypto and ceremony-prep
logic that many consumers copied locally now ships as stable public APIs. Highlights:

| Area | 1.0.x | 1.1.0 |
| --- | --- | --- |
| Passkey enroll after unlock | Export UVK or hand-roll inner blob re-wrap | `createPasskeyPrfEnvelopeWithSessionCache`, browser inner-key cache |
| PRF byte extraction | App-local Safari `evalByCredential` shims | `extractPasskeyPrfOutput`, `prfBytesForAes256Import` |
| WebAuthn option prep | App-local iOS `eval` / transport pinning | `prepareVaultUnlockAuthenticationOptions` and helpers on browser entry |
| iOS PRF capability | Often over-reported on iOS &lt; 18 | `isPrfExtensionSupported({ userAgent })` gates Apple mobile below major 18 |
| Legacy `vault_key` AAD | App-local multi-AAD unlock shims | `isLegacyVaultKeyEnvelope`, `unwrapVaultKeyWithLegacyAadFallback`, profile `legacyVaultKeyUnlock` |
| Missing envelope `aad.context` | App-local normalize before unwrap | `normalizeEnvelopeAadContext` |
| Passkey crypto errors | App-local `mapPasskeyCryptoError` copy | `classifyPasskeyCryptoError`, `getDefaultPasskeyCryptoErrorMessage` |
| Device binding | Ad hoc credential scoping | `VaultDeviceBindingStore` contract, `resolvePasskeyUnlockAvailableOnDevice`, `scopeAuthenticationOptionsToDevice` |
| Vault-key rotation / re-wrap | Deep `dist/crypto/*` imports or duplicates | Public envelope helpers (`wrapUserVaultKeyWithPrfOutput`, `rewrapInnerVaultKeyMaterialForPrfOutput`, …) |
| Dock passkey UX | 1.0.1 dock redirect/cancel fixes | Unchanged API surface; pair with 1.1.0 browser helpers for options prefetch |

**Minor behavior change:** `isPrfExtensionSupported()` returns `false` on iPhone/iPad/iPod with iOS
major version &lt; 18. Pass an explicit `userAgent` in SSR and unit tests.

Account authentication and vault unlock stay separate. The package still does **not** run WebAuthn
ceremonies or touch your database.

---

## 2. Package vs consumer responsibility

| Concern | Package (`@tgoliveira/vault-core`) | Consumer (your app) |
| --- | --- | --- |
| UVK generation, AES-GCM payloads, Argon2id envelopes | ✓ | |
| Passkey PRF envelope wrap/unwrap | ✓ | |
| Inner vault-key blob cache (memory-only) | ✓ | |
| `extractPasskeyPrfOutput`, PRF salt bytes | ✓ (browser) | |
| WebAuthn **option** preparation (extensions, transports, iOS `eval` parity) | ✓ (browser) | |
| WebAuthn **ceremony** (`navigator.credentials.get/create`) | | ✓ |
| Server WebAuthn verify (`@simplewebauthn/server`, etc.) | | ✓ |
| Device-binding **contracts** (`VaultDeviceBindingStore`, scoping helpers) | ✓ | |
| Device-binding **persistence** (DB rows, cookies, credential id storage) | | ✓ |
| `normalizeEnvelopeAadContext`, legacy AAD fallback unlock | ✓ | |
| Profile strings (`aadContextVault`, `aadContextEnvelope`, `legacyVaultKeyUnlock`) | ✓ (types + routing) | ✓ (choose/freeze values, e.g. `ACME_*` env) |
| `classifyPasskeyCryptoError` vs `classifyPasskeyUnlockFailure` | ✓ (both exported; different jobs) | ✓ (wire into UI; optional branded copy wrapper) |
| iOS PRF support gate | ✓ | ✓ (when to prefetch options; gesture timing for dock auto-start) |
| API routes, ORM, migrations | | ✓ |
| Cookie names, session auth | | ✓ |
| Rate limits at HTTP / unlock layer | ✓ (optional limiter primitives) | ✓ (apply on every unlock path) |
| Product copy, recovery education | | ✓ |
| `VaultStatusDock` / `VaultDockQuickUnlock` React components | ✓ (react entry) | ✓ (handlers, status snapshot, routing) |

**Rule of thumb:** if it touches ciphertext, KDF, PRF bytes, or envelope AAD, prefer the package. If
it touches users, routes, persistence, or `@simplewebauthn`, it stays in the app.

---

## 3. Phase-by-phase migration

Generalized from the passkey PRF epic rollout (section 7). Order matters: later phases assume earlier
imports are wired.

### Phase 1 — P0: inner-key material and passkey enroll

**Goal:** stop duplicating inner-blob extract/re-wrap logic; enroll passkeys after password,
recovery, or passkey unlock without exporting the session UVK.

1. Upgrade to `@tgoliveira/vault-core@^1.1.0`.
2. **Delete** app modules that mirror inner vault-key blob handling, for example:
   - `inner-key-material.ts`, `vault-inner-key-blob.ts`, or equivalent
   - Local `createPasskeyEnvelopeAfterUnlock` that calls `exportUserVaultKey()`
3. **Import** from documented entry points:

```ts
import {
  createPasskeyPrfEnvelope,
  type WrapUserVaultKeyOptions,
} from "@tgoliveira/vault-core";
import {
  cacheVaultInnerKeyMaterialAfterPasswordUnlock,
  cacheVaultInnerKeyMaterialAfterRecoveryUnlock,
  cacheVaultInnerKeyMaterialFromPasskeyUnlock,
  createPasskeyPrfEnvelopeWithSessionCache,
  unlockVaultSession,
} from "@tgoliveira/vault-core/browser";
```

4. After each unlock path, populate the cache then use `createPasskeyPrfEnvelopeWithSessionCache`
   (or pass `innerVaultKeyBlob` via `WrapUserVaultKeyOptions` on `createPasskeyPrfEnvelope`).
5. For KDF/password rotation that re-wraps inner material, use
   `rewrapInnerVaultKeyMaterialForDerivedKeys` / `rewrapEncryptedVaultKeyForDerivedKeys` from the
   main entry instead of local crypto copies.

**Keep in app:** WebAuthn registration ceremony, server credential storage, when to show “Link passkey”.

---

### Phase 2 — P1: PRF extraction, WebAuthn prep, device binding

**Goal:** one implementation for PRF bytes and unlock ceremony options; expose device-bound passkey
eligibility on the vault status snapshot.

1. **Delete** duplicates such as:
   - `normalize-prf-output.ts`, `extract-prf-from-extension-results.ts`
   - `prepare-webauthn-options.ts`, `passkey-transports.ts`, `align-prf-extensions.ts`
   - Local Safari-only `evalByCredential` branches
2. **Import:**

```ts
import {
  buildPrfSaltBytes,
  extractPasskeyPrfOutput,
  prepareVaultUnlockAuthenticationOptions,
  isPasskeySupported,
  isPrfExtensionSupported,
} from "@tgoliveira/vault-core/browser";
import {
  parseDeviceBindingId,
  resolvePasskeyUnlockAvailableOnDevice,
  scopeAuthenticationOptionsToDevice,
  type VaultDeviceBindingStore,
} from "@tgoliveira/vault-core";
```

3. Replace manual `publicKey` assembly with:

```ts
const publicKey = prepareVaultUnlockAuthenticationOptions(
  serverOptionsFromApi,
  { credentialId, filterSingleCredential: true, userAgent }
);
const credential = await navigator.credentials.get({ publicKey });
const prfOutput = extractPasskeyPrfOutput(credential.getClientExtensionResults(), {
  credentialId: credential.id,
});
```

4. Implement `VaultDeviceBindingStore` against your DB; return
   `passkeyUnlockAvailableOnThisDevice` from the vault status API via
   `resolvePasskeyUnlockAvailableOnDevice`. See
   [examples/device-binding/README.md](./examples/device-binding/README.md).

5. Prefetch authentication options **before** dock expand when using passkey auto-start (consumer
   owns timing; package prepares shape only).

**Keep in app:** challenge generation API, `@simplewebauthn/server` verification, cookie that stores
device binding id (name is yours).

---

### Phase 3 — P2: legacy envelope unlock and AAD normalize

**Goal:** remove app-local legacy multi-AAD unlock; rely on core routing with an explicit sunset plan.

1. **Delete** modules like `legacy-envelope-unlock.ts`, `tryLegacyAadCandidates.ts`, or copies of
   `aadByteCandidates` logic.
2. Ensure `VaultCryptoProfile` keeps `legacyVaultKeyUnlock: true` (default) until metrics show zero
   legacy envelopes:

```ts
export const VAULT_PROFILE: VaultCryptoProfile = {
  cryptoVersion: "vault-v1",
  aadContextVault: "myapp:vault:v1",
  aadContextEnvelope: "myapp:vault-envelope:v1",
  // legacyVaultKeyUnlock: true, // default — omit or set explicitly during migration
};
```

3. Use `normalizeEnvelopeAadContext(payload, profile)` only when **writing** or migrating stored
   passkey envelopes missing `aad.context`; unlock APIs route legacy envelopes automatically.
4. Monitor with `isLegacyVaultKeyEnvelope` server-side; re-wrap after unlock via rotation helpers.
5. When counts hit zero, set `legacyVaultKeyUnlock: false`. Details:
   [MIGRATION_LEGACY_VAULT_KEY.md](./MIGRATION_LEGACY_VAULT_KEY.md).

**Keep in app:** migration jobs, metrics dashboards, atomic envelope persistence.

---

### Phase 4 — P3: PRF support gate and crypto error classification

**Goal:** consistent capability probes and user-facing passkey crypto messages.

1. **Delete** `prf-support.ts`, `map-passkey-crypto-error.ts`, and duplicated iOS version parsers.
2. **Import:**

```ts
import {
  classifyPasskeyCryptoError,
  getDefaultPasskeyCryptoErrorMessage,
  isPrfExtensionSupported,
  parseAppleMobileOsMajorVersion,
  DEFAULT_APPLE_MOBILE_PRF_MIN_MAJOR_VERSION,
} from "@tgoliveira/vault-core";
// Browser re-exports for client components:
import { isPrfExtensionSupported } from "@tgoliveira/vault-core/browser";
```

3. Replace local mappers:

```ts
const kind = classifyPasskeyCryptoError(error);
const message = getDefaultPasskeyCryptoErrorMessage(kind);
// Optional: wrap for product tone — keep kind stable for analytics
```

4. For dock redirect policy (cancel vs recoverable vs full unlock page), use
   `classifyPasskeyUnlockFailure` from `@tgoliveira/vault-core/react` — **not**
   `classifyPasskeyCryptoError`. See §5.

**Keep in app:** localized strings, support links, analytics event names.

---

## 4. Per-feature checklist

### Inner-key cache and passkey enroll after unlock

| Action | Detail |
| --- | --- |
| Import | `@tgoliveira/vault-core/browser`: `cacheVaultInnerKeyMaterialAfter*`, `createPasskeyPrfEnvelopeWithSessionCache`, `VaultInnerKeyMaterialCache` |
| Import | `@tgoliveira/vault-core`: `createPasskeyPrfEnvelope`, `WrapUserVaultKeyOptions` |
| Delete | Any module that exports UVK to wrap a new passkey envelope after unlock |
| Keep | Passkey registration UI, PRF salt prefix in profile/admin config |

### PRF output extraction

| Action | Detail |
| --- | --- |
| Import | `extractPasskeyPrfOutput`, `prfBytesForAes256Import` from browser (also on main for isomorphic tests) |
| Delete | Local extension-result parsers and Safari special cases |
| Keep | Calling `getClientExtensionResults()` in the ceremony handler |

### WebAuthn unlock option preparation

| Action | Detail |
| --- | --- |
| Import | `prepareWebAuthnPrfExtensions`, `alignPrfExtensionsForCredential`, `preferPlatformTransportsForVaultUnlock`, `prepareVaultUnlockAuthenticationOptions`, `resolveVaultUnlockUserAgent` from browser |
| Delete | Local transport pinning and single-credential `eval` alignment |
| Keep | API route that returns challenge + allowCredentials; `@simplewebauthn` verify |

### Device binding

| Action | Detail |
| --- | --- |
| Import | `VaultDeviceBindingStore`, `parseDeviceBindingId`, `scopeAuthenticationOptionsToDevice`, `resolvePasskeyUnlockAvailableOnDevice` from main |
| Delete | Ad hoc “only this credential id” filters duplicated from vault-core |
| Keep | DB table, HTTP handlers, cookie/header names, setting `passkeyUnlockAvailableOnThisDevice` on status snapshot |

### Legacy AAD / missing context

| Action | Detail |
| --- | --- |
| Import | `isLegacyVaultKeyEnvelope`, `normalizeEnvelopeAadContext`, unlock envelopes (automatic routing) from main |
| Delete | App-local legacy unlock and multi-AAD candidate loops |
| Keep | Migration metrics, profile flag sunset per [MIGRATION_LEGACY_VAULT_KEY.md](./MIGRATION_LEGACY_VAULT_KEY.md) |

### iOS PRF gate

| Action | Detail |
| --- | --- |
| Import | `isPrfExtensionSupported({ userAgent })`, `parseAppleMobileOsMajorVersion` |
| Delete | Copy-pasted iOS version checks |
| Keep | When to call prefetch; passing SSR `userAgent` into probes |

### Crypto vs dock failure classification

| Action | Detail |
| --- | --- |
| Import | `classifyPasskeyCryptoError`, `getDefaultPasskeyCryptoErrorMessage` from **main** |
| Import | `classifyPasskeyUnlockFailure` from **react** |
| Delete | `map-passkey-crypto-error.ts`, duplicated cancel detection for dock |
| Keep | Product copy wrapper; `redirectOnPasskeyUnlockFailure` policy on `VaultStatusDock` |

### Vault-key envelope helpers (rotation / advanced re-wrap)

| Action | Detail |
| --- | --- |
| Import | `assertInnerVaultKeyBlobMatchesVaultKey`, `extractInnerVaultKeyBlob`, `rewrapInnerVaultKeyMaterialForPrfOutput`, `wrapUserVaultKeyWithPrfOutput`, … from main |
| Delete | Forked `dist/crypto` imports or LiqSense-era vault-key modules |
| Keep | Authorization gates before rotation; atomic server persistence |

---

## 5. Dock / React wiring

When using `VaultStatusDock` + `VaultDockQuickUnlock` (1.0.1+ behavior, compatible with 1.1.0 helpers):

### `passkeyUnlockAvailableOnThisDevice`

Set on `serverStatus` (and quick-unlock `serverStatus`) from your API using
`resolvePasskeyUnlockAvailableOnDevice`. Without it, the dock may hide passkey even when an envelope
exists.

### `passkeyOptionsReady`

Gate passkey **auto-start** until WebAuthn options (challenge, allowCredentials, PRF extensions) are
fetched and prepared. Pass `true` only after your prefetch completes — not merely when
`isPrfExtensionSupported()` is true.

### `bindAutoStartPasskey`

Wire from `VaultStatusDock` → `renderQuickUnlock` → `VaultDockQuickUnlock`. Auto-start runs
synchronously on dock expand (not in `useEffect`) so browsers retain the user-gesture chain on iOS.

```tsx
<VaultStatusDock
  serverStatus={{
    configured,
    hasPasskeyPrfEnvelope,
    passkeyUnlockAvailableOnThisDevice,
  }}
  renderQuickUnlock={({
    bindAutoStartPasskey,
    onPasskeyUnlockFailed,
    onPasskeyUnlockCancelled,
  }) => (
    <VaultDockQuickUnlock
      passkeyReady={passkeyReady}
      passkeyOptionsReady={optionsReady}
      bindAutoStartPasskey={bindAutoStartPasskey}
      onPasskeyUnlockFailed={onPasskeyUnlockFailed}
      onPasskeyUnlockCancelled={onPasskeyUnlockCancelled}
      onUnlockPasskey={handleUnlockPasskey}
      /* … */
    />
  )}
/>
```

### `onPasskeyUnlockCancelled`

Optional callback when the user dismisses the WebAuthn prompt. Default dock policy does **not**
redirect to the full unlock page on cancellation (1.0.1+).

### `classifyPasskeyUnlockFailure` vs `classifyPasskeyCryptoError`

| Classifier | Entry | Use for |
| --- | --- | --- |
| `classifyPasskeyUnlockFailure` | `@tgoliveira/vault-core/react` | Dock routing: `user_cancelled`, `recoverable`, `redirect_to_full_unlock` |
| `classifyPasskeyCryptoError` | `@tgoliveira/vault-core` | User-visible crypto copy after unwrap/re-wrap: `prf_mismatch`, `rewrap_requires_unlock`, `decrypt_failed`, `unknown` |

Typical pattern: catch unlock errors → `classifyPasskeyUnlockFailure` for navigation →
`classifyPasskeyCryptoError` + `getDefaultPasskeyCryptoErrorMessage` for inline error text.

Configure `redirectOnPasskeyUnlockFailure` on `VaultStatusDock` (default
`["redirect_to_full_unlock"]`; user cancellation excluded).

Reference: [apps/consumer-demo/src/components/vault/vault-status-dock-client.tsx](../apps/consumer-demo/src/components/vault/vault-status-dock-client.tsx).

---

## 6. Verification checklist (after migration)

- [ ] `@tgoliveira/vault-core` pinned to `^1.1.0`; no imports from `dist/*` or forked crypto files.
- [ ] Password, recovery, and passkey unlock integration tests still pass.
- [ ] Passkey enroll after password/recovery unlock works without `exportUserVaultKey()`.
- [ ] Safari and Chrome passkey unlock extract PRF via `extractPasskeyPrfOutput`.
- [ ] iOS 17 (or below) reports `isPrfExtensionSupported() === false`; password/recovery still offered.
- [ ] iOS 18+ passkey unlock uses `prepareVaultUnlockAuthenticationOptions` (single-credential `eval`).
- [ ] Legacy envelope fixtures decrypt without app-local legacy modules.
- [ ] `isLegacyVaultKeyEnvelope` metrics captured; re-wrap path tested.
- [ ] Vault status API returns `passkeyUnlockAvailableOnThisDevice` when device binding is enabled.
- [ ] Dock passkey auto-start waits for `passkeyOptionsReady`; cancel does not spuriously redirect.
- [ ] `classifyPasskeyCryptoError` messages shown on crypto failure; dock uses `classifyPasskeyUnlockFailure`.
- [ ] PRF output and UVK absent from network payloads, logs, localStorage, IndexedDB
      ([CONSUMER_SECURITY_REQUIREMENTS.md](./CONSUMER_SECURITY_REQUIREMENTS.md)).
- [ ] `npm run validate` / app test suite green.

---

## 7. Related documentation

- [API_REFERENCE.md](../API_REFERENCE.md) — passkey PRF, device binding, legacy vault_key, dock exports
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) — end-to-end greenfield integration
- [MIGRATION_LEGACY_VAULT_KEY.md](./MIGRATION_LEGACY_VAULT_KEY.md) — legacy AAD sunset
- [examples/device-binding/README.md](./examples/device-binding/README.md) — device binding snapshot
- [CONSUMER_SECURITY_REQUIREMENTS.md](./CONSUMER_SECURITY_REQUIREMENTS.md) — mandatory security checklist
- [CHANGELOG.md](../CHANGELOG.md) `[1.1.0]` — complete release notes

For greenfield apps or first-time extraction from a monolith, see also
[ADOPTING_VAULT_CORE_IN_EXISTING_APPS.md](./ADOPTING_VAULT_CORE_IN_EXISTING_APPS.md).
