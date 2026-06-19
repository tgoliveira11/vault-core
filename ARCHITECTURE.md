# Vault Core Architecture

## User Vault Key (UVK)

256-bit AES-GCM key generated client-side. Wrapped by envelopes; encrypts app payload JSON.

## Envelopes

| Method | KDF | Wraps |
| --- | --- | --- |
| Password | Argon2id | UVK |
| Recovery phrase | Argon2id (BIP39 normalized phrase) | UVK |
| Passkey PRF | PRF output → AES key | UVK |

Envelope AAD field: `vault_key` with app `aadContextEnvelope`.
Persisted envelopes are validated as a method-discriminated union, so password and recovery
envelopes require Argon2id metadata while passkey PRF envelopes require `null` KDF metadata.

## Encrypted payload

Generic JSON encrypted under UVK. AAD field: `vault_payload` with app `aadContextVault`.

Format: `enc-v1` / `AES-GCM` / `kdf-v1`.

## Package layers

```
@tgoliveira/vault-core          crypto + envelopes + payload + validation
@tgoliveira/vault-core/browser  session + auto-lock + PRF salt + kit DOM
@tgoliveira/vault-core/testing  sentinels + scan helpers
@tgoliveira/vault-core/react    headless React session/status hooks
```

Apps own: persistence, routes, product UI, product payload schema, WebAuthn ceremony.

Browser and React session layers keep the UVK in memory, renew auto-lock on activity, and clear it on
lock or `pagehide`. Direct key mutation is not part of the public browser entry.
