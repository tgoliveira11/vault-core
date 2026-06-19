import type { EncryptedVaultPayload } from "./schemas.js";
import type { VaultCryptoProfile } from "../profile.js";

export function assertVaultKeyAad(
  userId: string,
  payload: EncryptedVaultPayload,
  profile: VaultCryptoProfile
): void {
  if (payload.aad.userId !== userId) {
    throw new Error("Vault key AAD userId mismatch");
  }
  if (payload.aad.resourceId !== userId) {
    throw new Error("Vault key AAD resourceId mismatch");
  }
  if (payload.aad.field !== "vault_key") {
    throw new Error("Vault key AAD field mismatch");
  }
  if (payload.aad.context && payload.aad.context !== profile.aadContextEnvelope) {
    throw new Error("Vault key AAD context mismatch");
  }
}

export function assertVaultPayloadAad(
  userId: string,
  payload: EncryptedVaultPayload,
  profile: VaultCryptoProfile
): void {
  if (payload.aad.userId !== userId) {
    throw new Error("Vault payload AAD userId mismatch");
  }
  if (payload.aad.resourceId !== userId) {
    throw new Error("Vault payload AAD resourceId mismatch");
  }
  if (payload.aad.field !== "vault_payload") {
    throw new Error("Vault payload AAD field mismatch");
  }
  if (payload.aad.context && payload.aad.context !== profile.aadContextVault) {
    throw new Error("Vault payload AAD context mismatch");
  }
}
