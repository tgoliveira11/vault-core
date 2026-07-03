import type { EncryptedVaultPayload } from "../validation/schemas.js";
import type { WrapUserVaultKeyOptions } from "../crypto/vault-key-envelope.js";
import {
  assertInnerVaultKeyBlobMatchesVaultKey,
  extractInnerVaultKeyBlob,
} from "../crypto/vault-key-envelope.js";
import { importAesKwKey } from "../crypto/user-vault-key-crypto.js";
import { VaultAuthorizationError } from "../errors/vault-errors.js";

export type VaultInnerKeyMaterialCacheEntry = {
  inner: Uint8Array;
  wrappingKey: CryptoKey;
};

/** Default message when cached inner material no longer matches the session UVK. */
export const INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE =
  "Cached inner vault key material does not match the current session. Unlock again and retry.";

let cachedEntry: VaultInnerKeyMaterialCacheEntry | null = null;

export function clearVaultInnerKeyMaterialCache(): void {
  cachedEntry = null;
}

export function getCachedVaultInnerKeyMaterial(): VaultInnerKeyMaterialCacheEntry | null {
  return cachedEntry;
}

export async function cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
  inner: Uint8Array,
  wrappingKey: CryptoKey,
  sessionVaultKey: CryptoKey
): Promise<void> {
  await assertInnerVaultKeyBlobMatchesVaultKey(inner, sessionVaultKey, wrappingKey);
  cachedEntry = { inner, wrappingKey };
}

export async function cacheVaultInnerKeyMaterialFromPasskeyEnvelope(
  encryptedVaultKey: EncryptedVaultPayload,
  prfOutput: Uint8Array,
  prfEncryptionKey: CryptoKey,
  sessionVaultKey: CryptoKey
): Promise<void> {
  const inner = await extractInnerVaultKeyBlob(encryptedVaultKey, prfEncryptionKey);
  const wrappingKey = await importAesKwKey(
    prfOutput.byteLength === 32 ? prfOutput : prfOutput.slice(0, 32)
  );
  await cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(inner, wrappingKey, sessionVaultKey);
}

/**
 * Resolves wrap options using the in-memory cache when `innerVaultKeyBlob` is omitted.
 * Clears stale cache entries on mismatch.
 */
export async function resolveInnerVaultKeyBlobForWrap(
  sessionVaultKey: CryptoKey,
  options?: WrapUserVaultKeyOptions
): Promise<WrapUserVaultKeyOptions | undefined> {
  if (options?.innerVaultKeyBlob) {
    return options;
  }

  const cached = getCachedVaultInnerKeyMaterial();
  if (!cached) {
    return options;
  }

  try {
    await assertInnerVaultKeyBlobMatchesVaultKey(
      cached.inner,
      sessionVaultKey,
      cached.wrappingKey
    );
    return { ...options, innerVaultKeyBlob: cached.inner };
  } catch {
    clearVaultInnerKeyMaterialCache();
    throw new VaultAuthorizationError(INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE);
  }
}

/** Grouped cache API for browser and session integrations. */
export const VaultInnerKeyMaterialCache = {
  clear: clearVaultInnerKeyMaterialCache,
  getCached: getCachedVaultInnerKeyMaterial,
  cacheFromEnvelopeDecrypt: cacheVaultInnerKeyMaterialFromEnvelopeDecrypt,
  cacheFromPasskeyEnvelope: cacheVaultInnerKeyMaterialFromPasskeyEnvelope,
} as const;
