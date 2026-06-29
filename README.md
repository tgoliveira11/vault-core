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

## Testing

```bash
npm test
npm run test:coverage
```

Coverage is enforced per production file at 90% for statements, branches, functions, and lines.
`npm run validate` includes the coverage gate.

## Documentation

- [Complete implementation guide](docs/IMPLEMENTATION_GUIDE.md)
- [Documentation index](docs/README.md)
- [API reference](API_REFERENCE.md)
- [Security model](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Release process](docs/RELEASING.md)
- [Agent and contributor guide](AGENTS.md)

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

const encryptedPayload = await encryptVaultPayload(
  { version: 1, entries: [] },
  vaultKey,
  scope,
  profile
);

const unlockedKey = await unlockWithPasswordEnvelope(
  userVaultPassword,
  envelope,
  scope,
  profile
);

const payload = await decryptVaultPayload(encryptedPayload, unlockedKey, scope, profile);
```

High-level decrypt and unlock APIs require the expected scope and profile. This binds authenticated
AAD to the user, resource, field, and application context expected by the caller.

## Exports

| Entry | Purpose |
| --- | --- |
| `@tgoliveira/vault-core` | Core crypto, envelopes, payload, validation |
| `@tgoliveira/vault-core/browser` | In-memory session, activity-aware auto-lock, storage inspection, PRF salt, recovery kit DOM helpers |
| `@tgoliveira/vault-core/testing` | Sentinels and plaintext scan helpers |
| `@tgoliveira/vault-core/react` | Headless React session/status hooks and vault admin UI pages (optional peer: `react`) |
| `@tgoliveira/vault-core/vault-admin.css` | Styles for vault admin pages |

## Boundaries

- Does **not** include account authentication
- Does **not** require React, Next.js, or product payload schemas on the default entry
- `./react` is optional and requires `react >= 18`
- Vault password, recovery phrase, UVK, PRF output, and decrypted payload must stay client-side
- Persisted envelope schemas enforce method-specific KDF metadata at runtime

See `SECURITY.md`, `ARCHITECTURE.md`, `MIGRATION_FROM_LIQSENSE.md`, [`docs/VAULT_ADMIN.md`](docs/VAULT_ADMIN.md), and [`docs/ADOPTING_VAULT_CORE_IN_EXISTING_APPS.md`](docs/ADOPTING_VAULT_CORE_IN_EXISTING_APPS.md) for migrating other apps (including [letter-to-god](https://github.com/tgoliveira11/letter-to-god)).
