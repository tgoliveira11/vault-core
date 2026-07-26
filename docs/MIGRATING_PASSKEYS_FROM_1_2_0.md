# Migrating passkeys from vault-core 1.2.0

This guide corrects the 1.2.0 model that treated a passkey too much like a physical-device
enrollment. It preserves existing ciphertext, PRF salt prefixes, AAD profiles, credential IDs, and
the `passkey_prf` envelope method.

## Correct model

Keep these identities separate:

1. **Credential** — a logical WebAuthn credential. It can be synced/multi-device or single-device.
2. **Binding** — optional opaque browser routing state. Zero or many bindings can reference one
   credential. A binding is not an authentication factor.
3. **Envelope variant** — an encrypted UVK wrapper produced from that credential's PRF result. A
   credential normally has one variant, but recovery-authorized compatibility handling may add one.

Do not create a new credential merely because a user opens another device. First offer **Use an
existing passkey**. A separate registration is appropriate for a single-device credential, another
provider/security key, or an explicitly independent credential.

## Portable metadata

The package validates portable state but does not persist it:

```ts
import { vaultPasskeyCredentialStateSchema } from "@tgoliveira/vault-core";

const state = vaultPasskeyCredentialStateSchema.parse({
  credential: {
    credentialId: verifiedCredentialId,
    transports: storedTransports,
    credentialDeviceType: "multiDevice",
    backupEligible: true,
    credentialBackedUp: true,
  },
  bindings: [
    {
      bindingId: opaqueBrowserBindingId,
      credentialId: verifiedCredentialId,
      selectedEnvelopeVariantId: "envelope-row-1",
    },
  ],
  envelopeVariants: [
    {
      envelopeVariantId: "envelope-row-1",
      credentialId: verifiedCredentialId,
      envelope: storedPasskeyPrfEnvelope,
    },
  ],
});

void state;
```

`credentialDeviceType` uses the SimpleWebAuthn-compatible values `singleDevice` and `multiDevice`.
Backup eligibility is permanent for a credential; backed-up state may change. Preserve the most
recent verified WebAuthn metadata and reported transports in application-owned storage.

## Persistence migration

Make the migration additive and recoverable:

- remove uniqueness that limits `(user, credential)` to one binding;
- keep `binding_id` unique and opaque;
- permit several active envelope rows for one credential;
- use the existing envelope row ID as `envelopeVariantId` when possible;
- add an optional selected variant reference to each binding;
- backfill existing bindings/envelopes without decrypting, re-encrypting, or deleting them.

Do not add binding/variant IDs to PRF derivation or envelope AAD. That would make 1.2.0 ciphertext
undecryptable.

## Replace credential scoping

The deprecated `scopeAuthenticationOptionsToDevice()` alias now fails closed, but new code should use
explicit credential selection:

```ts
import { prepareAuthenticationOptions } from "@tgoliveira/secure-auth/client";
import { prepareVaultPasskeyPrfAuthenticationOptions } from "@tgoliveira/vault-core/browser";

const publicKey = await prepareVaultPasskeyPrfAuthenticationOptions({
  userId,
  prfSaltPrefix: "acme-passkey-prf-v1:",
  serverOptions,
  prepareJson: prepareAuthenticationOptions,
  credentialSelection: { mode: "exact", credentialId: boundCredentialId },
  transportPolicy: "preserve",
});
```

Exact selection throws `PasskeyCredentialScopeError` for a missing/mismatched credential, malformed
descriptor, or duplicate ID. Discoverable authentication must be explicit:

```ts
const publicKey = await prepareVaultPasskeyPrfAuthenticationOptions({
  userId,
  prfSaltPrefix: "acme-passkey-prf-v1:",
  serverOptions,
  prepareJson: prepareAuthenticationOptions,
  credentialSelection: { mode: "discoverable" },
});
```

Do not combine `credentialSelection` with the legacy `credentialId`, `scopeToDevice`,
`scopeToCredential`, or `filterSingleCredential` fields.

## Confirm PRF capability

`isPrfExtensionSupported()` is retained as a deprecated heuristic alias. It cannot confirm a
credential/authenticator. Use typed states:

```ts
import { resolvePasskeyPrfCapability } from "@tgoliveira/vault-core/browser";

const preliminary = resolvePasskeyPrfCapability();

const registration = resolvePasskeyPrfCapability({
  ceremony: "registration",
  clientExtensionResults: createdCredential.getClientExtensionResults() as Record<string, unknown>,
});

void preliminary;
void registration;
```

- API/user-agent inspection returns only `heuristic` or `unavailable`.
- Registration is confirmed only by `prf.enabled === true`.
- Authentication is confirmed only by a valid result for the asserted credential.
- Missing/invalid ceremony results return `incompatible`.

Do not serialize PRF extension results to a server. Extract locally, retain the original response in
the browser, and sanitize the copy sent to the application's verification library:

```ts
import { sanitizeWebAuthnResponseForServer } from "@tgoliveira/vault-core/browser";

const extensionResults = assertion.clientExtensionResults as Record<string, unknown>;
const serverAssertion = sanitizeWebAuthnResponseForServer(assertion);
const verification = await verifyAssertionOnServer(serverAssertion);

if (verification.verifiedCredentialId !== assertion.id) {
  throw new Error("Verified passkey credential mismatch");
}

const authentication = resolvePasskeyPrfCapability({
  ceremony: "authentication",
  verifiedCredentialId: verification.verifiedCredentialId,
  clientExtensionResults: extensionResults,
});

void authentication;

void extensionResults; // Remains browser-only for capability resolution and candidate unwrap.
```

`sanitizeWebAuthnResponseForServer()` removes the complete `clientExtensionResults.prf` node without
mutating the original response. Server-side checks of `prf.results.first` are not capability proof and
must not be used.

## Preserve transports by default

The composed helpers now preserve stored transports. Other modes require an explicit policy:

```ts
import { applyVaultUnlockTransportPolicy } from "@tgoliveira/vault-core/browser";

const stored = applyVaultUnlockTransportPolicy(options, "preserve");
const platformOnly = applyVaultUnlockTransportPolicy(options, "platform-only");
const discoverable = applyVaultUnlockTransportPolicy(options, "discoverable");
const appleWorkaround = applyVaultUnlockTransportPolicy(
  options,
  "apple-mobile-internal-workaround",
  navigator.userAgent
);

void stored;
void platformOnly;
void discoverable;
void appleWorkaround;
```

The Apple-mobile workaround is versioned compatibility behavior, not a statement that `internal` is
always the correct transport. Consumers may override the preliminary Apple PRF heuristic with
`appleMobileWorkaround: false` or `heuristicOverride` after their own compatibility decision.

## Use an existing credential and match envelope variants locally

After the server verifies the WebAuthn assertion, return only bounded active candidates belonging to
that credential. Candidate order is preserved, so the binding-selected variant may be first.

```ts
import {
  cacheVaultInnerKeyMaterialFromPasskeyUnlock,
  extractPasskeyPrfOutput,
  unlockVaultSession,
  unlockWithPasskeyPrfEnvelopeCandidates,
} from "@tgoliveira/vault-core/browser";

const prfOutput = extractPasskeyPrfOutput(
  assertion.getClientExtensionResults() as Record<string, unknown>,
  { credentialId: assertion.id }
);
if (!prfOutput) throw new Error("This passkey did not return a usable PRF result");

const result = await unlockWithPasskeyPrfEnvelopeCandidates({
  verifiedCredentialId: verification.verifiedCredentialId,
  candidates: serverCandidates,
  prfOutput,
  expectedScope: { userId, resourceId: userId },
  profile: APP_VAULT_PROFILE,
});

if (result.status === "matched") {
  await unlockVaultSession(result.vaultKey);
  const matchedCandidate = serverCandidates.find(
    (candidate) => candidate.envelopeVariantId === result.envelopeVariantId
  );
  if (!matchedCandidate) throw new Error("Matched passkey envelope variant is missing");
  await cacheVaultInnerKeyMaterialFromPasskeyUnlock(
    result.vaultKey,
    matchedCandidate.envelope,
    prfOutput
  );
  await persistAnotherOpaqueBinding({
    credentialId: verification.verifiedCredentialId,
    selectedEnvelopeVariantId: result.envelopeVariantId,
  });
} else if (result.status === "no_match") {
  // Preserve every variant. Require password/recovery before adding a compatibility variant.
}
```

