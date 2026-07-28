# Adopting unified passkey unlock from 1.5.1

This release does not change the database model, PRF salt, AAD, credential ID, or existing envelope
ciphertext. Existing passkeys do not need to be deleted or recreated.

The behavior change is intentional:

- a synced passkey is one logical WebAuthn credential;
- an opaque browser binding is only an optional exact-routing/UX hint;
- a full unlock page offers explicit allow-list authentication without a binding;
- a dock shortcut and WebAuthn auto-start still require a valid binding;
- a PRF candidate mismatch appends a compatibility variant only after local password/recovery
  authorization.

## Consumer migration matrix

| Area | Required consumer change | Package API |
| --- | --- | --- |
| Status | Report `hasPasskeyPrfEnvelope` independently of browser binding | `resolvePasskeyUnlockPlan` |
| Enrollment | Request PRF during `create()` and use it after exact server verification; call `get()` only on typed fallback | `prepareVaultPasskeyPrfRegistrationOptions`, `resolvePasskeyPrfEnrollmentAfterRegistration` |
| Full unlock | Keep the passkey action available without binding; default to the authenticated user's allow-list | `resolvePasskeyUnlockPlan({ intent: "explicit" })` |
| Dock/auto-start | Require a valid binding and scope to its exact credential | `resolvePasskeyUnlockPlan({ intent: "quick" })` |
| Assertion transport | Extract PRF locally, sanitize the JSON, then send only the sanitized response | `extractPasskeyPrfOutput`, `sanitizeWebAuthnResponseForServer` |
| Candidate unwrap | Return at most five active variants for the server-verified credential | `unlockWithPasskeyPrfEnvelopeCandidates` |
| Successful match | Append/update this browser's binding and selected variant only after `matched` | typed candidate result |
| No match | Prompt for password/recovery and append the returned envelope; never overwrite | `createPasskeyPrfEnvelopeAfterIndependentAuthorization` |
| Stale binding | Clear it and continue with explicit allow-list unlock | explicit plan does not require binding |

Database/cookie/challenge persistence, WebAuthn verification, account authentication, rate limits,
variant IDs, binding IDs, session-operation revalidation, and UI remain application-owned.

## Plan the ceremony

```ts
import {
  resolvePasskeyUnlockPlan,
  type VaultPasskeyBindingTarget,
} from "@tgoliveira/vault-core";

declare const vaultStatus: { activePasskeyVariantCount: number };
declare const browserPreliminaryPrfAvailable: boolean;
declare const resolvedBindingTarget: VaultPasskeyBindingTarget | null;

const explicitPlan = resolvePasskeyUnlockPlan({
  intent: "explicit",
  hasPasskeyPrfEnvelope: vaultStatus.activePasskeyVariantCount > 0,
  preliminaryPrfAvailable: browserPreliminaryPrfAvailable,
});

if (explicitPlan.status === "ready") {
  // Pass explicitPlan.credentialSelection to the browser preparation helper.
  // Its default is { mode: "allow-list" }; binding is irrelevant here.
}

const quickPlan = resolvePasskeyUnlockPlan({
  intent: "quick",
  hasPasskeyPrfEnvelope: vaultStatus.activePasskeyVariantCount > 0,
  preliminaryPrfAvailable: browserPreliminaryPrfAvailable,
  bindingTarget: resolvedBindingTarget,
});

if (quickPlan.status === "ready") {
  // Only this exact-bound plan may drive a dock shortcut or opt-in auto-start.
}
```

Do not silently create or authenticate a passkey in the background. WebAuthn requires user mediation.
After a successful user-mediated ceremony, binding persistence may be transparent if the app
revalidates the current authenticated account and vault session operation first.

## Verify, sanitize, and match locally

```ts
import {
  extractPasskeyPrfOutput,
  resolvePasskeyPrfCapability,
  unlockWithPasskeyPrfEnvelopeCandidates,
  type VaultCryptoProfile,
  type VaultPasskeyEnvelopeVariant,
} from "@tgoliveira/vault-core";
import { sanitizeWebAuthnResponseForServer } from "@tgoliveira/vault-core/browser";

type AuthenticationResponse = {
  id: string;
  clientExtensionResults: Record<string, unknown>;
};
type VerifiedAssertion = {
  credentialId: string;
  activeEnvelopeVariants: VaultPasskeyEnvelopeVariant[];
  scope: { userId: string; resourceId: string };
};
declare const publicKeyOptions: PublicKeyCredentialRequestOptions;
declare const APP_VAULT_PROFILE: VaultCryptoProfile;
declare function runWebAuthnAuthentication(
  options: PublicKeyCredentialRequestOptions
): Promise<AuthenticationResponse>;
declare function verifyAssertionAndLoadCandidates(
  response: Omit<AuthenticationResponse, "clientExtensionResults"> & {
    clientExtensionResults: Record<string, unknown>;
  }
): Promise<VerifiedAssertion>;

const assertion = await runWebAuthnAuthentication(publicKeyOptions);
const prfOutput = extractPasskeyPrfOutput(
  assertion.clientExtensionResults,
  { credentialId: assertion.id }
);
const sanitizedAssertion = sanitizeWebAuthnResponseForServer(assertion);
const verified = await verifyAssertionAndLoadCandidates(sanitizedAssertion);

const capability = resolvePasskeyPrfCapability({
  ceremony: "authentication",
  verifiedCredentialId: verified.credentialId,
  clientExtensionResults: assertion.clientExtensionResults,
});
if (capability.state !== "confirmed_authentication") {
  throw new Error("The verified passkey did not return a usable PRF result");
}

const candidateResult = await unlockWithPasskeyPrfEnvelopeCandidates({
  verifiedCredentialId: verified.credentialId,
  candidates: verified.activeEnvelopeVariants,
  prfOutput,
  expectedScope: verified.scope,
  profile: APP_VAULT_PROFILE,
});
```

