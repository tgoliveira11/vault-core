import { VaultKeyNotExtractableError, VaultAuthorizationError } from "../errors/vault-errors.js";
import { importUserVaultAesKey } from "../crypto/user-vault-key-crypto.js";

export type UserVaultKey = CryptoKey;

export async function createUserVaultKey(): Promise<CryptoKey> {
  // Extractable at generation so the first envelope can use AES-KW wrapKey.
  // Keys restored via envelope unlock are non-extractable.
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

/** @deprecated Use createUserVaultKey */
export const generateUserVaultKey = createUserVaultKey;

export type ImportUserVaultKeyOptions = {
  /** Defaults to false. Use true only in tests or legacy migration tooling. */
  extractable?: boolean;
};

export async function importUserVaultKey(
  rawKey: Uint8Array,
  options: ImportUserVaultKeyOptions = {}
): Promise<CryptoKey> {
  return importUserVaultAesKey(rawKey, options);
}

export async function exportUserVaultKey(key: CryptoKey): Promise<Uint8Array> {
  try {
    const raw = await crypto.subtle.exportKey("raw", key);
    return new Uint8Array(raw);
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "";
    if (errorName === "InvalidAccessError" || errorName === "InvalidAccessException") {
      throw new VaultKeyNotExtractableError();
    }
    throw error;
  }
}

/** Rejects extractable keys before they enter the in-memory vault session. */
export async function assertUserVaultKeyNonExtractable(key: CryptoKey): Promise<void> {
  try {
    await exportUserVaultKey(key);
    throw new VaultAuthorizationError("Session vault key must be non-extractable");
  } catch (error) {
    if (error instanceof VaultAuthorizationError) throw error;
    if (error instanceof VaultKeyNotExtractableError) return;
    throw error;
  }
}

const UVK_EQUALITY_PROBE = new TextEncoder().encode("vault-core-uvk-equality:v1");
const UVK_EQUALITY_IV = new Uint8Array(12);

async function userVaultKeysEqualViaEncrypt(a: CryptoKey, b: CryptoKey): Promise<boolean> {
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: UVK_EQUALITY_IV,
      additionalData: new Uint8Array(0),
    },
    a,
    UVK_EQUALITY_PROBE
  );

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: UVK_EQUALITY_IV,
        additionalData: new Uint8Array(0),
      },
      b,
      ciphertext
    );
    const bytes = new Uint8Array(decrypted);
    if (bytes.length !== UVK_EQUALITY_PROBE.length) return false;
    let diff = 0;
    for (let i = 0; i < bytes.length; i++) {
      diff |= bytes[i]! ^ UVK_EQUALITY_PROBE[i]!;
    }
    return diff === 0;
  } catch {
    return false;
  }
}

/** Constant-time comparison of two User Vault Keys (works for non-extractable keys). */
export async function userVaultKeysEqual(a: CryptoKey, b: CryptoKey): Promise<boolean> {
  try {
    const [bytesA, bytesB] = await Promise.all([exportUserVaultKey(a), exportUserVaultKey(b)]);
    if (bytesA.length !== bytesB.length) return false;
    let diff = 0;
    for (let i = 0; i < bytesA.length; i++) {
      diff |= bytesA[i]! ^ bytesB[i]!;
    }
    return diff === 0;
  } catch (error) {
    if (!(error instanceof VaultKeyNotExtractableError)) {
      throw error;
    }
    return userVaultKeysEqualViaEncrypt(a, b);
  }
}
