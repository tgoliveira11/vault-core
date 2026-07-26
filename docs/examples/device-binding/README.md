# Opaque browser binding example

A binding is optional browser routing/UX state. It is not a passkey, device identity, authentication
factor, or authorization grant. Zero or many opaque bindings may reference the same logical WebAuthn
credential, including a credential synced across a user's devices.

The package owns portable contracts and fail-closed selection. The application owns cookies, rows,
WebAuthn verification, authorization, and persistence.

## Consumer-owned schema sketch

```sql
CREATE TABLE vault_passkey_bindings (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  binding_id                   UUID NOT NULL UNIQUE,
  credential_id                TEXT NOT NULL,
  selected_envelope_variant_id UUID,
  last_used_at                 TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Intentionally not unique: several browsers may bind to one credential.
CREATE INDEX vault_passkey_bindings_user_credential_idx
  ON vault_passkey_bindings (user_id, credential_id);
```

The optional selected variant is a routing hint after a successful local unwrap. It must reference a
variant belonging to the same verified credential. Do not put `credentialId` inside `bindingId`.

## Store adapter

```ts
import type {
  VaultPasskeyBindingStore,
  VaultPasskeyBindingTarget,
} from "@tgoliveira/vault-core";

declare function readBindingCookie(): string | null;
declare function loadBindingTarget(input: {
  userId: string;
  bindingId: string;
}): Promise<VaultPasskeyBindingTarget | null>;
declare function insertBinding(input: {
  userId: string;
  bindingId: string;
  target: VaultPasskeyBindingTarget;
}): Promise<void>;
declare function deleteBinding(input: { userId: string; bindingId: string }): Promise<void>;

export function createBindingStore(userId: string): VaultPasskeyBindingStore {
  return {
    getBindingId: readBindingCookie,
    resolveBindingTarget(bindingId) {
      return loadBindingTarget({ userId, bindingId });
    },
    saveBinding({ bindingId, userId: ownerId, target }) {
      return insertBinding({ userId: ownerId, bindingId, target });
    },
    clearBinding(bindingId) {
      return deleteBinding({ userId, bindingId });
    },
  };
}
```

## Bound-browser quick unlock

Missing binding state fails closed. This does not prevent a separate explicit **Use an existing
passkey** flow.

```ts
import { resolvePasskeyUnlockAvailable } from "@tgoliveira/vault-core";

export function resolveQuickUnlock(input: {
  hasEnvelopeVariants: boolean;
  bindingExists: boolean;
}): boolean {
  return resolvePasskeyUnlockAvailable({
    hasPasskeyPrfEnvelope: input.hasEnvelopeVariants,
    passkeyUnlockAvailableOnThisBrowser: input.bindingExists,
  });
}
```

## Exact bound-credential selection

```ts
import { prepareAuthenticationOptions } from "@tgoliveira/secure-auth/client";
import { prepareVaultPasskeyPrfAuthenticationOptions } from "@tgoliveira/vault-core/browser";

declare const userId: string;
declare const boundCredentialId: string;
declare const serverOptions: Parameters<typeof prepareAuthenticationOptions>[0];

const publicKey = await prepareVaultPasskeyPrfAuthenticationOptions({
  userId,
  prfSaltPrefix: "acme-passkey-prf-v1:",
  serverOptions,
  prepareJson: prepareAuthenticationOptions,
  credentialSelection: { mode: "exact", credentialId: boundCredentialId },
  transportPolicy: "preserve",
});

void publicKey;
```

If the credential is absent, duplicated, or malformed, the helper throws
`PasskeyCredentialScopeError`; it never returns the original unscoped list.

## Cleared cookie / new browser

An unbound browser should not automatically register a new passkey. Offer an explicit discoverable or
allow-list flow:

1. run WebAuthn authentication and verify the chosen credential on the server;
2. return only that credential's bounded active envelope variants;
3. extract PRF locally and call `unlockWithPasskeyPrfEnvelopeCandidates()`;
4. after a match, create another opaque binding targeting the matched credential/variant.

If no variant matches, preserve all variants. Require password/recovery locally before creating and
persisting an additional compatibility variant.

## Revocation boundaries

These are distinct application operations:

- clear one browser binding;
- deactivate/delete one envelope variant after recovery-authorized policy checks;
- revoke the complete WebAuthn credential and all of its vault associations.

A binding cookie alone authorizes none of them.
