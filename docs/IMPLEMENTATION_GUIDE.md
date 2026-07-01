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
  PasskeyPrfEnvelope,
  PasswordEnvelope,
  RecoveryPhraseEnvelope,
} from "@tgoliveira/vault-core";

export type StoredVaultRecord = {
  cryptoVersion: "vault-v1";
  encryptedBlob: EncryptedVaultPayload;
  passwordEnvelope: PasswordEnvelope;
  recoveryEnvelope: RecoveryPhraseEnvelope;
  passkeyPrfEnvelope?: PasskeyPrfEnvelope | null;
};
```

The server may store these structures because ciphertext, IV, salt, bounded KDF metadata, and AAD are
not plaintext secrets. The server must never receive the vault password, recovery phrase, UVK, PRF
output, or decrypted payload.

Validate records at every untrusted boundary:

```ts
import { vaultSetupEnvelopeFieldsSchema } from "@tgoliveira/vault-core";

const record = vaultSetupEnvelopeFieldsSchema.parse(untrustedDatabaseValue);
```

The envelope schemas are discriminated by `method`. Password and recovery envelopes require
Argon2id metadata; passkey PRF envelopes require `kdfMetadata: null`.

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

Send only `serverRecord` to the server. Keep `recoveryPhrase` in the recovery confirmation UI and
`clientOnlyVaultKey` in the in-memory session. Never serialize either value into analytics, logs,
URLs, cookies, localStorage, IndexedDB, server actions, or API requests.

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

The package does not run WebAuthn ceremonies. The application must request the PRF extension and pass
the first PRF result to vault-core.

Use a stable, application-specific PRF salt:

```ts
import {
  buildPrfSaltBytes,
  extractPasskeyPrfOutput,
  isPasskeySupported,
  isPrfExtensionSupported,
} from "@tgoliveira/vault-core/browser";

const salt = await buildPrfSaltBytes("acme-passkey-prf-v1:", userId);

if (!isPasskeySupported() || !isPrfExtensionSupported()) {
  // Offer password or recovery phrase unlock instead.
}

const credential = await navigator.credentials.get({
  publicKey: {
    ...applicationOwnedRequestOptions,
    extensions: { prf: { eval: { first: salt } } },
  },
});

if (!(credential instanceof PublicKeyCredential)) {
  throw new Error("Passkey ceremony did not return a public-key credential");
}

const prfOutput = extractPasskeyPrfOutput(
  credential.getClientExtensionResults()
);
```

Exact WebAuthn option typing and credential verification belong to the application. Never send
`prfOutput` to the server.

Unlock after obtaining the PRF output:

```ts
import {
  passkeyPrfEnvelopeSchema,
  unlockWithPasskeyPrfEnvelope,
} from "@tgoliveira/vault-core";

const envelope = passkeyPrfEnvelopeSchema.parse(serverRecord.passkeyPrfEnvelope);
const vaultKey = await unlockWithPasskeyPrfEnvelope(
  envelope,
  prfOutput,
  vaultScope(userId),
  VAULT_PROFILE
);
```

Treat PRF support as an optional unlock method. Always preserve password or recovery fallback.

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
  registerVaultActivityGuard,
  registerVaultUnloadGuard,
  unlockVaultSession,
} from "@tgoliveira/vault-core/browser";

configureVaultSession({ autoLockMinutes: 15 });

const removeUnloadGuard = registerVaultUnloadGuard();

unlockVaultSession(vaultKey);
const currentKey = getSessionVaultKey();

// Optional: renew the countdown on pointer, keyboard, touch, and focus events.
// const removeActivityGuard = registerVaultActivityGuard();

// On explicit lock or logout:
lockVaultSession();

// On application teardown:
// removeActivityGuard?.();
removeUnloadGuard();
```

There is no public direct key setter. This ensures unlock, lock, timers, and subscribers remain in
sync. By default the auto-lock countdown runs down until lock or an explicit `touchVaultSession()` call
(for example the vault status dock **Stay unlocked** action). Opt in to activity-based renewal with
`registerVaultActivityGuard()` when meaningful user activity should extend the session.

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
      passkeyReady={passkeyReadyOnDevice}
      onUnlockPassword={(password) => unlockWithPassword(password)}
      onUnlockRecoveryPhrase={(phrase) => unlockWithRecovery(phrase)}
      onUnlockPasskey={passkeyReadyOnDevice ? () => unlockWithPasskey() : undefined}
    />
  );
}
```

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
- [ ] Recovery confirmation and offline storage education are implemented.
- [ ] In-memory sessions auto-lock and clear on `pagehide`.
- [ ] Rotation and recovery updates are atomic and authorization-protected.
- [ ] Wrong-AAD, tamper, leak, storage, and auto-lock tests pass.
- [ ] The application pins a compatible package version and reviews `CHANGELOG.md` before upgrades.
