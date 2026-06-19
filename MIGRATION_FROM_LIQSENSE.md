# Migration from LiqSense

## LiqSense profile (frozen)

```ts
export const LIQSENSE_VAULT_PROFILE = {
  cryptoVersion: "vault-v1",
  aadContextVault: "liqsense:vault:v1",
  aadContextEnvelope: "liqsense:vault-envelope:v1",
};
export const LIQSENSE_PRF_SALT_PREFIX = "liqsense-passkey-prf-v1:";
```

## Import mapping

| LiqSense (legacy) | vault-core |
| --- | --- |
| `generateUserVaultKey` | `createUserVaultKey` |
| `wrapVaultKeyForPassword` | `createPasswordEnvelope` + profile |
| `unwrapVaultKeyFromPassword` | `unlockWithPasswordEnvelope` |
| `wrapVaultKeyForRecoveryPhrase` | `createRecoveryEnvelope` + profile |
| `generateRecoveryPhrase` | `createRecoveryPhrase` |

LiqSense keeps thin wrappers in `src/modules/vault/core/` binding `LIQSENSE_VAULT_PROFILE`.

## Local dev

```json
"@tgoliveira/vault-core": "file:../vault-core"
```

Build vault-core first. LiqSense uses `next build --webpack` for local package resolution.

## React hooks

Import from `@tgoliveira/vault-core/react` (not a separate package):

```ts
import { useVaultUnlocked, resolveVaultClientStatus } from "@tgoliveira/vault-core/react";
```

The standalone `@tgoliveira/vault-react` package is deprecated.
