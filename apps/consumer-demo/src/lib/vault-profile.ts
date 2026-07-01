import type { VaultCryptoProfile } from "@tgoliveira/vault-core";

/** Demo-owned crypto profile — must stay stable once demo vault data exists. */
export const VAULT_PROFILE: VaultCryptoProfile = {
  cryptoVersion: "vault-v1",
  aadContextVault:
    process.env.VAULT_AAD_CONTEXT_VAULT ?? "vault-core-demo:vault:v1",
  aadContextEnvelope:
    process.env.VAULT_AAD_CONTEXT_ENVELOPE ?? "vault-core-demo:envelope:v1",
};

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

export function vaultScope(userId: string = DEMO_USER_ID) {
  return {
    userId,
    resourceId: userId,
    field: "vault_payload" as const,
  };
}

export const PRF_SALT_PREFIX =
  process.env.VAULT_PRF_SALT_PREFIX ?? "vault-core-demo-passkey-prf-v1:";
