import type { PasskeyPrfEnvelope, PasswordEnvelope, RecoveryPhraseEnvelope } from "../validation/schemas.js";
import { deriveVaultPasswordKeyPairFromMetadata } from "../kdf/argon2id.js";
import { deriveRecoveryPhraseKeyFromMetadata } from "../envelopes/recovery.js";
import { extractInnerVaultKeyBlob } from "../crypto/vault-key-envelope.js";
import { importPrfAesGcmKey } from "../crypto/prf-key.js";
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
import {
  assertVaultSessionMutationAllowed,
  type VaultSessionMutationOptions,
} from "../session/vault-session-operation.js";

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

/** Populates the inner-key cache after a successful password envelope unlock. */
export async function cacheVaultInnerKeyMaterialAfterPasswordUnlock(
  sessionVaultKey: CryptoKey,
  envelope: PasswordEnvelope | { encryptedVaultKey: PasswordEnvelope["encryptedVaultKey"]; kdfMetadata: PasswordEnvelope["kdfMetadata"] },
  vaultPassword: string,
  options?: VaultSessionMutationOptions
): Promise<void> {
  assertVaultSessionMutationAllowed(options?.operation);
  if (envelope.kdfMetadata?.kdf !== "argon2id") {
    throw new Error("Vault password envelope requires Argon2id metadata");
  }
  const derivedKeys = await deriveVaultPasswordKeyPairFromMetadata(
    vaultPassword,
    envelope.kdfMetadata
  );
  // The lower-level cache commit revalidates again after every remaining await.
  const inner = await extractInnerVaultKeyBlob(
    envelope.encryptedVaultKey,
    derivedKeys.encryptionKey
  );
  await cacheVaultInnerKeyMaterialFromEnvelopeDecrypt(
    inner,
    derivedKeys.wrappingKey,
    sessionVaultKey,
    options
  );
}

/** Populates the inner-key cache after a successful recovery phrase envelope unlock. */
export async function cacheVaultInnerKeyMaterialAfterRecoveryUnlock(
  sessionVaultKey: CryptoKey,
  envelope: RecoveryPhraseEnvelope | { encryptedVaultKey: RecoveryPhraseEnvelope["encryptedVaultKey"]; kdfMetadata: RecoveryPhraseEnvelope["kdfMetadata"] },
  recoveryPhrase: string,
  options?: VaultSessionMutationOptions
): Promise<void> {
  assertVaultSessionMutationAllowed(options?.operation);
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
    sessionVaultKey,
    options
  );
}

/** Populates the inner-key cache after a successful passkey PRF envelope unlock. */
export async function cacheVaultInnerKeyMaterialFromPasskeyUnlock(
  sessionVaultKey: CryptoKey,
  envelope: PasskeyPrfEnvelope | { encryptedVaultKey: PasskeyPrfEnvelope["encryptedVaultKey"] },
  prfOutput: Uint8Array,
  options?: VaultSessionMutationOptions
): Promise<void> {
  assertVaultSessionMutationAllowed(options?.operation);
  const prfKey = await importPrfAesGcmKey(prfOutput);
  await cacheVaultInnerKeyMaterialFromPasskeyEnvelope(
    envelope.encryptedVaultKey,
    prfOutput,
    prfKey,
    sessionVaultKey,
    options
  );
}
