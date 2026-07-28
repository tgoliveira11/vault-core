# Complete Implementation Guide

This guide is the end-to-end consumer contract for `@tgoliveira/vault-core`. It is written so a
developer or coding agent can implement the package without reading its source code.

## 1. What the package owns

The package owns:

- Generation and import/export of the 256-bit User Vault Key (UVK).
- AES-GCM encryption of generic JSON payloads with authenticated context.
- Password and recovery phrase envelopes using bounded Argon2id.
- Passkey PRF envelopes when the application provides WebAuthn PRF output bytes.
- BIP39 English recovery phrase generation, validation, confirmation, and recovery kit text.
- Runtime schemas for encrypted payloads and stored envelopes.
- Browser-only in-memory session, inactivity lock, storage namespace inspection, and recovery kit UI
  helpers.
- Optional React session and status helpers.
- Plaintext leak guards and testing sentinels.

The consuming application owns:

- Account authentication and authorization.
- API routes, database schemas, persistence, rate limiting, and audit logging.
- The product-specific plaintext payload schema and migrations.
- WebAuthn registration and authentication ceremonies.
- UI, password policy, recovery education, and destructive recovery decisions.

Account login must never unlock the vault. Account password reset must never replace vault recovery.

**Agents:** complete the mandatory checklist in
[CONSUMER_SECURITY_REQUIREMENTS.md](./CONSUMER_SECURITY_REQUIREMENTS.md) before marking vault
integration done (auth/RBAC on admin APIs, `withVaultUnlockRateLimit` on every unlock code path, CSP,
`assertNoVaultPlaintextFields`, and programmatic unlock checks — not overlay-only UX).

## 2. Requirements and installation

- Node.js 20 or newer for build, SSR, and tests.
- Web Crypto (`globalThis.crypto.subtle`) in the runtime performing encryption.
- React 18 or newer only when using `@tgoliveira/vault-core/react`.

```bash
npm install @tgoliveira/vault-core
```

Use only documented package entry points:

```ts
import { createUserVaultKey } from "@tgoliveira/vault-core";
import { unlockVaultSession } from "@tgoliveira/vault-core/browser";
import { VaultSessionProvider } from "@tgoliveira/vault-core/react";
import { SENTINEL_VAULT_PASSWORD } from "@tgoliveira/vault-core/testing";
```

Do not import internal `dist/*` files. They are not stable public APIs.

## 3. Freeze the application crypto profile

Choose profile strings once, before production data exists:

```ts
import type { VaultCryptoProfile } from "@tgoliveira/vault-core";

export const VAULT_PROFILE: VaultCryptoProfile = {
  cryptoVersion: "vault-v1",
  aadContextVault: "acme:vault:v1",
  aadContextEnvelope: "acme:vault-envelope:v1",
};

export function vaultScope(userId: string) {
  return { userId, resourceId: userId };
}
```

Both identifiers must be UUID strings when data is validated by `encryptedPayloadSchema`. A profile
change makes existing high-level decrypt and unlock operations fail by design. Treat profile strings
as persisted protocol constants, not environment labels.

For multi-resource vaults, use the authenticated resource identifier as `resourceId`. Always pass the
same expected scope back during decrypt or unlock.

## 4. Persisted data model

A minimal server record contains only encrypted structures and non-secret status metadata:

```ts
import type {
  EncryptedVaultPayload,
  PasswordEnvelope,
  RecoveryPhraseEnvelope,
  VaultPasskeyCredentialState,
} from "@tgoliveira/vault-core";

export type StoredVaultRecord = {
  cryptoVersion: "vault-v1";
  encryptedBlob: EncryptedVaultPayload;
  passwordEnvelope: PasswordEnvelope;
  recoveryEnvelope: RecoveryPhraseEnvelope;
  passkeyCredentials?: VaultPasskeyCredentialState[];
};
```

Each passkey state keeps three identities separate: one logical WebAuthn credential, zero or many
opaque browser bindings, and one or more PRF envelope variants. A synced multi-device credential can
be used from another device without creating a second credential. Treat bindings only as routing
metadata; they are neither credential IDs nor authorization factors.

The server may store these structures because ciphertext, IV, salt, bounded KDF metadata, and AAD are
not plaintext secrets. The server must never receive the vault password, recovery phrase, UVK, PRF
output, or decrypted payload.

Validate records at every untrusted boundary:

```ts
import { vaultSetupEnvelopeFieldsSchema } from "@tgoliveira/vault-core";

const record = vaultSetupEnvelopeFieldsSchema.parse(untrustedDatabaseValue);
```

The envelope schemas are discriminated by `method`. Password and recovery envelopes require
Argon2id metadata; passkey PRF envelopes require `kdfMetadata: null`. Validate each portable passkey
record with `vaultPasskeyCredentialStateSchema`. See
[MIGRATING_PASSKEYS_FROM_1_2_0.md](./MIGRATING_PASSKEYS_FROM_1_2_0.md) before migrating existing
single-binding records.

## 5. Initial vault setup

Run the complete setup flow in a trusted client runtime:

