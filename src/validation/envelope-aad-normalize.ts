import type { EncryptedVaultPayload } from "./schemas.js";
import type { VaultCryptoProfile } from "../profile.js";

/**
 * Injects `profile.aadContextEnvelope` when a `vault_key` payload was persisted without
 * `aad.context` (null/undefined). Does not alter envelopes with an explicit context value.
 */
export function normalizeEnvelopeAadContext(
  payload: EncryptedVaultPayload,
  profile: VaultCryptoProfile
): EncryptedVaultPayload {
  if (payload.aad.field !== "vault_key") {
    return payload;
  }

  const context = payload.aad.context as string | null | undefined;
  if (context !== undefined && context !== null) {
    return payload;
  }

  return {
    ...payload,
    aad: {
      ...payload.aad,
      context: profile.aadContextEnvelope,
    },
  };
}
