# Consumer application security requirements

Mandatory integration rules for applications and AI agents adopting `@tgoliveira/vault-core`.
The package ships crypto primitives and optional React UI — **it does not replace app-level
authentication, transport security, or access control.**

Read this document together with [SECURITY.md](../SECURITY.md) and
[docs/IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md).

## Agent checklist (definition of done)

Before marking vault integration complete, verify every item below.

### 1. Server routes that touch vault metadata

- [ ] **Authenticate** every vault admin/config API (session, JWT, or equivalent).
- [ ] **Authorize** with RBAC — only trusted admin roles may read or mutate vault configuration.
- [ ] Call **`assertNoVaultPlaintextFields(body)`** on every JSON body that persists or relays vault
  records (envelopes, encrypted blobs, admin overrides). Reject with `4xx` on violation.
- [ ] Apply **`consumeVaultApiRateLimit()`** (or your own backend limiter) per client identity +
  route namespace. Do not rely on IP alone without a trusted reverse proxy.
- [ ] Never log request bodies that contain envelopes or decrypted payloads.

### 2. Client unlock flows

- [ ] Wrap **every** code path that calls `unlockWithPasswordEnvelope`, `unlockWithRecoveryEnvelope`,
  `unlockWithPasskeyPrfEnvelope`, `unlockWithPasskeyPrfEnvelopeCandidates`, or
  `createPasskeyPrfEnvelopeAfterIndependentAuthorization` with
  **`withVaultUnlockRateLimit()`** (or equivalent) — not only
  `VaultUnlockPanel` / `VaultDockQuickUnlock`. UI rate limits are bypassable via DevTools or direct
  API calls. Use action **`recovery_phrase`** for recovery-phrase unlock, KDF upgrade, and rotation
  flows that verify the phrase; use `password` or `recovery_phrase` for the independent authorization
  helper according to its authorization kind.
- [ ] Use **`readVaultUnlockReturnPath()`** / **`resolveVaultUnlockReturnPath()`** for post-unlock
  navigation — never pass raw `searchParams.get("next")` to the router.
- [ ] Keep **account login** and **vault unlock** as separate security domains.
- [ ] Keep each logical WebAuthn credential distinct from opaque browser bindings and PRF envelope
  variants. A binding is routing metadata, not an authentication factor or authorization grant.
- [ ] Use **`resolvePasskeyUnlockPlan({ intent: "explicit", ... })`** for the full unlock page so a
  synced credential remains usable without a browser binding. Restrict exact selection and WebAuthn
  auto-start to the `quick` plan. On `VaultUnlockPanel`, pass that plan through `quickPasskeyPlan` and
  use the separate `onQuickUnlockPasskey`; stale/missing bindings must not hide the explicit action.
- [ ] Scope bound credential requests fail closed. Use an explicit exact, allow-list, or discoverable
  selection and preserve stored transports unless a documented compatibility policy requires otherwise.
- [ ] Verify the WebAuthn assertion server-side before returning at most five active variants for that
  credential. Extract PRF output and match candidates only in the trusted client.
- [ ] Never send or log raw PRF output, a PRF hash, or WebAuthn PRF extension results. Call
  **`sanitizeWebAuthnResponseForServer()`** (or an equally strict app-owned serializer) before every
  registration/authentication request. Candidate results may contain only a matched opaque variant ID
  and the in-memory non-extractable UVK.
- [ ] On candidate no-match, preserve all variants and call
  **`createPasskeyPrfEnvelopeAfterIndependentAuthorization()`** with password/recovery before appending
  another variant. A session UVK, binding, or passkey alone must not authorize envelope creation,
  replacement, or deletion.
- [ ] Validate decrypted vault JSON with **`decryptVaultPayloadWithSchema()`** and an app-owned Zod
  schema — do not trust ciphertext shape after schema migrations or tampering.
- [ ] When emergency/duress mode is enabled, use **`unlockVaultWithPasswordRouting()`** /
  **`unlockVaultWithPasskeyRouting()`** (or **`unlockVaultWithPasskeyCandidateRouting()`** for
  variants) and **`decryptVaultPayloadForSession()`** — never decrypt the
  primary `encryptedBlob` while `emergencyModeActive` is set.