```ts
import {
  createPasskeyPrfEnvelope,
  createPasswordEnvelope,
  createRecoveryEnvelope,
  createRecoveryPhrase,
  createUserVaultKey,
  encryptVaultPayload,
  vaultSetupEnvelopeFieldsSchema,
} from "@tgoliveira/vault-core";
import { VAULT_PROFILE, vaultScope } from "./vault-profile.js";

export async function createInitialVault<T>(input: {
  userId: string;
  vaultPassword: string;
  initialPayload: T;
  passkeyPrfOutput?: Uint8Array;
}) {
  const scope = vaultScope(input.userId);
  const vaultKey = await createUserVaultKey();
  const recoveryPhrase = createRecoveryPhrase({ wordCount: 24 });

  const { envelope: passwordEnvelope } = await createPasswordEnvelope(
    vaultKey,
    input.vaultPassword,
    scope,
    VAULT_PROFILE
  );

  const { envelope: recoveryEnvelope } = await createRecoveryEnvelope(
    vaultKey,
    recoveryPhrase,
    scope,
    VAULT_PROFILE,
    { phraseLength: 24 }
  );

  const passkeyPrfEnvelope = input.passkeyPrfOutput
    ? await createPasskeyPrfEnvelope(
        vaultKey,
        input.passkeyPrfOutput,
        scope,
        VAULT_PROFILE
      )
    : null;

  const encryptedBlob = await encryptVaultPayload(
    input.initialPayload,
    vaultKey,
    scope,
    VAULT_PROFILE
  );

  const serverRecord = vaultSetupEnvelopeFieldsSchema.parse({
    cryptoVersion: "vault-v1",
    encryptedBlob,
    passwordEnvelope,
    recoveryEnvelope,
    passkeyPrfEnvelope,
  });

  return {
    serverRecord,
    recoveryPhrase,
    clientOnlyVaultKey: vaultKey,
  };
}
```

`serverRecord` is the validated setup output. If it contains `passkeyPrfEnvelope`, persist that
envelope as the first variant under the server-verified credential ID; do not use a browser binding
ID as the credential or variant ID. Send only encrypted/public metadata to the server. Keep
`recoveryPhrase` in the recovery confirmation UI and `clientOnlyVaultKey` in the in-memory session.
Never serialize either value into analytics, logs, URLs, cookies, localStorage, IndexedDB, server
actions, or API requests.

Argon2id work is deliberately sequential in this example to avoid doubling peak browser memory.

## 6. Recovery phrase confirmation and kit

Generate the required confirmation prompts and reject partial answers:

```ts
import {
  assertRecoveryPhraseWordConfirmation,
  createRecoveryKitText,
  getRecoveryConfirmationPromptCount,
  pickRecoveryConfirmationIndices,
} from "@tgoliveira/vault-core";

const words = recoveryPhrase.split(" ");
const count = getRecoveryConfirmationPromptCount(24);
const requiredIndices = pickRecoveryConfirmationIndices(words.length, count);

assertRecoveryPhraseWordConfirmation(
  recoveryPhrase,
  answersByOneBasedIndex,
  requiredIndices
);

const recoveryKit = createRecoveryKitText({
  recoveryPhrase,
  wordCount: 24,
  productName: "Acme",
});
```

In a browser, `createRecoveryKitDownload()` and `printRecoveryKitContent()` are available from the
browser entry. Explain that anyone holding the phrase can unlock the vault. Do not automatically save
the kit to cloud storage.

## 7. Password unlock

```ts
import {
  decryptVaultPayload,
  encryptedPayloadSchema,
  passwordEnvelopeSchema,
  unlockWithPasswordEnvelope,
} from "@tgoliveira/vault-core";
import { VAULT_PROFILE, vaultScope } from "./vault-profile.js";

export async function unlockWithPassword<T>(input: {
  userId: string;
  vaultPassword: string;
  passwordEnvelope: unknown;
  encryptedBlob: unknown;
}) {
  const scope = vaultScope(input.userId);
  const envelope = passwordEnvelopeSchema.parse(input.passwordEnvelope);
  const encryptedBlob = encryptedPayloadSchema.parse(input.encryptedBlob);
  const vaultKey = await unlockWithPasswordEnvelope(
    input.vaultPassword,
    envelope,
    scope,
    VAULT_PROFILE
  );
  const payload = await decryptVaultPayload<T>(
    encryptedBlob,
    vaultKey,
    scope,
    VAULT_PROFILE
  );
  return { vaultKey, payload };
}
```

