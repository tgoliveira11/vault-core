# Adopting `@tgoliveira/vault-core` in Existing Apps

Guide for replacing a local, app-specific vault implementation with the reusable npm package [`@tgoliveira/vault-core`](https://www.npmjs.com/package/@tgoliveira/vault-core).

**Audience:** Future AI agents (Cursor and similar) performing incremental vault migrations without weakening security boundaries.

---

## Package name

| Name | Status |
| --- | --- |
| `@tgoliveira/vault-core` | **Official npm package name** (verified in `vault-core/package.json` and on npm) |
| `@tgoliveira/core-vault` | **Not published** — occasional shorthand; do not use in `package.json` imports |

Always install and import `@tgoliveira/vault-core`.

---

## 1. Purpose

This guide explains how to migrate an existing app from duplicated local vault crypto (AES-GCM helpers, Argon2id envelopes, recovery phrases, passkey PRF wrap/unwrap, session helpers) to `@tgoliveira/vault-core`.

The package provides **reusable vault primitives**, not product logic:

- User Vault Key (UVK) generation
- Password, recovery phrase, and passkey PRF envelopes
- Generic encrypted payload helpers (with profile-driven AAD)
- Recovery phrase utilities and recovery kit text helpers
- No-plaintext validation helpers
- Optional browser session helpers (`@tgoliveira/vault-core/browser`)
- Optional headless React session hooks (`@tgoliveira/vault-core/react`)

It does **not** replace your app’s note schemas, API routes, database layer, auth package, or UI.

---

## 2. When to use this guide

### Good candidates

- The app has local AES-GCM encrypt/decrypt helpers
- The app has local password, recovery phrase, or passkey PRF envelopes
- The app generates BIP39 recovery phrases client-side
- The app stores encrypted user-private payloads in the database
- The app has an explicit client-side vault unlock flow
- Account authentication and vault unlock are already separate concerns
- The app has (or needs) no-plaintext guarantees on API/server boundaries

### Not a good fit

- The app only needs account login (use `@tgoliveira/secure-auth` or your auth stack)
- The app does not encrypt user-private payloads on the client
- The app requires server-side plaintext processing of vault secrets
- The app cannot preserve existing encrypted vault records (no compatibility fixtures, no migration plan)
- You expect vault-core to own product payload schemas or Next.js routes

---

## 3. Package boundary

### Belongs in `@tgoliveira/vault-core`

| Area | Examples |
| --- | --- |
| Crypto primitives | AES-GCM, canonical AAD byte candidates, base64url encoding |
| Key generation | `createUserVaultKey()` |
| KDF | Argon2id with default params (`memory: 65536`, `iterations: 3`, `parallelism: 1`) |
| Envelopes | `createPasswordEnvelope`, `unlockWithPasswordEnvelope`, recovery and passkey PRF equivalents |
| Generic payload | `encryptVaultPayload` / `decryptVaultPayload` (profile + scope) |
| Recovery | `createRecoveryPhrase`, normalization, confirmation helpers |
| Recovery kit | `createRecoveryKitText`, browser download/print helpers |
| Validation | `assertNoVaultPlaintextFields`, AAD assert helpers |
| Errors | `VaultCoreError`, `RecoveryPhraseConfirmationError`, passkey PRF errors |
| Browser session | `@tgoliveira/vault-core/browser` — in-memory UVK, auto-lock, PRF salt helper |
| React (optional) | `@tgoliveira/vault-core/react` — headless session/status hooks |
| Testing | `@tgoliveira/vault-core/testing` — sentinels, scan helpers |

### Stays in the consuming app

| Area | Examples |
| --- | --- |
| Database | Drizzle/Prisma schemas, repositories, migrations |
| API routes | Vault init/setup/status, envelope persistence, note CRUD |
| Auth/session checks | `@tgoliveira/secure-auth`, NextAuth, middleware |
| App payload schemas | Note metadata/body, vault index shape, vault settings plaintext |
| Domain encryption | Per-note keys, category/tag crypto, app-specific AAD `field` values |
| UI | Setup wizard, unlock panels, recovery UX copy |
| Business rules | Unlock behavior, moderation, sharing |
| WebAuthn ceremony | Account passkey login (separate from PRF vault unlock) |
| Payload migrations | v1 → v2 index format, legacy recovery code support |

**Rule:** `vault-core` must not import or know your product domain (letters, notes, subscriptions, etc.).

---

## 4. Migration mental model

Treat this as a **strangler migration**, not a rewrite.

```text
1. Add package dependency
2. Freeze current app crypto profile/constants
3. Add compatibility fixtures from the existing local vault
4. Replace pure crypto helpers first
5. Replace envelope helpers
6. Replace recovery phrase helpers
7. Replace generic encrypted payload helpers (where field types align)
8. Keep app payload schemas local
9. Keep UI / API / routes mostly unchanged
10. Remove duplicated local code only after tests pass
```

During transition, keep **thin compatibility wrappers** in the app (e.g. `wrapVaultKeyForPassword` → delegates to `createPasswordEnvelope` with a frozen profile). This reduces churn and preserves import paths for tests.

---

## 5. App crypto profile

Every consuming app needs an explicit **`VaultCryptoProfile`** passed into vault-core envelope and payload helpers.

```ts
import type { VaultCryptoProfile } from "@tgoliveira/vault-core";

export const APP_VAULT_PROFILE: VaultCryptoProfile = {
  cryptoVersion: "vault-v1",
  aadContextVault: "my-app:vault:v1",
  aadContextEnvelope: "my-app:vault-envelope:v1",
};
```

### Rules

- **Profile preserves AAD compatibility** for *new* encryption using vault-core (`context` is embedded in the stored `aad` object).
- **Do not change** profile strings after production data exists unless you have a deliberate breaking migration.
- **Existing apps:** derive profile values from the current implementation. If legacy records have **no** `context` in stored `aad`, use the low-level `decryptField` compatibility path in an explicit migration, validate all available AAD fields, and re-encrypt with the configured context. High-level decrypt and unlock APIs intentionally reject missing contexts.
- **New apps:** pick stable, product-neutral strings before first production release.
- **Passkey PRF salt prefix** (if used) is app-specific and lives beside the profile, e.g. `buildPrfSaltBytes("my-app-passkey-prf-v1:", userId)` from `@tgoliveira/vault-core/browser`.

---

## 6. Import mapping

Use the **actual** vault-core API (see `API_REFERENCE.md`). Deprecated aliases exist for LiqSense-era names.

| Local concept | `@tgoliveira/vault-core` replacement |
| --- | --- |
| `generateUserVaultKey` / `generateAesKey` for UVK | `createUserVaultKey()` |
| `encryptField` for generic vault payload | `encryptVaultPayload(payload, key, scope, profile)` / `decryptVaultPayload(encrypted, key, expectedScope, profile)` **or** exported low-level `encryptField` / `decryptField` |
| `wrapVaultKeyForPassword` | `createPasswordEnvelope(vaultKey, password, scope, profile)` |
| `unwrapVaultKeyFromPassword` | `unlockWithPasswordEnvelope(password, envelope, expectedScope, profile)` |
| `generateRecoveryPhrase` | `createRecoveryPhrase({ wordCount: 12 \| 24 })` |
| `wrapVaultKeyForRecoveryPhrase` | `createRecoveryEnvelope(vaultKey, phrase, scope, profile)` |
| `unwrapVaultKeyFromRecoveryPhrase` | `unlockWithRecoveryEnvelope(phrase, envelope, expectedScope, profile)` |
| `wrapVaultKeyForPasskey` | `createPasskeyPrfEnvelope(vaultKey, prfOutput, scope, profile)` |
| `unwrapVaultKeyFromPasskey` | `unlockWithPasskeyPrfEnvelope(envelope, prfOutput, expectedScope, profile)` |
| `extractPasskeyPrfOutput` | `@tgoliveira/vault-core/browser` (also re-exported from passkey module) |
| Recovery kit text | `createRecoveryKitText` / `buildRecoveryKitContent` |
| Plaintext guard | `assertNoVaultPlaintextFields`, `validateNoPlaintextLeak` |
| In-memory session / auto-lock | `@tgoliveira/vault-core/browser` |
| React vault status hooks | `@tgoliveira/vault-core/react` |

### Entry points

| Import path | Use when |
| --- | --- |
| `@tgoliveira/vault-core` | Core crypto, envelopes, validation (safe for shared isomorphic code that does not touch `window`) |
| `@tgoliveira/vault-core/browser` | Session, countdown auto-lock (optional activity renewal), PRF salt, recovery kit DOM, storage namespace inspection |
| `@tgoliveira/vault-core/testing` | Test sentinels and plaintext scans |
| `@tgoliveira/vault-core/react` | Optional React hooks (peer: `react >= 18`) |

---

## 7. Compatibility fixture strategy

Create fixtures **before** replacing call sites.

### Required fixture categories

| Fixture | Proves |
| --- | --- |
| Existing password envelope unlock | UVK unwrap + Argon2id metadata round-trip |
| Existing recovery phrase envelope unlock | BIP39 + envelope |
| 12-word recovery unlock | If app supports 12-word phrases |
| 24-word recovery unlock | If app supports 24-word phrases |
| Legacy recovery **code** unlock | **Only if app still has vault-v1 `recovery_code` envelopes** |
| Encrypted vault index decrypt | App-specific blob still decrypts |
| Encrypted vault settings decrypt | App-specific blob still decrypts |
| Encrypted note payload decrypt | Stays app-local crypto; optional cross-check |
| Wrong AAD failure | Tampered `userId` / `resourceId` / `field` rejected |
| Wrong key failure | Bad password/phrase fails closed |
| Tampered ciphertext failure | Bit flip fails decrypt |
| No plaintext persistence sample | Server payload / storage scan tests |

### Random IV warning

AES-GCM uses a random 12-byte IV per encryption. **Do not** expect byte-identical ciphertext for newly generated blobs.

- Fixtures should store **real ciphertext from production or a captured setup** and assert **decryptability** and UVK equality.
- For deterministic **envelope** tests only, pass a fixed Argon2 salt into `createPasswordEnvelope` / `createRecoveryEnvelope` (see `vault-core/src/testing/fixtures/liqsense-compat.ts`).
- **Never** weaken production `crypto.getRandomValues` to make tests pass.

---

## 8. Step-by-step migration checklist

```text
[ ] Inspect local vault implementation (rg vault|encrypt|recovery|Argon2|PRF)
[ ] Classify files: core crypto | envelopes | recovery | session | app schema | API | UI | auth
[ ] Add @tgoliveira/vault-core to package.json (semver, not file: link for production)
[ ] Define APP_VAULT_PROFILE (frozen; match legacy AAD behavior via fixtures)
[ ] Define PRF salt prefix constant if passkey PRF is used
[ ] Capture golden encrypted blobs from staging or test setup into JSON fixtures
[ ] Port tests to unlock/decrypt fixtures with vault-core APIs
[ ] Add thin re-export wrappers in app (preserve old function names temporarily)
[ ] Migrate call sites incrementally (crypto → envelopes → recovery → session)
[ ] Keep app EncryptedPayload schema / extended AAD field enums local if needed
[ ] Keep API request/response contracts unchanged
[ ] Keep database columns unchanged unless a proven migration exists
[ ] Run app unit + security tests after each phase
[ ] Run vault-core boundary tests pattern in app (no server importing browser entry wrongly)
[ ] Delete duplicated local files only when all tests green
[ ] Update app docs and remove stale crypto ADRs that duplicate vault-core
```

---

## 9. Security checklist

Agents must verify **all** items before declaring migration complete:

```text
[ ] No vault password sent to server
[ ] No recovery phrase sent to server
[ ] No User Vault Key sent to server
[ ] No raw PRF output sent to server
[ ] No decrypted vault payload sent to server
[ ] No decrypted vault state in localStorage
[ ] No decrypted vault state in IndexedDB (note drafts may use encrypted or opaque storage — verify app policy)
[ ] No vault secrets in logs
[ ] No Math.random for cryptographic values
[ ] AAD bindings preserved (userId, resourceId, field; legacy key order still decrypts)
[ ] KDF params preserved for existing envelopes (Argon2id memory/iterations/parallelism/salt)
[ ] Existing encrypted payloads still decrypt
[ ] Account login does not unlock vault
[ ] Account password reset does not unlock vault
[ ] TOTP / OAuth login do not unlock vault
[ ] Account passkey login and passkey PRF vault unlock remain separate code paths
[ ] WebAuthn signatures are not used as encryption keys (only PRF extension output)
```

---

## 10. Test plan for consuming apps

### Functional

```text
[ ] Vault setup creates UVK and envelopes client-side
[ ] Password unlock restores UVK
[ ] Recovery phrase unlock restores UVK (12- and 24-word if supported)
[ ] Legacy recovery code unlock still works (if vault-v1 data retained)
[ ] Passkey PRF unlock works when supported
[ ] Vault settings round-trip encrypted
[ ] Vault index round-trip encrypted
[ ] Note encrypt/decrypt still works
[ ] Vault lock clears in-memory UVK and decrypted note caches
[ ] Auto-lock fires after inactivity
[ ] Server rejects plaintext vault secrets on all vault API routes
```

### Boundary / static

```text
[ ] Account session alone does not set session UVK (see vault-session-account-separation pattern)
[ ] App no longer duplicates argon2id/aes-gcm/envelope implementations covered by vault-core
[ ] @tgoliveira/vault-core/browser not imported from server-only modules
[ ] App-specific payload schemas remain in app repo, not in vault-core
[ ] API integration tests still pass with encrypted blobs only in POST bodies
```

Use `@tgoliveira/vault-core/testing` sentinels (`SENTINEL_VAULT_PASSWORD`, etc.) in security tests.

---

## 11. Case study: [letter-to-god](https://github.com/tgoliveira11/letter-to-god)

**Inspected:** Local clone at `/Users/thiago.oliveira/Projects/letter-to-god` (npm package name `letters-to-god`, product UI branded **SelahKeep**).

**Current state:** Full local vault stack under `src/lib/crypto-client/*`. **No** `@tgoliveira/vault-core` dependency yet. Account auth via `@tgoliveira/secure-auth`.

---

### 11.1 Current local vault inventory

| File / path | Current role | Migration classification | Recommended action |
| --- | --- | --- | --- |
| `src/lib/crypto-client/aes-gcm.ts` | AES-GCM encrypt/decrypt, UVK import/export | Reusable crypto helper | Replace with vault-core `encryptField` / `decryptField` + profile **or** keep thin wrapper for app-specific `field` enum |
| `src/lib/crypto-client/aad.ts` | Canonical AAD string + legacy byte candidates | Reusable crypto helper | Replace with vault-core `canonicalAadString` / `aadByteCandidates` behavior; note legacy LTG records omit `context` |
| `src/lib/crypto-client/aad-verify.ts` | Client-side AAD binding checks before decrypt | App-specific integration | **Keep local** (binds app field names) |
| `src/lib/crypto-client/encoding.ts` | base64url, string bytes | Reusable crypto helper | Remove after vault-core import |
| `src/lib/crypto-client/argon2id.ts` | Argon2id KDF + metadata | Reusable crypto helper | Replace with vault-core `kdf/argon2id` exports |
| `src/lib/crypto-client/vault-kdf.ts` | Vault password NFKC + Argon2id | Reusable crypto helper | Replace with vault-core password KDF (same NFKC normalization) |
| `src/lib/crypto-client/vault-envelope.ts` | Password + recovery phrase envelopes | Local envelope implementation | Replace with `createPasswordEnvelope` / `createRecoveryEnvelope` + profile wrappers |
| `src/lib/crypto-client/recovery-phrase.ts` | BIP39 12/24 phrase generate/validate/KDF | Local recovery helper | Replace with vault-core recovery exports |
| `src/lib/crypto-client/recovery-code.ts` | Legacy hyphenated recovery **code** (not BIP39), Argon2id + PBKDF2 fallback | Local recovery helper | **Do not migrate yet** — vault-core has no recovery-code envelope; keep for vault-v1 legacy |
| `src/lib/crypto-client/passkey-vault.ts` | PRF wrap/unwrap, passkey unlock errors | Local envelope implementation | Replace PRF wrap/unwrap with vault-core; keep WebAuthn ceremony in app |
| `src/lib/passkey/prf.ts` | PRF salt: `letters-passkey-prf-v1:{userId}` | App-specific integration | Keep constant; use `buildPrfSaltBytes` from vault-core/browser |
| `src/lib/crypto-client/vault.ts` | UVK session pointer, legacy recovery code wrap, vault version constants | Browser session + legacy | Split: UVK gen → vault-core; session → vault-core/browser or gradual merge with local note cache hooks |
| `src/lib/crypto-client/vault-session.ts` | Auto-lock, manual lock, activity timers | Browser session helper | Mostly replace with `@tgoliveira/vault-core/browser`; **keep** LTG-specific hooks (`clearNoteBodyCache`, `registerVaultBeforeAutoLock`) as app layer |
| `src/lib/crypto-client/vault-settings.ts` | Encrypted vault settings plaintext schema | App-specific payload schema | **Keep schema local**; encrypt via app wrapper (field `vault_settings` not in vault-core enum) |
| `src/lib/crypto-client/vault-index.ts` | Encrypted vault index (categories, tags, entries) | App-specific payload schema | **Keep schema local**; field `vault_index` aligns with vault-core enum — candidate for shared encrypt helper + profile later |
| `src/lib/crypto-client/vault-index-types.ts` | Index plaintext types | App-specific payload schema | **Keep local** |
| `src/lib/crypto-client/notes.ts` | Note metadata/body encryption, per-note keys | App-specific payload schema | **Keep local** (fields: `title`, `body`, `note_key`, etc.) |
| `src/lib/crypto-client/note-key.ts` | Per-note AES key wrap | App-specific integration | **Keep local** |
| `src/lib/crypto-client/note-drafts.ts` | Draft encryption (IndexedDB via `idb`) | App-specific integration | **Keep local**; verify drafts stay encrypted |
| `src/lib/crypto-client/vault-idb-cleanup.ts` | Purge legacy trusted-device IDB | App-specific integration | **Keep local** |
| `src/lib/validation/encrypted-payload.ts` | Zod schema, extended AAD `field` enum, KDF union incl. PBKDF2 | App-specific payload schema | **Keep local** (superset of vault-core schema) |
| `src/modules/vault/repositories/vault-repository.ts` | DB persistence for vaults/envelopes | App-specific API/server route | **Keep local** |
| `src/modules/vault/services/vault-service.ts` | Vault setup, status, recovery replacement | App-specific API/server route | **Keep local** |
| `src/modules/vault/services/vault-security-service.ts` | Security events | App-specific API/server route | **Keep local** |
| `src/app/api/vault/**` | REST routes (init, setup, status, envelopes, …) | App-specific API/server route | **Keep local** |
| `src/features/vault/**` | Setup wizard, unlock UI, status dock | App-specific UI | **Keep local** (update imports only) |
| `src/lib/secure-auth/**` | Account auth integration | Auth integration | **Keep separate** — do not couple vault-core to secure-auth |
| `src/server/services/passkey-login-vault-service.ts` | Account passkey login + optional PRF for vault | Auth + vault integration | **Keep local** — preserve login vs PRF-unlock separation |
| `src/test/unit/crypto-*.ts`, `src/test/security/vault-*.ts` | Golden paths, plaintext rejection | Tests | Port to fixtures + vault-core APIs incrementally |

---

### 11.2 Current crypto / profile assumptions

| Topic | letter-to-god value / behavior | Notes |
| --- | --- | --- |
| Product npm name | `letters-to-god` | GitHub repo: `letter-to-god` |
| Vault record versions | `vault-v1` (legacy), `vault-v2` (current setup) | Constants in `vault.ts` |
| Payload encryption version | `enc-v1`, alg `AES-GCM` | Matches vault-core |
| Vault-core crypto version | N/A today | vault-core uses `cryptoVersion: "vault-v1"` for profile (distinct from LTG `vault-v2` **record** version) |
| AAD shape (legacy) | JSON `{ field, resourceId, userId }` — **no `context` key** | Stored in DB jsonb as encrypted payloads |
| AAD canonical order | `{ field, resourceId, userId }` | vault-core uses `{ context, field, resourceId, userId }` for **new** encrypts |
| Argon2id defaults | `memory: 65536`, `iterations: 3`, `parallelism: 1`, `hashLength: 32`, `saltLength: 16` | Matches vault-core `DEFAULT_ARGON2ID_PARAMS` |
| Vault password normalization | NFKC (`vault-kdf.ts`) | Matches vault-core |
| Recovery phrase | BIP39 English, 12 or 24 words, lowercase normalized | Matches vault-core |
| Legacy recovery **code** | Custom English wordlist, hyphen-separated, ~17 words; PBKDF2 fallback in `recovery-code.ts` | **Not in vault-core** — vault-v1 only |
| Passkey PRF | Required for passkey vault envelopes; PRF salt prefix `letters-passkey-prf-v1:` | App-specific; not the LiqSense prefix |
| Envelope methods (v2) | `password`, `recovery_phrase`, optional `passkey_prf` | Aligns with vault-core method names |
| DB: `user_vaults` | `vault_version`, `encrypted_vault_settings`, `encrypted_vault_index` jsonb | Server stores ciphertext only |
| DB: `vault_envelopes` | `method`, `encrypted_vault_key`, `kdf_metadata`, `public_metadata` | Server stores ciphertext only |
| Session UVK | In-memory module variable in `vault.ts` | Not persisted to localStorage |
| UI preferences | `localStorage` keys like `selahkeep:vault-status-dock:collapsed` | Non-secret UI state only |
| Note drafts | IndexedDB (`idb`) — encrypted draft pattern | Security tests assert no plaintext drafts in localStorage |
| Recovery kit | **Not implemented** in LTG today | Optional future use of vault-core kit helpers |

**Uncertainties**

- No captured production golden blobs in repo yet — agents must add fixtures from a controlled setup run before deleting local crypto.
- Whether all live `vault-v2` envelopes omit `context` in stored `aad` should be confirmed against production/staging exports; decrypt tests must cover both with and without `context` if mixed generations exist.

---

### 11.3 Proposed letter-to-god crypto profile

Use this profile **only after fixtures prove** existing envelopes and payloads decrypt via vault-core. Adjust strings if inspection of live data shows embedded `context` values already in use (none found in local LTG encrypt paths).

```ts
import type { VaultCryptoProfile } from "@tgoliveira/vault-core";

/** Frozen before migration — do not edit after production cutover. */
export const LETTER_TO_GOD_VAULT_PROFILE: VaultCryptoProfile = {
  cryptoVersion: "vault-v1",
  aadContextVault: "letter-to-god:vault:v1",
  aadContextEnvelope: "letter-to-god:vault-envelope:v1",
};

/** Passkey PRF salt prefix — must match src/lib/passkey/prf.ts today. */
export const LETTER_TO_GOD_PRF_SALT_PREFIX = "letters-passkey-prf-v1:";
```

**Important:** New encryption with vault-core will embed `context` in stored `aad`. Legacy LTG ciphertext without `context` must still decrypt via `aadByteCandidates`. Do **not** re-encrypt production rows unless a migration project explicitly requires it.

---

### 11.4 Migration phases for letter-to-god

#### Phase A — Baseline local vault tests

| | |
| --- | --- |
| **Goal** | Green baseline before any dependency change |
| **Files** | None changed |
| **Tests** | `npm test` — especially `crypto-vault-envelope-ltg.test.ts`, `crypto-recovery-*.test.ts`, `vault-session.test.ts`, `src/test/security/vault-*` |
| **Rollback** | N/A |
| **Risk** | Low |

#### Phase B — Add vault-core dependency and profile

| | |
| --- | --- |
| **Goal** | Add `@tgoliveira/vault-core`, create `src/modules/vault/ltg-vault-profile.ts` (or similar) |
| **Files** | `package.json`, lockfile, new profile module |
| **Tests** | Typecheck; optional smoke import test |
| **Rollback** | Remove dependency |
| **Risk** | Low |

#### Phase C — Compatibility fixtures

| | |
| --- | --- |
| **Goal** | JSON fixtures for password envelope, recovery phrase envelope, vault index, vault settings from LTG setup flow |
| **Files** | `src/test/fixtures/vault-core-compat/*.json`, new vitest suite |
| **Tests** | Unlock/decrypt fixtures using vault-core APIs + `LETTER_TO_GOD_VAULT_PROFILE` |
| **Rollback** | Delete fixture tests only |
| **Risk** | Medium — blocks migration if decrypt fails |

#### Phase D — Replace pure crypto helpers

| | |
| --- | --- |
| **Goal** | Route `argon2id.ts`, `encoding.ts`, UVK generation through vault-core |
| **Files** | `src/lib/crypto-client/argon2id.ts`, `encoding.ts`, `vault.ts` (partial) |
| **Tests** | `crypto-argon2id.test.ts`, `crypto-aes-gcm.test.ts` |
| **Rollback** | Revert wrappers |
| **Risk** | Medium |

#### Phase E — Replace envelope / recovery helpers

| | |
| --- | --- |
| **Goal** | `vault-envelope.ts`, `recovery-phrase.ts`, `passkey-vault.ts` delegate to vault-core |
| **Files** | Envelope modules, `use-ltg-vault-setup.ts`, unlock panels |
| **Tests** | `crypto-vault-envelope-ltg.test.ts`, `crypto-passkey-vault.test.ts`, security setup tests |
| **Rollback** | Restore local envelope implementations |
| **Risk** | High — affects unlock |

#### Phase F — Generic payload encryption (partial)

| | |
| --- | --- |
| **Goal** | Use vault-core for `vault_index` encryption if wrappers align; keep `vault_settings` and notes on app-local `encryptField` until field enum extended or wrapped |
| **Files** | `vault-index.ts` (optional), **not** `notes.ts` in first pass |
| **Tests** | `vault-index.test.ts`, note tests unchanged |
| **Rollback** | Revert index wrapper |
| **Risk** | Medium |

#### Phase G — Keep UI / API / auth unchanged

| | |
| --- | --- |
| **Goal** | No route or schema changes; API still accepts same encrypted jsonb shapes |
| **Files** | Import paths only in features/modules |
| **Tests** | API route tests, `vault-setup-plaintext.test.ts` |
| **Rollback** | N/A |
| **Risk** | Low if Phase C passed |

#### Phase H — Remove duplicated local code

| | |
| --- | --- |
| **Goal** | Delete superseded files (`argon2id.ts`, duplicate aes helpers, etc.) |
| **Files** | Remove after zero references |
| **Tests** | Full `npm test` |
| **Rollback** | Git revert |
| **Risk** | Medium |

#### Phase I — Update docs

| | |
| --- | --- |
| **Goal** | Point ADRs/docs to vault-core; document profile + PRF prefix |
| **Files** | App `docs/` or ADRs |
| **Tests** | Doc lint if available |
| **Rollback** | N/A |
| **Risk** | Low |

**Explicitly out of scope for early phases:** removing `recovery-code.ts` (vault-v1 legacy), rewriting note encryption, changing `vault-v2` server schema.

---

### 11.5 What must remain in letter-to-god

- **Note domain:** encrypted note metadata/body, per-note keys, templates, reflection/lifecycle fields
- **Vault index plaintext schema:** categories, tags, entries, saved views, recently viewed
- **Vault settings plaintext:** `unlockBehavior`, `recoveryPhraseLength`
- **Spiritual / reflective copy:** setup prompts, recovery UX, SelahKeep branding
- **Routes:** `/vault/setup`, `/vault/unlock`, `/vault/recovery`, `/vault/settings`, `/vault/security`
- **Database:** `user_vaults`, `vault_envelopes`, `notes` tables
- **Auth checks:** secure-auth session, passkey **login** ceremony
- **Legacy recovery codes:** vault-v1 users until formally sunset
- **Security policies:** `plaintext-rejection`, passkey-vault plaintext guards, audit logging
- **App-specific AAD fields:** `title`, `body`, `note_key`, `vault_settings`, etc.

---

### 11.6 Agent-ready implementation prompt for letter-to-god

Copy the block below into a future Cursor agent task:

```text
Migrate letter-to-god (SelahKeep) from local src/lib/crypto-client vault code to @tgoliveira/vault-core incrementally.

Rules:
- Do NOT rewrite the app or change UX copy unnecessarily.
- Do NOT change database schemas or API contracts.
- Do NOT change existing encrypted database records without proven compatibility fixtures.
- Account login (secure-auth) must NOT unlock the vault.
- Vault password, recovery phrase, UVK, PRF output, and decrypted payloads must NEVER be sent to the server.
- Keep recovery-code.ts for vault-v1 legacy until explicitly removed.
- Keep notes.ts, note-key.ts, vault-settings schema, and extended EncryptedPayload Zod schema in the app.
- Freeze LETTER_TO_GOD_VAULT_PROFILE and LETTER_TO_GOD_PRF_SALT_PREFIX before replacing call sites.

Steps:
1. Read docs/ADOPTING_VAULT_CORE_IN_EXISTING_APPS.md in @tgoliveira/vault-core.
2. Phase A: run full test suite baseline.
3. Phase B: add @tgoliveira/vault-core dependency and profile module.
4. Phase C: capture golden fixtures from existing LTG setup tests; prove decrypt with vault-core.
5. Phases D–F: replace crypto/envelope/recovery/passkey-prf helpers via thin wrappers; keep app field-specific encryption local.
6. Phase G: leave UI/API/auth routes unchanged except imports.
7. Phase H: delete duplicated files only when tests pass.
8. Run npm test after each phase; run security tests under src/test/security/vault-*.

Reference repo: https://github.com/tgoliveira11/letter-to-god
Package: @tgoliveira/vault-core (NOT @tgoliveira/core-vault)
```

---

## 12. Common mistakes to avoid

| Mistake | Why it fails |
| --- | --- |
| Moving app payload schemas into vault-core | Breaks package boundary; couples release cycles |
| Coupling vault-core to secure-auth | Account auth ≠ vault unlock |
| Treating account login as vault unlock | Security boundary violation |
| Using password reset as vault recovery | Different secrets, different threat model |
| POSTing recovery phrase to API | Plaintext secret on server |
| Persisting decrypted payloads in localStorage/IDB | Expand XSS blast radius |
| Changing AAD profile strings casually | Bricks existing ciphertext |
| Changing KDF params without migration | Bricks existing envelopes |
| Using WebAuthn assertion signatures as AES keys | Wrong primitive — use PRF extension output only |
| Importing `@tgoliveira/vault-core/browser` from server modules | Breaks SSR / pulls `window` assumptions |
| Deleting local crypto before fixture tests pass | No rollback, production data at risk |
| Expecting deterministic AES-GCM ciphertext | IV is random — test decrypt, not bytes |
| Migrating legacy recovery **codes** to vault-core | Not supported — keep app-local until vault-v1 sunset |

---

## 13. Final agent handoff checklist

```text
[ ] Current vault implementation inventoried (files classified)
[ ] Crypto profile frozen and documented
[ ] PRF salt prefix documented (if applicable)
[ ] Compatibility fixtures added and passing
[ ] Security boundaries verified (§9)
[ ] Core imports migrated (UVK, KDF, envelopes, recovery, PRF wrap)
[ ] App-specific schemas stayed local
[ ] Server never receives plaintext vault secrets
[ ] Decrypted state not persisted in localStorage/IDB
[ ] Account auth and vault unlock tests still pass
[ ] Unit + security tests passing
[ ] Duplicated local crypto removed only after green CI
[ ] App docs / ADRs updated
[ ] Rollback path documented (git revert per phase)
```

---

## Related reading

- [`README.md`](../README.md) — install and exports
- [`docs/IMPLEMENTATION_GUIDE.md`](IMPLEMENTATION_GUIDE.md) — complete greenfield and operational workflows
- [`API_REFERENCE.md`](../API_REFERENCE.md) — function list
- [`SECURITY.md`](../SECURITY.md) — threat model
- [`ARCHITECTURE.md`](../ARCHITECTURE.md) — module layout
- [`MIGRATION_FROM_LIQSENSE.md`](../MIGRATION_FROM_LIQSENSE.md) — first consumer reference migration
- [`CHANGELOG.md`](../CHANGELOG.md) — versioned changes and upgrade impact
