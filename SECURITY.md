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

Use `assertNoVaultPlaintextFields()` on API request bodies.

## Client must never persist

- Decrypted vault payload in localStorage or IndexedDB

Browser session helpers clear UVK on lock and `pagehide`.

## Crypto constants (per app profile)

Apps define `VaultCryptoProfile` with stable AAD contexts. Existing ciphertext breaks if contexts change.

## Logging

Never log vault secrets, request bodies containing envelopes, or decrypted payloads.