Prefer **`decryptVaultPayloadWithSchema()`** with an app-owned Zod schema when the payload shape
is versioned or may have been tampered with after encryption. See
[docs/CONSUMER_SECURITY_REQUIREMENTS.md](./CONSUMER_SECURITY_REQUIREMENTS.md#runtime-payload-schema-recommended).

Do not expose whether a password failed during KDF derivation versus AES-GCM authentication. Present
a generic unlock failure to the user. UI throttling can improve local UX but cannot prevent offline
attacks against copied envelopes, so require a strong vault password and protect ciphertext access.

## 8. Recovery phrase unlock

```ts
import {
  decryptVaultPayload,
  encryptedPayloadSchema,
  parseRecoveryPhraseWordCount,
  recoveryPhraseEnvelopeSchema,
  unlockWithRecoveryEnvelope,
} from "@tgoliveira/vault-core";

const envelope = recoveryPhraseEnvelopeSchema.parse(serverRecord.recoveryEnvelope);
const expectedWordCount = parseRecoveryPhraseWordCount(envelope.publicMetadata);
const vaultKey = await unlockWithRecoveryEnvelope(
  enteredRecoveryPhrase,
  envelope,
  vaultScope(userId),
  VAULT_PROFILE,
  { expectedWordCount }
);
const payload = await decryptVaultPayload(
  encryptedPayloadSchema.parse(serverRecord.encryptedBlob),
  vaultKey,
  vaultScope(userId),
  VAULT_PROFILE
);
```

After successful recovery, let the user create a new password envelope around the same UVK and
replace the old password envelope atomically on the server.

## 9. Passkey PRF integration

**Upgrading from 1.0.x?** See [ADOPTING_VAULT_CORE_1_1_0.md](./ADOPTING_VAULT_CORE_1_1_0.md) for
what to import vs delete (inner-key cache, WebAuthn prep, legacy AAD, device binding, classifiers).

The package does not run WebAuthn ceremonies. The application must request the PRF extension and pass
the first PRF result to vault-core. Use the browser helpers below to prepare authentication options
(iOS `eval` parity, salt coercion, fail-closed credential selection, and an explicit transport
policy) before calling `navigator.credentials.get`. Stored transports are preserved by default.

### PRF authentication ceremonies (unlock **and** enroll/manage)

Any client call to `navigator.credentials.get` that feeds PRF output into
`createPasskeyPrfEnvelope*` or `unwrapVaultKeyFromPasskey*` **must** pass options through the
vault-core PRF preparation pipeline. **`prepareAuthenticationOptions` from `@tgoliveira/secure-auth`
(or similar JSON-only preparers) alone is insufficient** — ceremonies may complete and even return
PRF extension results, but salt coercion and iOS `eval` alignment differ from vault-core prep, so
envelopes created at enable time cannot be decrypted at unlock.

| Ceremony | Requires full vault-core PRF prep |
| --- | --- |
| Vault unlock | Yes |
| Passkey vault unlock **enable** (post-register) | Yes |
| Passkey vault unlock **disable** (PRF proof) | Yes |
| Envelope **re-wrap / rotate** on device | Yes |

Use the same helper (or the same composed function) for every row in the table. Do not copy the
unlock path correctly and leave enable/disable on raw server JSON prep.

**Anti-pattern — enable/disable with JSON prep only:**

```ts
import { prepareAuthenticationOptions } from "@tgoliveira/secure-auth/client";

// WRONG for PRF-gated ceremonies: missing vault-core PRF salt coercion and iOS eval alignment
const publicKey = prepareAuthenticationOptions(serverOptionsJson);
const credential = await navigator.credentials.get({ publicKey });
```

**Required pattern — shared PRF ceremony prep:**

```ts
import { prepareAuthenticationOptions } from "@tgoliveira/secure-auth/client";
import {
  prepareVaultPasskeyPrfAuthenticationOptions,
} from "@tgoliveira/vault-core/browser";

// One function for unlock, enable, disable, and re-wrap ceremonies:
const publicKey = await prepareVaultPasskeyPrfAuthenticationOptions({
  userId,
  prfSaltPrefix: "acme-passkey-prf-v1:",
  serverOptions: serverOptionsJson,
  prepareJson: prepareAuthenticationOptions,
  credentialSelection: { mode: "exact", credentialId },
  transportPolicy: "preserve",
});

const credential = await navigator.credentials.get({ publicKey });
```

**Manual composition** (when you need finer control):

```ts
import { prepareAuthenticationOptions } from "@tgoliveira/secure-auth/client";
import {
  buildPrfSaltBytes,
  prepareVaultUnlockAuthenticationOptions,
} from "@tgoliveira/vault-core/browser";
import { scopeAuthenticationOptionsToCredential } from "@tgoliveira/vault-core";

const salt = await buildPrfSaltBytes("acme-passkey-prf-v1:", userId);

let options = prepareAuthenticationOptions(serverOptionsJson);
options = {
  ...options,
  extensions: {
    ...options.extensions,
    prf: {
      evalByCredential: {
        [credentialId]: { first: salt },
      },
    },
  },
};

options = scopeAuthenticationOptionsToCredential(options, { credentialId });
const publicKey = prepareVaultUnlockAuthenticationOptions(options, {
  credentialSelection: { mode: "exact", credentialId },
  transportPolicy: "preserve",
});
```

**Troubleshooting:** If unlock fails immediately after enable with `decrypt_failed` or “Could not
decrypt your vault with this passkey”, the enable ceremony likely used JSON-only prep while unlock
used vault-core prep. Re-enable the passkey on each affected device (or re-wrap the envelope) after
fixing the client prep.

Use a stable, application-specific PRF salt:

```ts
import {
  buildPrfSaltBytes,
  extractPasskeyPrfOutput,
  isPasskeySupported,
  prepareVaultUnlockAuthenticationOptions,
  resolvePasskeyPrfCapability,
  sanitizeWebAuthnResponseForServer,
} from "@tgoliveira/vault-core/browser";

const salt = await buildPrfSaltBytes("acme-passkey-prf-v1:", userId);

const preliminaryPrfCapability = resolvePasskeyPrfCapability();
if (!isPasskeySupported() || preliminaryPrfCapability.state === "unavailable") {
  // Offer password or recovery phrase unlock instead.
}

const publicKey = prepareVaultUnlockAuthenticationOptions(
  {
    challenge: applicationChallenge,
    rpId: applicationRpId,
    allowCredentials: [{ id: credentialId, type: "public-key" }],
    extensions: {
      prf: {
        evalByCredential: {
          [credentialId]: { first: salt },
        },
      },
    },
  },
  {
    credentialSelection: { mode: "exact", credentialId },
    transportPolicy: "preserve",
  }
);

const credential = await navigator.credentials.get({ publicKey });

if (!(credential instanceof PublicKeyCredential)) {
  throw new Error("Passkey ceremony did not return a public-key credential");
}

const prfOutput = extractPasskeyPrfOutput(
  credential.getClientExtensionResults(),
  { credentialId: credential.id }
);

// Give the app-owned WebAuthn JSON serializer only PRF-free extension results.
const safeClientExtensionResults = sanitizeWebAuthnResponseForServer({
  clientExtensionResults: credential.getClientExtensionResults(),
}).clientExtensionResults;
void safeClientExtensionResults;

// After sending the sanitized assertion, use the credential id returned by successful
// application-owned server verification.
declare const verifiedCredentialId: string;
if (verifiedCredentialId !== credential.id) {
  throw new Error("Verified passkey credential mismatch");
}
const confirmedPrfCapability = resolvePasskeyPrfCapability({
  ceremony: "authentication",
  verifiedCredentialId,
  clientExtensionResults: credential.getClientExtensionResults() as Record<string, unknown>,
});

if (!prfOutput || confirmedPrfCapability.state !== "confirmed_authentication") {
  throw new Error("This passkey did not return a usable PRF result");
}
```

The preliminary result is only a heuristic. Treat PRF authentication as confirmed only when
`confirmedPrfCapability.state === "confirmed_authentication"` and after the server returns the same
verified credential ID. Never serialize extension results or PRF bytes to the server; send only the
sanitized copy.

Credential verification and server-side WebAuthn validation remain application-owned. Never send
`prfOutput` to the server.

For a single already-selected envelope variant, unlock after obtaining the PRF output:

```ts
import {
  passkeyPrfEnvelopeSchema,
  unlockWithPasskeyPrfEnvelope,
} from "@tgoliveira/vault-core";

const envelope = passkeyPrfEnvelopeSchema.parse(selectedEnvelopeVariant.envelope);
const vaultKey = await unlockWithPasskeyPrfEnvelope(
  envelope,
  prfOutput,
  vaultScope(userId),
  VAULT_PROFILE
);
```

Treat PRF support as an optional unlock method. Always preserve password or recovery fallback.

### Synced credentials, bindings, and envelope variants

After the server verifies the assertion, return at most five active variants belonging to the
verified credential. Try them locally in server order so a binding-selected variant can be first:

```ts
import {
  cacheVaultInnerKeyMaterialFromPasskeyUnlock,
  unlockVaultSession,
  unlockWithPasskeyPrfEnvelopeCandidates,
} from "@tgoliveira/vault-core/browser";

const candidateResult = await unlockWithPasskeyPrfEnvelopeCandidates({
  verifiedCredentialId,
  candidates: serverCandidates,
  prfOutput,
  expectedScope: vaultScope(userId),
  profile: VAULT_PROFILE,
});

if (candidateResult.status === "matched") {
  await unlockVaultSession(candidateResult.vaultKey);
  const matchedCandidate = serverCandidates.find(
    (candidate) => candidate.envelopeVariantId === candidateResult.envelopeVariantId
  );
  if (!matchedCandidate) throw new Error("Matched passkey envelope variant is missing");
  await cacheVaultInnerKeyMaterialFromPasskeyUnlock(
    candidateResult.vaultKey,
    matchedCandidate.envelope,
    prfOutput
  );
  await persistOpaqueBinding({
    credentialId: verifiedCredentialId,
    selectedEnvelopeVariantId: candidateResult.envelopeVariantId,
  });
}
```

`no_match` must leave all variants intact and the vault locked. Call
`createPasskeyPrfEnvelopeAfterIndependentAuthorization()` with password or recovery locally, then
append its returned envelope as a new variant and install its non-extractable UVK. Do not use the
session cache, binding, or another passkey as authorization for this repair path. When
emergency/duress mode is enabled, use
`unlockVaultWithPasskeyCandidateRouting()` so candidate matching preserves primary/decoy routing and
session roles. After either matched flow, populate the memory-only inner-key cache from the matched
envelope when later passkey enrollment or re-wrap must work with the non-extractable session UVK.
If emergency/duress candidate routing returns `no_match`, do not run or install the stateless repair
result: fall back to password/recovery routing and defer variant repair until normal primary context.

### Passkey enroll after unlock (non-extractable session UVK)

After `createUserVaultKey()` the UVK is extractable; the first passkey envelope can be created
immediately. After unlock via password, recovery, or passkey, the session UVK is non-extractable —
use the browser inner-key cache to enroll an additional passkey without exporting the UVK:

```ts
import {
  unlockVaultSession,
  cacheVaultInnerKeyMaterialAfterPasswordUnlock,
  createPasskeyPrfEnvelopeWithSessionCache,
} from "@tgoliveira/vault-core/browser";
import { unlockWithPasswordEnvelope } from "@tgoliveira/vault-core";

const vaultKey = await unlockWithPasswordEnvelope(
  password,
  passwordEnvelope,
  vaultScope(userId),
  VAULT_PROFILE
);
await unlockVaultSession(vaultKey);
await cacheVaultInnerKeyMaterialAfterPasswordUnlock(
  vaultKey,
  passwordEnvelope,
  password
);

const passkeyEnvelope = await createPasskeyPrfEnvelopeWithSessionCache(
  vaultKey,
  prfOutput,
  vaultScope(userId),
  VAULT_PROFILE
);
```

The cache is memory-only and cleared automatically on `lockVaultSession()` /
`lockVaultSessionManually()`. Never persist inner key material, PRF output, or UVK bytes.

## 10. Save and update encrypted payloads

Keep the typed product schema in the application:

```ts
import { z } from "zod";
import { encryptVaultPayload } from "@tgoliveira/vault-core";

const appVaultPayloadSchema = z.object({
  version: z.literal(1),
  entries: z.array(z.object({ id: z.string(), secret: z.string() })),
});

const validatedPayload = appVaultPayloadSchema.parse(nextPayload);
const encryptedBlob = await encryptVaultPayload(
  validatedPayload,
  inMemoryVaultKey,
  vaultScope(userId),
  VAULT_PROFILE
);
```

Persist only `encryptedBlob`. Use application-owned optimistic concurrency or record versions to
prevent lost updates and ciphertext rollback. Vault-core authenticates content and AAD but does not
provide server freshness or synchronization.

## 11. Browser session without React

```ts
import {
  configureVaultSession,
  getSessionVaultKey,
  lockVaultSession,
  registerVaultLockCleanup,
  registerVaultActivityGuard,
  registerVaultUnloadGuard,
  unlockVaultSession,
} from "@tgoliveira/vault-core/browser";

configureVaultSession({ autoLockMinutes: 15 });

const removeUnloadGuard = registerVaultUnloadGuard();

await unlockVaultSession(vaultKey);
const currentKey = getSessionVaultKey();

// Optional: renew the countdown on pointer, keyboard, touch, and focus events.
// const removeActivityGuard = registerVaultActivityGuard();

// On explicit lock or logout:
lockVaultSession();
registerVaultLockCleanup(() => clearDecryptedPayloadCache());

// On application teardown:
// removeActivityGuard?.();
removeUnloadGuard();
```

There is no public direct key setter. This ensures unlock, lock, timers, and subscribers remain in
sync. By default the auto-lock countdown runs down until lock or an explicit `touchVaultSession()` call
(for example the vault status dock **Stay unlocked** action). Opt in to activity-based renewal with
`registerVaultActivityGuard()` when meaningful user activity should extend the session.

### Account ownership and async cancellation

Authenticated or multi-account applications must start one opaque operation at each outer vault flow
boundary and thread it through every package mutation:

```ts
import {
  assertVaultSessionOperationCurrent,
  assertVaultSessionLeaseCurrent,
  beginVaultSessionUnlock,
  clearVaultSessionOwner,
  unlockVaultSession,
} from "@tgoliveira/vault-core/browser";

const operation = beginVaultSessionUnlock(opaqueAccountId);
const vaultKey = await unlockWithPasswordEnvelope(password, envelope, scope, profile);
assertVaultSessionOperationCurrent(operation);
const lease = await unlockVaultSession(vaultKey, { operation });
if (!lease) throw new Error("Owner-scoped unlock did not produce a lease");

const payload = await loadAndDecryptVaultPayload(lease.vaultKey);
assertVaultSessionLeaseCurrent(lease);
setDecryptedPayload(payload);

// Logout, account removal, or unresolved authenticated ownership:
clearVaultSessionOwner();
```

Each new attempt cancels the prior attempt; switching owners also synchronously purges the prior
owner's browser vault state. Every lock invalidates the token, so the next unlock starts a new
operation. Once enabled, guarded package mutations reject missing or stale tokens with
`VaultSessionOperationCancelledError`. Treat that error as stale-flow control state rather than a
credential error. Pure setup/rotation crypto remains stateless: re-check the operation after awaited
crypto and immediately before persistence or React state commits. See
[`MIGRATING_SESSION_OWNERSHIP_FROM_1_4_0.md`](./MIGRATING_SESSION_OWNERSHIP_FROM_1_4_0.md) for the full
mutation matrix.

After key commit, use the returned `VaultSessionLease` for saves and hydration. It binds the opaque
owner, committed epoch, role, and non-extractable key; validate it after awaited work and before
app-owned commits. `captureVaultSessionLease(ownerId)` retrieves the current lease for a later
component, while `getVaultSessionSnapshot()` exposes only owner/epoch/role. Timer renewal requires the
lease after opt-in (`touchVaultSession(lease)`, `useVaultSession({ lease })`,
`VaultSessionProvider lease={lease}`, and `VaultStatusDock sessionLease={lease}`).

## 12. React session integration

Mount one provider near the client application root:

```tsx
import type { ReactNode } from "react";
import { VaultSessionProvider } from "@tgoliveira/vault-core/react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <VaultSessionProvider
      sessionConfig={{ autoLockMinutes: 15 }}
      registerUnloadGuard
    >
      {children}
    </VaultSessionProvider>
  );
}
```

Read and control state:

```tsx
import {
  useVaultClientStatus,
  useVaultSession,
  useVaultUnlocked,
} from "@tgoliveira/vault-core/react";

const unlocked = useVaultUnlocked();
const { lock, touch } = useVaultSession({
  registerActivityGuard: false,
  registerUnloadGuard: false,
});
const status = useVaultClientStatus(serverStatus, browserSupportsPrf);
```

Avoid mounting both `VaultSessionProvider` and a default `useVaultSession()` solely to register the
same guards. When the provider owns guards, use the hook with guard registration disabled or call the
browser lifecycle functions directly.

### Deterministic auto-lock preference hydration

When the application persists a user's auto-lock preference with the account, resolve it on the
server and pass the same serializable snapshot to the client hook:

```tsx
import { useVaultAutoLockPreference } from "@tgoliveira/vault-core/react";
import type { VaultSessionLease } from "@tgoliveira/vault-core/browser";

function AutoLockSettings(props: {
  adminMinutes: number;
  initialUserMinutes: number | null;
  sessionLease: VaultSessionLease | null;
}) {
  const preference = useVaultAutoLockPreference(props.adminMinutes, {
    initialUserMinutes: props.initialUserMinutes,
    sessionLease: props.sessionLease,
  });

  return <output>{preference.minutes} minutes</output>;
}
```

An explicit `null` means the server already resolved that the user has no override, so the hook is
`ready` on the first server and client render and does not consult browser storage. If
`initialUserMinutes` is omitted, the hook starts with `hydrationStatus === "checking"` and the admin
fallback, reads local storage in an effect, and then becomes `ready`. Render a neutral placeholder or
disable the preference control while checking to avoid presenting the fallback as a final value.
The hook never reads `localStorage` during render.
In owner-scoped mode, always pass the current lease or explicit `null`. A current lease re-arms the
timer after preference changes; `null` is the locked/bootstrap state and a stale lease is ignored.
Omit `sessionLease` only in legacy apps that never call `beginVaultSessionUnlock()`.

### Vault protected pages

Wrap vault-gated routes with `VaultProtectedGate` so locked sessions show a blur overlay while page
content stays mounted. Customize overlay color with `overlayBackground` (sets
`--vc-vault-lock-overlay-color`) or `overlayClassName`:

```tsx
import { VaultLockOverlayExclude, VaultProtectedGate } from "@tgoliveira/vault-core/react";

<div>
  <VaultLockOverlayExclude>
    <AppHeader>
      <VaultStatusDock {...dockProps} />
    </AppHeader>
  </VaultLockOverlayExclude>

  <VaultProtectedGate
    configured={vaultConfigured}
    overlayBackground="color-mix(in srgb, var(--background) 92%, transparent)"
  >
    {protectedPageContent}
  </VaultProtectedGate>
</div>
```

`VaultLockOverlayExclude` is optional. When omitted, the overlay covers the full viewport while
locked. When present, the overlay is carved around each excluded region so navigation, branding, and
the status dock stay visible and clickable. Consumers may register multiple exclusions (for example
header and a footer toolbar). You can also set `data-vault-lock-overlay-exclude="true"` on any
element instead of the wrapper component.

**Security:** The overlay is visual UX only — it blurs content and blocks pointer events in the DOM,
but it is not a security boundary. Always check vault unlock status in application code before
decrypting, persisting, or rendering secrets (`useVaultUnlocked()`, `useVaultSession()`, or
equivalent). Mount `VaultStatusDock` inside an excluded header region for quick unlock while locked.

#### Lock hygiene (required for production)

`lockVaultSession()` clears the in-memory UVK and inner-key cache. **Consumers must also remove
decrypted plaintext from the React tree and app-owned stores.**

| Mechanism | Entry | Purpose |
| --- | --- | --- |
| Lock cleanup registry | `registerVaultLockCleanup()` (`/browser`) | Sync handlers on every lock (stores, query cache) |
| React hook | `useOnVaultLocked()` (`/react`) | Register cleanup from components |
| Sensitive subtree | `VaultSensitiveRegion` (`/react`) | Unmount children while locked |
| Gate unmount mode | `VaultProtectedGate` `lockedContentStrategy="unmount"` | Replace page content while locked (optional) |
| Post-lock test | `assertNoVaultPlaintextInDocument()` (`/testing`) | Assert DOM has no sentinel strings |

Default gate behavior remains **`lockedContentStrategy="overlay"`** (children stay mounted). Use
**overlay for shell UX** + **`VaultSensitiveRegion` for secrets**, or opt into gate unmount for
whole-page sensitive routes.

```tsx
import {
  registerVaultLockCleanup,
  lockVaultSession,
} from "@tgoliveira/vault-core/browser";
import {
  VaultProtectedGate,
  VaultSensitiveRegion,
  useOnVaultLocked,
} from "@tgoliveira/vault-core/react";

registerVaultLockCleanup(() => {
  appStore.clearDecryptedVault();
});

function ProtectedVaultRoute({ children }: { children: React.ReactNode }) {
  useOnVaultLocked(() => appStore.clearDecryptedVault());

  return (
    <VaultProtectedGate configured>
      <VaultSensitiveRegion>{children}</VaultSensitiveRegion>
    </VaultProtectedGate>
  );
}
```

See [docs/CONSUMER_SECURITY_REQUIREMENTS.md](./CONSUMER_SECURITY_REQUIREMENTS.md) §3.

### Vault unlock page

Mount a dedicated unlock route (for example `/vault/unlock`) with `VaultUnlockPanel` for password,
recovery phrase, and passkey unlock when configured:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  VaultUnlockPanel,
  buildVaultUnlockHref,
  readVaultUnlockReturnPath,
  useVaultUnlockPageNavigation,
} from "@tgoliveira/vault-core/react";