- [ ] If emergency/duress passkey candidate routing returns `no_match`, keep the vault locked and use
  password/recovery routing. Do not install or persist a compatibility result until a confirmed normal
  primary context.
- [ ] Persist **`emergencyModeActive`** server-side; hydrate with **`hydrateVaultEmergencyModeFromServer()`**
  on authenticated load. Clear the flag only through **`exitEmergencyMode()`** (primary recovery phrase).
- [ ] Rate-limit **`emergency_exit`** unlock action separately from password/passkey unlock.
- [ ] Wire dock **`onDuressSignalChange`** / long-press latch into passkey unlock orchestration.

### 3. Locked vs unlocked access in application code

- [ ] On multi-account/authenticated apps, call **`beginVaultSessionOperation(opaqueAccountId)`** at
  every outer unlock, setup/finalize, hydration/rotation, and passkey-management flow. Thread the same
  operation through package mutations and re-check it before app-owned state or persistence commits.
- [ ] After unlock commit, retain/capture the **`VaultSessionLease`** and validate it after awaited
  work and before saves/hydration state commits. Pass it to timer renewal APIs; do not use a stale
  lease's `vaultKey` without `assertVaultSessionLeaseCurrent()`.
- [ ] Call **`clearVaultSessionOwner()`** when logging out, removing an account, or losing resolved
  authenticated ownership. Do not reuse an operation after lock or account replacement.
- [ ] Treat **`VaultSessionOperationCancelledError`** as stale-flow control state, not a credential
  failure. Keep external callbacks authenticated and owner-scoped because client cancellation cannot
  undo a request already processed by a server.
- [ ] **`VaultProtectedGate` is UX only** (blur + pointer blocking). It is not a security boundary.
- [ ] Before decrypting or rendering secrets, check **`useVaultUnlocked()`** / **`getSessionVaultKey()`**
  in application logic.
- [ ] **Do not render decrypted vault payload in the React tree while locked** — use
  **`VaultSensitiveRegion`**, `lockedContentStrategy="unmount"` on the gate, or conditional rendering
  (`{unlocked ? <Secrets /> : null}`).
- [ ] Register **`registerVaultLockCleanup()`** or **`useOnVaultLocked()`** to clear app-owned state
  (React stores, TanStack Query caches, form fields) when `lockVaultSession()` runs.
- [ ] After lock, integration tests should pass **`assertNoVaultPlaintextInDocument()`** from
  `@tgoliveira/vault-core/testing` when using sentinel strings in fixtures.
- [ ] Only pass **non-extractable** UVKs to **`unlockVaultSession()`** (keys from envelope unlock are non-extractable).

**Anti-pattern:** Relying on blur/`inert` while keeping decrypted notes or form values mounted in the DOM.

**Recommended pattern:**

```tsx
import {
  VaultProtectedGate,
  VaultSensitiveRegion,
  useOnVaultLocked,
  useVaultUnlocked,
} from "@tgoliveira/vault-core/react";
import { registerVaultLockCleanup } from "@tgoliveira/vault-core/browser";

// Module-level store cleanup (non-React)
registerVaultLockCleanup(() => queryClient.removeQueries({ queryKey: ["vault-plaintext"] }));

function VaultNotesPage() {
  useOnVaultLocked(() => setLocalDraft(null));

  return (
    <VaultProtectedGate configured overlayBackground="...">
      <VaultSensitiveRegion lockedFallback={<p>Unlock the vault to view notes.</p>}>
        <DecryptedNotes />
      </VaultSensitiveRegion>
    </VaultProtectedGate>
  );
}
```

### 4. Browser hardening

- [ ] Deploy a **strict Content-Security-Policy** (`default-src 'self'`, `frame-ancestors 'none'`,
  `script-src` with **per-request nonces** and `'strict-dynamic'` — no `unsafe-inline` or `unsafe-eval`
  in production). XSS with an unlocked vault exposes the in-memory UVK via public browser APIs.
- [ ] Forward the nonce on the request (for example `x-nonce`) so your framework can tag inline scripts.
- [ ] Use **`inspectLocalStoragePrefix()`** / **`inspectIndexedDBPrefix()`** in security checks;
  treat **`unavailable`** as fail-closed.

### 5. Crypto profile and admin overrides

