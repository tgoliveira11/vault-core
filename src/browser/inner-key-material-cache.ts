import type { PasskeyPrfEnvelope, PasswordEnvelope, RecoveryPhraseEnvelope } from "../validation/schemas.js";
import { deriveVaultPasswordKeyPairFromMetadata } from "../kdf/argon2id.js";
import { deriveRecoveryPhraseKeyFromMetadata } from "../envelopes/recovery.js";
import { extractInnerVaultKeyBlob } from "../crypto/vault-key-envelope.js";
import { toBufferSource } from "../crypto/encoding.js";
import {
  VaultInnerKeyMaterialCache,
  cacheVaultInnerKeyMaterialFromEnvelopeDecrypt,
  cacheVaultInnerKeyMaterialFromPasskeyEnvelope,
  clearVaultInnerKeyMaterialCache,
  getCachedVaultInnerKeyMaterial,
  INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE,
  resolveInnerVaultKeyBlobForWrap,
  type VaultInnerKeyMaterialCacheEntry,
} from "../session/inner-key-material-cache.js";

export {
  VaultInnerKeyMaterialCache,
  cacheVaultInnerKeyMaterialFromEnvelopeDecrypt,
  cacheVaultInnerKeyMaterialFromPasskeyEnvelope,
  clearVaultInnerKeyMaterialCache,
  getCachedVaultInnerKeyMaterial,
  INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE,
  resolveInnerVaultKeyBlobForWrap,
  type VaultInnerKeyMaterialCacheEntry,
};

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

/** Populates the inner-key cache after a successful password envelope unlock. */
export async function cacheVaultInnerKeyMaterialAfterPasswordUnlock(
  sessionVaultKey: CryptoKey,
  envelope: PasswordEnvelope | { encryptedVaultKey: PasswordEnvelope["encryptedVaultKey"]; kdfMetadata: PasswordEnvelope["kdfMetadata"] },
  vaultPassword: string
): Promise<void> {
  if (envelope.kdfMetadata?.kdf !== "argon2id") {
    throw new Error("Vault password envelope requires Argon2id metadata");
  }
  const derivedKeys = await deriveVaultPasswordKeyPairFromMetadata(
    vaultPassword,
    envelope.kdfMetadata
  );
  const inner = await extractInnerVaultKeyBlob(
    envelope.encryptedVaultKey,
    derivedKeys.encryptionKey
  );
  await cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
    inner,
    derivedKeys.wrappingKey,
    sessionVaultKey
  );
}

/** Populates the inner-key cache after a successful recovery phrase envelope unlock. */
export async function cacheVaultInnerKeyMaterialAfterRecoveryUnlock(
  sessionVaultKey: CryptoKey,
  envelope: RecoveryPhraseEnvelope | { encryptedVaultKey: RecoveryPhraseEnvelope["encryptedVaultKey"]; kdfMetadata: RecoveryPhraseEnvelope["kdfMetadata"] },
  recoveryPhrase: string
): Promise<void> {
  if (envelope.kdfMetadata?.kdf !== "argon2id") {
    throw new Error("Recovery phrase envelope requires Argon2id metadata");
  }
  const derivedKeys = await deriveRecoveryPhraseKeyFromMetadata(
    recoveryPhrase,
    envelope.kdfMetadata
  );
  const inner = await extractInnerVaultKeyBlob(
    envelope.encryptedVaultKey,
    derivedKeys.encryptionKey
  );
  await cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
    inner,
    derivedKeys.wrappingKey,
    sessionVaultKey
  );
}

/** Populates the inner-key cache after a successful passkey PRF envelope unlock. */
export async function cacheVaultInnerKeyMaterialFromPasskeyUnlock(
  sessionVaultKey: CryptoKey,
  envelope: PasskeyPrfEnvelope | { encryptedVaultKey: PasskeyPrfEnvelope["encryptedVaultKey"] },
  prfOutput: Uint8Array
): Promise<void> {
  const prfKey = await importPrfAsAesKey(prfOutput);
  await cacheVaultInnerKeyMaterialFromPasskeyEnvelope(
    envelope.encryptedVaultKey,
    prfOutput,
    prfKey,
    sessionVaultKey
  );
}
