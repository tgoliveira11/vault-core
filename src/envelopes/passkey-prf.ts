import type { EncryptedVaultPayload, PasskeyPrfEnvelope } from "../validation/schemas.js";
import type { VaultCryptoProfile, VaultAadScope } from "../profile.js";
import type { WrapUserVaultKeyOptions } from "../crypto/vault-key-envelope.js";
import { PasskeyPrfRequiredError, PasskeyUnlockError, VaultAuthorizationError } from "../errors/vault-errors.js";
import { toBufferSource } from "../crypto/encoding.js";
import {
  unwrapUserVaultKeyWithPrfOutput,
  wrapUserVaultKeyWithPrfOutput,
  rewrapInnerVaultKeyMaterialForWrappingKeys,
} from "../crypto/vault-key-envelope.js";
import { importAesKwKey } from "../crypto/user-vault-key-crypto.js";
import {
  getCachedVaultInnerKeyMaterial,
  clearVaultInnerKeyMaterialCache,
  resolveInnerVaultKeyBlobForWrap,
  INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE,
} from "../session/inner-key-material-cache.js";
import { assertVaultKeyAad } from "../validation/aad-assert.js";
import { normalizeEnvelopeAadContext } from "../validation/envelope-aad-normalize.js";

export {
  extractPasskeyPrfOutput,
  prfBytesForAes256Import,
  type ExtractPasskeyPrfOutputOptions,
} from "./passkey-prf-output.js";

export function isPasskeySupported(): boolean {
  return typeof globalThis !== "undefined" &&
    typeof globalThis.PublicKeyCredential !== "undefined";
}

export {
  DEFAULT_APPLE_MOBILE_PRF_MIN_MAJOR_VERSION,
  isPrfExtensionSupported,
  parseAppleMobileOsMajorVersion,
  type PrfExtensionSupportOptions,
} from "./passkey-prf-support.js";