const UNLOCK_PATH = "/vault/unlock";

export function VaultUnlockPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnPath = readVaultUnlockReturnPath(searchParams, { defaultPath: "/vault" });

  useVaultUnlockPageNavigation({
    configured: vaultConfigured,
    returnPath,
    setupPath: "/vault/setup",
    onNavigate: (path) => router.replace(path),
  });

  return (
    <VaultUnlockPanel
      serverStatus={serverStatus}
      prfSupported={browserSupportsPrf}
      passkeyReady={explicitPasskeyOptionsReady}
      onUnlockPassword={(password) => unlockWithPassword(password)}
      onUnlockRecoveryPhrase={(phrase) => unlockWithRecovery(phrase)}
      onUnlockPasskey={explicitPasskeyOptionsReady ? () => unlockWithPasskey() : undefined}
    />
  );
}
```

`explicitPasskeyOptionsReady` means the authenticated user's allow-listed WebAuthn request options
are loaded. Do not derive it from a browser binding. Use `resolvePasskeyUnlockPlan({ intent:
"explicit", ... })` for this page. A binding is required only for exact dock/auto-start quick unlock.
If this full page opts into `autoStartPasskey`, pass the ready `intent: "quick"` plan through
`quickPasskeyPlan` and implement `onQuickUnlockPasskey(plan)` separately. The explicit
`onUnlockPasskey` callback is never auto-started.

Link to the unlock page from the status dock or protected gates:

```tsx
import { buildVaultUnlockHref } from "@tgoliveira/vault-core/react";

