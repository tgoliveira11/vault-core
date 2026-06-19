import { encryptField, decryptField } from "../crypto/aes-gcm.js";
import { parseVaultPayload, serializeVaultPayload } from "../crypto/serialization.js";
import type { VaultCryptoProfile, VaultAadScope } from "../profile.js";
import type { EncryptedVaultPayload } from "../validation/schemas.js";

export async function encryptVaultPayload<T>(
  payload: T,
  vaultKey: CryptoKey,
  scope: Pick<VaultAadScope, "userId" | "resourceId">,
  profile: VaultCryptoProfile
): Promise<EncryptedVaultPayload> {
  return encryptField(serializeVaultPayload(payload), vaultKey, {
    userId: scope.userId,
    resourceId: scope.resourceId,
    field: "vault_payload",
  }, profile);
}

export async function decryptVaultPayload<T>(
  encrypted: EncryptedVaultPayload,
  vaultKey: CryptoKey
): Promise<T> {
  const json = await decryptField(encrypted, vaultKey);
  return parseVaultPayload<T>(json);
}
