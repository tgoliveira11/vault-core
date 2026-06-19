import type { EncryptedVaultPayload } from "./schemas.js";
import type { VaultAadScope, VaultCryptoProfile } from "../profile.js";

type ExpectedScope = Pick<VaultAadScope, "userId" | "resourceId">;

function normalizeExpectedScope(scope: string | ExpectedScope): ExpectedScope {
  return typeof scope === "string"
    ? { userId: scope, resourceId: scope }
    : scope;
}

export function assertVaultKeyAad(
  expectedScope: string | ExpectedScope,
  payload: EncryptedVaultPayload,
  profile: VaultCryptoProfile
): void {
  const scope = normalizeExpectedScope(expectedScope);
  if (payload.aad.userId !== scope.userId) {
    throw new Error("Vault key AAD userId mismatch");
  }
  if (payload.aad.resourceId !== scope.resourceId) {
    throw new Error("Vault key AAD resourceId mismatch");
  }
  if (payload.aad.field !== "vault_key") {
    throw new Error("Vault key AAD field mismatch");
  }
  if (payload.aad.context !== profile.aadContextEnvelope) {
    throw new Error("Vault key AAD context mismatch");
  }
}

export function assertVaultPayloadAad(
  expectedScope: string | ExpectedScope,
  payload: EncryptedVaultPayload,
  profile: VaultCryptoProfile
): void {
  const scope = normalizeExpectedScope(expectedScope);
  if (payload.aad.userId !== scope.userId) {
    throw new Error("Vault payload AAD userId mismatch");
  }
  if (payload.aad.resourceId !== scope.resourceId) {
    throw new Error("Vault payload AAD resourceId mismatch");
  }
  if (payload.aad.field !== "vault_payload") {
    throw new Error("Vault payload AAD field mismatch");
  }
  if (payload.aad.context !== profile.aadContextVault) {
    throw new Error("Vault payload AAD context mismatch");
  }
}