- [ ] Set **`VAULT_AAD_CONTEXT_VAULT`** and **`VAULT_AAD_CONTEXT_ENVELOPE`** at deploy time only.
  vault-core **does not** allow runtime admin overrides for AAD contexts (changing them breaks existing
  ciphertext).
- [ ] Do not expose admin override APIs without authentication, even in internal tools.

## Reference patterns

### Rate-limited unlock (required)

```ts
import { withVaultUnlockRateLimit, createVaultUnlockRateLimiterFromAdminConfig } from "@tgoliveira/vault-core";
import { unlockWithPasswordEnvelope } from "@tgoliveira/vault-core";

const unlockLimiter = createVaultUnlockRateLimiterFromAdminConfig(adminConfig);

export async function unlockUserVault(userId: string, password: string) {
  return withVaultUnlockRateLimit(unlockLimiter, userId, "password", async () => {
    const envelope = await loadPasswordEnvelope(userId);
    const key = await unlockWithPasswordEnvelope(password, envelope, scope(userId), profile);
    await unlockVaultSession(key);
  });
}
```

### Protected admin config route (required)

```ts
import {
  assertNoVaultPlaintextFields,
  buildVaultRateLimitHttpResponse,
  consumeVaultApiRateLimit,
  validateVaultAdminOverride,
} from "@tgoliveira/vault-core";

export async function POST(request: Request) {
  await requireAdminSession(request);

  const limited = consumeVaultApiRateLimit(apiLimiter, "vault-admin-config", clientKey(request));
  if (!limited.allowed) {
    const response = buildVaultRateLimitHttpResponse(limited);
    return Response.json(response.body, { status: response.status, headers: response.headers });
  }

  const body = await request.json();
  assertNoVaultPlaintextFields(body);
  validateVaultAdminOverride(body.key, body.value);
  // ...
}
```

### Return path (required)

```ts
import { readVaultUnlockReturnPath } from "@tgoliveira/vault-core/react";

const returnPath = readVaultUnlockReturnPath(searchParams, { defaultPath: "/vault" });
router.push(returnPath);
```

### CSP with nonce (production — required)

Generate a fresh nonce per HTML request in middleware, set CSP on the response, and forward the nonce
on the request so Next.js (or your framework) can tag hydration scripts:

```ts
// middleware.ts (sketch — see apps/consumer-demo/src/lib/content-security-policy.ts pattern)
const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
const requestHeaders = new Headers(request.headers);
requestHeaders.set("x-nonce", nonce);

const response = NextResponse.next({ request: { headers: requestHeaders } });
response.headers.set(
  "Content-Security-Policy",
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join("; ")
);
return response;
```

Reference implementation: `apps/consumer-demo/src/lib/content-security-policy.ts` and
`apps/consumer-demo/src/middleware.ts`.

### Runtime payload schema (recommended)

```ts
import { z } from "zod";
import { decryptVaultPayloadWithSchema } from "@tgoliveira/vault-core";

const vaultNotesSchema = z.object({
  version: z.literal(1),
  notes: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      body: z.string(),
      createdAt: z.string().datetime(),
    })
  ),
});

const payload = await decryptVaultPayloadWithSchema(
  encryptedBlob,
  vaultKey,
  scope,
  profile,
  vaultNotesSchema
);
```

Throws **`VaultPayloadValidationError`** when decrypted JSON fails schema validation.

### Rate-limited recovery phrase flows (required)

Use the **`recovery_phrase`** action for unlock, KDF upgrade, and rotation paths that verify the phrase:

```ts
return withVaultUnlockRateLimit(limiter, userId, "recovery_phrase", async () => {
  await unlockWithRecoveryEnvelope(phrase, envelope, scope, profile);
});
```

## Consumer demo

`apps/consumer-demo` implements a **mock admin email gate** (`DEMO_ADMIN_EMAIL`) for local
demonstration only. Demo admin sessions are HMAC-signed with expiry, login is rate-limited server-side,
API rate-limit keys combine multiple request headers (do not trust `X-Forwarded-For` alone), production
CSP uses per-request nonces (no `unsafe-inline` on scripts), and decrypted payloads use
`decryptVaultPayloadWithSchema()` with `demoVaultPayloadSchema` in `vault-demo-crypto.ts`.
Copy the **patterns** above for production — replace mock auth with your identity provider and hardened CSP.
