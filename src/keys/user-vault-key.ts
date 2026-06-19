import { generateAesKey } from "../crypto/aes-gcm.js";

export type UserVaultKey = CryptoKey;

export async function createUserVaultKey(): Promise<CryptoKey> {
  return generateAesKey();
}

/** @deprecated Use createUserVaultKey */
export const generateUserVaultKey = createUserVaultKey;

export async function importUserVaultKey(rawKey: Uint8Array): Promise<CryptoKey> {
  const { importAesKey } = await import("../crypto/aes-gcm.js");
  return importAesKey(rawKey);
}

export async function exportUserVaultKey(key: CryptoKey): Promise<Uint8Array> {
  const { exportAesKey } = await import("../crypto/aes-gcm.js");
  return exportAesKey(key);
}
