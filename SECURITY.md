# Vault Core Security Model

## Separation from account auth

Account login, password reset, TOTP, OAuth, and passkey **login** must not unlock the vault.

Vault unlock requires a separate vault password, recovery phrase, or passkey PRF envelope.

## Server must never receive

- Vault password
- Recovery phrase (plaintext)
- User Vault Key
- PRF output
- Decrypted vault payload

Use `assertNoVaultPlaintextFields()` on API request bodies. The guard recursively checks nested
objects and arrays and safely handles cyclic in-memory objects.

## Client must never persist

- Decrypted vault payload in localStorage or IndexedDB

Browser session helpers clear UVK on lock and `pagehide`, run registered lock cleanup handlers,
and zero inner-key cache bytes before dropping references. Envelope unlock restores a
**non-extractable** session UVK; envelope wrap uses AES-KW (Web Crypto `wrapKey` / `unwrapKey`) so
raw key bytes are not exported during re-wrap when the inner blob is reused. Legacy envelopes that
store 32 raw bytes after the outer decrypt remain unlockable. React session helpers also renew the
inactivity timer on pointer, keyboard, touch, and focus activity by default. Public browser exports
do not expose direct session-key setters; use `unlockVaultSession()` and `lockVaultSession()` so
timers and subscribers remain consistent.

Multi-account consumers must use `beginVaultSessionOperation(opaqueAccountId)` and pass the returned
operation to browser session, cache, emergency, and deletion mutations. After unlock, use the returned
owner+epoch+role+non-extractable-key `VaultSessionLease` and validate it before post-await saves or
hydration commits. Owner changes and locks cancel older attempts and leases so a delayed account-A
operation cannot reinstall state after account B becomes current. Use `clearVaultSessionOwner()` on
logout. Pure crypto and app-owned network/state continuations remain consumer-owned.

`inspectLocalStoragePrefix()` and `inspectIndexedDBPrefix()` are namespace inspections, not content
scanners. They return `"unavailable"` when inspection is blocked or unsupported. Treat that result
as a failed security check. IndexedDB inspection checks database names and cannot prove that records
inside an unrelated database contain no plaintext.

## Crypto constants (per app profile)

Apps define `VaultCryptoProfile` with stable AAD contexts. Existing ciphertext breaks if contexts change.

High-level decrypt and envelope-unlock APIs require the expected scope and profile. They reject a
valid ciphertext when its authenticated AAD belongs to a different user, resource, field, or app
context. Treat `decryptField()` as a low-level compatibility primitive: callers that use it directly
must validate the expected AAD separately.

## Untrusted persisted data

Treat encrypted payloads, envelopes, AAD, and KDF metadata loaded from a server or local storage as
untrusted. Argon2id metadata is bounded before derivation to prevent excessive client memory or CPU
consumption. Do not bypass the high-level APIs or their runtime validation for persisted data.

Consuming applications must implement authentication, RBAC, CSP, mandatory unlock rate limits, and
`assertNoVaultPlaintextFields()` on server routes. See
[docs/CONSUMER_SECURITY_REQUIREMENTS.md](docs/CONSUMER_SECURITY_REQUIREMENTS.md).

## Logging

Never log vault secrets, request bodies containing envelopes, or decrypted payloads.

## Passkey credential and PRF boundaries

A synced/multi-device WebAuthn credential is one logical credential, not one credential per physical
device. Optional browser bindings are opaque routing/UX state; possession of a binding is not WebAuthn
proof and cannot authorize envelope creation, replacement, or deletion.

Treat API/user-agent PRF detection as preliminary only. Confirm credential capability from registration
`prf.enabled` and confirm a usable authentication result from `prf.results`. PRF output and hashes stay
client-only; note that serializing a `PublicKeyCredential` can include extension results, so remove PRF
results with `sanitizeWebAuthnResponseForServer()` (or an equally strict app-owned serializer) before
sending WebAuthn data to a server.

When compatibility requires multiple envelopes for one verified credential, pass only that
credential's bounded active candidates to `unlockWithPasskeyPrfEnvelopeCandidates()`. A no-match must
preserve every candidate and require password/recovery authorization before adding another variant.
Use `unlockVaultWithPasskeyCandidateRouting()` when emergency/duress mode is enabled so candidate
selection cannot bypass primary/decoy session routing.

Candidate AAD context checks use the exact profile when `legacyVaultKeyUnlock` is disabled. While
legacy routing is enabled, only missing/null contexts and strings explicitly listed in
`legacyVaultKeyAadContexts` are accepted. Arbitrary strings, user/resource mismatches, and non-
`vault_key` fields fail closed.