const href = buildVaultUnlockHref(UNLOCK_PATH, pathname + search);
```

The default query parameter is `next` (`VAULT_UNLOCK_RETURN_QUERY_PARAM`). `resolveVaultUnlockReturnPath`
rejects open redirects — only paths starting with `/` that are not protocol-relative (`//`) are kept.

## 13. Storage policy and inspection

Do not persist decrypted payloads or the UVK. Storage helpers inspect namespace presence; they cannot
classify arbitrary record contents:

```ts
import {
  inspectIndexedDBPrefix,
  inspectLocalStoragePrefix,
} from "@tgoliveira/vault-core/browser";

const localResult = inspectLocalStoragePrefix("acme:vault:");
const idbResult = await inspectIndexedDBPrefix("acme-vault-");

if (localResult !== "clear" || idbResult !== "clear") {
  // Investigate "found" and treat "unavailable" as a failed security check.
}
```

`inspectIndexedDBPrefix()` checks database names, not object-store contents. Enforce the real no-
plaintext rule through architecture, code review, CSP/XSS controls, and sentinel-based integration
tests.

## 14. Server request validation

Reject known plaintext fields recursively before accepting an encrypted vault request:

```ts
import {
  assertNoVaultPlaintextFields,
  vaultSetupEnvelopeFieldsSchema,
} from "@tgoliveira/vault-core";

export function parseVaultSetupRequest(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Vault request body must be an object");
  }
  assertNoVaultPlaintextFields(body as Record<string, unknown>);
  return vaultSetupEnvelopeFieldsSchema.parse(body);
}
```

