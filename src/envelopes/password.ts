import type {
  Argon2idKdfMetadata,
  EncryptedVaultPayload,
  KdfMetadata,
  PasswordEnvelope,
} from "../validation/schemas.js";
import type { VaultCryptoProfile, VaultAadScope } from "../profile.js";
import type { WrapUserVaultKeyOptions } from "../crypto/vault-key-envelope.js";
import {
  unwrapUserVaultKeyWithDerivedKeys,
  wrapUserVaultKeyWithDerivedKeys,
} from "../crypto/vault-key-envelope.js";
import {
  deriveVaultPasswordKey,
  deriveVaultPasswordKeyPairFromMetadata,
} from "../kdf/argon2id.js";
import { assertVaultKeyAad } from "../validation/aad-assert.js";

type WrapScope = Pick<VaultAadScope, "userId" | "resourceId">;

export type CreatePasswordEnvelopeOptions = WrapUserVaultKeyOptions;

export async function createPasswordEnvelope(
  vaultKey: CryptoKey,
  vaultPassword: string,
  scope: WrapScope,
  profile: VaultCryptoProfile,
  salt?: Uint8Array,
  options?: CreatePasswordEnvelopeOptions
): Promise<{ envelope: PasswordEnvelope; kdfMetadata: Argon2idKdfMetadata }> {
  const { key: encryptionKey, wrappingKey, metadata } = await deriveVaultPasswordKey(
    vaultPassword,
    salt
  );
  const encryptedVaultKey = await wrapUserVaultKeyWithDerivedKeys(
    vaultKey,
    { encryptionKey, wrappingKey },
    scope,
    profile,
    options
  );
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
  envelope: PasswordEnvelope | { encryptedVaultKey: EncryptedVaultPayload; kdfMetadata: KdfMetadata },
  expectedScope: WrapScope,
  profile: VaultCryptoProfile
): Promise<CryptoKey> {
  if (envelope.kdfMetadata?.kdf !== "argon2id") {
    throw new Error("Vault password envelope requires Argon2id metadata");
  }
  assertVaultKeyAad(expectedScope, envelope.encryptedVaultKey, profile);
  const derivedKeys = await deriveVaultPasswordKeyPairFromMetadata(
    vaultPassword,
    envelope.kdfMetadata
  );
  return unwrapUserVaultKeyWithDerivedKeys(envelope.encryptedVaultKey, derivedKeys);
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
