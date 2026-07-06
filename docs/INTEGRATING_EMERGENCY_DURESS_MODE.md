# Integrating Emergency / Duress Mode

Consumer integration guide for **Emergency / Duress Mode** in `@tgoliveira/vault-core`. Use this
document to add coercion-resistant decoy vault unlock to an existing vault integration.

**Related docs**

| Doc | Purpose |
| --- | --- |
| [ADR 0001](./adr/0001-emergency-duress-mode.md) | Threat model, crypto model, security invariants |
| [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) §20 | Short API snippets |
| [API_REFERENCE.md](../API_REFERENCE.md) | Export list and preconditions |
| [CONSUMER_SECURITY_REQUIREMENTS.md](./CONSUMER_SECURITY_REQUIREMENTS.md) §2 | Mandatory checklist items |
| [apps/consumer-demo](../apps/consumer-demo/) | Runnable reference wiring |

**Prerequisites:** vault-core **1.2.0+** (or the release that ships emergency mode — see
[CHANGELOG.md](../CHANGELOG.md) `[Unreleased]` / release notes). Primary vault setup, session
provider, and at least one unlock path (password) must already work.

---

## 1. What you are building

Emergency mode lets a user under coercion unlock a **cryptographic decoy vault** (honey content)
instead of the real vault. The coercer sees plausible ciphertext and UI; the real UVK and primary
`encryptedBlob` never enter the session.

| Activation (user-facing) | Package behavior |
| --- | --- |
| **Password:** any password containing a user-configured **duress sequence** | Routes to decoy `passwordEnvelope` |
| **Passkey:** **long press ≥ 1 s** on dock handle or passkey button, then successful PRF ceremony | Routes to decoy passkey envelope (or primary PRF envelope when decoy passkey not enrolled — see §7) |
| **Reload while emergency active** | Server flag `emergencyModeActive` re-pins routing to decoy |

**Exit:** primary recovery phrase (12 or 24 words) via `exitEmergencyMode()`. When the user
configured a recovery email, your app must also verify an email OTP **before** calling exit (vault-core
accepts `emailOtpRequired` + `emailOtp` as a gate parameter; it does not send email).

Normal vault password **does not** exit emergency mode.

---

## 2. Package vs consumer responsibility

| Concern | `@tgoliveira/vault-core` | Your application |
| --- | --- | --- |
| Decoy UVK, envelopes, `encryptedBlob` | ✓ (`createDecoyVaultSetup`) | |
| Duress sequence detection (constant-time) | ✓ (`containsDuressSequence`) | Store sequence for sync |
| Unlock routing (primary vs decoy) | ✓ (`unlockVaultWith*Routing`) | Call from every unlock path |
| Session mode (`normal` \| `emergency`) | ✓ (browser session) | Hydrate from server on load |
| Refuse primary decrypt in emergency | ✓ (`decryptVaultPayloadForSession`) | Use this helper everywhere |
| Exit via primary recovery phrase | ✓ (`exitEmergencyMode`) | Exit UI + clear server flag |
| Honey / decoy JSON payload content | | ✓ |
| Decoy enrollment UI (sequence, duress password, honey) | | ✓ |
| Server DB columns + API for metadata | | ✓ |
| `emergencyModeActive` persistence | | ✓ |
| Email OTP send/verify | | ✓ |
| Coercer-facing UI (no obvious “DECOY” banner) | | ✓ |
| Dock long-press + 2 s auto-start | ✓ (React components + hook) | Wire callbacks into unlock |
| Rate limits on unlock + exit | ✓ (primitives) | Apply on every path |

**Rule of thumb:** ciphertext, routing, and session mode stay in the package. Users, routes, honey
content, email, and product copy stay in your app.

---

## 3. Data model

### 3.1 Persisted vault record (client/server ciphertext)

Extend your existing vault row/document with an optional `decoy` field:

```ts
import {
  vaultSetupWithDecoySchema,
  type VaultSetupWithDecoy,
} from "@tgoliveira/vault-core";

// After primary setup + decoy enrollment:
const record: VaultSetupWithDecoy = vaultSetupWithDecoySchema.parse({
  cryptoVersion: "vault-v1",
  encryptedBlob,           // primary payload
  passwordEnvelope,
  recoveryEnvelope,
  passkeyPrfEnvelope,
  decoy: {
    cryptoVersion: "vault-v1",
    encryptedBlob: decoyBlob,       // honey payload
    passwordEnvelope: duressPasswordEnvelope,
    recoveryEnvelope: decoyRecoveryEnvelope,
    passkeyPrfEnvelope: decoyPasskeyEnvelope ?? null, // optional
  },
});
```