This guard is defense in depth, not a complete data-loss-prevention system. Use closed route schemas,
never log request bodies, and verify the authenticated account owns the AAD `userId` and resource.

### Rate limiting

Use the in-memory limiters from `@tgoliveira/vault-core` to protect expensive unlock work and vault
HTTP routes. Configure via `VaultAdminConfig.rateLimit` or the `VAULT_UNLOCK_*` and
`VAULT_API_RATE_LIMIT_*` environment variables.

**Unlock failures** (per scope + method: password, recovery phrase, or passkey PRF):

```ts
import {
  createVaultUnlockRateLimiterFromAdminConfig,
  withVaultUnlockRateLimit,
} from "@tgoliveira/vault-core";

const unlockLimiter = createVaultUnlockRateLimiterFromAdminConfig(adminConfig);

await withVaultUnlockRateLimit(unlockLimiter, userId, "password", async () => {
  return unlockVaultFromPasswordEnvelope({ password, envelope, profile });
});
```

Pass `unlockRateLimiter` and `rateLimitScopeKey` to `VaultUnlockPanel` / `VaultDockQuickUnlock` for
built-in assert/record behavior. **Also** wrap every direct call to envelope unlock APIs with
`withVaultUnlockRateLimit()` — UI props alone are bypassable.

**Vault HTTP APIs** (per namespace + client key, e.g. client IP):

