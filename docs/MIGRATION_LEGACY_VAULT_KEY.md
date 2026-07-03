# Legacy vault_key AAD migration

Some deployments persisted `vault_key` envelopes before `aad.context` was required, or with a
frozen context string that differs from the current `VaultCryptoProfile.aadContextEnvelope`.

## Behavior (1.1+)

When `profile.legacyVaultKeyUnlock !== false` (default **true**):

- `unlockWithPasskeyPrfEnvelope`, `unlockWithPasswordEnvelope`, and `unlockWithRecoveryEnvelope`
  route legacy envelopes through `unwrapVaultKeyWithLegacyAadFallback`, trying canonical and
  legacy AAD byte orderings via `aadByteCandidates`.
- Modern envelopes (matching profile context) use strict `assertVaultKeyAad`.

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

1. Ship 1.1 with `legacyVaultKeyUnlock: true` (default).
2. Monitor `isLegacyVaultKeyEnvelope` counts server-side.
3. When zero, set `legacyVaultKeyUnlock: false` and remove app-local legacy unlock shims.
