import type { VaultAadScope, VaultCryptoProfile } from "../profile.js";
import type { EncryptedVaultPayload } from "../validation/schemas.js";
import { assertVaultKeyAad } from "../validation/aad-assert.js";
import { randomBytes } from "./random.js";
import { toBufferSource } from "./encoding.js";
import {
  unwrapUserVaultKeyWithDerivedKeys,
  wrapUserVaultKeyWithDerivedKeys,
  type WrapUserVaultKeyOptions,
} from "./vault-key-envelope.js";

export const PORTABLE_VAULT_UNLOCK_KEY_BYTES = 32;

const HKDF_SALT = new TextEncoder().encode("vault-core:portable-vault-broker:puk:v1");
const ENCRYPTION_INFO = new TextEncoder().encode(
  "vault-core:portable-vault-broker:envelope-encryption:v1"
);
const WRAPPING_INFO = new TextEncoder().encode(
  "vault-core:portable-vault-broker:vault-key-wrapping:v1"
);

export type PortableVaultOpaqueAadScope = Pick<VaultAadScope, "userId" | "resourceId">;

function assertPortableUnlockKey(puk: Uint8Array): void {
  if (puk.byteLength !== PORTABLE_VAULT_UNLOCK_KEY_BYTES) {
    throw new Error("Portable unlock key must be exactly 32 bytes");
  }
}

async function derivePortableVaultKeys(
  puk: Uint8Array
): Promise<{ encryptionKey: CryptoKey; wrappingKey: CryptoKey }> {
  assertPortableUnlockKey(puk);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    toBufferSource(puk),
    "HKDF",
    false,
    ["deriveKey"]
  );
  const [encryptionKey, wrappingKey] = await Promise.all([
    crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: toBufferSource(HKDF_SALT),
        info: toBufferSource(ENCRYPTION_INFO),
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    ),
    crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: toBufferSource(HKDF_SALT),
        info: toBufferSource(WRAPPING_INFO),
      },
      keyMaterial,
      { name: "AES-KW", length: 256 },
      false,
      ["wrapKey", "unwrapKey"]
    ),
  ]);
  return { encryptionKey, wrappingKey };
}

/** Generates a browser-owned 256-bit key for one portable broker envelope. */
export function generatePortableVaultUnlockKey(): Uint8Array {
  return randomBytes(PORTABLE_VAULT_UNLOCK_KEY_BYTES);
}

/**
 * Generates pairwise random AAD identifiers. They are intentionally unrelated to an account ID,
 * email address, WebAuthn credential ID, or broker subject.
 */
export function generatePortableVaultOpaqueAadScope(): PortableVaultOpaqueAadScope {
  return {
    userId: crypto.randomUUID(),
    resourceId: crypto.randomUUID(),
  };
}

export type CreatePortableVaultBrokerEnvelopeOptions = WrapUserVaultKeyOptions;

/**
 * Encrypts a UVK for a portable broker PUK. Network transport and PUK custody are consumer-owned.
 */
export async function createPortableVaultBrokerEncryptedVaultKey(
  vaultKey: CryptoKey,
  puk: Uint8Array,
  opaqueScope: PortableVaultOpaqueAadScope,
  profile: VaultCryptoProfile,
  options?: CreatePortableVaultBrokerEnvelopeOptions
): Promise<EncryptedVaultPayload> {
  const derivedKeys = await derivePortableVaultKeys(puk);
  return wrapUserVaultKeyWithDerivedKeys(
    vaultKey,
    derivedKeys,
    opaqueScope,
    profile,
    options
  );
}

/** Restores a non-extractable UVK after strictly validating the opaque AAD scope and profile. */
export async function unlockPortableVaultBrokerEncryptedVaultKey(
  encryptedVaultKey: EncryptedVaultPayload,
  puk: Uint8Array,
  expectedOpaqueScope: PortableVaultOpaqueAadScope,
  profile: VaultCryptoProfile
): Promise<CryptoKey> {
  assertVaultKeyAad(expectedOpaqueScope, encryptedVaultKey, profile);
  const derivedKeys = await derivePortableVaultKeys(puk);
  return unwrapUserVaultKeyWithDerivedKeys(encryptedVaultKey, derivedKeys);
}
