import type { EncryptedVaultPayload, PasskeyPrfEnvelope } from "../validation/schemas.js";
import type { VaultCryptoProfile, VaultAadScope } from "../profile.js";
import type { WrapUserVaultKeyOptions } from "../crypto/vault-key-envelope.js";
import { PasskeyPrfRequiredError, PasskeyUnlockError, VaultAuthorizationError } from "../errors/vault-errors.js";
import { importPrfAesGcmKey, importPrfAesKwKey } from "../crypto/prf-key.js";
import {
  unwrapUserVaultKeyWithPrfOutput,
  wrapUserVaultKeyWithPrfOutput,
  rewrapInnerVaultKeyMaterialForWrappingKeys,
} from "../crypto/vault-key-envelope.js";
import {
  getCachedVaultInnerKeyMaterial,
  clearVaultInnerKeyMaterialCache,
  resolveInnerVaultKeyBlobForWrap,
  INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE,
} from "../session/inner-key-material-cache.js";
import {
  assertVaultSessionMutationAllowed,
  type VaultSessionMutationOptions,
} from "../session/vault-session-operation.js";
import { assertVaultKeyAad } from "../validation/aad-assert.js";
import { unlockVaultKeyEnvelopeWithAadRouting } from "./legacy-vault-key-unlock.js";

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
  isPrfExtensionHeuristicallyAvailable,
  isPrfExtensionSupported,
  parseAppleMobileOsMajorVersion,
  type PrfExtensionSupportOptions,
} from "./passkey-prf-support.js";

export {
  resolvePasskeyPrfCapability,
  type PasskeyPrfCapability,
  type ResolvePasskeyPrfCapabilityInput,
} from "./passkey-prf-capability.js";

type WrapScope = Pick<VaultAadScope, "userId" | "resourceId">;

export type CreatePasskeyPrfEnvelopeOptions = WrapUserVaultKeyOptions;
export type CreatePasskeyPrfEnvelopeWithSessionCacheOptions =
  CreatePasskeyPrfEnvelopeOptions & VaultSessionMutationOptions;

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
  const prfKey = await importPrfAesGcmKey(prfOutput);
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
  options?: CreatePasskeyPrfEnvelopeWithSessionCacheOptions
): Promise<PasskeyPrfEnvelope> {
  const { operation, ...wrapOptions } = options ?? {};
  assertVaultSessionMutationAllowed(operation);

  if (wrapOptions.innerVaultKeyBlob) {
    const envelope = await createPasskeyPrfEnvelope(
      vaultKey,
      prfOutput,
      scope,
      profile,
      publicMetadata,
      wrapOptions
    );
    assertVaultSessionMutationAllowed(operation);
    return envelope;
  }

  const sessionOptions = { operation };
  const cached = getCachedVaultInnerKeyMaterial(sessionOptions);
  if (cached) {
    try {
      const prfWrappingKey = await importPrfAesKwKey(prfOutput);
      const rewrappedInner = await rewrapInnerVaultKeyMaterialForWrappingKeys(
        cached.inner,
        cached.wrappingKey,
        prfWrappingKey,
        vaultKey
      );
      assertVaultSessionMutationAllowed(operation);
      const envelope = await createPasskeyPrfEnvelope(
        vaultKey,
        prfOutput,
        scope,
        profile,
        publicMetadata,
        { ...wrapOptions, innerVaultKeyBlob: rewrappedInner }
      );
      assertVaultSessionMutationAllowed(operation);
      return envelope;
    } catch (error) {
      assertVaultSessionMutationAllowed(operation);
      clearVaultInnerKeyMaterialCache(sessionOptions);
      if (error instanceof VaultAuthorizationError) {
        throw new VaultAuthorizationError(INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE);
      }
      throw error;
    }
  }

  const resolvedOptions = await resolveInnerVaultKeyBlobForWrap(
    vaultKey,
    wrapOptions,
    sessionOptions
  );
  assertVaultSessionMutationAllowed(operation);
  const envelope = await createPasskeyPrfEnvelope(
    vaultKey,
    prfOutput,
    scope,
    profile,
    publicMetadata,
    resolvedOptions
  );
  assertVaultSessionMutationAllowed(operation);
  return envelope;
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
  const prfKey = await importPrfAesGcmKey(prfOutput);
  const decrypt = async (candidate: EncryptedVaultPayload) =>
    unwrapUserVaultKeyWithPrfOutput(candidate, prfOutput, prfKey);

  if (options?.strictAad) {
    assertVaultKeyAad(expectedScope, encryptedVaultKey, profile);
    return decrypt(encryptedVaultKey);
  }

  return unlockVaultKeyEnvelopeWithAadRouting(
    encryptedVaultKey,
    expectedScope,
    profile,
    decrypt
  );
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
