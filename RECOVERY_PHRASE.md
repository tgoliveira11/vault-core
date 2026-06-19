# Recovery Phrase

- BIP39 English wordlist via `@scure/bip39`
- Supported lengths: **12 words** (128-bit) and **24 words** (256-bit, default)
- Normalization: trim, lowercase, single-space separated
- Confirmation helpers: deterministic word indices (3 for 12 words, 4 for 24)
- Recovery kit text via `createRecoveryKitText({ productName, ... })`

Recovery phrase never sent to server.
