# Adopting vault-core in an existing application

Use this guide to replace duplicated app-local vault primitives with
`@tgoliveira/vault-core` without changing existing ciphertext, AAD, PRF derivation, or product
payload contracts.

For a new implementation, start with [the complete implementation guide](./IMPLEMENTATION_GUIDE.md).
For persisted data created by an older vault-core release, also follow the matching historical
upgrade guide in [the documentation index](./README.md#historical-upgrade-guides).

## Package boundary

Move reusable cryptographic and browser lifecycle behavior into vault-core:

- UVK generation, AES-GCM payload encryption, AAD validation, KDF, and envelopes;
- password, recovery phrase, and passkey PRF wrap/unwrap;
- in-memory browser session, auto-lock, owner/epoch operations, and lock cleanup;
- passkey option preparation, PRF extraction/sanitization, candidate matching, and typed capability;
- no-plaintext validation and security test helpers.

Keep product and infrastructure behavior in the consuming app:

- database schemas, repositories, migrations, transactions, and API routes;
- account authentication, RBAC, 2FA, challenge persistence, and WebAuthn server verification;
- payload schemas, UI, product copy, routing, analytics, and notifications;
- app-specific AAD profile constants and PRF salt prefix;
- legacy formats that have not completed a tested migration.

Do not import vault-core from server routes merely to make browser secrets available. Vault
passwords, recovery phrases, UVKs, PRF output, and decrypted payloads remain browser-only.

## Migration sequence

### 1. Inventory before editing

Classify every local file and database field as one of:

| Class | Action |
| --- | --- |
| Reusable crypto/session behavior already exported by vault-core | Replace through a thin adapter, then remove duplicate |
| Product payload, route, persistence, or authentication behavior | Keep app-owned |
| Legacy compatibility behavior | Freeze, fixture-test, and retain until its sunset is authorized |
| Unused code | Prove no imports/data dependency, then delete |

Record current envelope methods, KDF metadata, AAD objects, crypto versions, PRF salt input, scope
IDs, passkey credential IDs, and browser storage keys.

### 2. Freeze the compatibility profile

Define one app-owned module and do not change it after production ciphertext exists:

```ts
import type { VaultCryptoProfile } from "@tgoliveira/vault-core";

export const APP_VAULT_PROFILE: VaultCryptoProfile = {
  cryptoVersion: "vault-v1",
  aadContextVault: "my-app:vault:v1",
  aadContextEnvelope: "my-app:vault-envelope:v1",
  legacyVaultKeyUnlock: false,
};

export const APP_PASSKEY_PRF_SALT_PREFIX = "my-app-passkey-prf-v1:";
```

Enable `legacyVaultKeyUnlock` only with a bounded `legacyVaultKeyAadContexts` allowlist and fixture
proof. Follow [the legacy AAD guide](./MIGRATION_LEGACY_VAULT_KEY.md); never accept arbitrary AAD
contexts.

### 3. Capture compatibility fixtures

Before deleting local crypto, capture controlled non-production records produced by the current app:

- password, recovery, and passkey envelopes;
- encrypted payloads for every live record version;
- 12- and 24-word recovery cases;
- each known legacy AAD/KDF variant;
- synced passkey metadata, multiple envelope variants, and missing/stale browser binding cases.

Prove both directions when required: old ciphertext decrypts with vault-core and newly written data
can be read by the intended rollback version. AES-GCM ciphertext is randomized; compare decrypted
content and authenticated metadata, not ciphertext bytes.

### 4. Add the package behind app adapters

Pin the intended compatible range and replace local functions incrementally. Keep existing route and
repository contracts stable while adapters translate app records to runtime vault-core schemas.
After each replacement, run functional, fixture, and plaintext-boundary tests.

Use supported entry points only:

```ts
import { createPasswordEnvelope } from "@tgoliveira/vault-core";
import { unlockVaultSession } from "@tgoliveira/vault-core/browser";
import { VaultSessionProvider } from "@tgoliveira/vault-core/react";
import { assertNoVaultPlaintextFields } from "@tgoliveira/vault-core/testing";
```

Never import `dist/*` or copy package source back into the application.

### 5. Migrate browser session ownership

Use `beginVaultSessionOperation(opaqueAccountId)` for multi-account apps and pass the operation to
session/cache/emergency mutations. Capture and validate `VaultSessionLease` across async saves.
Call `clearVaultSessionOwner()` on logout or account removal. Do not preserve decrypted state in
localStorage, sessionStorage, IndexedDB, cookies, URLs, or server sessions.

### 6. Migrate passkeys as logical credentials

A synced WebAuthn credential is one logical credential with optional browser bindings and one or
more append-only envelope variants. Bindings are UX/routing hints, not authentication proof.

- explicit unlock uses `resolvePasskeyUnlockPlan({ intent: "explicit", ... })` and remains available
  without a binding;
- auto-start quick unlock uses an exact valid binding;
- registration confirms PRF capability through
  `resolvePasskeyPrfEnrollmentAfterRegistration()` after exact server credential verification, then
  an exact authentication supplies the authoritative PRF for the first durable envelope;
- authentication responses are sanitized before the server and PRF output stays in browser memory;
- candidate no-match preserves known-good variants and requires local password/recovery
  authorization before appending a compatibility variant.

When a WebAuthn library converts challenge/credential JSON but passes extension inputs through,
call the existing preparation helpers without `prepareJson`. For optional reuse of one credential
for account login and vault PRF, follow
[the interoperability contract](./PASSKEY_ACCOUNT_AUTH_INTEROPERABILITY.md).

### 7. Remove duplicates only after proof

Delete a local primitive only when all imports have moved, fixtures pass, production schemas remain
compatible, and rollback is documented. Keep product schemas, server verification, repository
transactions, and legacy readers local unless a separate migration explicitly replaces them.

## Required application tests

Functional:

- setup, unlock, lock, reload, auto-lock, password rotation, recovery rotation, and deletion;
- passkey registration followed by exact-credential PRF authentication;
- explicit synced-passkey unlock without a binding and exact bound quick unlock;
- multiple variants, legacy AAD/KDF records, and recovery after PRF mismatch;
- logout/account switch cancelling stale async vault work.

Security boundaries:

- API/server reject vault password, recovery phrase, PRF, UVK, and decrypted payload sentinels;
- PRF is removed client-side and rejected server-side if present;
- plaintext is absent from localStorage, sessionStorage, IndexedDB, logs, analytics, URLs, and cookies;
- high-level decrypt validates expected scope/profile and persisted KDF is bounded;
- a stale operation/lease cannot commit after lock or account change;
- account authentication does not imply vault unlock.

## Completion checklist

- [ ] Current implementation and persisted formats inventoried.
- [ ] Crypto profile, scope mapping, and PRF prefix frozen.
- [ ] Compatibility fixtures cover every live and legacy record variant.
- [ ] Package APIs replace reusable local crypto/session behavior incrementally.
- [ ] App payloads, persistence, routes, and account authentication remain app-owned.
- [ ] Passkeys use logical credentials, optional bindings, append-only variants, and browser-only PRF.
- [ ] Multi-account operations and leases are wired across async boundaries.
- [ ] Plaintext rejection and browser storage tests pass.
- [ ] Duplicate code is removed only after fixture and rollback proof.
- [ ] `npm run validate` (or the consumer equivalent) passes before deployment.

## Related reading

- [Implementation guide](./IMPLEMENTATION_GUIDE.md)
- [Consumer security requirements](./CONSUMER_SECURITY_REQUIREMENTS.md)
- [Passkey account-auth interoperability](./PASSKEY_ACCOUNT_AUTH_INTEROPERABILITY.md)
- [API reference](../API_REFERENCE.md)
- [Security model](../SECURITY.md)
- [Architecture](../ARCHITECTURE.md)
