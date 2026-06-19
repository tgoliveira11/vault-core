# Password Envelopes

- Vault password normalized with NFKC before Argon2id
- Default params: memory 65536 KiB, iterations 3, parallelism 1, 32-byte hash, 16-byte salt
- Persisted Argon2id parameters are bounded before derivation to prevent client-side resource exhaustion
- API: `createPasswordEnvelope(vaultKey, password, scope, profile)` / `unlockWithPasswordEnvelope(password, envelope, expectedScope, profile)`
- Unlock rejects envelopes whose authenticated AAD does not match the expected scope and profile

Vault password never sent to server.