Run `assertNoVaultPlaintextFields()` on every persistence route (primary **and** decoy fields).

### 3.2 Server metadata (non-secret)

Store separately from ciphertext (user row, vault status API, etc.):

```ts
import { vaultEmergencyServerMetadataSchema } from "@tgoliveira/vault-core";

const metadata = vaultEmergencyServerMetadataSchema.parse({
  emergencyModeActive: false,
  decoyConfigured: true,
  duressSequence: "er34_",              // signal, not a secret key
  emergencyModeEnteredAt: null,
  emergencyExitEmailRequired: false,    // when true, require OTP before exit
});
```

Extend your existing vault status snapshot for React:

```ts
import type { VaultServerStatusSnapshot } from "@tgoliveira/vault-core/react";

const serverStatus: VaultServerStatusSnapshot = {
  configured: true,
  hasPasskeyPrfEnvelope: true,
  passkeyUnlockAvailableOnThisDevice: true,
  emergencyModeActive: metadata.emergencyModeActive,
  decoyConfigured: metadata.decoyConfigured,
};
```

**Suggested SQL columns** (consumer-owned migration):

```sql
ALTER TABLE vault_user_settings ADD COLUMN emergency_mode_active BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vault_user_settings ADD COLUMN emergency_mode_entered_at TIMESTAMPTZ;
ALTER TABLE vault_user_settings ADD COLUMN duress_sequence TEXT;
ALTER TABLE vault_user_settings ADD COLUMN decoy_configured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vault_user_settings ADD COLUMN emergency_exit_email_required BOOLEAN NOT NULL DEFAULT FALSE;
```

---

## 4. Phased integration

### Phase 0 — Readiness

- [ ] Pin compatible vault-core version; review CHANGELOG emergency section.
- [ ] Primary vault unlock, lock, and `VaultSessionProvider` work.
- [ ] `withVaultUnlockRateLimit` on password, recovery, and passkey paths.
- [ ] Skim [ADR 0001](./adr/0001-emergency-duress-mode.md) threat model.

### Phase 1 — Server metadata + hydration

On authenticated app load (before any unlock):

```ts
import { hydrateVaultEmergencyModeFromServer } from "@tgoliveira/vault-core/browser";

const snapshot = await fetchVaultStatus(); // your API
hydrateVaultEmergencyModeFromServer(Boolean(snapshot.emergencyModeActive));
```

When `emergencyModeActive` is true, the session is **pinned** to decoy routing even before UVK is
loaded. The user must unlock again (decoy path) to see honey content.

**Reference:** `apps/consumer-demo/src/lib/vault-demo-emergency-store.ts`,
`hydrateDemoEmergencyFromServer()` in `vault-demo-crypto.ts`, `Providers` effect.

### Phase 2 — Decoy enrollment (trusted session)

Only while the real vault is unlocked with primary UVK:

```ts
import { createDecoyVaultSetup, vaultSetupWithDecoySchema } from "@tgoliveira/vault-core";

const { decoy } = await createDecoyVaultSetup({
  duressPassword,      // must contain duressSequence (validated at enrollment)
  duressSequence,
  honeyPayload,        // your app JSON — notes, entries, etc.
  scope,
  profile,
  recoveryWordCount: 12, // or 24
});

await saveVaultRecord(vaultSetupWithDecoySchema.parse({ ...existingRecord, decoy }));
await saveEmergencyMetadata({
  decoyConfigured: true,
  duressSequence,
  emergencyModeActive: false,
  emergencyExitEmailRequired: userWantsEmailExit,
});
```

Educate users:

- **Primary trigger:** any password containing the sequence (not necessarily a dedicated short PIN).
- **Secondary trigger:** long press on passkey button or dock handle before passkey unlock.
- Honey content should look believable (not an empty vault).

**Reference:** `DecoyEnrollmentSection` in consumer-demo settings.

### Phase 3 — Password unlock routing

Replace direct `unlockWithPasswordEnvelope` + `unlockVaultSession` with:

