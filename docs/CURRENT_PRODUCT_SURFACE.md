# Current product surface

Living inventory of what `@tgoliveira/vault-core` exposes today. Update this file when exports, admin screens, published artifacts, or shipped/planned status changes.

Last reviewed: **2026-06-19** (package version **0.3.0**, unreleased admin overrides on branch)

## Package entry points (shipped)

| Export | Status | Purpose |
| --- | --- | --- |
| `@tgoliveira/vault-core` | Shipped | Crypto, envelopes, recovery, rotation, admin config helpers, validation |
| `@tgoliveira/vault-core/browser` | Shipped | Session lifecycle, auto-lock, storage inspection, PRF salt, recovery kit DOM |
| `@tgoliveira/vault-core/react` | Shipped | Session provider/hooks, client status, **vault admin UI pages** |
| `@tgoliveira/vault-core/testing` | Shipped | Plaintext sentinels and leak-detection helpers |
| `@tgoliveira/vault-core/vault-admin.css` | Shipped | Styles for vault admin pages |

## Core capabilities (shipped)

- AES-256-GCM encrypted payloads with canonical AAD
- Argon2id password and recovery envelopes (`kdf-v1` legacy, `kdf-v2` recommended)
- Passkey PRF envelope wrap/unwrap (no WebAuthn ceremony)
- BIP39 12/24-word recovery phrases and recovery kit text
- Password rotation (`rotateVaultPassword`)
- Recovery phrase rotation (`rotateRecoveryPhrase`)
- Auto-upgrade legacy KDF on unlock
- Plaintext rejection / sentinel validation
- Canonical crypto policy (`VAULT_CRYPTO_POLICY`) + CI guard

## Admin config helpers (shipped)

Exported from main entry — app maps `process.env`; package never reads env directly:

- `buildVaultAdminConfigFromEnv`, `listVaultAdminConfigEntries`
- `applyVaultAdminOverrides`, `validateVaultAdminOverride`, `VAULT_OVERRIDABLE_CONFIG_KEYS`, `VAULT_CONFIG_KEY_DEFINITIONS`
- `VAULT_ADMIN_ENV_CATALOG`, `buildVaultEnvLocalTemplate`
- `resolveVaultAdminPaths`, `listVaultAdminScreens`, `DEFAULT_VAULT_ADMIN_PATHS`

Documented env groups: admin, crypto profile, session, password policy, features. See [VAULT_ADMIN.md](./VAULT_ADMIN.md).

## Vault admin UI screens (shipped)

Mounted by consuming apps under configurable base path (default `/admin/vault`):

| Screen | Component | Default path |
| --- | --- | --- |
| Panel | `VaultAdminPanelPage` | `/admin/vault` |
| Configuration | `VaultAdminConfigPage` | `/admin/vault/config` |
| Environment template | `VaultAdminEnvTemplatePage` | `/admin/vault/env-template` |
| Crypto policy | `VaultAdminCryptoPolicyPage` | `/admin/vault/crypto-policy` |
| Crypto profile | `VaultAdminProfilePage` | `/admin/vault/profile` |
| Session & auto-lock | `VaultAdminSessionPage` | `/admin/vault/session` |
| Vault password policy | `VaultAdminPasswordPolicyPage` | `/admin/vault/password-policy` |
| Security boundaries | `VaultAdminSecurityPage` | `/admin/vault/security` |

Editable when the consuming app provides `configApiBase` (runtime overrides via app-owned API/DB).
Read-only display otherwise. Crypto policy constants remain read-only. No account auth or vault
decryption in admin pages.

## React session helpers (shipped)

- `VaultSessionProvider`, `useVaultSession`, `useVaultUnlocked`, `useVaultLockState`
- `resolveVaultClientStatus`, `useVaultClientStatus`

## Published npm tarball includes

`dist/`, `vault-admin.css`, `README.md`, `CHANGELOG.md`, `AGENTS.md`, `LICENSE`, security/architecture docs, `API_REFERENCE.md`, `docs/`

## Explicitly out of scope (not shipped)

- Account authentication / OAuth / sessions for users
- Database, API routes, persistence adapters (package exports override helpers only; apps implement storage)
- Email / SMTP / notification flows
- Product-specific payload schemas on the default entry
- Automatic npm publish on merge or tag
- **`apps/consumer-demo/`** — local Next.js reference app in the git repo only (not in npm tarball); mounts all vault admin UI pages at `/admin/vault/*`, persists admin overrides in Postgres, exposes `/api/vault/admin/config`

## Planned / not yet shipped

- Consumer demo: vault setup and unlock flows (custom app UI — not exported as pages from vault-core)
