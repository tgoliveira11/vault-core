# Vault Core — consumer demo (local only)

Reference Next.js app for humans and AI agents implementing `@tgoliveira/vault-core`.
**Not included in the npm package tarball.**

## Prerequisites

Build the parent package first:

```bash
cd ../..
npm run validate
```

## Database (Docker)

From this directory:

```bash
npm run db:up
```

Postgres listens on **host port 5437** (container 5432):

| Setting | Value |
| --- | --- |
| User | `vault_demo` |
| Password | `vault_demo_dev` |
| Database | `vault_core_demo` |

Copy `.env.example` to `.env.local` (includes `DATABASE_URL` and `VAULT_ADMIN_ENABLED=true`).

## Run locally

```bash
npm install
npm run db:up
cp .env.example .env.local   # if not done yet
npm run dev
```

Open http://localhost:3013

## Routes

| Route | Source |
| --- | --- |
| `/dashboard` | Demo hub — session status, Postgres health |
| `/admin/vault` | `VaultAdminPanelPage` |
| `/admin/vault/config` | `VaultAdminConfigPage` |
| `/admin/vault/env-template` | `VaultAdminEnvTemplatePage` |
| `/admin/vault/crypto-policy` | `VaultAdminCryptoPolicyPage` |
| `/admin/vault/profile` | `VaultAdminProfilePage` |
| `/admin/vault/session` | `VaultAdminSessionPage` |
| `/admin/vault/password-policy` | `VaultAdminPasswordPolicyPage` |
| `/admin/vault/security` | `VaultAdminSecurityPage` |
| `/api/health` | Postgres connectivity check |

Admin pages are thin re-exports in `src/app/admin/vault/*` using `getVaultAdminPageProps()` from `src/lib/vault-admin-page-props.ts`.

## Package link

`"@tgoliveira/vault-core": "file:../.."`. Rebuild the parent package after changing vault-core source.

See also [docs/VAULT_ADMIN.md](../../docs/VAULT_ADMIN.md).