```ts
import {
  unlockVaultWithPasswordRouting,
  getSessionVaultKey,
} from "@tgoliveira/vault-core/browser";
import { decryptVaultPayloadForSession } from "@tgoliveira/vault-core";

await unlockVaultWithPasswordRouting({
  record,
  password,
  duressSequence: metadata.duressSequence,
  emergencyModeActive: metadata.emergencyModeActive,
  scope,
  profile,
  onEmergencyEntered: async () => {
    await persistEmergencyModeActive(true); // atomic server update
  },
});

const payload = await decryptVaultPayloadForSession({
  record,
  vaultKey: getSessionVaultKey()!,
  scope,
  profile,
  schema: appPayloadSchema,
});
```

Apply on **every** password unlock path: full unlock page, dock, admin re-auth, etc.

Rate limit:

```ts
await withVaultUnlockRateLimit(limiter, scopeKey, "password", () => /* ... */);
```

### Phase 4 — Passkey unlock routing

```ts
import { unlockVaultWithPasskeyRouting } from "@tgoliveira/vault-core/browser";

await unlockVaultWithPasskeyRouting({
  record,
  prfOutput,
  duressSignaled, // from dock long-press latch
  emergencyModeActive: metadata.emergencyModeActive,
  scope,
  profile,
  onEmergencyEntered: async () => {
    await persistEmergencyModeActive(true);
  },
});
```

Pass `duressSignaled: true` when the user long-pressed (≥ 1 s) on the passkey button or dock handle
before/during the ceremony.

Rate limit action key: `"passkey_prf"`.

### Phase 5 — Dock integration

```tsx
import { VaultStatusDock, VaultDockQuickUnlock } from "@tgoliveira/vault-core/react";

const duressRef = useRef(false);

<VaultStatusDock
  serverStatus={serverStatus}
  passkeyAutoStartDelayMs={2000}   // default; allows 1 s handle long-press before auto-start
  onDuressSignalChange={(signaled) => {
    duressRef.current = signaled;
  }}
  renderQuickUnlock={({
    bindAutoStartPasskey,
    duressSignaled,
    resetDuressSignal,
    /* ... */
  }) => (
    <VaultDockQuickUnlock
      bindAutoStartPasskey={bindAutoStartPasskey}
      duressSignaled={duressSignaled}
      resetDuressSignal={resetDuressSignal}
      onDuressSignalChange={(signaled) => {
        duressRef.current = signaled;
      }}
      onUnlockPasskey={async () => {
        await unlockWithPasskey({ duressSignaled: duressRef.current });
      }}
      /* ... */
    />
  )}
/>
```

**Behavior**

| Gesture | Result |
| --- | --- |
| Short click expand → wait 2 s → auto passkey | Normal unlock |
| Long press handle ≥ 1 s before auto-start | `duressSignaled` latched → decoy after PRF |
| Long press passkey button ≥ 1 s → passkey | Decoy after PRF |

For custom unlock UIs (full page passkey button):

```tsx
import { useLongPressDuressSignal } from "@tgoliveira/vault-core/react";

const { bind, duressSignaled, resetDuressSignal } = useLongPressDuressSignal({
  thresholdMs: 1000,
});

<button {...bind()} onClick={() => unlockPasskey({ duressSignaled })}>
  Unlock with passkey
</button>
```

**Reference:** `vault-status-dock-client.tsx` in consumer-demo.

### Phase 6 — Save payload while emergency

When the user edits honey content, persist to the **decoy** blob only:

```ts
import { isVaultEmergencyMode } from "@tgoliveira/vault-core/browser";

const encryptedBlob = await encryptVaultPayload(payload, vaultKey, scope, profile);

if (isVaultEmergencyMode() && record.decoy) {
  await saveVaultRecord({
    ...record,
    decoy: { ...record.decoy, encryptedBlob },
  });
} else {
  await saveVaultRecord({ ...record, encryptedBlob });
}
```

Or rely on `decryptVaultPayloadForSession` + your existing save helper if it already branches on
session mode.

### Phase 7 — Exit emergency mode

Dedicated screen (neutral copy — not “panic mode” in coercer-visible chrome):