`sanitizeWebAuthnResponseForServer()` returns a copy without `prf.results`; it does not mutate the
browser-owned assertion. Never serialize `prfOutput`, a hash of it, or unsanitized extension results.

## Handle match and no-match

For `matched`, install the returned non-extractable key through the current package session operation.
Only after the session/account is still current, persist an opaque binding targeting
`verified.credentialId` and `candidateResult.envelopeVariantId`.

For `no_match` in a confirmed normal primary context, keep every candidate active and ask for one
independent local secret. If emergency/duress routing is active or the target is unresolved, keep the
vault locked, use password/recovery routing, and defer repair.

```ts
import {
  createPasskeyPrfEnvelopeAfterIndependentAuthorization,
  type PasskeyVariantIndependentAuthorization,
  type VaultCryptoProfile,
} from "@tgoliveira/vault-core";

declare const verified: {
  credentialId: string;
  scope: { userId: string; resourceId: string };
};
declare const prfOutput: Uint8Array;
declare const APP_VAULT_PROFILE: VaultCryptoProfile;
declare function appendPasskeyEnvelopeVariant(input: {
  credentialId: string;
  envelope: Awaited<ReturnType<typeof createPasskeyPrfEnvelopeAfterIndependentAuthorization>>["envelope"];
}): Promise<{ envelopeVariantId: string }>;
declare function saveBrowserBinding(input: {
  credentialId: string;
  selectedEnvelopeVariantId: string;
}): Promise<void>;

async function createCompatibilityVariant(
  authorization: PasskeyVariantIndependentAuthorization
) {
  const created = await createPasskeyPrfEnvelopeAfterIndependentAuthorization({
    authorization,
    verifiedCredentialId: verified.credentialId,
    prfOutput,
    expectedScope: verified.scope,
    profile: APP_VAULT_PROFILE,
    publicMetadata: { source: "synced-passkey-compatibility" },
  });

  const persisted = await appendPasskeyEnvelopeVariant({
    credentialId: verified.credentialId,
    envelope: created.envelope,
  });

  await saveBrowserBinding({
    credentialId: verified.credentialId,
    selectedEnvelopeVariantId: persisted.envelopeVariantId,
  });

  return created.vaultKey;
}
```

The helper accepts only password or recovery-phrase authorization, reopens that source envelope with
expected scope/profile/AAD, re-wraps inner key material without exporting the UVK, and returns no
raw secret or PRF bytes. Its `vaultKey` is a non-extractable `CryptoKey`. It has no persistence side
effects.

## React package UI

`VaultUnlockPanel` now interprets `passkeyReady` as “explicit WebAuthn options are loaded,” not
“browser binding exists.” Pass `onUnlockPasskey` whenever explicit allow-list unlock can run. The
explicit callback is never auto-started. To opt into full-page `autoStartPasskey`, also pass a ready
`intent: "quick"` plan as `quickPasskeyPlan` and a separate `onQuickUnlockPasskey(plan)` that uses its
exact credential selection.

`VaultDockQuickUnlock` is unchanged: without a valid binding it does not show or auto-start passkey
quick unlock.

## Acceptance checks

- Existing passkey unlock still works in its original browser.
- The same synced credential unlocks from a new browser with no binding or cookie.
- A missing/stale binding does not hide the full-page action and does not auto-start WebAuthn.
- A successful later candidate persists its opaque selected variant ID.
- `no_match` cannot create a variant from session UVK/binding/passkey alone.
- Password and recovery paths append, never overwrite, a variant.
- Unsanitized PRF extension results never reach server requests or logs.
- Wrong credential, user/resource scope, AAD profile, and more than five candidates fail closed.
- Safari/iOS synced-passkey candidate matching preserves all known-good variants.
- Emergency/duress consumers continue through `unlockVaultWithPasskeyCandidateRouting()`.
- Emergency/duress `no_match` remains locked and falls back to password/recovery routing; repair is
  deferred until a confirmed normal primary context.
