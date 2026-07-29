# Vault Core Security Model

## Separation from account auth

Account login, password reset, TOTP, OAuth, and passkey **login** must not unlock the vault.

Vault unlock requires a separate vault password, recovery phrase, legacy passkey PRF envelope, or
an explicitly authorized portable-broker envelope.

One WebAuthn credential may be explicitly opted into both passkey login and vault PRF, but the
capabilities, challenges, verification outcomes, server sessions, and lifecycle flags remain
independent. Login never implies vault unlock. A shared credential increases compromise blast radius
compared with separate credentials and requires informed user choice. See
[the interoperability contract](docs/PASSKEY_ACCOUNT_AUTH_INTEROPERABILITY.md).

## Application server must never receive

- Vault password
- Recovery phrase (plaintext)
- User Vault Key
- PRF output
- Decrypted vault payload

The optional portable broker is a separate trusted security boundary. It receives a random PUK
during enrollment and can recover that PUK at runtime; the application server must not proxy or log
it. A PUK plus its encrypted UVK envelope can restore the UVK, so this architecture is not
zero-knowledge against simultaneous compromise of broker runtime, KEK, and database. Use isolated
application-specific KEKs, pairwise opaque subjects, short-lived single-use grants, ephemeral-key
binding, completion receipts, replay protection, rate limits, and audited key rotation. See
[the portable broker security contract](docs/PORTABLE_PASSKEY_BROKER.md).

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

Envelope `publicMetadata` is server-visible and untrusted. Consumers must keep it non-secret and
apply route/schema size limits. `createPasskeyPrfEnvelopeAfterIndependentAuthorization()` additionally
enforces JSON-only metadata, forbidden-plaintext field rejection, bounded depth/entries, and a
4,096-byte limit. Legacy envelope parsing remains compatible and does not imply that old metadata is
trusted.

## Logging

Never log vault secrets, request bodies containing envelopes, or decrypted payloads.

## Passkey credential and PRF boundaries

PRF envelopes are a legacy compatibility mechanism, not the recommended cross-device portability
contract. A synced WebAuthn credential does not guarantee stable PRF output across devices,
providers, platforms, or `create()`/`get()` ceremonies. Preserve these APIs for existing ciphertext;
use the trusted portable broker for a one-enrollment cross-device product requirement.

A synced/multi-device WebAuthn credential is one logical credential, not one credential per physical
device. Optional browser bindings are opaque routing/UX state; possession of a binding is not WebAuthn
proof and cannot authorize envelope creation, replacement, or deletion.

Use `resolvePasskeyUnlockPlan({ intent: "explicit", ... })` for a user-initiated unlock page. It does
not require a browser binding and defaults to the authenticated account's allow-list. Use `intent:
"quick"` (or `resolvePasskeyUnlockAvailable()`) only for exact bound-credential routing and optional
auto-start. `VaultUnlockPanel` requires that ready quick plan and a separate quick callback for
auto-start; it never auto-starts the explicit callback.

Treat API/user-agent PRF detection as preliminary only. During enrollment, registration may confirm
PRF capability, but never persist its `create()` output as the only durable envelope variant.
`resolvePasskeyPrfEnrollmentAfterRegistration()` validates the exact server-verified credential and
always requires a post-registration authentication ceremony for confirmed PRF credentials. Only the
PRF returned by that exact `get()` ceremony is authoritative for future unlocks. Authentication PRF
is confirmed only for the server-verified assertion credential. PRF output and hashes stay
client-only; note that serializing a `PublicKeyCredential` can include extension results, so remove
PRF results with
`sanitizeWebAuthnResponseForServer()` (or an equally strict app-owned serializer) before sending
WebAuthn data to a server.

Registration verification must not mint a proof that authorizes durable passkey-envelope
persistence. The application may issue that short-lived, single-use persistence proof only after it
has verified the exact post-registration authentication assertion. This prevents a consumer from
bypassing the authentication-confirmed PRF requirement while still using the safe resolver result.

Browser libraries such as SimpleWebAuthn may convert challenge, user, and credential IDs while
passing extension inputs through unchanged. Compose their server options with the existing
`prepareVaultPasskeyPrfRegistrationOptions()` / `prepareVaultPasskeyPrfAuthenticationOptions()`
without `prepareJson` so those JSON fields remain encoded and the local PRF salt remains a native
`ArrayBuffer`. When account authentication and vault use the same credential, keep one authoritative
server counter with atomic monotonic compare-and-swap, one verifier per assertion, distinct
challenge audiences, and no vault unwrap before the fully authenticated account session (including
2FA).

When compatibility requires multiple envelopes for one verified credential, pass only that
credential's bounded active candidates to `unlockWithPasskeyPrfEnvelopeCandidates()`. A no-match must
preserve every candidate and require password/recovery authorization before adding another variant.
Use `createPasskeyPrfEnvelopeAfterIndependentAuthorization()` for that local authorization and
creation step; do not authorize it from a session UVK, binding cookie, or another passkey alone.
Use `unlockVaultWithPasskeyCandidateRouting()` when emergency/duress mode is enabled so candidate
selection cannot bypass primary/decoy session routing.

If emergency/duress candidate routing returns `no_match`, keep the vault locked and fall back to
`unlockVaultWithPasswordRouting()` or the package recovery/exit flow. Do not install the UVK returned
by the stateless compatibility helper in that ambiguous context. Defer variant repair until the app
has a confirmed normal primary context.

Candidate AAD context checks use the exact profile when `legacyVaultKeyUnlock` is disabled. While
legacy routing is enabled, only missing/null contexts and strings explicitly listed in
`legacyVaultKeyAadContexts` are accepted. Arbitrary strings, user/resource mismatches, and non-
`vault_key` fields fail closed.
