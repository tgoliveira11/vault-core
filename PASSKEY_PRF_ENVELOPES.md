# Passkey PRF Envelopes

- Separate from account passkey login
- App provides PRF output bytes (≥ 32 bytes) from WebAuthn ceremony
- Package wraps UVK with PRF-derived AES key
- API: `createPasskeyPrfEnvelope(vaultKey, prfOutput, scope, profile)` / `unlockWithPasskeyPrfEnvelope(envelope, prfOutput, expectedScope, profile)`
- One logical credential may be synced across devices and have many opaque browser bindings.
- One credential normally has one envelope variant; compatibility recovery may add variants without
  replacing a known-good envelope.
- `unlockWithPasskeyPrfEnvelopeCandidates()` tries at most 5 variants locally and returns the matched
  opaque variant ID plus a non-extractable UVK.
- `resolvePasskeyUnlockPlan()` keeps explicit allow-list unlock available without a binding while
  reserving exact selection and auto-start for bound-browser quick unlock.
- After candidate `no_match`, `createPasskeyPrfEnvelopeAfterIndependentAuthorization()` reopens a
  password/recovery envelope locally and returns a non-extractable UVK plus a new envelope to append.
  Emergency/duress no-match must remain locked and defer this repair until normal primary context.
- Unlock rejects envelopes whose authenticated AAD does not match the expected scope and profile
- Browser helpers: `buildPrfSaltBytes(prefix, userId)`, typed capability evaluation, strict credential
  selection, explicit transport policy, WebAuthn response sanitization, and emergency-aware candidate
  routing

PRF output never goes to the server. Call `sanitizeWebAuthnResponseForServer()` before serializing a
registration or authentication response. WebAuthn ceremony, credential verification,
binding/envelope persistence, append-only variant storage, and revocation stay in the app. The core
performs the local password/recovery authorization for compatibility-variant creation.
