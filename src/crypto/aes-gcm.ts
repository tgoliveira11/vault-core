import { ENCRYPTION_ALG, ENCRYPTION_VERSION, MAX_VAULT_CIPHERTEXT_BYTES, MAX_VAULT_IV_BYTES } from "../constants.js";
import type { VaultCryptoProfile, VaultAadScope } from "../profile.js";
import { resolveAadContext } from "../profile.js";
import type { EncryptedVaultPayload } from "../validation/schemas.js";
import { canonicalAadString, aadByteCandidates } from "./aad.js";
import {
  bytesToBase64Url,
  decodeBoundedBase64Url,
  stringToBytes,
  bytesToString,
  toBufferSource,
} from "./encoding.js";

const IV_LENGTH = MAX_VAULT_IV_BYTES;

export async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ENCRYPTION_ALG, length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toBufferSource(rawKey),
    { name: ENCRYPTION_ALG, length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportAesKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

export type EncryptFieldAad = VaultAadScope;

export async function encryptField(
  plaintext: string,
  key: CryptoKey,
  aad: EncryptFieldAad,
  profile: VaultCryptoProfile
): Promise<EncryptedVaultPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const aadWithContext = {
    ...aad,
    context: resolveAadContext(aad, profile),
  };
  const aadBytes = stringToBytes(canonicalAadString(aadWithContext));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: ENCRYPTION_ALG,
      iv: toBufferSource(iv),
      additionalData: toBufferSource(aadBytes),
    },
    key,
    toBufferSource(stringToBytes(plaintext))
  );

  return {
    version: ENCRYPTION_VERSION,
    alg: ENCRYPTION_ALG,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertextBuffer)),
    aad: aadWithContext,
  };
}

export async function decryptField(
  payload: EncryptedVaultPayload,
  key: CryptoKey
): Promise<string> {
  const iv = decodeBoundedBase64Url(payload.iv, MAX_VAULT_IV_BYTES);
  const ciphertext = decodeBoundedBase64Url(payload.ciphertext, MAX_VAULT_CIPHERTEXT_BYTES);
  let lastError: unknown;

  for (const aadBytes of aadByteCandidates(payload.aad)) {
    try {
      const plaintextBuffer = await crypto.subtle.decrypt(
        {
          name: ENCRYPTION_ALG,
          iv: toBufferSource(iv),
          additionalData: toBufferSource(aadBytes),
        },
        key,
        toBufferSource(ciphertext)
      );
      return bytesToString(new Uint8Array(plaintextBuffer));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Decryption failed");
}
