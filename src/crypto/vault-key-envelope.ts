import type { VaultCryptoProfile, VaultAadScope } from "../profile.js";
import type { EncryptedVaultPayload } from "../validation/schemas.js";
import { bytesToBase64Url, base64UrlToBytes } from "./encoding.js";
import {
  importAesKwKey,
  importUserVaultAesKey,
  isLegacyRawVaultKeyMaterial,
  unwrapAesKey,
  wrapAesKey,
} from "./user-vault-key-crypto.js";
import { decryptField, encryptField } from "./aes-gcm.js";
import { VaultAuthorizationError, VaultKeyNotExtractableError } from "../errors/vault-errors.js";
import { userVaultKeysEqual } from "../keys/user-vault-key.js";

type WrapScope = Pick<VaultAadScope, "userId" | "resourceId">;

export type WrapUserVaultKeyOptions = {
  /** Reuse an existing inner blob (AES-KW or legacy raw) when re-wrapping without exporting the UVK. */
  innerVaultKeyBlob?: Uint8Array;
};

async function materializeInnerVaultKeyBlob(
  vaultKey: CryptoKey,
  wrappingKey: CryptoKey,
  options?: WrapUserVaultKeyOptions
): Promise<Uint8Array> {
  if (options?.innerVaultKeyBlob) {
    return options.innerVaultKeyBlob;
  }

  try {
    return await wrapAesKey(vaultKey, wrappingKey);
  } catch {
    throw new VaultKeyNotExtractableError(
      "Cannot wrap a non-extractable vault key. Re-wrap using innerVaultKeyBlob from the current envelope, or create the first envelope immediately after createUserVaultKey()."
    );
  }
}

export async function extractInnerVaultKeyBlob(
  encryptedVaultKey: EncryptedVaultPayload,
  encryptionKey: CryptoKey
): Promise<Uint8Array> {
  return base64UrlToBytes(await decryptField(encryptedVaultKey, encryptionKey));
}

export async function wrapUserVaultKeyWithDerivedKeys(
  vaultKey: CryptoKey,
  derivedKeys: { encryptionKey: CryptoKey; wrappingKey: CryptoKey },
  scope: WrapScope,
  profile: VaultCryptoProfile,
  options?: WrapUserVaultKeyOptions
): Promise<EncryptedVaultPayload> {
  const inner = await materializeInnerVaultKeyBlob(
    vaultKey,
    derivedKeys.wrappingKey,
    options
  );
  return encryptField(bytesToBase64Url(inner), derivedKeys.encryptionKey, {
    userId: scope.userId,
    resourceId: scope.resourceId,
    field: "vault_key",
  }, profile);
}

export async function unwrapUserVaultKeyWithDerivedKeys(
  encryptedVaultKey: EncryptedVaultPayload,
  derivedKeys: { encryptionKey: CryptoKey; wrappingKey: CryptoKey }
): Promise<CryptoKey> {
  const inner = base64UrlToBytes(await decryptField(encryptedVaultKey, derivedKeys.encryptionKey));
  if (isLegacyRawVaultKeyMaterial(inner)) {
    return importUserVaultAesKey(inner);
  }

  return unwrapAesKey(inner, derivedKeys.wrappingKey);
}

/**
 * Re-wraps stored inner vault-key material for a new derived key pair (password rotation, KDF upgrade).
 * Uses a short-lived extractable UVK handle inside Web Crypto only; raw bytes are not exported.
 */
export async function rewrapInnerVaultKeyMaterialForDerivedKeys(
  inner: Uint8Array,
  oldDerivedKeys: { wrappingKey: CryptoKey },
  newDerivedKeys: { wrappingKey: CryptoKey },
  sessionVaultKey: CryptoKey
): Promise<Uint8Array> {
  const uvkForRewrap = isLegacyRawVaultKeyMaterial(inner)
    ? await importUserVaultAesKey(inner, { extractable: true })
    : await unwrapAesKey(inner, oldDerivedKeys.wrappingKey, { extractable: true });

  if (!(await userVaultKeysEqual(uvkForRewrap, sessionVaultKey))) {
    throw new VaultAuthorizationError("Vault key mismatch during envelope re-wrap");
  }

  return wrapAesKey(uvkForRewrap, newDerivedKeys.wrappingKey);
}

export async function rewrapEncryptedVaultKeyForDerivedKeys(
  encryptedVaultKey: EncryptedVaultPayload,
  oldDerivedKeys: { encryptionKey: CryptoKey; wrappingKey: CryptoKey },
  newDerivedKeys: { encryptionKey: CryptoKey; wrappingKey: CryptoKey },
  sessionVaultKey: CryptoKey,
  scope: WrapScope,
  profile: VaultCryptoProfile
): Promise<EncryptedVaultPayload> {
  const inner = await extractInnerVaultKeyBlob(encryptedVaultKey, oldDerivedKeys.encryptionKey);
  const rewrappedInner = await rewrapInnerVaultKeyMaterialForDerivedKeys(
    inner,
    oldDerivedKeys,
    newDerivedKeys,
    sessionVaultKey
  );
  return encryptField(bytesToBase64Url(rewrappedInner), newDerivedKeys.encryptionKey, {
    userId: scope.userId,
    resourceId: scope.resourceId,
    field: "vault_key",
  }, profile);
}

export async function wrapUserVaultKeyWithPrfOutput(
  vaultKey: CryptoKey,
  prfOutput: Uint8Array,
  scope: WrapScope,
  profile: VaultCryptoProfile,
  prfEncryptionKey: CryptoKey,
  options?: WrapUserVaultKeyOptions
): Promise<EncryptedVaultPayload> {
  const wrappingKey = await importAesKwKey(
    prfOutput.byteLength === 32 ? prfOutput : prfOutput.slice(0, 32)
  );
  const inner = await materializeInnerVaultKeyBlob(vaultKey, wrappingKey, options);
  return encryptField(bytesToBase64Url(inner), prfEncryptionKey, {
    userId: scope.userId,
    resourceId: scope.resourceId,
    field: "vault_key",
  }, profile);
}

export async function unwrapUserVaultKeyWithPrfOutput(
  encryptedVaultKey: EncryptedVaultPayload,
  prfOutput: Uint8Array,
  prfEncryptionKey: CryptoKey
): Promise<CryptoKey> {
  const inner = base64UrlToBytes(await decryptField(encryptedVaultKey, prfEncryptionKey));
  if (isLegacyRawVaultKeyMaterial(inner)) {
    return importUserVaultAesKey(inner);
  }

  const wrappingKey = await importAesKwKey(
    prfOutput.byteLength === 32 ? prfOutput : prfOutput.slice(0, 32)
  );
  return unwrapAesKey(inner, wrappingKey);
}
