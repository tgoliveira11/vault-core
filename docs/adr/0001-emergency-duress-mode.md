# ADR 0001: Emergency / Duress Mode

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-07-06 |
| **Authors** | vault-core maintainers (design review) |
| **Related** | [Issue breakdown](./0001-emergency-duress-mode-issues.md), [SECURITY.md](../../SECURITY.md), [IMPLEMENTATION_GUIDE.md](../IMPLEMENTATION_GUIDE.md) |

## Context

Users of consumer vault applications (e.g. SelahKeep) may face coercion to unlock a vault and reveal
sensitive content. A **duress / emergency mode** lets the user present plausible decoy content while
cryptographically isolating the real vault.

Prior design discussion established these constraints:

- Emergency mode must be a **cryptographic decoy vault** (separate envelope and UVK), not a UI flag
  applied after decrypting the real vault.
- **Primary activation:** any vault password that **contains a user-configured substring sequence**
  unlocks the decoy vault.
- **Secondary activation:** **long press (≥ 1 s)** on the passkey unlock button or the vault status
  dock handle during passkey unlock; the WebAuthn ceremony still succeeds but the session opens in
  emergency mode.
- **Exit:** recovery phrase (12 or 24 words) is required; when the user configured a recovery email,
  a consumer-owned **email OTP** is also required.
- **Normal unlock** (password or passkey without duress signal) opens the real vault.
- **Normal password does not exit emergency mode** — only the explicit exit flow clears it.
- **Emergency state persists** server-side so a page reload cannot bypass the decoy session.
- **vault-core** owns crypto, session mode, and detection APIs; the **consumer** owns honey/decoy
  payload content, email OTP delivery, and presentation UX.

Today, vault-core exposes a single vault record (`encryptedBlob` + envelopes), session APIs that
track only `locked` / `unlocked`, and a status dock with immediate passkey auto-start on expand
(see `VaultStatusDock`, `VaultDockQuickUnlock`). There is no session mode dimension or decoy
envelope family.

## Threat model

### In scope

| Threat | Mitigation |
| --- | --- |
| Coerced unlock at gunpoint | User enters duress password or long-press passkey; attacker sees decoy ciphertext only |
| Attacker reloads page after duress unlock | Server-persisted `emergencyModeActive` re-applies decoy routing on next session |
| Attacker tries real password while emergency active | Session remains pinned to decoy UVK until recovery-based exit |
| Timing side channel on duress sequence check | Constant-time substring detection in vault-core |
| Decoy indistinguishable from “empty vault” | Consumer honey content; crypto layer provides separate UVK and payload |

### Out of scope (non-goals)

- Hiding that emergency mode exists from a forensic analyst with full device access
- Protecting against malware that keylogs passwords before duress routing
- Server-side coercion detection or law-enforcement workflows
- Automatic wipe or destruction of the real vault on duress (explicit non-goal)
- Account-login duress (account auth remains a separate domain per [SECURITY.md](../../SECURITY.md))
- vault-core shipping email/SMTP (consumer-owned, per [ARCHITECTURE.md](../../ARCHITECTURE.md))

### Assumptions

- The user configures the duress sequence and decoy vault during a trusted, unlocked session.
- The duress sequence is a **signal**, not a secret key; security rests on the decoy envelope
  password (which contains the sequence) and separate decoy UVK.
- Recovery phrase remains offline and is not available to a casual coercer.

## Decision

Implement **Emergency / Duress Mode** as a first-class vault mode with a parallel decoy crypto
record, explicit activation signals, session pinning, and a recovery-gated exit.

### 1. Cryptographic model — decoy vault record

Extend the persisted vault record with an optional **decoy** (emergency) structure, validated by a
new schema sibling to `vaultSetupEnvelopeFieldsSchema`:

