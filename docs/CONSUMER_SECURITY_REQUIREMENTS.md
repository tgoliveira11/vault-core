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
  or `unlockWithPasskeyPrfEnvelope` with **`withVaultUnlockRateLimit()`** (or equivalent) — not only
  `VaultUnlockPanel` / `VaultDockQuickUnlock`. UI rate limits are bypassable via DevTools or direct
  API calls. Use action **`recovery_phrase`** for recovery-phrase unlock, KDF upgrade, and rotation
  flows that verify the phrase.
- [ ] Use **`readVaultUnlockReturnPath()`** / **`resolveVaultUnlockReturnPath()`** for post-unlock
  navigation — never pass raw `searchParams.get("next")` to the router.
- [ ] Keep **account login** and **vault unlock** as separate security domains.
- [ ] Validate decrypted vault JSON with **`decryptVaultPayloadWithSchema()`** and an app-owned Zod
  schema — do not trust ciphertext shape after schema migrations or tampering.

### 3. Locked vs unlocked access in application code

- [ ] **`VaultProtectedGate` is UX only** (blur + pointer blocking). It is not a security boundary.
- [ ] Before decrypting or rendering secrets, check **`useVaultUnlocked()`** / **`getSessionVaultKey()`**
  in application logic.
- [ ] Do not render decrypted vault payload in the React tree while locked; clear sensitive UI state on lock.
- [ ] Only pass **non-extractable** UVKs to **`unlockVaultSession()`** (keys from envelope unlock are non-extractable).

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