```ts
import {
  buildVaultRateLimitHttpResponse,
  consumeVaultApiRateLimit,
  createVaultApiRateLimiterFromAdminConfig,
} from "@tgoliveira/vault-core";

const apiLimiter = createVaultApiRateLimiterFromAdminConfig(adminConfig);
const decision = consumeVaultApiRateLimit(apiLimiter, "vault-admin-config", clientIp);
if (!decision.allowed) {
  const limited = buildVaultRateLimitHttpResponse(decision);
  return Response.json(limited.body, { status: limited.status, headers: limited.headers });
}
```

Defaults: 5 failed unlocks / 15 minutes with a 30-minute lockout; 120 API requests / 60 seconds.

## 15. Password and recovery rotation

Use the rotation helpers after the vault is explicitly unlocked and the UVK is in memory.

### Change vault password

```ts
import { rotateVaultPassword } from "@tgoliveira/vault-core";

const { envelope } = await rotateVaultPassword({
  vaultKey,
  currentPassword,
  newPassword,
  currentEnvelope: passwordEnvelope,
  scope: { userId, resourceId: userId },
  profile: APP_VAULT_PROFILE,
});
```

Persist the returned password envelope atomically. Encrypted payloads and other envelopes stay unchanged.

### Rotate recovery phrase

Authorization options:

- current vault password (`authorization.kind === "password"`)
- passkey PRF validation while the vault is unlocked (`authorization.kind === "passkey_prf"`)

```ts
import { rotateRecoveryPhrase } from "@tgoliveira/vault-core";

const result = await rotateRecoveryPhrase({
  vaultKey,
  authorization: {
    kind: "password",
    currentPassword,
    passwordEnvelope,
  },
  scope: { userId, resourceId: userId },
  profile: APP_VAULT_PROFILE,
  wordCount: 24,
  recoveryKitProductName: "My App",
});
```

Replace the recovery envelope atomically. Never send the recovery phrase to the server.

### Automatic KDF upgrade on unlock

Legacy envelopes labeled `kdf-v1` remain decryptable. After unlock, call:

- `maybeUpgradePasswordEnvelopeAfterUnlock(...)`
- `maybeUpgradeRecoveryEnvelopeAfterUnlock(...)`

When `upgradedEnvelope` is non-null, persist it with the same password or recovery phrase. New envelopes use the current recommended policy (`kdf-v2`).

## 16. Error handling

Expected domain errors include:

- `VaultPlaintextRejectionError`
- `PasskeyPrfRequiredError`
- `PasskeyUnlockError`
- `RecoveryPhraseConfirmationError`
- `VaultConflictError`
- `VaultNotFoundError`
- `VaultRateLimitError` — unlock or API rate limit exceeded (`retryAfterMs`, `resetAtMs`)

Web Crypto, JSON parsing, Zod, and Argon2id validation may also throw standard errors. Convert detailed
internal failures into generic user-facing unlock messages. Never include entered secrets, decrypted
data, PRF bytes, or full encrypted request bodies in logs.

## 17. Testing a consuming application

Use the testing entry to prove plaintext never crosses persistence or network boundaries:

