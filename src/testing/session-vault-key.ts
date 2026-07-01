import {
  createUserVaultKey,
  exportUserVaultKey,
  importUserVaultKey,
} from "../index.js";

/** Non-extractable UVK suitable for `unlockVaultSession()` in tests and demos. */
export async function createNonExtractableSessionVaultKey(): Promise<CryptoKey> {
  const extractable = await createUserVaultKey();
  const raw = await exportUserVaultKey(extractable);
  return importUserVaultKey(raw, { extractable: false });
}
