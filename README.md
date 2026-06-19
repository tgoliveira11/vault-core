# @tgoliveira/vault-core

Framework-independent vault crypto primitives extracted from LiqSense.

## Scope

- User Vault Key (UVK) generation
- AES-GCM encrypted payloads with canonical AAD
- Argon2id password and recovery phrase envelopes
- Passkey PRF envelope wrap/unwrap (PRF bytes only — no WebAuthn ceremony)
- BIP39 12/24-word recovery phrases
- No-plaintext validation helpers

## Install

```bash
npm install @tgoliveira/vault-core
```

Local development with LiqSense:

```json
"@tgoliveira/vault-core": "file:../vault-core"
```

Build vault-core before consuming:

```bash
cd ../vault-core && npm run validate
```

## Quick start

```ts
import {
  createUserVaultKey,
  createPasswordEnvelope,
  unlockWithPasswordEnvelope,
  encryptVaultPayload,
  decryptVaultPayload,
  type VaultCryptoProfile,
} from "@tgoliveira/vault-core";

const profile: VaultCryptoProfile = {
  cryptoVersion: "vault-v1",
  aadContextVault: "myapp:vault:v1",
  aadContextEnvelope: "myapp:vault-envelope:v1",
};

const userId = "00000000-0000-4000-8000-000000000001";
const scope = { userId, resourceId: userId };
const vaultKey = await createUserVaultKey();

const { envelope } = await createPasswordEnvelope(
  vaultKey,
  userVaultPassword,
  scope,
  profile
);
```

## Exports

| Entry | Purpose |
| --- | --- |
| `@tgoliveira/vault-core` | Core crypto, envelopes, payload, validation |
| `@tgoliveira/vault-core/browser` | In-memory session, auto-lock, PRF salt, recovery kit DOM helpers |
| `@tgoliveira/vault-core/testing` | Sentinels and plaintext scan helpers |
| `@tgoliveira/vault-core/react` | Headless React session/status hooks (optional peer: `react`) |

## Boundaries

- Does **not** include account authentication
- Does **not** require React, Next.js, or product payload schemas on the default entry
- `./react` is optional and requires `react >= 18`
- Vault password, recovery phrase, UVK, PRF output, and decrypted payload must stay client-side

See `SECURITY.md`, `ARCHITECTURE.md`, and `MIGRATION_FROM_LIQSENSE.md`.