```ts
import { exitEmergencyMode } from "@tgoliveira/vault-core/browser";

// 1. Consumer verifies email OTP when configured (your SMTP/API)
if (metadata.emergencyExitEmailRequired && !verifiedOtp) {
  throw new Error("Email verification required");
}

// 2. vault-core verifies primary recovery phrase
await withVaultUnlockRateLimit(limiter, scopeKey, "emergency_exit", () =>
  exitEmergencyMode({
    recoveryPhrase,
    emailOtp: verifiedOtp,
    emailOtpRequired: metadata.emergencyExitEmailRequired,
    scope,
    profile,
    primaryRecoveryEnvelope: record.recoveryEnvelope,
  })
);

// 3. Clear server flag; session is locked, mode returns to normal
await persistEmergencyModeActive(false);
```

User must perform a **normal** unlock to access the real vault.

**Reference:** `/vault/emergency-exit` in consumer-demo.

### Phase 8 — Client status and UX

```ts
import { resolveVaultClientStatus } from "@tgoliveira/vault-core/react";

const status = resolveVaultClientStatus({
  configured: true,
  unlocked: isUnlocked,
  serverStatus,
  /* ... */
});
// "emergency_locked" | "emergency_unlocked" when applicable
```

- Do not show obvious decoy indicators to a coercer.
- Optional subtle affordance for the legitimate user (settings toggle) is app-owned.
- Wire `useOnVaultLocked()` / `registerVaultLockCleanup()` to clear honey plaintext from React state.

### Phase 9 — Testing

```ts
import {
  assertVaultSessionMode,
  createPrimaryDecoyVaultFixture,
  HONEY_VAULT_SENTINEL_NOTE,
  PRIMARY_VAULT_SENTINEL_NOTE,
} from "@tgoliveira/vault-core/testing";
```

**Minimum integration tests**

| Case | Expect |
| --- | --- |
| Password with duress sequence | `getVaultSessionMode() === "emergency"`, honey payload |
| Password without sequence | Normal payload |
| Long-press passkey | Emergency + honey |
| Short passkey | Normal |
| Reload with `emergencyModeActive: true` | Still decoy routing |
| Normal password while emergency active | Stays emergency / honey |
| `exitEmergencyMode` + primary recovery | Flag cleared, locked, normal mode |
| Wrong recovery on exit | Fails, flag unchanged |
| Primary decrypt while emergency | `VaultEmergencyDecryptError` |

Use `assertNoVaultPlaintextInDocument()` after lock with sentinel strings.

---

## 5. Unlock routing reference

```ts
import { resolveVaultUnlockTarget } from "@tgoliveira/vault-core";

resolveVaultUnlockTarget({
  password,                    // password path only
  duressSequence,
  duressSignaled,              // passkey path only
  emergencyModeActive,
});
// → "primary" | "decoy"
```

Priority:

1. `emergencyModeActive` → always `decoy`
2. `duressSignaled` → `decoy`
3. Password contains `duressSequence` → `decoy`
4. Otherwise → `primary`

---

## 6. API quick reference

### Core (`@tgoliveira/vault-core`)

| Export | Use |
| --- | --- |
| `vaultSetupWithDecoySchema` | Parse persisted record with optional decoy |
| `vaultEmergencyServerMetadataSchema` | Parse server metadata |
| `createDecoyVaultSetup()` | Enrollment |
| `containsDuressSequence()` | Pre-check / validation |
| `resolveVaultUnlockTarget()` | Low-level routing (prefer browser helpers) |
| `decryptVaultPayloadForSession()` | Decrypt correct blob; blocks primary in emergency |
| `VaultEmergencyDecryptError` | Primary decrypt blocked |

### Browser (`@tgoliveira/vault-core/browser`)

| Export | Use |
| --- | --- |
| `getVaultSessionMode()` / `isVaultEmergencyMode()` | Session checks |
| `hydrateVaultEmergencyModeFromServer()` | App load |
| `unlockVaultWithPasswordRouting()` | Password unlock |
| `unlockVaultWithPasskeyRouting()` | Passkey unlock |
| `exitEmergencyMode()` | Recovery-gated exit |

### React (`@tgoliveira/vault-core/react`)

| Export | Use |
| --- | --- |
| `useLongPressDuressSignal` | Custom unlock UI |
| `VaultStatusDock` | `passkeyAutoStartDelayMs`, `onDuressSignalChange` |
| `VaultDockQuickUnlock` | Passkey button long-press |
| `VaultServerStatusSnapshot` | `emergencyModeActive`, `decoyConfigured` |
| `resolveVaultClientStatus` | `emergency_locked` / `emergency_unlocked` |

### Testing (`@tgoliveira/vault-core/testing`)