async function importPrfAsAesKey(prfOutput: Uint8Array): Promise<CryptoKey> {
  const keyBytes = prfOutput.byteLength === 32 ? prfOutput : prfOutput.slice(0, 32);
  return crypto.subtle.importKey(
    "raw",
    toBufferSource(keyBytes),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

type WrapScope = Pick<VaultAadScope, "userId" | "resourceId">;

export type CreatePasskeyPrfEnvelopeOptions = WrapUserVaultKeyOptions;

export async function createPasskeyPrfEnvelope(
  vaultKey: CryptoKey,
  prfOutput: Uint8Array,
  scope: WrapScope,
  profile: VaultCryptoProfile,
  publicMetadata?: Record<string, unknown>,
  options?: CreatePasskeyPrfEnvelopeOptions
): Promise<PasskeyPrfEnvelope> {
  if (prfOutput.byteLength < 32) {
    throw new Error("PRF output must be at least 32 bytes");
  }
  const prfKey = await importPrfAsAesKey(prfOutput);
  const encryptedVaultKey = await wrapUserVaultKeyWithPrfOutput(
    vaultKey,
    prfOutput,
    scope,
    profile,
    prfKey,
    options
  );
  return {
    method: "passkey_prf",
    encryptedVaultKey,
    kdfMetadata: null,
    publicMetadata,
  };
}

/**
 * Creates a passkey PRF envelope using the in-memory inner-key cache when
 * `innerVaultKeyBlob` is omitted and the session UVK is non-extractable.
 */
export async function createPasskeyPrfEnvelopeWithSessionCache(
  vaultKey: CryptoKey,
  prfOutput: Uint8Array,
  scope: WrapScope,
  profile: VaultCryptoProfile,
  publicMetadata?: Record<string, unknown>,
  options?: CreatePasskeyPrfEnvelopeOptions
): Promise<PasskeyPrfEnvelope> {
  if (options?.innerVaultKeyBlob) {
    return createPasskeyPrfEnvelope(
      vaultKey,
      prfOutput,
      scope,
      profile,
      publicMetadata,
      options
    );
  }

  const cached = getCachedVaultInnerKeyMaterial();
  if (cached) {
    try {
      const prfWrappingKey = await importAesKwKey(
        prfOutput.byteLength === 32 ? prfOutput : prfOutput.slice(0, 32)
      );
      const rewrappedInner = await rewrapInnerVaultKeyMaterialForWrappingKeys(
        cached.inner,
        cached.wrappingKey,
        prfWrappingKey,
        vaultKey
      );
      return createPasskeyPrfEnvelope(
        vaultKey,
        prfOutput,
        scope,
        profile,
        publicMetadata,
        { ...options, innerVaultKeyBlob: rewrappedInner }
      );
    } catch (error) {
      clearVaultInnerKeyMaterialCache();
      if (error instanceof VaultAuthorizationError) {
        throw new VaultAuthorizationError(INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE);
      }
      throw error;
    }
  }

  const resolvedOptions = await resolveInnerVaultKeyBlobForWrap(vaultKey, options);
  return createPasskeyPrfEnvelope(
    vaultKey,
    prfOutput,
    scope,
    profile,
    publicMetadata,
    resolvedOptions
  );
}

export async function unwrapVaultKeyFromPasskey(
  encryptedVaultKey: EncryptedVaultPayload,
  prfOutput: Uint8Array,
  expectedScope: WrapScope,
  profile: VaultCryptoProfile,
  options?: { strictAad?: boolean }
): Promise<CryptoKey> {
  if (prfOutput.byteLength < 32) {
    throw new Error("PRF output must be at least 32 bytes");
  }
  const normalizedPayload = options?.strictAad
    ? encryptedVaultKey
    : normalizeEnvelopeAadContext(encryptedVaultKey, profile);
  assertVaultKeyAad(expectedScope, normalizedPayload, profile);
  const prfKey = await importPrfAsAesKey(prfOutput);
  return unwrapUserVaultKeyWithPrfOutput(normalizedPayload, prfOutput, prfKey);
}

export async function unlockWithPasskeyPrfEnvelope(
  envelope: PasskeyPrfEnvelope | { encryptedVaultKey: EncryptedVaultPayload },
  prfOutput: Uint8Array | null,
  expectedScope: WrapScope,
  profile: VaultCryptoProfile,
  options?: { prfRequired?: boolean }
): Promise<CryptoKey> {
  const prfRequired = options?.prfRequired ?? true;

  if (prfRequired && !prfOutput) {
    throw new PasskeyPrfRequiredError(
      "This passkey requires browser PRF support to unlock your vault. Use your vault password or recovery phrase."
    );
  }

  if (!prfOutput) {
    throw new PasskeyUnlockError(
      "Could not unlock your vault with this passkey. Use your vault password or recovery phrase."
    );
  }

  try {
    return await unwrapVaultKeyFromPasskey(
      envelope.encryptedVaultKey,
      prfOutput,
      expectedScope,
      profile
    );
  } catch {
    throw new PasskeyUnlockError(
      "Could not decrypt your vault with this passkey. Use your vault password or recovery phrase."
    );
  }
}

/** @deprecated Use unlockWithPasskeyPrfEnvelope */
export async function unlockVaultFromPasskeyEnvelope(
  encryptedVaultKeyOrEnvelope: EncryptedVaultPayload | PasskeyPrfEnvelope,
  prfOutput: Uint8Array | null,
  expectedScope: WrapScope,
  profile: VaultCryptoProfile,
  options?: { prfRequired?: boolean }
): Promise<CryptoKey> {
  const envelope =
    "method" in encryptedVaultKeyOrEnvelope
      ? encryptedVaultKeyOrEnvelope
      : { encryptedVaultKey: encryptedVaultKeyOrEnvelope, method: "passkey_prf" as const, kdfMetadata: null };
  return unlockWithPasskeyPrfEnvelope(envelope, prfOutput, expectedScope, profile, options);
}

/** @deprecated Use createPasskeyPrfEnvelope */
export async function wrapVaultKeyForPasskey(
  vaultKey: CryptoKey,
  prfOutput: Uint8Array,
  userId: string,
  resourceId: string,
  profile: VaultCryptoProfile,
  publicMetadata?: Record<string, unknown>
): Promise<EncryptedVaultPayload> {
  const envelope = await createPasskeyPrfEnvelope(
    vaultKey,
    prfOutput,
    { userId, resourceId },
    profile,
    publicMetadata
  );
  return envelope.encryptedVaultKey;
}

export { PasskeyPrfRequiredError, PasskeyUnlockError } from "../errors/vault-errors.js";
