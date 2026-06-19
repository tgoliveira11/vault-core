# API Reference

See TypeScript exports from:

- `@tgoliveira/vault-core`
- `@tgoliveira/vault-core/browser`
- `@tgoliveira/vault-core/testing`
- `@tgoliveira/vault-core/react`

## Core types

- `VaultCryptoProfile`, `VaultCryptoVersion`
- `EncryptedVaultPayload`, `VaultEnvelope`, `PasswordEnvelope`, `RecoveryPhraseEnvelope`, `PasskeyPrfEnvelope`
- `RecoveryPhraseWordCount` (`12 | 24`)
- `VaultUnlockResult<TPayload>`, `VaultCoreError`

## Core functions

- `createUserVaultKey()`
- `encryptVaultPayload<T>(payload, key, scope, profile)`
- `decryptVaultPayload<T>(encrypted, key)`
- `createPasswordEnvelope` / `unlockWithPasswordEnvelope`
- `createRecoveryPhrase` / `createRecoveryEnvelope` / `unlockWithRecoveryEnvelope`
- `createPasskeyPrfEnvelope` / `unlockWithPasskeyPrfEnvelope`
- `createRecoveryKitText(...)`
- `assertVaultKeyAad` / `assertVaultPayloadAad`
- `assertNoVaultPlaintextFields` / `validateNoPlaintextLeak`

Deprecated aliases (`wrapVaultKeyForPassword`, etc.) remain for migration.

## React entry (`@tgoliveira/vault-core/react`)

- `useVaultUnlocked()`, `useVaultLockState()`
- `useVaultSession()`, `VaultSessionProvider`
- `resolveVaultClientStatus()`, `useVaultClientStatus()`
- `VaultClientStatus`, `VaultServerStatusSnapshot`
