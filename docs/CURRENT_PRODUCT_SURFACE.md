# Current product surface

Living inventory of what `@tgoliveira/vault-core` exposes today. Update this file when exports, admin screens, published artifacts, or shipped/planned status changes.

Last reviewed: **2026-07-01** (package version **0.3.0**, unreleased vault deletion helpers on branch)

## Package entry points (shipped)

| Export | Status | Purpose |
| --- | --- | --- |
| `@tgoliveira/vault-core` | Shipped | Crypto, envelopes, recovery, rotation, admin config helpers, validation |
| `@tgoliveira/vault-core/browser` | Shipped | Session lifecycle, auto-lock, storage inspection, PRF salt, recovery kit DOM |
| `@tgoliveira/vault-core/react` | Shipped | Session provider/hooks, client status, **vault admin UI pages** |
| `@tgoliveira/vault-core/testing` | Shipped | Plaintext sentinels and leak-detection helpers |
| `@tgoliveira/vault-core/vault-admin.css` | Shipped | Styles for vault admin pages and vault status dock |

## Consumer integration docs (shipped)

- [docs/CONSUMER_SECURITY_REQUIREMENTS.md](./CONSUMER_SECURITY_REQUIREMENTS.md) — mandatory checklist
  for apps and agents (auth/RBAC, rate limits, CSP, plaintext guards, unlock access control)

## Core capabilities (shipped)

- AES-256-GCM encrypted payloads with canonical AAD
- Argon2id password and recovery envelopes (`kdf-v1` legacy, `kdf-v2` recommended)
- Passkey PRF envelope wrap/unwrap (no WebAuthn ceremony)
- BIP39 12/24-word recovery phrases and recovery kit text
- Password rotation (`rotateVaultPassword`)
- Recovery phrase rotation (`rotateRecoveryPhrase`)
- Vault deletion after authorization (`deleteVaultAfterAuthorization`, `deleteVaultWithPasswordAuthorization` on browser entry)
- Auto-upgrade legacy KDF on unlock
- Plaintext rejection / sentinel validation
- Canonical crypto policy (`VAULT_CRYPTO_POLICY`) + CI guard

## Admin config helpers (shipped)

Exported from main entry — app maps `process.env`; package never reads env directly:

- `buildVaultAdminConfigFromEnv`, `listVaultAdminConfigEntries`
- `applyVaultAdminOverrides`, `validateVaultAdminOverride`, `VAULT_OVERRIDABLE_CONFIG_KEYS`, `VAULT_CONFIG_KEY_DEFINITIONS`
- Rate limiting: `createVaultUnlockRateLimiter()`, `createVaultApiRateLimiter()`, `VaultRateLimitError`, `withVaultUnlockRateLimit()`, `buildVaultRateLimitHttpResponse()`
- `VAULT_ADMIN_ENV_CATALOG`, `buildVaultEnvLocalTemplate`
- `resolveVaultAdminPaths`, `listVaultAdminScreens`, `DEFAULT_VAULT_ADMIN_PATHS`

Documented env groups: admin, crypto profile, session, password policy, rate limit, features. See [VAULT_ADMIN.md](./VAULT_ADMIN.md).

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

## Vault status dock (shipped)

Exported from `@tgoliveira/vault-core/react` (styles: `vc-status-dock-*` in `vault-admin.css`):

| Export | Purpose |
| --- | --- |
| `VaultStatusDock` | Header-attached collapsible lock/unlock handle and expanded panel |
| `VaultDockQuickUnlock` | Compact password or passkey primary unlock for the dock (auto-focus password, Enter submit, passkey auto-start) |
| `requestVaultDockExpand` / `subscribeVaultDockExpand` | Programmatic expand from locked-content gates |
| `useVaultAutoLockCountdown` / `useVaultAutoLockFraction` | Live auto-lock countdown and ring fraction |
| `resolveVaultDockPasskeyAvailability` | Passkey PRF quick-unlock eligibility |
| Copy/preference helpers | `getVaultStatusDockExpandedCopy`, collapse `localStorage` preference |

Apps inject routes (`unlockPath`, `buildUnlockHref`, `LinkComponent`), server status snapshot,
`renderQuickUnlock`, and unlock handlers — no product auth or note payloads in the package.

## Vault protected gate (shipped)

Exported from `@tgoliveira/vault-core/react` (styles: `vc-vault-protected-gate*` / `vc-vault-lock-overlay`
in `vault-admin.css`):

| Export | Purpose |
| --- | --- |
| `VaultProtectedGate` | Blur overlay on protected pages while locked; blocks interaction; Enter expands dock |
| `VaultLockOverlayExclude` | Marks header/nav chrome that stays above the overlay while locked |
| `shouldVaultLockOverlayExpandDock` | Enter-key guard (skips editable fields) |
| `computeVaultLockOverlayPanels` | Viewport overlay geometry minus exclusion holes |
| `useVaultLockOverlayPanels` | Hook that tracks exclusion rects for overlay panels |
| `VAULT_LOCK_OVERLAY_EXCLUDE_SELECTOR` | Query selector for registered exclusion regions |

Props: `configured?`, `redirectToSetup?`, `onRedirectToSetup?`, `onExpandDock?`, `loadingFallback?`,
`overlayClassName?`, `overlayBackground?` (sets `--vc-vault-lock-overlay-color`).
Redirect applies only when the vault is not configured — not when locked. Wrap app chrome in
`VaultLockOverlayExclude` (sibling above the gate); mount `VaultStatusDock` inside that excluded header.

**Security:** The overlay is visual UX only (blur + pointer blocking). Apps must check vault unlock
status in code (`useVaultUnlocked()`, session APIs) before decrypting or exposing secrets — do not
treat the overlay as a security boundary.

## Vault unlock page (shipped)

Exported from `@tgoliveira/vault-core/react` (styles: `vc-vault-unlock-*` in `vault-admin.css`):

| Export | Purpose |
| --- | --- |
| `VaultUnlockPanel` | Full-page unlock UI — password tab, recovery phrase tab, optional passkey button (explicit click; no auto-start by default) |
| `readVaultUnlockReturnPath` / `resolveVaultUnlockReturnPath` | Sanitize caller return paths from URL search params |
| `buildVaultUnlockHref` | Build unlock route href preserving return path (`next` query param by default) |
| `VAULT_UNLOCK_RETURN_QUERY_PARAM` | Default query key (`next`) |
| `useVaultUnlockPageNavigation` | Redirect to setup when unconfigured; redirect to return path after unlock |

Apps mount `VaultUnlockPanel` on a dedicated unlock route, wire crypto handlers
(`onUnlockPassword`, `onUnlockRecoveryPhrase`, optional `onUnlockPasskey`), and pass
`serverStatus` / `prfSupported` for passkey eligibility. Return URLs must be same-origin relative
paths only (`/vault`, not `//evil` or `https://…`).

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

- Consumer demo: vault setup and unlock flows (custom app UI — not exported as pages from vault-core;
  demo uses `VaultUnlockPanel` at `/vault/unlock` with `next` return-path support)
