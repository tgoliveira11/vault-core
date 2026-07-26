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
- Unlock rejects envelopes whose authenticated AAD does not match the expected scope and profile
- Browser helpers: `buildPrfSaltBytes(prefix, userId)`, typed capability evaluation, strict credential
  selection, explicit transport policy, WebAuthn response sanitization, and emergency-aware candidate
  routing

PRF output never goes to the server. Call `sanitizeWebAuthnResponseForServer()` before serializing a
registration or authentication response. WebAuthn ceremony, credential verification,
binding/envelope persistence, recovery authorization, and revocation stay in the app.
