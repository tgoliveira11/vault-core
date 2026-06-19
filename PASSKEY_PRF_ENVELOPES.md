# Passkey PRF Envelopes

- Separate from account passkey login
- App provides PRF output bytes (≥ 32 bytes) from WebAuthn ceremony
- Package wraps UVK with PRF-derived AES key
- API: `createPasskeyPrfEnvelope` / `unlockWithPasskeyPrfEnvelope`
- Browser helpers: `buildPrfSaltBytes(prefix, userId)`, capability probes

PRF output never sent to server. WebAuthn ceremony stays in the app.
