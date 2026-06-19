# Password Envelopes

- Vault password normalized with NFKC before Argon2id
- Default params: memory 65536 KiB, iterations 3, parallelism 1, 32-byte hash, 16-byte salt
- API: `createPasswordEnvelope` / `unlockWithPasswordEnvelope`

Vault password never sent to server.