```ts
/** App-owned persisted record — sketch only; final names in API_REFERENCE.md */
export type VaultDecoyRecord = {
  cryptoVersion: "vault-v1";
  /** Separate UVK-wrapped payload (consumer honey content). */
  encryptedBlob: EncryptedVaultPayload;
  /** Argon2id envelope for duress password (must contain configured sequence at setup). */
  passwordEnvelope: PasswordEnvelope;
  /** Recovery envelope for decoy UVK — used only for emergency exit verification. */
  recoveryEnvelope: RecoveryPhraseEnvelope;
  /** Optional; same passkey PRF bytes wrap decoy UVK when consumer enrolls passkey on decoy. */
  passkeyPrfEnvelope?: PasskeyPrfEnvelope | null;
};

export type StoredVaultRecordWithDecoy = {
  /** Existing primary vault fields (unchanged). */
  cryptoVersion: "vault-v1";
  encryptedBlob: EncryptedVaultPayload;
  passwordEnvelope: PasswordEnvelope;
  recoveryEnvelope: RecoveryPhraseEnvelope;
  passkeyPrfEnvelope?: PasskeyPrfEnvelope | null;
  /** Present when user completed decoy enrollment. */
  decoy?: VaultDecoyRecord | null;
};
```

**Invariants:**

- Decoy UVK ≠ primary UVK (independently generated at enrollment).
- Decoy `encryptedBlob` uses the same app `VaultCryptoProfile` AAD contexts but a different UVK.
- Duress password envelope is created with the user-chosen duress password (validated to contain
  the configured sequence at enrollment).
- Real vault envelopes are never decrypted when emergency mode is active.

### 2. Activation signals

| Path | Signal | Unlock target |
| --- | --- | --- |
| **Password (primary)** | Entered password contains configured `duressSequence` (constant-time) | Decoy `passwordEnvelope` with full entered password |
| **Passkey (secondary)** | Long press ≥ 1000 ms on passkey button or dock handle before/during ceremony | Decoy UVK via passkey PRF envelope (or post-PRF routing — see below) |
| **Normal** | No sequence match; no long-press flag | Primary envelopes — **unless** session is emergency-pinned |

**Password routing:**

1. If `emergencyModeActive` (server + session) → always attempt decoy unlock paths only.
2. Else if `containsDuressSequence(password, config)` → decoy password envelope.
3. Else → primary password envelope.

**Passkey routing:**

1. If `emergencyModeActive` → decoy passkey envelope (when present) or PRF output routed to decoy UVK.
2. Else if long-press duress signal latched for this ceremony → decoy routing after successful PRF.
3. Else → primary passkey envelope.

Long-press detection is implemented in `@tgoliveira/vault-core/react` (dock + quick-unlock). The
consumer passes the latched signal into vault-core unlock orchestration APIs; vault-core does not
perform WebAuthn.

### 3. Passkey auto-start delay (dock)

To allow long-press on the dock handle before auto-start fires, change the dock passkey auto-start
from **immediate** (`triggerPasskeyAutoStart` on expand) to a **default 2000 ms delay** after
expand, configurable via prop (e.g. `passkeyAutoStartDelayMs`).

- Long-press on the handle (≥ 1000 ms) before the delay elapses sets the duress latch.
- Short click + expand still auto-starts passkey after 2 s (unchanged UX for non-duress users).
- Explicit passkey button supports independent long-press detection.
- `autoStartPasskey={false}` bypasses delay (consumer full-unlock page unchanged).

### 4. Session lifecycle and `emergency` mode

Add a session mode dimension alongside lock state:

```ts
export type VaultSessionMode = "normal" | "emergency";

/** Browser session — sketch */
export function getVaultSessionMode(): VaultSessionMode;
export function isVaultEmergencyMode(): boolean;
```

**Enter emergency mode** when:

- Decoy unlock succeeds (password sequence or passkey long-press path), or
- Server reports `emergencyModeActive: true` on hydration and consumer re-opens decoy UVK.

**While in emergency mode:**

