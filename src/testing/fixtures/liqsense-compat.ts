import type { VaultCryptoProfile } from "../../profile.js";

/** Frozen LiqSense compatibility profile — must not change. */
export const LIQSENSE_COMPAT_PROFILE: VaultCryptoProfile = {
  cryptoVersion: "vault-v1",
  aadContextVault: "liqsense:vault:v1",
  aadContextEnvelope: "liqsense:vault-envelope:v1",
};

export const LIQSENSE_COMPAT_USER_ID = "00000000-0000-4000-8000-000000000001";

export const LIQSENSE_COMPAT_SCOPE = {
  userId: LIQSENSE_COMPAT_USER_ID,
  resourceId: LIQSENSE_COMPAT_USER_ID,
};

/** Fixed 32-byte UVK for fixture generation (not a production key). */
export const FIXTURE_UVK_BYTES = Uint8Array.from({ length: 32 }, (_, i) => i + 1);

/** Fixed 16-byte Argon2 salt for deterministic envelope fixtures. */
export const FIXTURE_ARGON2_SALT = Uint8Array.from({ length: 16 }, (_, i) => 0x10 + i);

export const FIXTURE_VAULT_PASSWORD = "SENTINEL_VAULT_PASSWORD_DO_NOT_STORE";

export const FIXTURE_12_WORD_PHRASE =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

export const FIXTURE_24_WORD_PHRASE =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

/** 32-byte PRF output for passkey envelope fixtures. */
export const FIXTURE_PRF_OUTPUT = Uint8Array.from({ length: 32 }, (_, i) => 0x20 + i);

export const FIXTURE_PAYLOAD_V1 = {
  version: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  profile: { displayName: "fixture-user" },
  subscriptions: [],
  walletLabels: [],
  strategyNotes: [],
  privatePreferences: { privateModeDefault: true },
};
