# Device binding example

Production apps that ship passkey PRF vault unlock must implement **multi-device binding**:
each browser/device needs an explicit binding after the user enrolls a passkey on that device.
The package exports scoping and status helpers; persistence (DB rows, cookies) stays in the app.

Reference consumer pattern: **SelahKeep** (`letter-to-god`).

## Package exports

| Export | Role |
| --- | --- |
| `VaultDeviceBindingStore` | App-owned persistence contract |
| `parseDeviceBindingId(raw)` | Parses `v1.<credentialId>` or raw credential id from cookie/header |
| `resolvePasskeyUnlockAvailableOnDevice(...)` | Server helper for `GET /api/vault/status` |
| `scopeAuthenticationOptionsToDevice(options, { credentialId })` | Filters `allowCredentials` before `navigator.credentials.get` |

## App-owned binding store (pseudocode)

Cookie name is **yours** (example: `selahkeep_vault_device_binding`). Store an opaque
`bindingId`; resolve it server-side to the WebAuthn `credentialId` for this browser.

```sql
-- Consumer-owned migration (PostgreSQL example)
CREATE TABLE vault_device_bindings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL,
  binding_id    TEXT NOT NULL UNIQUE,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, credential_id)
);

CREATE INDEX vault_device_bindings_user_id_idx ON vault_device_bindings (user_id);
```

```ts
import {
  parseDeviceBindingId,
  resolvePasskeyUnlockAvailableOnDevice,
  scopeAuthenticationOptionsToDevice,
  type VaultDeviceBindingStore,
} from "@tgoliveira/vault-core";

const VAULT_DEVICE_BINDING_COOKIE = "myapp_vault_device_binding"; // app-owned

/** SelahKeep-style store; method names are app conventions, not package exports. */
export const vaultDeviceBindingStore = {
  async resolveBindingForUser(userId: string) {
    const bindingId = readCookie(VAULT_DEVICE_BINDING_COOKIE);
    if (!bindingId) return null;
    const row = await db.vaultDeviceBindings.findFirst({
      where: { userId, bindingId },
    });
    if (!row) return null;
    return { bindingId: row.bindingId, credentialId: row.credentialId };
  },

  async bindPasskeyToDevice(input: { userId: string; credentialId: string }) {
    const bindingId = crypto.randomUUID();
    await db.vaultDeviceBindings.upsert({
      where: { userId_credentialId: { userId: input.userId, credentialId: input.credentialId } },
      create: { userId: input.userId, credentialId: input.credentialId, bindingId },
      update: { bindingId, lastUsedAt: new Date() },
    });
    setCookie(VAULT_DEVICE_BINDING_COOKIE, bindingId, { httpOnly: true, sameSite: "lax", secure: true });
    return { bindingId };
  },

  async touchLastUsed(bindingId: string) {
    await db.vaultDeviceBindings.updateMany({
      where: { bindingId },
      data: { lastUsedAt: new Date() },
    });
  },
} satisfies {
  resolveBindingForUser(userId: string): Promise<{ bindingId: string; credentialId: string } | null>;
  bindPasskeyToDevice(input: { userId: string; credentialId: string }): Promise<{ bindingId: string }>;
  touchLastUsed(bindingId: string): Promise<void>;
};

/** Wire the vault-core `VaultDeviceBindingStore` contract from the store above. */
export function createVaultDeviceBindingStoreAdapter(
  userId: string
): VaultDeviceBindingStore {
  return {
    getDeviceBindingId() {
      return readCookie(VAULT_DEVICE_BINDING_COOKIE);
    },
    async resolveCredentialId(bindingId) {
      const row = await db.vaultDeviceBindings.findFirst({ where: { userId, bindingId } });
      return row?.credentialId ?? null;
    },
    async saveBinding({ bindingId, credentialId, userId: uid }) {
      await vaultDeviceBindingStore.bindPasskeyToDevice({ userId: uid, credentialId });
      setCookie(VAULT_DEVICE_BINDING_COOKIE, bindingId, { httpOnly: true, sameSite: "lax", secure: true });
    },
    async clearBinding(bindingId) {
      await db.vaultDeviceBindings.deleteMany({ where: { userId, bindingId } });
      clearCookie(VAULT_DEVICE_BINDING_COOKIE);
    },
  };
}
```

## Vault status API (`GET /api/vault/status`)

Include binding availability on every response when a passkey envelope exists. When this browser
has **no** binding row for the signed-in user, pass `passkeyUnlockAvailableOnThisDevice: false`
explicitly — do not omit the field in production (omission defaults to “available” in
`resolvePasskeyUnlockAvailableOnDevice`).

```ts
export async function GET(request: Request) {
  const userId = await requireSessionUserId(request);
  const vault = await loadUserVault(userId);
  const binding = await vaultDeviceBindingStore.resolveBindingForUser(userId);

  const passkeyUnlockAvailableOnThisDevice = resolvePasskeyUnlockAvailableOnDevice({
    hasPasskeyPrfEnvelope: vault.hasPasskeyPrfEnvelope,
    passkeyUnlockAvailableOnThisDevice: binding != null,
  });

  return Response.json({
    configured: vault.configured,
    hasPasskeyPrfEnvelope: vault.hasPasskeyPrfEnvelope,
    passkeyUnlockAvailableOnThisDevice,
  });
}
```

## After passkey registration / enroll

Call `bindPasskeyToDevice` when WebAuthn registration succeeds and the passkey PRF envelope is
persisted (first enroll on this device, or “link passkey” after password unlock on a new device).

```ts
const { credentialId } = await verifyRegistrationResponse(/* @simplewebauthn/server */);
await persistPasskeyPrfEnvelope(/* ciphertext only */);
await vaultDeviceBindingStore.bindPasskeyToDevice({ userId, credentialId });
```

## Before WebAuthn authenticate (unlock)

Resolve the bound credential, scope server options, then run browser ceremony prep:

```ts
const binding = await vaultDeviceBindingStore.resolveBindingForUser(userId);
if (!binding) {
  throw new VaultUnlockError("passkey_not_bound_on_device");
}

const scoped = scopeAuthenticationOptionsToDevice(serverOptionsFromApi, {
  credentialId: binding.credentialId,
});

const publicKey = prepareVaultUnlockAuthenticationOptions(scoped, {
  credentialId: binding.credentialId,
  filterSingleCredential: true,
  userAgent,
});

const assertion = await navigator.credentials.get({ publicKey });
await vaultDeviceBindingStore.touchLastUsed(binding.bindingId);
```

## React dock

Pass `passkeyUnlockAvailableOnThisDevice` from the status API into `VaultStatusDock` /
`VaultDockQuickUnlock` `serverStatus`. See
[ADOPTING_VAULT_CORE_1_1_0.md](../../ADOPTING_VAULT_CORE_1_1_0.md) §5 (dock wiring).

The consumer demo uses localStorage for a single-browser demo only; production apps use
server DB + httpOnly cookie as above.
