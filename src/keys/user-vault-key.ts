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

/** Constant-time comparison of two User Vault Keys. */
export async function userVaultKeysEqual(a: CryptoKey, b: CryptoKey): Promise<boolean> {
  const [bytesA, bytesB] = await Promise.all([exportUserVaultKey(a), exportUserVaultKey(b)]);
  if (bytesA.length !== bytesB.length) return false;
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i]!;
  }
  return diff === 0;
}
