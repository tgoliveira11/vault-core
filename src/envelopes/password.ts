import type {
  Argon2idKdfMetadata,
  EncryptedVaultPayload,
  KdfMetadata,
  PasswordEnvelope,
} from "../validation/schemas.js";
import type { VaultCryptoProfile, VaultAadScope } from "../profile.js";
import { encryptField, decryptField, exportAesKey, importAesKey } from "../crypto/aes-gcm.js";
import { bytesToBase64Url, base64UrlToBytes } from "../crypto/encoding.js";
import {
  deriveVaultPasswordKey,
  deriveVaultPasswordKeyFromMetadata,
} from "../kdf/argon2id.js";

type WrapScope = Pick<VaultAadScope, "userId" | "resourceId">;

async function wrapVaultKeyWithDerivedKey(
  vaultKey: CryptoKey,
  derivedKey: CryptoKey,
  scope: WrapScope,
  profile: VaultCryptoProfile
): Promise<EncryptedVaultPayload> {
  return encryptField(bytesToBase64Url(await exportAesKey(vaultKey)), derivedKey, {
    userId: scope.userId,
    resourceId: scope.resourceId,
    field: "vault_key",
  }, profile);
}

async function unwrapVaultKeyWithDerivedKey(
  encryptedVaultKey: EncryptedVaultPayload,
  derivedKey: CryptoKey
): Promise<CryptoKey> {
  const keyBytes = base64UrlToBytes(await decryptField(encryptedVaultKey, derivedKey));
  return importAesKey(keyBytes);
}

export async function createPasswordEnvelope(
  vaultKey: CryptoKey,
  vaultPassword: string,
  scope: WrapScope,
  profile: VaultCryptoProfile,
  salt?: Uint8Array
): Promise<{ envelope: PasswordEnvelope; kdfMetadata: Argon2idKdfMetadata }> {
  const { key: derivedKey, metadata } = await deriveVaultPasswordKey(vaultPassword, salt);
  const encryptedVaultKey = await wrapVaultKeyWithDerivedKey(vaultKey, derivedKey, scope, profile);
  return {
    envelope: {
      method: "password",
      encryptedVaultKey,
      kdfMetadata: metadata,
    },
    kdfMetadata: metadata,
  };
}

export async function unlockWithPasswordEnvelope(
  vaultPassword: string,
  envelope: PasswordEnvelope | { encryptedVaultKey: EncryptedVaultPayload; kdfMetadata: KdfMetadata }
): Promise<CryptoKey> {
  if (envelope.kdfMetadata?.kdf !== "argon2id") {
    throw new Error("Vault password envelope requires Argon2id metadata");
  }
  const derivedKey = await deriveVaultPasswordKeyFromMetadata(vaultPassword, envelope.kdfMetadata);
  return unwrapVaultKeyWithDerivedKey(envelope.encryptedVaultKey, derivedKey);
}

/** @deprecated Use createPasswordEnvelope */
export async function wrapVaultKeyForPassword(
  vaultKey: CryptoKey,
  vaultPassword: string,
  scope: WrapScope,
  profile: VaultCryptoProfile,
  salt?: Uint8Array
): Promise<{ encryptedVaultKey: EncryptedVaultPayload; kdfMetadata: Argon2idKdfMetadata }> {
  const { envelope, kdfMetadata } = await createPasswordEnvelope(
    vaultKey,
    vaultPassword,
    scope,
    profile,
    salt
  );
  return { encryptedVaultKey: envelope.encryptedVaultKey, kdfMetadata };
}

/** @deprecated Use unlockWithPasswordEnvelope */
export const unwrapVaultKeyFromPassword = unlockWithPasswordEnvelope;
