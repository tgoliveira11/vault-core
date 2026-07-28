# Adopting @tgoliveira/vault-core 1.1.0

Upgrade guide for consuming applications that already integrate vault-core **1.0.x** (or carry
LiqSense-era duplicates). Use this document to decide what to import from the package, what to
delete from your repo, and what remains application-owned.

**Prerequisites:** pin `@tgoliveira/vault-core@^1.1.0`, read [CHANGELOG.md](../CHANGELOG.md)
`[1.1.0]`, and skim [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) §9 (passkey PRF).

> **Passkey correction after 1.2.0:** synced credentials do not require a separate passkey
> registration per physical device. Bindings are opaque browser routing state, and several bindings
> may reference one credential. For current APIs and migration, read
> [MIGRATING_PASSKEYS_FROM_1_2_0.md](./MIGRATING_PASSKEYS_FROM_1_2_0.md). Deprecated 1.1 names remain
> below only where they explain the historical upgrade.

---

## 1. Overview — what 1.1.0 adds vs 1.0.x

Version **1.1.0** closes the passkey PRF gap epic (items **#8–#16**): crypto and ceremony-prep
logic that many consumers copied locally now ships as stable public APIs. Highlights:

| Area | 1.0.x | 1.1.0 |
| --- | --- | --- |
| Passkey enroll after unlock | Export UVK or hand-roll inner blob re-wrap | `createPasskeyPrfEnvelopeWithSessionCache`, browser inner-key cache |
| PRF byte extraction | App-local Safari `evalByCredential` shims | `extractPasskeyPrfOutput`, `prfBytesForAes256Import` |
| WebAuthn option prep | App-local iOS `eval` / transport pinning | `prepareVaultUnlockAuthenticationOptions`, `prepareVaultPasskeyPrfAuthenticationOptions`, and helpers on browser entry |
| iOS PRF capability | Often over-reported on iOS &lt; 18 | Historical `isPrfExtensionSupported({ userAgent })` heuristic; current code uses `resolvePasskeyPrfCapability()` |
| Legacy `vault_key` AAD | App-local multi-AAD unlock shims | Core routing with `legacyVaultKeyUnlock` plus explicit `legacyVaultKeyAadContexts` |
| Missing envelope `aad.context` | App-local normalize before unwrap | `normalizeEnvelopeAadContext` |
| Passkey crypto errors | App-local `mapPasskeyCryptoError` copy | `classifyPasskeyCryptoError`, `getDefaultPasskeyCryptoErrorMessage` |
| Browser binding | Ad hoc credential scoping | Historical device-named APIs; current replacements use opaque binding and credential terminology |
| Vault-key rotation / re-wrap | Deep `dist/crypto/*` imports or duplicates | Public envelope helpers (`wrapUserVaultKeyWithPrfOutput`, `rewrapInnerVaultKeyMaterialForPrfOutput`, …) |
| Dock passkey UX | 1.0.1 dock redirect/cancel fixes | Unchanged API surface; pair with 1.1.0 browser helpers for options prefetch |

The 1.1 `isPrfExtensionSupported()` API was only a user-agent/API heuristic. Current integrations use
`resolvePasskeyPrfCapability()` to distinguish heuristic availability from registration- or
authentication-confirmed PRF results.

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
| Credential/binding/variant portable contracts and strict selection | ✓ | |
| Optional browser binding for quick-unlock routing | | ✓ (DB table, httpOnly cookie, status API field) |
| Binding and credential persistence (DB rows, cookies, credential metadata) | | ✓ |
| `normalizeEnvelopeAadContext`, legacy AAD fallback unlock | ✓ | |
| Profile strings (`aadContextVault`, `aadContextEnvelope`, legacy flags/allowlist) | ✓ (types + routing) | ✓ (choose/freeze only known deployed values) |
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

## 3. Multi-device passkey unlock

Consuming applications may keep an opaque binding per browser for quick-unlock routing. A synced
credential can be used by several browsers/devices; each binding references the same credential and
does not require another WebAuthn registration. A single-device credential still requires another
credential on another device.

The reference consumer pattern is **SelahKeep** ([letter-to-god](https://github.com/tgoliveira11/letter-to-god)):
server-side binding rows, an app-owned httpOnly cookie, vault status reflects binding availability,
and WebAuthn unlock options are scoped to the bound credential before the ceremony.

Portable contracts and helpers ship in `@tgoliveira/vault-core`; persistence and cookie names stay
in your app. Full pseudocode:
[examples/device-binding/README.md](./examples/device-binding/README.md).

### Why an optional binding is useful

| Without binding | With binding |
| --- | --- |
| Dock has no quick-unlock routing hint | Dock hides bound-browser quick unlock when `passkeyUnlockAvailableOnThisBrowser` is `false` |
| Multiple `allowCredentials` need an explicit selection policy | `scopeAuthenticationOptionsToCredential` pins exact unlock to the bound credential |
| Cleared/new browser has no routing hint | Explicitly use an existing passkey, match its envelope locally, then add another binding |

`resolvePasskeyUnlockAvailable` treats missing binding state as unavailable for quick unlock. Pass
`passkeyUnlockAvailableOnThisBrowser: true` only after resolving a valid opaque binding. Keep a
separate explicit “Use an existing passkey” action for unbound browsers.

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
| `saveBrowserBinding({ userId, credentialId, selectedEnvelopeVariantId })` | Insert another row, set httpOnly cookie, return `{ bindingId }` |
| `touchLastUsed(bindingId)` | Update `last_used_at` after successful passkey unlock |

Wire these to the package `VaultPasskeyBindingStore` contract (`getBindingId`,
`resolveBindingTarget`, optional `saveBinding` / `clearBinding`) for shared utilities.

#### b. After passkey registration or enroll success

Prepare registration with `prepareVaultPasskeyPrfRegistrationOptions()` and resolve it with
`resolvePasskeyPrfEnrollmentAfterRegistration()` after server verification. A confirmed credential
returns `authentication_required`; run the existing exact-credential authentication path and create
the durable envelope only from its `get()` PRF output.

After the envelope is persisted, create an opaque binding so this browser routes to the new
credential:

```ts
const { credentialId } = await verifyRegistrationResponse(/* @simplewebauthn/server */);
await persistPasskeyPrfEnvelope(/* ciphertext only */);
await vaultDeviceBindingStore.bindPasskeyToDevice({ userId, credentialId });
```

For a synced credential on an unbound browser, prefer WebAuthn authentication with **Use an existing
passkey**, bounded local candidate matching, and then add another binding. Do not register a second
credential solely because the browser is new.

#### c. Vault status API — binding availability

`GET /api/vault/status` (or equivalent) **must** include binding availability whenever a passkey
envelope exists:

```ts
import { resolvePasskeyUnlockAvailable } from "@tgoliveira/vault-core";

const binding = await vaultDeviceBindingStore.resolveBindingForUser(userId);

const passkeyUnlockAvailableOnThisBrowser = resolvePasskeyUnlockAvailable({
  hasPasskeyPrfEnvelope: vault.hasPasskeyPrfEnvelope,
  passkeyUnlockAvailableOnThisBrowser: binding != null,
});

return {
  configured: vault.configured,
  hasPasskeyPrfEnvelope: vault.hasPasskeyPrfEnvelope,
  passkeyUnlockAvailableOnThisBrowser,
};
```

Pass `false` when there is no binding on this browser. The dock and
`resolvePasskeyDockAvailability` use this field to hide passkey quick-unlock on unbound devices.

#### d. Before WebAuthn authenticate (unlock **and** PRF-gated management)

Any `navigator.credentials.get` that feeds PRF output into vault envelope wrap/unwrap must use the
**same** preparation pipeline — not only vault unlock. That includes the passkey enable fallback
(when registration omitted PRF output), disable (PRF proof), and on-device envelope re-wrap. See
[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) §9 (“PRF registration and authentication ceremonies”) for the
full ceremony table and anti-patterns.

**Unlock** on a device-bound credential:

1. `resolveBindingForUser(userId)` — abort or fall back if `null`.
2. Prepare options with `credentialSelection: { mode: "exact", credentialId }`.
3. Preserve stored transports by default; select a restrictive transport policy only explicitly.
4. Run `navigator.credentials.get` in the browser.
5. `touchLastUsed(bindingId)` after successful verification.

**Enable fallback, disable, re-wrap** — same PRF prep as unlock; device scoping is optional when the
server already returns a single credential. Prefer one shared client helper for all authentication
ceremonies:

```ts
import { prepareAuthenticationOptions } from "@tgoliveira/secure-auth/client";
import {
  prepareVaultPasskeyPrfAuthenticationOptions,
} from "@tgoliveira/vault-core/browser";

// Unlock (bound device):
const binding = await vaultDeviceBindingStore.resolveBindingForUser(userId);
if (!binding) throw new Error("passkey_not_bound_on_device");

const unlockPublicKey = await prepareVaultPasskeyPrfAuthenticationOptions({
  userId,
  prfSaltPrefix: "acme-passkey-prf-v1:",
  serverOptions: serverOptionsFromApi,
  prepareJson: prepareAuthenticationOptions,
  credentialSelection: { mode: "exact", credentialId: binding.credentialId },
  transportPolicy: "preserve",
});

// Enrollment fallback / disable / re-wrap (do not use prepareAuthenticationOptions alone):
const managePublicKey = await prepareVaultPasskeyPrfAuthenticationOptions({
  userId,
  prfSaltPrefix: "acme-passkey-prf-v1:",
  serverOptions: serverOptionsFromApi,
  prepareJson: prepareAuthenticationOptions,
  credentialSelection: { mode: "exact", credentialId },
  transportPolicy: "preserve",
});
```

Manual exact-selection composition:

```ts
import { scopeAuthenticationOptionsToCredential } from "@tgoliveira/vault-core";
import { prepareVaultUnlockAuthenticationOptions } from "@tgoliveira/vault-core/browser";

const binding = await vaultDeviceBindingStore.resolveBindingForUser(userId);
if (!binding) throw new Error("passkey_not_bound_on_device");

const scoped = scopeAuthenticationOptionsToCredential(serverOptionsFromApi, {
  credentialId: binding.credentialId,
});
const publicKey = prepareVaultUnlockAuthenticationOptions(scoped, {
  credentialSelection: { mode: "exact", credentialId: binding.credentialId },
  transportPolicy: "preserve",
});
```

#### e. React dock — pass server status through

Fetch vault status from your API and pass `passkeyUnlockAvailableOnThisBrowser` into
`VaultStatusDock` and `VaultDockQuickUnlock` `serverStatus` (see §6). Do not derive this flag
only from client-side storage in production — the server must authoritative reflect whether this
browser’s cookie resolves to a binding row.

```tsx
<VaultStatusDock
  serverStatus={{
    configured,
    hasPasskeyPrfEnvelope,
    passkeyUnlockAvailableOnThisBrowser, // from GET /api/vault/status
  }}
  /* … */
/>
```

#### f. New device behavior

| Situation | Expected UX |
| --- | --- |
| User enrolled a synced passkey on device A; opens app on device B | Bound quick unlock is unavailable; offer explicit “Use an existing passkey” |
| Existing passkey matches an envelope variant | Add another opaque binding to the same credential and matched variant |
| A single-device credential is unavailable on device B | Offer separate enrollment only after password/recovery unlock |
| User clears cookies or uses private browsing | Treat as unbound until existing-credential discovery succeeds again |

Account passkey **login** and vault passkey **PRF unlock** remain separate: logging in on a new
device does not imply vault PRF binding or unlock.

### Migration and opt-out

| Audience | Action |
| --- | --- |
| Existing integrations without binding | Keep explicit passkey discovery; add opaque bindings only when quick-unlock routing is useful |
| New integrations | Model credential, optional bindings, and one-or-more variants separately |
| Single-device-only apps (kiosk, embedded) | A separate credential may be enrolled on another device after local password/recovery authorization |

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

### Phase 2 — P1: PRF extraction, WebAuthn prep, and optional browser binding

**Goal:** one implementation for PRF bytes and unlock ceremony options, with fail-closed credential
selection and optional bound-browser quick-unlock routing.

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
  resolvePasskeyPrfCapability,
} from "@tgoliveira/vault-core/browser";
import {
  parsePasskeyBindingId,
  resolvePasskeyUnlockAvailable,
  scopeAuthenticationOptionsToCredential,
  type VaultPasskeyBindingStore,
} from "@tgoliveira/vault-core";
```

3. Replace manual `publicKey` assembly with:

```ts
const publicKey = prepareVaultUnlockAuthenticationOptions(
  serverOptionsFromApi,
  {
    credentialSelection: { mode: "exact", credentialId },
    transportPolicy: "preserve",
  }
);
const credential = await navigator.credentials.get({ publicKey });
const prfOutput = extractPasskeyPrfOutput(credential.getClientExtensionResults(), {
  credentialId: credential.id,
});
```

4. When bound-browser quick unlock is desired, implement the opaque binding store, cookie, and
   status API field per §3. Implement `VaultPasskeyBindingStore` against your DB; return
   `passkeyUnlockAvailableOnThisBrowser` from `GET /api/vault/status` via
   `resolvePasskeyUnlockAvailable`. Pass `false` when this browser has no binding.
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
  // legacyVaultKeyAadContexts: ["myapp:known-legacy-envelope:v0"],
};
```

Only add an explicit legacy string after confirming it was a previously shipped application constant.
Arbitrary non-canonical contexts fail closed. Missing and null contexts remain eligible while legacy
unlock is enabled.

3. Use `normalizeEnvelopeAadContext(payload, profile)` at a compatibility read boundary only when
   production fixtures prove the ciphertext was authenticated with the canonical context but its
   serialized metadata omitted it. Do not persist an AAD mutation; decrypt and re-wrap to migrate.
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
} from "@tgoliveira/vault-core";
// Browser re-exports for client components:
import { resolvePasskeyPrfCapability } from "@tgoliveira/vault-core/browser";
```

3. Replace local mappers:

```ts
const kind = classifyPasskeyCryptoError(error);
const message = getDefaultPasskeyCryptoErrorMessage(kind);
// Optional: wrap for product tone — keep kind stable for analytics

const preliminaryCapability = resolvePasskeyPrfCapability();
// Confirm again with registration/authentication client extension results after the ceremony.
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
| Import | `prepareWebAuthnPrfExtensions`, `alignPrfExtensionsForCredential`, `applyVaultUnlockTransportPolicy`, `prepareVaultUnlockAuthenticationOptions` from browser |
| Delete | Local transport pinning and single-credential `eval` alignment |
| Keep | API route that returns challenge + allowCredentials; `@simplewebauthn` verify |

### Optional browser binding

| Action | Detail |
| --- | --- |
| Import | `VaultPasskeyBindingStore`, `parsePasskeyBindingId`, `scopeAuthenticationOptionsToCredential`, `resolvePasskeyUnlockAvailable` from main |
| Implement | App store: `resolveBindingForUser`, `saveBrowserBinding`, `touchLastUsed`; DB table + httpOnly cookie when quick unlock needs routing (§3) |
| Delete | Ad hoc “only this credential id” filters duplicated from vault-core |
| Keep | DB table, HTTP handlers, cookie names, explicit `passkeyUnlockAvailableOnThisBrowser: false` when unbound |

### Legacy AAD / missing context

| Action | Detail |
| --- | --- |
| Import | `isLegacyVaultKeyEnvelope`, `normalizeEnvelopeAadContext`, unlock envelopes (automatic routing) from main |
| Delete | App-local legacy unlock and multi-AAD candidate loops |
| Keep | Migration metrics, profile flag sunset per [MIGRATION_LEGACY_VAULT_KEY.md](./MIGRATION_LEGACY_VAULT_KEY.md) |

### iOS PRF gate

| Action | Detail |
| --- | --- |
| Import | `resolvePasskeyPrfCapability()`, and `parseAppleMobileOsMajorVersion` only for a documented compatibility policy |
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

### `passkeyUnlockAvailableOnThisBrowser`

Set on `serverStatus` (and quick-unlock `serverStatus`) from your API using
`resolvePasskeyUnlockAvailable` and `resolveBindingForUser` (§3). Pass `false` when this browser has
no binding. Missing binding state now fails closed for bound-browser quick unlock.

### `passkeyOptionsReady`

Gate passkey **auto-start** until WebAuthn options (challenge, allowCredentials, PRF extensions) are
fetched and prepared. Pass `true` only after your prefetch completes — not merely when the preliminary
PRF heuristic is available.

### `bindAutoStartPasskey`

Wire from `VaultStatusDock` → `renderQuickUnlock` → `VaultDockQuickUnlock`. Auto-start runs
synchronously on dock expand (not in `useEffect`) so browsers retain the user-gesture chain on iOS.

```tsx
<VaultStatusDock
  serverStatus={{
    configured,
    hasPasskeyPrfEnvelope,
    passkeyUnlockAvailableOnThisBrowser,
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

## 6.1 Lock hygiene (required)

`lockVaultSession()` clears the UVK and inner-key cache in the package. **Consumers must remove
decrypted plaintext from React state, caches, and the DOM.**

| Mechanism | Entry | Use |
| --- | --- | --- |
| `registerVaultLockCleanup` | `@tgoliveira/vault-core/browser` | Clear stores/query cache on lock |
| `useOnVaultLocked` | `@tgoliveira/vault-core/react` | Same from components |
| `VaultSensitiveRegion` | `@tgoliveira/vault-core/react` | Unmount secrets subtree while locked |
| `VaultProtectedGate` `lockedContentStrategy="unmount"` | react | Optional whole-page unmount |
| `assertNoVaultPlaintextInDocument` | `@tgoliveira/vault-core/testing` | Post-lock integration tests |

Default gate mode remains **overlay** (blur only). Use **overlay + `VaultSensitiveRegion`** for
typical apps, or gate **unmount** for routes where the entire page is sensitive.

See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) §12 and
[CONSUMER_SECURITY_REQUIREMENTS.md](./CONSUMER_SECURITY_REQUIREMENTS.md) §3.

---

## 7. Verification checklist (after migration)

- [ ] `@tgoliveira/vault-core` pinned to `^1.1.0`; no imports from `dist/*` or forked crypto files.
- [ ] Password, recovery, and passkey unlock integration tests still pass.
- [ ] Passkey enroll after password/recovery unlock works without `exportUserVaultKey()`.
- [ ] Safari and Chrome passkey unlock extract PRF via `extractPasskeyPrfOutput`.
- [ ] Preliminary PRF heuristic is not treated as a confirmed credential capability; password/recovery remains offered.
- [ ] iOS 18+ passkey unlock uses `prepareVaultUnlockAuthenticationOptions` (single-credential `eval`).
- [ ] Registration uses `prepareVaultPasskeyPrfRegistrationOptions()` for capability confirmation;
  after exact server verification, a credential-scoped `get()` supplies the durable-envelope PRF.
- [ ] Passkey enable **fallback**, disable, and re-wrap authentication ceremonies use the same PRF
  prep helper as unlock (`prepareVaultPasskeyPrfAuthenticationOptions`).
- [ ] Preserve known-good envelopes; after recovery authorization, add a compatibility variant when a
  platform path returns a different PRF result.
- [ ] Legacy envelope fixtures decrypt without app-local legacy modules.
- [ ] `isLegacyVaultKeyEnvelope` metrics captured; re-wrap path tested.
- [ ] If bound quick unlock is implemented, multiple opaque binding rows can reference one credential.
- [ ] `GET /api/vault/status` returns `passkeyUnlockAvailableOnThisBrowser: false` when unbound; `true` after a valid binding resolves.
- [ ] Unlock uses exact fail-closed credential selection; discoverable flow is explicit.
- [ ] Enable/disable/rewrap paths do **not** call `prepareAuthenticationOptions` (or similar) without vault-core PRF prep.
- [ ] Dock passkey auto-start waits for `passkeyOptionsReady`; cancel does not spuriously redirect.
- [ ] `classifyPasskeyCryptoError` messages shown on crypto failure; dock uses `classifyPasskeyUnlockFailure`.
- [ ] Lock clears app state via `registerVaultLockCleanup` / `useOnVaultLocked`; secrets unmounted via `VaultSensitiveRegion` or gate `unmount`.
- [ ] Post-lock tests pass `assertNoVaultPlaintextInDocument()` when using testing sentinels.
- [ ] PRF output and UVK absent from network payloads, logs, localStorage, IndexedDB
      ([CONSUMER_SECURITY_REQUIREMENTS.md](./CONSUMER_SECURITY_REQUIREMENTS.md)).
- [ ] `npm run validate` / app test suite green.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| “Could not decrypt your vault with this passkey” immediately after enable | Enable used JSON-only WebAuthn prep (`prepareAuthenticationOptions` alone); unlock used vault-core PRF prep → different PRF bytes | Use `prepareVaultPasskeyPrfAuthenticationOptions` (or the same manual pipeline) for **all** PRF ceremonies; re-enable passkey or re-wrap envelope on affected devices |
| Passkey ceremony succeeds but PRF output does not decrypt envelope | Missing `prepareVaultUnlockAuthenticationOptions` / salt coercion / iOS `eval` alignment | See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) §9 |
| Dock shows passkey on an unbound browser | Bound-browser status was derived without a valid binding | Return `passkeyUnlockAvailableOnThisBrowser: false`; offer “Use an existing passkey” separately |

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