| Export | Use |
| --- | --- |
| `createPrimaryDecoyVaultFixture()` | Deterministic test pair |
| `assertVaultSessionMode()` | Session mode assertion |
| `HONEY_VAULT_SENTINEL_NOTE` / `PRIMARY_VAULT_SENTINEL_NOTE` | Leak detection |

---

## 7. Passkey decoy envelope (optional but recommended)

If the user enrolls passkey on the primary vault but **does not** create a decoy passkey envelope,
long-press passkey routing uses the **primary** `passkeyPrfEnvelope` bytes to unwrap the **decoy**
UVK envelope target — the PRF output is the same, but routing selects decoy ciphertext after
unlock.

For strongest separation, enroll passkey on the decoy record during decoy setup (same ceremony,
second envelope wrap). Document this in your enrollment UX when passkey is the primary unlock method.

---

## 8. Security checklist (definition of done)

Copy into your PR template; full list also in [CONSUMER_SECURITY_REQUIREMENTS.md](./CONSUMER_SECURITY_REQUIREMENTS.md).

- [ ] Decoy enrollment only while primary vault unlocked.
- [ ] `decoy` record validated with `vaultSetupWithDecoySchema` before persist.
- [ ] `emergencyModeActive` set atomically in `onEmergencyEntered`; cleared only after successful exit.
- [ ] `hydrateVaultEmergencyModeFromServer()` on every authenticated session start.
- [ ] All unlock paths use `unlockVaultWithPasswordRouting` / `unlockVaultWithPasskeyRouting`.
- [ ] All decrypt paths use `decryptVaultPayloadForSession`.
- [ ] Normal password does **not** call `exitEmergencyMode` or clear the server flag.
- [ ] `withVaultUnlockRateLimit(..., "emergency_exit", ...)` on exit flow.
- [ ] Email OTP verified by consumer before `exitEmergencyMode` when `emergencyExitEmailRequired`.
- [ ] Lock cleanup clears honey plaintext from app state and DOM.
- [ ] No vault passwords, recovery phrases, UVKs, or OTPs logged or sent to analytics.
- [ ] Coercer-facing UI does not advertise duress gestures in obvious help text.

---

## 9. Common mistakes

| Mistake | Why it fails |
| --- | --- |
| UI flag after real decrypt | Real UVK and plaintext remain in memory |
| Only dock wired, not full unlock page | Coercer navigates to `/vault/unlock` and sees real vault |
| Forgetting hydration on reload | Real password works after refresh |
| Clearing `emergencyModeActive` on lock | Reload bypasses decoy pin |
| Using decoy recovery phrase to exit | Exit requires **primary** recovery envelope |
| Skipping `onEmergencyEntered` | Server flag out of sync across devices |
| Immediate passkey auto-start (0 ms delay) | User cannot long-press handle in time |

---

## 10. Consumer-demo file map

| File | Role |
| --- | --- |
| `src/lib/vault-demo-emergency-store.ts` | Metadata persistence (localStorage stand-in for server) |
| `src/lib/vault-demo-crypto.ts` | Routing, decrypt, save, exit orchestration |
| `src/lib/vault-demo-honey-templates.ts` | Default honey note templates |
| `src/components/vault/decoy-enrollment-section.tsx` | Settings enrollment UI |
| `src/components/vault/vault-status-dock-client.tsx` | Dock + duress latch wiring |
| `src/components/vault/vault-unlock-client.tsx` | Full-page unlock routing |
| `src/components/vault/vault-emergency-exit-page.tsx` | Recovery + mock OTP exit |
| `src/app/vault/emergency-exit/` | Exit route |
| `src/components/providers.tsx` | Hydration on load |

Run the demo:

```bash
cd apps/consumer-demo && npm run dev
```

Configure decoy in **Vault settings**, then test sequence password and dock long-press passkey.

---

## 11. Migration from vault without decoy

Existing users have `vaultSetupEnvelopeFieldsSchema` records without `decoy`. Migration steps:

1. Deploy server columns with defaults (`decoyConfigured: false`).
2. Ship enrollment UI; do not require decoy for existing users.
3. Gate emergency features on `decoyConfigured === true`.
4. When user enrolls decoy, atomically PATCH vault record + metadata in one transaction.
5. Old clients without emergency support continue to parse primary-only records (backward compatible).

No automatic decoy creation — user must opt in during a trusted session.
