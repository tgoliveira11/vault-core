# Vault Admin UI

`@tgoliveira/vault-core` ships a read-only admin UI (same pattern as `@tgoliveira/secure-auth/react`) for inspecting vault configuration, crypto policy, and `.env.local` variables.

## Admin screens

| Screen | Export | Default path |
|--------|--------|--------------|
| Panel (hub) | `VaultAdminPanelPage` | `/admin/vault` |
| Configuration | `VaultAdminConfigPage` | `/admin/vault/config` |
| Environment template | `VaultAdminEnvTemplatePage` | `/admin/vault/env-template` |
| Crypto policy | `VaultAdminCryptoPolicyPage` | `/admin/vault/crypto-policy` |
| Crypto profile | `VaultAdminProfilePage` | `/admin/vault/profile` |
| Session & auto-lock | `VaultAdminSessionPage` | `/admin/vault/session` |
| Vault password policy | `VaultAdminPasswordPolicyPage` | `/admin/vault/password-policy` |
| Security boundaries | `VaultAdminSecurityPage` | `/admin/vault/security` |

Use `listVaultAdminScreens()` from the main package for programmatic discovery.

## Styles

Import once in your app (e.g. `globals.css`):

```css
@import "@tgoliveira/vault-core/vault-admin.css";
```

## App integration (Next.js App Router)

### 1. Env mapper (app-owned)

The package never reads `process.env`. Map env in your app:

```ts
// src/lib/env/vault-from-env.ts
import { buildVaultAdminConfigFromEnv } from "@tgoliveira/vault-core";
import type { VaultCryptoProfile } from "@tgoliveira/vault-core";

export const vaultCryptoProfile: VaultCryptoProfile = {
  cryptoVersion: "vault-v1",
  aadContextVault: process.env.VAULT_AAD_CONTEXT_VAULT ?? "my-app:vault:v1",
  aadContextEnvelope: process.env.VAULT_AAD_CONTEXT_ENVELOPE ?? "my-app:vault-envelope:v1",
};

export function getVaultAdminConfig() {
  return buildVaultAdminConfigFromEnv({
    env: process.env,
    profile: vaultCryptoProfile,
    prfSaltPrefix: process.env.VAULT_PRF_SALT_PREFIX ?? "my-app-passkey-prf-v1:",
    productName: process.env.APP_NAME ?? "My App",
  });
}
```

### 2. Thin admin pages

```tsx
// src/app/admin/vault/page.tsx
import { VaultAdminPanelPage } from "@tgoliveira/vault-core/react";
import { getVaultAdminConfig } from "@/lib/env/vault-from-env";

export default function Page() {
  return <VaultAdminPanelPage config={getVaultAdminConfig()} />;
}
```

Repeat for each sub-route (`config`, `crypto-policy`, etc.) or use a shared layout.

### 3. Protect routes

Wrap admin routes with your existing admin authorization. Vault-core does not implement account roles.

## Environment variables

All vault-related variables are cataloged in `VAULT_ADMIN_ENV_CATALOG` and rendered on the **Environment template** screen. Key groups:

- **Admin:** `VAULT_ADMIN_ENABLED`, `VAULT_ADMIN_PATH`
- **Crypto profile:** `VAULT_AAD_CONTEXT_VAULT`, `VAULT_AAD_CONTEXT_ENVELOPE`, `VAULT_PRF_SALT_PREFIX`, `VAULT_DEFAULT_RECOVERY_WORD_COUNT`
- **Session:** `NEXT_PUBLIC_VAULT_AUTO_LOCK_MINUTES`, `VAULT_AUTO_LOCK_MINUTES`
- **Password policy:** `VAULT_PASSWORD_*`
- **Features:** `VAULT_PASSKEY_PRF_UNLOCK_ENABLED`

Copy-ready block: `buildVaultEnvLocalTemplate(productName)` or the admin **Environment template** page.

## Optional Next.js Link

Pass `LinkComponent={Link}` from `next/link` to avoid full page reloads:

```tsx
<VaultAdminPanelPage config={config} LinkComponent={Link} />
```

## Runtime overrides (editable config)

To enable editing on `VaultAdminConfigPage`, the consuming app must:

1. Implement `GET/POST/DELETE {configApiBase}/admin/config` (see consumer-demo
   `src/app/api/vault/admin/config/route.ts`).
2. Persist overrides in an app-owned database using the reference schema below.
3. Pass `configApiBase` and load `adminOverrides` into `buildVaultAdminConfigFromEnv({ adminOverrides })`.

### Reference PostgreSQL schema

Shipped with the package:

| Artifact | Location |
| --- | --- |
| SQL file | `docs/schemas/vault_admin_config_overrides.sql` (in npm tarball under `docs/`) |
| Helper | `getVaultAdminConfigOverrideSchemaSql()` from `@tgoliveira/vault-core` |
| Table constant | `VAULT_ADMIN_CONFIG_OVERRIDES_TABLE` |

```ts
import {
  getVaultAdminConfigOverrideSchemaSql,
  VAULT_ADMIN_CONFIG_OVERRIDES_TABLE,
} from "@tgoliveira/vault-core";

// Migration tool or bootstrap:
await sql.unsafe(getVaultAdminConfigOverrideSchemaSql());
```

Default table columns: `key` (text PK), `value` (jsonb), `updated_at` (timestamptz).

Without `configApiBase`, all admin screens remain read-only (env-resolved config).