- `getSessionVaultKey()` returns the **decoy UVK** only.
- `getVaultSessionMode()` returns `"emergency"`.
- Primary decrypt APIs refuse primary `encryptedBlob` even if callers pass the real UVK by mistake
  (vault-core validates mode + scope before decrypt).
- Normal password/passkey unlock without exit flow **does not** clear emergency mode or swap to
  primary UVK.

**Lock** (`lockVaultSession`) clears in-memory UVK but **does not** clear server emergency flag.

**Exit emergency mode** (dedicated API):

```ts
export type ExitEmergencyModeInput = {
  recoveryPhrase: string;
  /** Required when consumer configured recovery email for exit. */
  emailOtp?: string;
  scope: VaultScope;
  profile: VaultCryptoProfile;
  decoyRecoveryEnvelope: RecoveryPhraseEnvelope;
};

export async function exitEmergencyMode(input: ExitEmergencyModeInput): Promise<void>;
```

Flow:

1. Verify recovery phrase against **primary** `recoveryEnvelope` (not decoy) — proves legitimate user.
2. Consumer verifies email OTP out-of-band (vault-core accepts OTP only as a gate parameter; no SMTP).
3. Clear server `emergencyModeActive` (consumer API call).
4. `lockVaultSession()`; session mode returns to `"normal"` without holding any UVK.
5. User must perform a normal unlock to access the real vault.

Normal password alone **never** exits emergency mode.

### 5. Server persistence contract

vault-core documents a **consumer-owned** metadata extension; the package does not implement DB
migrations.

```ts
/** Non-secret server fields — sketch */
export type VaultEmergencyServerMetadata = {
  emergencyModeActive: boolean;
  /** ISO timestamp of last emergency entry; optional audit */
  emergencyModeEnteredAt?: string | null;
  /** Duress sequence is a signal, not a secret; may be server-stored for cross-device sync */
  duressSequence?: string | null;
  /** Whether decoy enrollment completed */
  decoyConfigured: boolean;
  /** Whether email OTP is required for exit */
  emergencyExitEmailRequired?: boolean;
};
```

Extend `VaultServerStatusSnapshot`:

```ts
export type VaultServerStatusSnapshot = {
  configured: boolean;
  hasPasskeyPrfEnvelope?: boolean;
  passkeyUnlockAvailableOnThisDevice?: boolean;
  emergencyModeActive?: boolean;
  decoyConfigured?: boolean;
};
```

Consumer responsibilities:

- Persist `emergencyModeActive` atomically when vault-core reports emergency entry.
- Clear flag only through the exit flow (recovery + optional OTP).
- On app load, pass snapshot to React helpers so dock/status reflect emergency state before unlock.
- Rate-limit emergency flag toggles and exit attempts.

### 6. API surface sketch (vault-core)

| Area | Proposed exports | Package |
| --- | --- | --- |
| Duress detection | `containsDuressSequence(password, sequence): boolean` (constant-time) | core |
| Decoy setup | `createDecoyVaultSetup(...)`, `vaultDecoyRecordSchema` | core |
| Unlock routing | `resolveVaultUnlockTarget(...)`, `unlockWithEmergencyRouting(...)` | core / browser |
| Session mode | `getVaultSessionMode`, `isVaultEmergencyMode`, `enterVaultEmergencyMode`, `exitEmergencyMode` | browser |
| Schemas | `vaultSetupWithDecoySchema`, `vaultEmergencyServerMetadataSchema` | core |
| Dock UX | `useLongPressDuressSignal`, `passkeyAutoStartDelayMs` prop, long-press on handle + button | react |
| Status | Extend `resolveVaultClientStatus` with emergency-aware copy hooks | react |
| Testing | `assertVaultSessionMode`, decoy fixtures | testing |

Exact names and signatures will be finalized in implementation PRs and `API_REFERENCE.md`.

### 7. Consumer (SelahKeep) responsibilities

