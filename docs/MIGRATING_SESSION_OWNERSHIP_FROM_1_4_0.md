# Migrating browser session ownership from 1.4.0

This guide adds account ownership and cancellation to browser vault operations. It prevents an async
operation started for account A from installing a key, cache entry, emergency pin, or lock after the
application has switched to account B.

There is no persisted-data or database migration. The contract applies only to process-memory browser
state.

## 1. Start one operation at each outer flow boundary

Use a stable, opaque identifier for the authenticated account. Start the operation only after account
bootstrap has resolved the real owner; do not use a loading placeholder or email address.

```ts
import {
  assertVaultSessionOperationCurrent,
  assertVaultSessionLeaseCurrent,
  beginVaultSessionUnlock,
  cacheVaultInnerKeyMaterialAfterPasswordUnlock,
  unlockVaultSession,
  VaultSessionOperationCancelledError,
} from "@tgoliveira/vault-core/browser";
import { unlockWithPasswordEnvelope } from "@tgoliveira/vault-core";

const operation = beginVaultSessionUnlock(opaqueAccountId);

try {
  const vaultKey = await unlockWithPasswordEnvelope(
    password,
    passwordEnvelope,
    vaultScope(opaqueAccountId),
    VAULT_PROFILE
  );
  assertVaultSessionOperationCurrent(operation);
  const lease = await unlockVaultSession(vaultKey, { operation });
  if (!lease) throw new Error("Owner-scoped unlock did not produce a session lease");
  await cacheVaultInnerKeyMaterialAfterPasswordUnlock(
    vaultKey,
    passwordEnvelope,
    password,
    { operation }
  );

  const payload = await loadAndDecryptPayload(lease.vaultKey);
  assertVaultSessionLeaseCurrent(lease);
  setDecryptedPayload(payload);
} catch (error) {
  if (error instanceof VaultSessionOperationCancelledError) return;
  throw error;
}
```

Starting another operation for the same owner uses last-operation-wins semantics. Starting one for a
different owner synchronously locks and clears the prior owner's UVK, inner-key cache, registered app
cleanup state, session role, and emergency pin before returning the new token.

`beginVaultSessionOperation()` is the generalized alias for setup/finalize, rotation, and passkey
management flows. `beginVaultSessionUnlock()` is the canonical unlock name.

## 2. Thread the same token through package mutations

The following browser APIs accept the operation token:

- `unlockVaultSession(key, { operation, role? })`
- password, recovery, and passkey inner-key cache population helpers (final options argument)
- `VaultInnerKeyMaterialCache` and the low-level cache helpers (`{ operation }`)
- `createPasskeyPrfEnvelopeWithSessionCache(..., { operation, ...wrapOptions })`
- `unlockVaultWithPasswordRouting`, `unlockVaultWithPasskeyRouting`, and
  `unlockVaultWithPasskeyCandidateRouting` (`operation` on the input)
- `hydrateVaultEmergencyModeFromServer(flag, { operation })`, `enterVaultEmergencyMode({ operation })`,
  `clearEmergencyModePin({ operation })`, and `exitEmergencyMode({ ..., operation })`
- `deleteVaultAfterAuthorization({ ..., operation })` and
  `deleteVaultWithPasswordAuthorization({ ..., operation })`

Pure crypto helpers do not own browser state and therefore do not accept a token. For setup, rotation,
payload hydration, and app-owned persistence, call `assertVaultSessionOperationCurrent(operation)`
after each awaited boundary and immediately before committing React state or persistence. A setup flow
that installs its new UVK finishes with `unlockVaultSession(key, { operation })`.

## 3. Use a lease after the key is installed

`unlockVaultSession()` returns a `VaultSessionLease` in owner-scoped mode. The frozen lease contains
the opaque `ownerId`, committed `epoch`, exact `role`, and non-extractable `vaultKey`. It is a
capability for post-unlock reads, decrypt/encrypt work, payload saves, hydration, and timer renewal:

```ts
import {
  assertVaultSessionLeaseCurrent,
  captureVaultSessionLease,
  getVaultSessionSnapshot,
  touchVaultSession,
} from "@tgoliveira/vault-core/browser";

const lease = captureVaultSessionLease(opaqueAccountId);
const encrypted = await encryptUpdatedPayload(lease.vaultKey);
assertVaultSessionLeaseCurrent(lease);
await persistEncryptedPayload(encrypted);
assertVaultSessionLeaseCurrent(lease);

touchVaultSession(lease);
const snapshot = getVaultSessionSnapshot(); // { ownerId, epoch, role } | null
```

Use `isVaultSessionLeaseCurrent()` for a non-throwing check. A newer attempt for the same owner does
not invalidate the installed lease until that attempt commits a new key. Lock, owner change, logout,
or a successful replacement-key commit invalidates the prior lease. Pass `lease` to
`useVaultSession`, `VaultSessionProvider`, and `VaultStatusDock` (`sessionLease`) when those React APIs
renew the timer. Also pass `{ sessionLease: leaseOrNull }` to `useVaultAutoLockPreference`; explicit
`null` configures the preference without scheduling while locked/bootstrap has no lease, and a stale
lease is ignored rather than renewing a replacement session.

## 4. Clear ownership on logout

```ts
import { clearVaultSessionOwner } from "@tgoliveira/vault-core/browser";

clearVaultSessionOwner();
await logoutAccount();
```

Call `clearVaultSessionOwner()` on logout, account removal, and when authenticated ownership becomes
unknown. An ordinary `lockVaultSession()` also cancels outstanding tokens, but intentionally retains
the same owner's emergency pin. A token cannot be reused after any lock; begin a new operation for the
next unlock attempt.

## 5. Treat cancellation as control flow

`VaultSessionOperationCancelledError` has code `vault_session_operation_cancelled` and reason
`missing_operation` or `stale_operation`. Do not show stale-operation cancellation as a password,
recovery, or passkey failure. It normally means navigation, lock, logout, or account replacement won
the race.

Once the application calls `beginVaultSessionOperation()`, guarded package mutations fail closed when
called without a current token. This intentionally exposes missed migration call sites. Applications
that never opt in retain the 1.4.0 single-owner runtime behavior.

## 6. App-owned async effects remain app-owned

Vault-core revalidates before and after `onEmergencyEntered`, deletion callbacks, and package state
commits. It cannot undo an external request that a callback has already sent. Keep callback endpoints
authenticated and owner-scoped, use request cancellation where available, and re-check the operation
before applying the response to browser state.
