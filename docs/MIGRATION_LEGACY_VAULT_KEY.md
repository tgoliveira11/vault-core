# Legacy vault_key AAD migration

Some deployments persisted `vault_key` envelopes before `aad.context` was required, with `null`, or
with a frozen context string that differs from the current `VaultCryptoProfile.aadContextEnvelope`.

## Behavior (1.1+)

When `profile.legacyVaultKeyUnlock !== false` (default **true**):

- missing and null contexts are eligible for legacy routing;
- an explicit non-canonical string is eligible only when present in
  `profile.legacyVaultKeyAadContexts`;
- `unlockWithPasskeyPrfEnvelope`, `unlockWithPasswordEnvelope`, and `unlockWithRecoveryEnvelope`
  route eligible envelopes through `unwrapVaultKeyWithLegacyAadFallback`, trying canonical and legacy
  AAD byte orderings via `aadByteCandidates`.
- Modern envelopes (matching profile context) use strict `assertVaultKeyAad`.

```ts
const profile: VaultCryptoProfile = {
  cryptoVersion: "vault-v1",
  aadContextVault: "acme:vault:v1",
  aadContextEnvelope: "acme:vault-envelope:v1",
  legacyVaultKeyUnlock: true,
  legacyVaultKeyAadContexts: ["acme:legacy-vault-envelope:v0"],
};
```

Do not add observed arbitrary strings to this list. Confirm each value was a previously shipped
application constant; the allowlist is an AAD domain-migration contract.

Set `legacyVaultKeyUnlock: false` on your profile after all stored envelopes are normalized.

## Detecting legacy data

```ts
import { isLegacyVaultKeyEnvelope } from "@tgoliveira/vault-core";

if (isLegacyVaultKeyEnvelope(envelope.encryptedVaultKey, VAULT_PROFILE)) {
  // metrics / migration job
}
```

## Normalizing on write

Re-wrap envelopes after unlock so new ciphertext uses `profile.aadContextEnvelope`. Use rotation
APIs (`rotateVaultPassword`, `rotateRecoveryPhrase`) or passkey re-wrap with session cache.

## Sunset

1. Ship with `legacyVaultKeyUnlock: true` and only known explicit legacy strings allowlisted.
2. Monitor `isLegacyVaultKeyEnvelope` counts server-side.
3. Re-wrap successfully unlocked envelopes with the canonical context.
4. When zero, set `legacyVaultKeyUnlock: false`, remove the allowlist, and remove app-local shims.