The helper tries at most `MAX_PASSKEY_PRF_ENVELOPE_CANDIDATES` (5). It returns no PRF output/hash and
has no persistence, revocation, cache, session, or emergency-mode side effects. Malformed candidates,
credential/scope mismatches, and unexpected crypto failures are separate typed results.

AAD context validation is strict when `legacyVaultKeyUnlock` is `false`. When legacy routing remains
enabled, missing/null contexts are accepted and explicit old strings must appear in
`profile.legacyVaultKeyAadContexts`. Arbitrary context strings are rejected; user, resource, and
`vault_key` field checks remain mandatory.

## Emergency/duress mode

Do not replace `unlockVaultWithPasskeyRouting()` with the low-level candidate helper when emergency
mode is enabled. Use the candidate-aware browser API:

```ts
import {
  cacheVaultInnerKeyMaterialFromPasskeyUnlock,
  unlockVaultWithPasskeyCandidateRouting,
} from "@tgoliveira/vault-core/browser";

const result = await unlockVaultWithPasskeyCandidateRouting({
  record,
  verifiedCredentialId: verification.verifiedCredentialId,
  primaryCandidates,
  decoyCandidates,
  prfOutput,
  duressSignaled,
  emergencyModeActive: serverMetadata.emergencyModeActive,
  scope: { userId, resourceId: userId },
  profile: APP_VAULT_PROFILE,
  onEmergencyEntered: () => persistEmergencyModeActive(true),
});

if (result.status === "matched") {
  const selectedCandidates = result.target === "decoy" ? decoyCandidates : primaryCandidates;
  const matchedCandidate = selectedCandidates.find(
    (candidate) => candidate.envelopeVariantId === result.matchedEnvelopeVariantId
  );
  if (!matchedCandidate) throw new Error("Matched passkey envelope variant is missing");
  await cacheVaultInnerKeyMaterialFromPasskeyUnlock(
    result.vaultKey,
    matchedCandidate.envelope,
    prfOutput
  );
  await persistBindingSelectedVariant(result.matchedEnvelopeVariantId);
}
```

It chooses primary/decoy candidates first, performs bounded matching, and changes session role only
after a successful match. A decoy-targeted candidate flow must supply explicit decoy candidates.

## Availability and rebinding

`resolvePasskeyUnlockAvailableOnDevice()` now fails closed when binding state is omitted. Prefer:

```ts
import { resolvePasskeyUnlockAvailable } from "@tgoliveira/vault-core";

const quickUnlockAvailable = resolvePasskeyUnlockAvailable({
  hasPasskeyPrfEnvelope: activeEnvelopeVariantCount > 0,
  passkeyUnlockAvailableOnThisBrowser: binding != null,
});
```

This boolean controls bound-browser quick unlock only. An unbound browser can still offer an explicit
**Use an existing passkey** flow, verify a discoverable/allow-listed credential, match variants
locally, and create another binding after success.

## No-match recovery flow

If no active variant matches:

1. preserve every existing envelope and binding;
2. keep the vault locked;
3. require vault password or recovery phrase locally;
4. create a new passkey PRF envelope for the current result;
5. persist it as an additional opaque variant;
6. select it for the current browser binding.

A binding alone must never authorize step 4, replacement, deletion, or revocation.

## Validation matrix

- same synced credential: device A → device B and B → A;
- two bindings reference one credential without eviction;
- cleared cookie can discover and rebind an existing credential;
- single-device credential requires separate enrollment on another device;
- exact selection: match, no match, single mismatch, duplicate, malformed, discoverable opt-in;
- PRF: unavailable, heuristic, registration-confirmed, authentication-confirmed, missing/invalid;
- candidate variants: first match, later match, no match, malformed, over limit, wrong credential/AAD;
- no PRF bytes/hashes in serialized results, requests, persistence, or logs;
- stored transports preserved; platform/discoverable/workaround policies explicit;
- no-match recovery adds a variant without overwrite;
- emergency candidate matching preserves primary/decoy routing and session roles;
- old 1.2.0 ciphertext, envelope method, PRF prefix, scope, and AAD profile still decrypt.
