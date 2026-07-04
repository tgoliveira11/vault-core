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
| WebAuthn option prep | App-local iOS `eval` / transport pinning | `prepareVaultUnlockAuthenticationOptions`, `prepareVaultPasskeyPrfAuthenticationOptions`, and helpers on browser entry |
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
| Multi-device passkey binding (**required** for production apps with passkey PRF) | | ✓ (DB table, httpOnly cookie, status API field) |
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

## 3. Multi-device passkey unlock (required for new integrations)

From **1.1.0** onward, consuming applications that ship passkey PRF vault unlock in production
**must** implement device binding. Binding is **not optional** for multi-device apps: each browser
or device needs an explicit binding after the user enrolls (or re-links) a passkey on that device.

The reference consumer pattern is **SelahKeep** ([letter-to-god](https://github.com/tgoliveira11/letter-to-god)):
server-side binding rows, an app-owned httpOnly cookie, vault status reflects binding availability,
and WebAuthn unlock options are scoped to the bound credential before the ceremony.

Portable contracts and helpers ship in `@tgoliveira/vault-core`; persistence and cookie names stay
in your app. Full pseudocode:
[examples/device-binding/README.md](./examples/device-binding/README.md).

### Why binding is required

| Without binding | With binding |
| --- | --- |
| Dock may offer passkey unlock on a browser that never enrolled PRF on this device | Dock hides passkey when `passkeyUnlockAvailableOnThisDevice` is `false` |
| Multiple `allowCredentials` may confuse WebAuthn / PRF `eval` alignment | `scopeAuthenticationOptionsToDevice` pins unlock to the credential bound on this browser |
| User assumes “I have a passkey” means vault unlock works everywhere | Password/recovery unlock on a new device, then enroll binding on that device |

`resolvePasskeyUnlockAvailableOnDevice` treats a missing `passkeyUnlockAvailableOnThisDevice` as
**available** when a passkey envelope exists. Production apps that implement binding **must**
pass `passkeyUnlockAvailableOnThisDevice: false` when this browser has no binding — not omit the
field.

### Step-by-step implementation (SelahKeep pattern)

#### a. Server — binding store and cookie

1. Add a consumer-owned DB table (see example SQL in
   [examples/device-binding/README.md](./examples/device-binding/README.md)).
2. Choose an app-owned cookie name (e.g. `myapp_vault_device_binding`). Store an opaque
   `bindingId`; resolve it server-side to the WebAuthn `credentialId` for this browser.
3. Implement an app store with SelahKeep-style methods (names are **your** conventions, not package
   exports):

| App method | Purpose |
| --- | --- |
| `resolveBindingForUser(userId)` | Read cookie → load row → `{ bindingId, credentialId }` or `null` |
| `bindPasskeyToDevice({ userId, credentialId })` | Upsert row, set httpOnly cookie, return `{ bindingId }` |
| `touchLastUsed(bindingId)` | Update `last_used_at` after successful passkey unlock |

Wire these to the package `VaultDeviceBindingStore` contract (`getDeviceBindingId`,
`resolveCredentialId`, optional `saveBinding` / `clearBinding`) for shared server utilities.

#### b. After passkey registration or enroll success

When WebAuthn registration verifies and the passkey PRF envelope is persisted, call
`bindPasskeyToDevice` so this browser is bound to the new credential:

```ts
const { credentialId } = await verifyRegistrationResponse(/* @simplewebauthn/server */);
await persistPasskeyPrfEnvelope(/* ciphertext only */);
await vaultDeviceBindingStore.bindPasskeyToDevice({ userId, credentialId });
```

Also call `bindPasskeyToDevice` when the user links a passkey **after** password or recovery
unlock on a device that did not have a binding yet (same ceremony, same persistence point).

#### c. Vault status API — binding availability

`GET /api/vault/status` (or equivalent) **must** include binding availability whenever a passkey
envelope exists:

```ts
const binding = await vaultDeviceBindingStore.resolveBindingForUser(userId);

const passkeyUnlockAvailableOnThisDevice = resolvePasskeyUnlockAvailableOnDevice({
  hasPasskeyPrfEnvelope: vault.hasPasskeyPrfEnvelope,
  passkeyUnlockAvailableOnThisDevice: binding != null,
});

return {
  configured: vault.configured,
  hasPasskeyPrfEnvelope: vault.hasPasskeyPrfEnvelope,
  passkeyUnlockAvailableOnThisDevice,
};
```

Pass `false` when there is no binding on this browser. The dock and
`resolvePasskeyDockAvailability` use this field to hide passkey quick-unlock on unbound devices.

#### d. Before WebAuthn authenticate (unlock **and** PRF-gated management)

Any `navigator.credentials.get` that feeds PRF output into vault envelope wrap/unwrap must use the
**same** preparation pipeline — not only vault unlock. That includes passkey enable (post-register),
disable (PRF proof), and on-device envelope re-wrap. See
[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) §9 (“PRF authentication ceremonies”) for the
full ceremony table and anti-patterns.

**Unlock** on a device-bound credential:

1. `resolveBindingForUser(userId)` — abort or fall back if `null`.
2. `scopeAuthenticationOptionsToDevice(serverOptions, { credentialId })`.
3. `prepareVaultUnlockAuthenticationOptions(...)` with `filterSingleCredential: true` and
   `userAgent`.
4. Run `navigator.credentials.get` in the browser.
5. `touchLastUsed(bindingId)` after successful verification.

**Enable, disable, re-wrap** — same PRF prep as unlock; device scoping is optional when the server
already returns a single credential (typical post-register enable). Prefer one shared client helper
for all ceremonies:

```ts
import { prepareAuthenticationOptions } from "@tgoliveira/secure-auth/client";
import {
  prepareVaultPasskeyPrfAuthenticationOptions,
  resolveVaultUnlockUserAgent,
} from "@tgoliveira/vault-core/browser";
import {
  resolvePasskeyUnlockAvailableOnDevice,
  scopeAuthenticationOptionsToDevice,
} from "@tgoliveira/vault-core";

const userAgent = resolveVaultUnlockUserAgent();

// Unlock (bound device):
const binding = await vaultDeviceBindingStore.resolveBindingForUser(userId);
if (!binding) throw new Error("passkey_not_bound_on_device");

const unlockPublicKey = await prepareVaultPasskeyPrfAuthenticationOptions({
  userId,
  prfSaltPrefix: "acme-passkey-prf-v1:",
  serverOptions: serverOptionsFromApi,
  prepareJson: prepareAuthenticationOptions,
  credentialId: binding.credentialId,
  userAgent,
  scopeToDevice: true,
});

// Enable / disable / re-wrap (same helper — do not use prepareAuthenticationOptions alone):
const managePublicKey = await prepareVaultPasskeyPrfAuthenticationOptions({
  userId,
  prfSaltPrefix: "acme-passkey-prf-v1:",
  serverOptions: serverOptionsFromApi,
  prepareJson: prepareAuthenticationOptions,
  credentialId,
  userAgent,
});
```

Manual unlock composition (equivalent to the composed helper when `scopeToDevice: true`):

```ts
import {
  resolvePasskeyUnlockAvailableOnDevice,
  scopeAuthenticationOptionsToDevice,
} from "@tgoliveira/vault-core";
import { prepareVaultUnlockAuthenticationOptions } from "@tgoliveira/vault-core/browser";

const binding = await vaultDeviceBindingStore.resolveBindingForUser(userId);
if (!binding) throw new Error("passkey_not_bound_on_device");

const scoped = scopeAuthenticationOptionsToDevice(serverOptionsFromApi, {
  credentialId: binding.credentialId,
});
const publicKey = prepareVaultUnlockAuthenticationOptions(scoped, {
  credentialId: binding.credentialId,
  filterSingleCredential: true,
  userAgent,
});
```

#### e. React dock — pass server status through

Fetch vault status from your API and pass `passkeyUnlockAvailableOnThisDevice` into
`VaultStatusDock` and `VaultDockQuickUnlock` `serverStatus` (see §6). Do not derive this flag
only from client-side storage in production — the server must authoritative reflect whether this
browser’s cookie resolves to a binding row.

```tsx
<VaultStatusDock
  serverStatus={{
    configured,
    hasPasskeyPrfEnvelope,
    passkeyUnlockAvailableOnThisDevice, // from GET /api/vault/status
  }}
  /* … */
/>
```

#### f. New device behavior

| Situation | Expected UX |
| --- | --- |
| User enrolled passkey on device A; opens app on device B | `passkeyUnlockAvailableOnThisDevice: false` — dock shows password/recovery unlock, not passkey quick-unlock |
| User unlocks on device B with password or recovery | Session unlock works; offer “Link passkey on this device” when PRF is supported |
| User completes passkey enroll on device B | `bindPasskeyToDevice` → status returns `passkeyUnlockAvailableOnThisDevice: true` on subsequent loads |
| User clears cookies or uses private browsing | Treat as unbound (`false`) until they enroll or re-link passkey on that browser |

Account passkey **login** and vault passkey **PRF unlock** remain separate: logging in on a new
device does not imply vault PRF binding until enroll + `bindPasskeyToDevice` completes.

### Migration and opt-out

| Audience | Action |
| --- | --- |
| Existing integrations without binding | Add §3 steps before shipping passkey PRF to production users with multiple devices |
| New integrations (1.1.0+) | Implement binding as part of Phase 2 — **required**, not optional |
| Single-device-only apps (kiosk, embedded) | May omit binding only with an explicit product decision; document risks: omitting `passkeyUnlockAvailableOnThisDevice` defaults to “available”, so the dock may show passkey on browsers that cannot complete PRF unlock |

---

## 4. Phase-by-phase migration

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

### Phase 2 — P1: PRF extraction, WebAuthn prep, device binding (**required**)

**Goal:** one implementation for PRF bytes and unlock ceremony options; **require** device-bound
passkey eligibility on the vault status snapshot for all production multi-device integrations.

1. **Delete** duplicates such as:
   - `normalize-prf-output.ts`, `extract-prf-from-extension-results.ts`
   - `prepare-webauthn-options.ts`, `passkey-transports.ts`, `align-prf-extensions.ts`
   - Local Safari-only `evalByCredential` branches
2. **Import:**

```ts
import {
  buildPrfSaltBytes,
  extractPasskeyPrfOutput,
  prepareVaultPasskeyPrfAuthenticationOptions,
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

4. **Required:** implement the multi-device binding store, cookie, and status API field per §3.
   Implement `VaultDeviceBindingStore` against your DB; return
   `passkeyUnlockAvailableOnThisDevice` from `GET /api/vault/status` via
   `resolvePasskeyUnlockAvailableOnDevice`. Pass `false` when this browser has no binding.
   See [examples/device-binding/README.md](./examples/device-binding/README.md).

5. Prefetch authentication options **before** dock expand when using passkey auto-start (consumer
   owns timing; package prepares shape only).

**Keep in app:** challenge generation API, `@simplewebauthn/server` verification, httpOnly cookie
that stores device binding id (name is yours), `bindPasskeyToDevice` after enroll,
`resolveBindingForUser` on status and unlock routes.

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
   `classifyPasskeyCryptoError`. See §6.

**Keep in app:** localized strings, support links, analytics event names.

---

## 5. Per-feature checklist

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

### Device binding (**required** for production passkey PRF)

| Action | Detail |
| --- | --- |
| Import | `VaultDeviceBindingStore`, `parseDeviceBindingId`, `scopeAuthenticationOptionsToDevice`, `resolvePasskeyUnlockAvailableOnDevice` from main |
| Implement | App store: `resolveBindingForUser`, `bindPasskeyToDevice`, `touchLastUsed`; DB table + httpOnly cookie (§3) |
| Delete | Ad hoc “only this credential id” filters duplicated from vault-core |
| Keep | DB table, HTTP handlers, cookie names, explicit `passkeyUnlockAvailableOnThisDevice: false` when unbound |

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

## 6. Dock / React wiring

When using `VaultStatusDock` + `VaultDockQuickUnlock` (1.0.1+ behavior, compatible with 1.1.0 helpers):

### `passkeyUnlockAvailableOnThisDevice` (**required** with device binding)

Set on `serverStatus` (and quick-unlock `serverStatus`) from your API using
`resolvePasskeyUnlockAvailableOnDevice` and `resolveBindingForUser` (§3). Pass `false` when this
browser has no binding. Without an explicit `false`, the dock may show passkey even when unlock
cannot succeed on this device.

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

## 7. Verification checklist (after migration)

- [ ] `@tgoliveira/vault-core` pinned to `^1.1.0`; no imports from `dist/*` or forked crypto files.
- [ ] Password, recovery, and passkey unlock integration tests still pass.
- [ ] Passkey enroll after password/recovery unlock works without `exportUserVaultKey()`.
- [ ] Safari and Chrome passkey unlock extract PRF via `extractPasskeyPrfOutput`.
- [ ] iOS 17 (or below) reports `isPrfExtensionSupported() === false`; password/recovery still offered.
- [ ] iOS 18+ passkey unlock uses `prepareVaultUnlockAuthenticationOptions` (single-credential `eval`).
- [ ] Passkey **enable**, **disable**, and **re-wrap** ceremonies use the same PRF prep helper as unlock (shared function or `prepareVaultPasskeyPrfAuthenticationOptions`).
- [ ] Re-enable passkey on each device after fixing client prep if envelopes were created with wrong PRF bytes.
- [ ] Legacy envelope fixtures decrypt without app-local legacy modules.
- [ ] `isLegacyVaultKeyEnvelope` metrics captured; re-wrap path tested.
- [ ] Multi-device binding implemented (§3): DB row, httpOnly cookie, `bindPasskeyToDevice` on enroll.
- [ ] `GET /api/vault/status` returns `passkeyUnlockAvailableOnThisDevice: false` when unbound; `true` after bind on this browser.
- [ ] Unlock path calls `scopeAuthenticationOptionsToDevice` before `prepareVaultUnlockAuthenticationOptions`.
- [ ] Enable/disable/rewrap paths do **not** call `prepareAuthenticationOptions` (or similar) without vault-core PRF prep.
- [ ] Dock passkey auto-start waits for `passkeyOptionsReady`; cancel does not spuriously redirect.
- [ ] `classifyPasskeyCryptoError` messages shown on crypto failure; dock uses `classifyPasskeyUnlockFailure`.
- [ ] PRF output and UVK absent from network payloads, logs, localStorage, IndexedDB
      ([CONSUMER_SECURITY_REQUIREMENTS.md](./CONSUMER_SECURITY_REQUIREMENTS.md)).
- [ ] `npm run validate` / app test suite green.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| “Could not decrypt your vault with this passkey” immediately after enable | Enable used JSON-only WebAuthn prep (`prepareAuthenticationOptions` alone); unlock used vault-core PRF prep → different PRF bytes | Use `prepareVaultPasskeyPrfAuthenticationOptions` (or the same manual pipeline) for **all** PRF ceremonies; re-enable passkey or re-wrap envelope on affected devices |
| Passkey ceremony succeeds but PRF output does not decrypt envelope | Missing `prepareVaultUnlockAuthenticationOptions` / salt coercion / iOS `eval` alignment | See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) §9 |
| Dock shows passkey on a browser that cannot unlock | Missing or omitted `passkeyUnlockAvailableOnThisDevice: false` when unbound | Implement device binding per §3 |

---

## 9. Related documentation

- [API_REFERENCE.md](../API_REFERENCE.md) — passkey PRF, device binding, legacy vault_key, dock exports
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) — end-to-end greenfield integration
- [MIGRATION_LEGACY_VAULT_KEY.md](./MIGRATION_LEGACY_VAULT_KEY.md) — legacy AAD sunset
- [examples/device-binding/README.md](./examples/device-binding/README.md) — multi-device binding store, cookie, status API
- [CONSUMER_SECURITY_REQUIREMENTS.md](./CONSUMER_SECURITY_REQUIREMENTS.md) — mandatory security checklist
- [CHANGELOG.md](../CHANGELOG.md) `[1.1.0]` — complete release notes

For greenfield apps or first-time extraction from a monolith, see also
[ADOPTING_VAULT_CORE_IN_EXISTING_APPS.md](./ADOPTING_VAULT_CORE_IN_EXISTING_APPS.md).
