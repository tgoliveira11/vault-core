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
  API calls.
- [ ] Use **`readVaultUnlockReturnPath()`** / **`resolveVaultUnlockReturnPath()`** for post-unlock
  navigation — never pass raw `searchParams.get("next")` to the router.
- [ ] Keep **account login** and **vault unlock** as separate security domains.

### 3. Locked vs unlocked access in application code

- [ ] **`VaultProtectedGate` is UX only** (blur + pointer blocking). It is not a security boundary.
- [ ] Before decrypting or rendering secrets, check **`useVaultUnlocked()`** / **`getSessionVaultKey()`**
  in application logic.
- [ ] Do not render decrypted vault payload in the React tree while locked.

### 4. Browser hardening

- [ ] Deploy a **strict Content-Security-Policy** (`default-src 'self'`, `frame-ancestors 'none'`,
  minimal `script-src`). XSS with an unlocked vault exposes the in-memory UVK via public browser APIs.
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
    unlockVaultSession(key);
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

## Consumer demo

`apps/consumer-demo` implements a **mock admin email gate** (`DEMO_ADMIN_EMAIL`) for local
demonstration only. Copy the **patterns** above for production — replace mock auth with your
identity provider and hardened CSP.
