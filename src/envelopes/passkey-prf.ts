import type { EncryptedVaultPayload, PasskeyPrfEnvelope } from "../validation/schemas.js";
import type { VaultCryptoProfile, VaultAadScope } from "../profile.js";
import { PasskeyPrfRequiredError, PasskeyUnlockError } from "../errors/vault-errors.js";
import { encryptField, decryptField, exportAesKey, importAesKey } from "../crypto/aes-gcm.js";
import { bytesToBase64Url, base64UrlToBytes, toBufferSource } from "../crypto/encoding.js";

interface PrfClientExtensionResults {
  prf?: {
    results?: {
      first?: ArrayBuffer;
    };
  };
}

export function isPasskeySupported(): boolean {
  return typeof globalThis !== "undefined" &&
    typeof globalThis.PublicKeyCredential !== "undefined";
}

export function isPrfExtensionSupported(): boolean {
  if (!isPasskeySupported()) return false;
  return typeof PublicKeyCredential !== "undefined" &&
    "getClientExtensionResults" in PublicKeyCredential.prototype;
}

export function extractPasskeyPrfOutput(
  clientExtensionResults: Record<string, unknown>
): Uint8Array | null {
  const prf = (clientExtensionResults as PrfClientExtensionResults).prf;
  const first = prf?.results?.first;
  if (!first || first.byteLength < 32) return null;
  return new Uint8Array(first);
}

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

export async function createPasskeyPrfEnvelope(
  vaultKey: CryptoKey,
  prfOutput: Uint8Array,
  scope: WrapScope,
  profile: VaultCryptoProfile,
  publicMetadata?: Record<string, unknown>
): Promise<PasskeyPrfEnvelope> {
  if (prfOutput.byteLength < 32) {
    throw new Error("PRF output must be at least 32 bytes");
  }
  const prfKey = await importPrfAsAesKey(prfOutput);
  const encryptedVaultKey = await encryptField(
    bytesToBase64Url(await exportAesKey(vaultKey)),
    prfKey,
    {
      userId: scope.userId,
      resourceId: scope.resourceId,
      field: "vault_key",
    },
    profile
  );
  return {
    method: "passkey_prf",
    encryptedVaultKey,
    kdfMetadata: null,
    publicMetadata,
  };
}

export async function unwrapVaultKeyFromPasskey(
  encryptedVaultKey: EncryptedVaultPayload,
  prfOutput: Uint8Array
): Promise<CryptoKey> {
  if (prfOutput.byteLength < 32) {
    throw new Error("PRF output must be at least 32 bytes");
  }
  const prfKey = await importPrfAsAesKey(prfOutput);
  const keyBytes = base64UrlToBytes(await decryptField(encryptedVaultKey, prfKey));
  return importAesKey(keyBytes);
}

export async function unlockWithPasskeyPrfEnvelope(
  envelope: PasskeyPrfEnvelope | { encryptedVaultKey: EncryptedVaultPayload },
  prfOutput: Uint8Array | null,
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
    return await unwrapVaultKeyFromPasskey(envelope.encryptedVaultKey, prfOutput);
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
  options?: { prfRequired?: boolean }
): Promise<CryptoKey> {
  const envelope =
    "method" in encryptedVaultKeyOrEnvelope
      ? encryptedVaultKeyOrEnvelope
      : { encryptedVaultKey: encryptedVaultKeyOrEnvelope, method: "passkey_prf" as const, kdfMetadata: null };
  return unlockWithPasskeyPrfEnvelope(envelope, prfOutput, options);
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