```ts
import {
  SENTINEL_PRIVATE_NOTE,
  SENTINEL_VAULT_PASSWORD,
  validateNoPlaintextLeak,
} from "@tgoliveira/vault-core/testing";

const result = validateNoPlaintextLeak(capturedRequestBody);
expect(result.ok).toBe(true);
```

Required integration tests:

- Password, recovery, and passkey round trips.
- Wrong password, wrong phrase, missing PRF, tampered ciphertext, and wrong expected AAD.
- API bodies contain no password, phrase, UVK, PRF output, or product plaintext sentinels.
- localStorage and IndexedDB contain no decrypted vault state.
- Auto-lock clears the in-memory key and updates subscribed UI.
- Stored legacy fixtures still decrypt through the documented migration path.

## 18. Legacy ciphertext

High-level APIs require the configured AAD context. For a legacy record with missing context:

1. Use `decryptField()` only inside an explicit migration path.
2. Validate every available AAD field against the authenticated user and resource.
3. Parse and validate the decrypted product payload.
4. Re-encrypt immediately with `encryptVaultPayload()` and the frozen profile.
5. Remove the compatibility path after migration completes.

Never make missing AAD context a permanent high-level fallback.

## 19. Production readiness checklist

- [ ] Profile strings are unique, stable, documented, and frozen.
- [ ] User and resource IDs passed to AAD match authenticated ownership.
- [ ] Product payloads are validated before encryption and after decryption.
- [ ] Server routes accept only runtime-validated encrypted structures.
- [ ] Password, phrase, UVK, PRF output, and decrypted payload never reach the server or logs.
- [ ] Decrypted data is absent from localStorage, IndexedDB, cookies, URLs, and analytics.
- [ ] Password and recovery unlock remain available if passkey PRF is unsupported.
- [ ] Credentials, opaque bindings, and envelope variants are persisted as separate identities.
- [ ] Exact credential selection fails closed; discoverable authentication is explicitly requested.
- [ ] Candidate variants are bounded, scoped to the server-verified credential and AAD, and matched locally.
- [ ] PRF capability is confirmed from ceremony results; PRF extension results never reach the server.
- [ ] Stored credential transports are preserved unless an explicit compatibility policy is selected.
- [ ] Recovery confirmation and offline storage education are implemented.
- [ ] In-memory sessions auto-lock and clear on `pagehide`.
- [ ] Rotation and recovery updates are atomic and authorization-protected.
- [ ] Wrong-AAD, tamper, leak, storage, and auto-lock tests pass.
- [ ] The application pins a compatible package version and reviews `CHANGELOG.md` before upgrades.

## 20. Emergency / duress mode

See [INTEGRATING_EMERGENCY_DURESS_MODE.md](./INTEGRATING_EMERGENCY_DURESS_MODE.md) for the full
consumer integration guide (phased checklist, dock wiring, server metadata, testing). See
[ADR 0001](./adr/0001-emergency-duress-mode.md) for the threat model and design decisions.

### Enrollment (trusted session)

```ts
import {
  createDecoyVaultSetup,
  containsDuressSequence,
  vaultSetupWithDecoySchema,
} from "@tgoliveira/vault-core";
import { buildHoneyPayloadFromTemplates } from "./honey-templates";

const { decoy } = await createDecoyVaultSetup({
  duressPassword,
  duressSequence,
  honeyPayload: buildHoneyPayloadFromTemplates(),
  scope,
  profile,
});

await saveVaultRecord(vaultSetupWithDecoySchema.parse({ ...primaryRecord, decoy }));
await saveEmergencyMetadata({ decoyConfigured: true, duressSequence });
```

### Unlock routing

```ts
import {
  unlockVaultWithPasswordRouting,
  unlockVaultWithPasskeyRouting,
  decryptVaultPayloadForSession,
  hydrateVaultEmergencyModeFromServer,
} from "@tgoliveira/vault-core/browser";

hydrateVaultEmergencyModeFromServer(serverSnapshot.emergencyModeActive);

await unlockVaultWithPasswordRouting({
  record,
  password,
  duressSequence: serverMetadata.duressSequence,
  emergencyModeActive: serverMetadata.emergencyModeActive,
  scope,
  profile,
  onEmergencyEntered: () => persistEmergencyModeActive(true),
});

const payload = await decryptVaultPayloadForSession({
  record,
  vaultKey: getSessionVaultKey()!,
  scope,
  profile,
  schema: appPayloadSchema,
});
```

### Exit (recovery phrase + optional OTP)

```ts
import { exitEmergencyMode } from "@tgoliveira/vault-core/browser";

await exitEmergencyMode({
  recoveryPhrase,
  emailOtp: emailRequired ? verifiedOtp : undefined,
  scope,
  profile,
  primaryRecoveryEnvelope: record.recoveryEnvelope,
  emailOtpRequired: serverMetadata.emergencyExitEmailRequired,
});
await persistEmergencyModeActive(false);
```

### Dock integration

- Wire `VaultStatusDock.onDuressSignalChange` and pass `duressSignaled` into passkey unlock.
- Default `passkeyAutoStartDelayMs={2000}` allows 1 s handle long-press before auto-start.
- Use `useLongPressDuressSignal` on custom unlock UIs when not using the dock.

### Testing

```ts
import {
  assertVaultSessionMode,
  createPrimaryDecoyVaultFixture,
  HONEY_VAULT_SENTINEL_NOTE,
} from "@tgoliveira/vault-core/testing";
```

Consumer checklist:

- [ ] Persist `emergencyModeActive` atomically on decoy entry; clear only via exit flow.
- [ ] Rate-limit `emergency_exit` with `withVaultUnlockRateLimit(..., "emergency_exit", ...)`.
- [ ] Never decrypt primary `encryptedBlob` while emergency mode is active.
- [ ] Normal vault password does not exit emergency mode.
