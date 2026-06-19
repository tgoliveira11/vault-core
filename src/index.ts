export * from "./constants.js";
export * from "./profile.js";
export * from "./errors/vault-errors.js";

export * from "./crypto/aes-gcm.js";
export * from "./crypto/aad.js";
export * from "./crypto/encoding.js";
export * from "./crypto/random.js";
export * from "./crypto/serialization.js";

export * from "./kdf/argon2id.js";
export * from "./kdf/params.js";

export * from "./keys/user-vault-key.js";

export * from "./validation/schemas.js";
export * from "./validation/aad-assert.js";
export {
  assertNoVaultPlaintextFields,
  rejectVaultPlaintextFields,
  validateNoPlaintextLeak,
  scanForSentinels,
  containsSentinel,
  PLAINTEXT_FORBIDDEN_VAULT_FIELDS,
  ALL_SENTINELS,
  SENTINEL_VAULT_PASSWORD,
  SENTINEL_RECOVERY_PHRASE,
  SENTINEL_12_WORD_RECOVERY_PHRASE,
  SENTINEL_24_WORD_RECOVERY_PHRASE,
  SENTINEL_PRIVATE_LABEL,
  SENTINEL_STRATEGY_NOTE,
  SENTINEL_SUBSCRIPTION_TOKEN,
  SENTINEL_MANAGEMENT_TOKEN,
  SENTINEL_PRIVATE_NOTE,
  SENTINEL_USER_VAULT_KEY,
  SENTINEL_PRF_OUTPUT,
} from "./validation/plaintext-reject.js";

export * from "./payload/encrypted-payload.js";

export * from "./envelopes/password.js";
export * from "./envelopes/recovery.js";
export * from "./envelopes/passkey-prf.js";

export * from "./recovery/kit.js";

export type { VaultUnlockResult } from "./profile.js";
