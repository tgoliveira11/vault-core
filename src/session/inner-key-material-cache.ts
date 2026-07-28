import type { EncryptedVaultPayload } from "../validation/schemas.js";
import type { WrapUserVaultKeyOptions } from "../crypto/vault-key-envelope.js";
import {
  assertInnerVaultKeyBlobMatchesVaultKey,
  extractInnerVaultKeyBlob,
} from "../crypto/vault-key-envelope.js";
import { importPrfAesKwKey } from "../crypto/prf-key.js";
import { VaultAuthorizationError } from "../errors/vault-errors.js";
import {
  assertVaultSessionMutationAllowed,
  type VaultSessionMutationOptions,
} from "./vault-session-operation.js";

export type VaultInnerKeyMaterialCacheEntry = {
  inner: Uint8Array;
  wrappingKey: CryptoKey;
};

/** Default message when cached inner material no longer matches the session UVK. */
export const INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE =
  "Cached inner vault key material does not match the current session. Unlock again and retry.";

let cachedEntry: VaultInnerKeyMaterialCacheEntry | null = null;

function zeroSensitiveBytes(bytes: Uint8Array): void {
  bytes.fill(0);
}

function clearCachedEntry(): void {
  if (cachedEntry?.inner) {
    zeroSensitiveBytes(cachedEntry.inner);
  }
  cachedEntry = null;
}

export function clearVaultInnerKeyMaterialCache(
  options?: VaultSessionMutationOptions
): void {
  assertVaultSessionMutationAllowed(options?.operation);
  clearCachedEntry();
}

/** @internal Lock/owner-transition cleanup already invalidates the active operation. */
export function clearVaultInnerKeyMaterialCacheForSessionLock(): void {
  clearCachedEntry();
}

/** @internal Detect legacy unowned cache state before enabling owner-scoped operations. */
export function hasCachedVaultInnerKeyMaterial(): boolean {
  return cachedEntry !== null;
}

export function getCachedVaultInnerKeyMaterial(
  options?: VaultSessionMutationOptions
): VaultInnerKeyMaterialCacheEntry | null {
  assertVaultSessionMutationAllowed(options?.operation);
  return cachedEntry;
}

export async function cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
  inner: Uint8Array,
  wrappingKey: CryptoKey,
  sessionVaultKey: CryptoKey,
  options?: VaultSessionMutationOptions
): Promise<void> {
  try {
    assertVaultSessionMutationAllowed(options?.operation);
    await assertInnerVaultKeyBlobMatchesVaultKey(inner, sessionVaultKey, wrappingKey);
    assertVaultSessionMutationAllowed(options?.operation);
  } catch (error) {
    zeroSensitiveBytes(inner);
    throw error;
  }
  clearCachedEntry();
  cachedEntry = { inner, wrappingKey };
}

export async function cacheVaultInnerKeyMaterialFromPasskeyEnvelope(
  encryptedVaultKey: EncryptedVaultPayload,
  prfOutput: Uint8Array,
  prfEncryptionKey: CryptoKey,
  sessionVaultKey: CryptoKey,
  options?: VaultSessionMutationOptions
): Promise<void> {
  assertVaultSessionMutationAllowed(options?.operation);
  const wrappingKey = await importPrfAesKwKey(prfOutput);
  const inner = await extractInnerVaultKeyBlob(encryptedVaultKey, prfEncryptionKey);
  await cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
    inner,
    wrappingKey,
    sessionVaultKey,
    options
  );
}

/**
 * Resolves wrap options using the in-memory cache when `innerVaultKeyBlob` is omitted.
 * Clears stale cache entries on mismatch.
 */
export async function resolveInnerVaultKeyBlobForWrap(
  sessionVaultKey: CryptoKey,
  options?: WrapUserVaultKeyOptions,
  sessionOptions?: VaultSessionMutationOptions
): Promise<WrapUserVaultKeyOptions | undefined> {
  if (options?.innerVaultKeyBlob) {
    return options;
  }

  const cached = getCachedVaultInnerKeyMaterial(sessionOptions);
  if (!cached) {
    return options;
  }

  try {
    await assertInnerVaultKeyBlobMatchesVaultKey(
      cached.inner,
      sessionVaultKey,
      cached.wrappingKey
    );
    assertVaultSessionMutationAllowed(sessionOptions?.operation);
    return { ...options, innerVaultKeyBlob: cached.inner };
  } catch {
    assertVaultSessionMutationAllowed(sessionOptions?.operation);
    clearVaultInnerKeyMaterialCache(sessionOptions);
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
