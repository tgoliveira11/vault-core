# Portable passkey vault unlock through a trusted broker

This is the recommended passkey architecture for a user who must register one synced WebAuthn
credential once and unlock the same vault on every device where that credential authenticates.
Legacy PRF envelopes remain supported for existing ciphertext, but WebAuthn PRF is not a portable
cross-device key contract: a synced credential may return missing or different PRF output depending
on the provider, platform, and ceremony.

## Security boundary

The broker is a separate trusted service. It holds a random Portable Unlock Key (PUK) encrypted
under an application-specific broker KEK and stores the UVK only as a `vault-core` AES-GCM envelope.
The PUK is not the UVK, but possession of the PUK plus the encrypted UVK envelope can restore the
UVK. This model is therefore **not zero-knowledge against compromise of the running broker plus its
database and KEK**. It trades that explicit, auditable server trust for deterministic cross-device
passkey unlock.

The consuming application server remains unable to decrypt the vault:

- account authentication verifies WebAuthn and emits a short-lived, single-use broker grant;
- the grant uses a pairwise random broker subject, never email or a direct user ID;
- unlock grants bind the action, credential, envelope, expiry, nonce, UV result, and RFC 7638
  thumbprint of a browser-generated ephemeral P-256 key;
- the browser calls the broker directly over TLS;
- the broker seals the PUK to that non-extractable, one-use browser key;
- the browser restores a non-extractable UVK and zeroes its PUK byte buffer;
- the application verifies and consumes the broker's signed completion receipt before updating its
  local enable/revoke state.

Account login and vault unlock stay separate authorization domains. Reusing one credential is
allowed, but a login result alone must never install a UVK or mint an unlock grant. Complete the
account session, including 2FA, and then authorize the distinct vault action.

## Package boundary

`vault-core` owns only browser and crypto primitives:

- random 32-byte PUK generation;
- HKDF-SHA-256 domain separation into AES-GCM and AES-KW keys;
- UVK envelope creation and strict AAD/profile validation;
- random opaque AAD scope generation with no account identifier;
- non-extractable, one-use ephemeral P-256 session and RFC 7638 thumbprint;
- broker response validation, PUK unsealing, PUK zeroing, and typed unlock results.

The app, account-auth package, and broker own WebAuthn verification, grants, completion receipts,
CORS, TLS, database persistence, KEK custody/rotation, replay prevention, rate limits, audit,
availability, UI, and migrations. None of those responsibilities belongs in `vault-core`.

## Enrollment

```ts
import {
  generatePortableVaultOpaqueAadScope,
  type VaultCryptoProfile,
} from "@tgoliveira/vault-core";
import {
  createPortableVaultBrokerEnrollmentPackageWithSessionCache,
  serializePortableVaultBrokerEnrollmentPackage,
  type VaultSessionOperation,
} from "@tgoliveira/vault-core/browser";

declare const vaultKey: CryptoKey;
declare const brokerEnrollmentGrant: string;
declare const brokerUrl: string;
declare const profile: VaultCryptoProfile;
declare const operation: VaultSessionOperation;

const opaqueScope = generatePortableVaultOpaqueAadScope();
const enrollment = await createPortableVaultBrokerEnrollmentPackageWithSessionCache({
  vaultKey,
  opaqueScope,
  profile,
  operation,
});

try {
  const response = await fetch(`${brokerUrl}/api/v1/envelopes/enroll`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${brokerEnrollmentGrant}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(serializePortableVaultBrokerEnrollmentPackage(enrollment)),
  });
  if (!response.ok) throw new Error("Portable vault enrollment failed");
  // Verify the signed completion receipt server-side before persisting enabled state.
  // Persist opaqueScope with the returned broker envelope ID; neither value is an identity.
} finally {
  enrollment.dispose();
}
```

Send the PUK directly from the browser to the trusted broker. Never proxy it through the application
server, store it in browser storage, log it, add it to analytics, or retain the serialized request.
The cache-aware helper is the required enrollment API for an already-open vault: it re-wraps the
inner key material retained only in the current owner-scoped browser session, so a non-extractable
UVK is never exported and the user does not have to enter a password or recovery phrase again. The
lower-level `createPortableVaultBrokerEnrollmentPackage()` remains appropriate only for the first
envelope created immediately with a fresh extractable `createUserVaultKey()` result.

## Unlock

```ts
import type {
  PortableVaultOpaqueAadScope,
  VaultCryptoProfile,
} from "@tgoliveira/vault-core";
import {
  createPortableVaultBrokerUnlockSession,
  unlockPortableVaultBrokerResponse,
  type VaultSessionOperation,
} from "@tgoliveira/vault-core/browser";

declare const brokerEnvelopeId: string;
declare const brokerUrl: string;
declare const expectedOpaqueScope: PortableVaultOpaqueAadScope;
declare const profile: VaultCryptoProfile;
declare const operation: VaultSessionOperation;
declare function verifyAndConsumeBrokerReceipt(receipt: string): Promise<void>;
declare function requestVerifiedUnlockGrant(input: {
  brokerEnvelopeId: string;
  ephemeralKeyThumbprint: string;
}): Promise<string>;

const session = await createPortableVaultBrokerUnlockSession();
const grant = await requestVerifiedUnlockGrant({
  brokerEnvelopeId,
  ephemeralKeyThumbprint: session.thumbprint,
});
const response = await fetch(`${brokerUrl}/api/v1/envelopes/unlock`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${grant}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ envelopeId: brokerEnvelopeId, ephemeralPublicJwk: session.publicJwk }),
});

const result = await unlockPortableVaultBrokerResponse({
  response: await response.json(),
  session,
  expectedOpaqueScope,
  profile,
  operation,
  verifyAndConsumeCompletionReceipt: verifyAndConsumeBrokerReceipt,
});

if (result.status !== "unlocked") {
  throw new Error(`Portable vault unlock failed: ${result.status}`);
}
// Receipt verification and cache commit have succeeded. Only now install result.vaultKey through
// the owner-scoped vault session lifecycle.
```

Passing the current `operation` requires `verifyAndConsumeCompletionReceipt`. The core invokes that
consumer-owned callback after local unwrap but before committing the memory-only re-wrap cache or
returning an unlocked result. Receipt rejection returns `completion_receipt_rejected` and zeroes the
pending inner material. A successful commit permits later portable enrollment while the same vault
session remains open. Lock, logout, account change, or cache mismatch clears that material; stale
operations cannot read or mutate it.

Do not retry with the same ephemeral session. Create a new key and obtain a new grant for every
attempt. A malformed response, PUK unseal failure, or UVK unwrap failure must leave the vault locked.

## Legacy PRF migration

Do not claim that one PRF variant is portable across providers or devices. Existing `passkey_prf`
records remain decryptable and the APIs remain exported for migration and compatibility. New
portable enrollments use the broker flow. Migrate only after password/recovery or an already-unlocked
session proves access to the same UVK; validate the new broker envelope locally before retiring a
legacy variant.
