import type { z } from "zod";
import { encryptField, decryptField } from "../crypto/aes-gcm.js";
import { parseVaultPayload, serializeVaultPayload } from "../crypto/serialization.js";
import type { VaultCryptoProfile, VaultAadScope } from "../profile.js";
import type { EncryptedVaultPayload } from "../validation/schemas.js";
import { assertVaultPayloadAad } from "../validation/aad-assert.js";
import { VaultPayloadValidationError } from "../errors/vault-errors.js";

type PayloadScope = Pick<VaultAadScope, "userId" | "resourceId">;

export async function encryptVaultPayload<T>(
  payload: T,
  vaultKey: CryptoKey,
  scope: PayloadScope,
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
  vaultKey: CryptoKey,
  expectedScope: PayloadScope,
  profile: VaultCryptoProfile
): Promise<T> {
  assertVaultPayloadAad(expectedScope, encrypted, profile);
  const json = await decryptField(encrypted, vaultKey);
  return parseVaultPayload<T>(json);
}

/**
 * Decrypts a vault payload and validates the parsed JSON with a Zod schema.
 * Prefer this over {@link decryptVaultPayload} when persisted ciphertext may be stale or tampered.
 */
export async function decryptVaultPayloadWithSchema<T extends z.ZodType>(
  encrypted: EncryptedVaultPayload,
  vaultKey: CryptoKey,
  expectedScope: PayloadScope,
  profile: VaultCryptoProfile,
  schema: T
): Promise<z.infer<T>> {
  assertVaultPayloadAad(expectedScope, encrypted, profile);
  const json = await decryptField(encrypted, vaultKey);
  const parsed = parseVaultPayload<unknown>(json);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new VaultPayloadValidationError(result.error.message);
  }
  return result.data;
}