| Area | Owner |
| --- | --- |
| Honey/decoy vault JSON payload | Consumer |
| Decoy enrollment UI (sequence picker, duress password, decoy content) | Consumer |
| Server columns / API for `emergencyModeActive` and `duressSequence` | Consumer |
| Email OTP generation, delivery, verification | Consumer |
| Emergency mode banner / subtle UX affordances | Consumer |
| Wire dock long-press → unlock orchestration | Consumer |
| Integration tests with sentinel honey content | Consumer |

### 8. Security invariants (must not regress)

1. Vault passwords, recovery phrases, UVKs, PRF output, and decrypted payloads **never** go to the
   server ([SECURITY.md](../../SECURITY.md)).
2. Decrypted vault state is **never** persisted to `localStorage` or IndexedDB.
3. Emergency mode **never** decrypts the primary `encryptedBlob` while active.
4. Duress sequence check is **constant-time** over the password length cap.
5. `unlockVaultSession()` only accepts **non-extractable** UVKs.
6. Session key changes use lifecycle APIs; no public direct UVK setters.
7. Account authentication and vault unlock remain **separate domains**.
8. `assertNoVaultPlaintextFields()` applies to all vault persistence routes including decoy records.
9. Exit emergency mode requires **primary recovery phrase** verification (12- or 24-word, matching
   enrollment).
10. Email OTP is **additive** when configured; vault-core does not weaken exit when OTP is omitted
    by misconfiguration — consumer must enforce `emergencyExitEmailRequired`.

## Consequences

### Positive

- Coercion resistance with plausible deniability via real ciphertext isolation.
- Clear split: vault-core crypto/session vs consumer content and OTP.
- Reload-safe emergency state via server flag.
- Dock long-press fits existing passkey-primary quick-unlock UX.

### Negative / trade-offs

- **Storage doubling:** optional decoy record increases server payload size.
- **Enrollment complexity:** users must set up decoy vault, sequence, and duress password.
- **Passkey duress without decoy passkey envelope:** if user has passkey but no decoy passkey
  envelope, long-press path must still work (PRF routing); document enrollment expectations.
- **2 s auto-start delay:** slightly slower passkey UX for all dock users (mitigated by explicit
  button and configurable delay).
- **Sequence in password:** users must remember a substring pattern, not a separate short PIN only.

### Follow-up

- Implementation issues: [0001-emergency-duress-mode-issues.md](./0001-emergency-duress-mode-issues.md)
- Update `CHANGELOG.md`, `API_REFERENCE.md`, `IMPLEMENTATION_GUIDE.md`, and
  `CURRENT_PRODUCT_SURFACE.md` when shipped.
- Consumer migration guide for SelahKeep (separate repo).

## Alternatives considered

| Alternative | Rejected because |
| --- | --- |
| UI-only decoy (flag after real decrypt) | Attacker with devtools or memory inspection could recover real payload |
| Single UVK with two payloads | Unlocking one key exposes both ciphertexts to a determined analyst |
| Duress wipes real vault | Irreversible data loss; out of scope |
| Exit via normal password | Violates requirement; coercer could force exit |
| vault-core ships email OTP | Violates package boundary ([ARCHITECTURE.md](../../ARCHITECTURE.md)) |
| Immediate passkey auto-start + parallel long-press | 1 s long-press cannot complete before auto-start; 2 s delay required |

## References

- [SECURITY.md](../../SECURITY.md) — secret boundaries
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — envelope and layer model
- [docs/IMPLEMENTATION_GUIDE.md](../IMPLEMENTATION_GUIDE.md) — consumer persistence contract
- [docs/CONSUMER_SECURITY_REQUIREMENTS.md](../CONSUMER_SECURITY_REQUIREMENTS.md) — unlock rate limits
- `src/react/status-dock/vault-status-dock.tsx` — dock expand and passkey auto-start
- `src/react/status-dock/vault-dock-quick-unlock.tsx` — passkey button and `bindAutoStartPasskey`
- `src/session/auto-lock.ts` — `unlockVaultSession`, lock lifecycle
- `src/validation/schemas.ts` — `vaultSetupEnvelopeFieldsSchema`
