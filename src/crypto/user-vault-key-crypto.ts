import { toBufferSource } from "./encoding.js";

const AES_GCM = "AES-GCM" as const;
const AES_KW = "AES-KW" as const;

/** Generates a non-extractable 256-bit AES-GCM user vault key. */
export async function generateUserVaultAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: AES_GCM, length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function importUserVaultAesKey(
  rawKey: Uint8Array,
  options: { extractable?: boolean } = {}
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toBufferSource(rawKey),
    { name: AES_GCM, length: 256 },
    options.extractable ?? false,
    ["encrypt", "decrypt"]
  );
}

export async function importAesKwKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toBufferSource(rawKey),
    { name: AES_KW, length: 256 },
    false,
    ["wrapKey", "unwrapKey"]
  );
}

export async function wrapAesKey(key: CryptoKey, wrappingKey: CryptoKey): Promise<Uint8Array> {
  const wrapped = await crypto.subtle.wrapKey("raw", key, wrappingKey, AES_KW);
  return new Uint8Array(wrapped);
}

export async function unwrapAesKey(
  wrappedKey: Uint8Array,
  unwrappingKey: CryptoKey,
  options: { extractable?: boolean } = {}
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    "raw",
    toBufferSource(wrappedKey),
    unwrappingKey,
    AES_KW,
    { name: AES_GCM, length: 256 },
    options.extractable ?? false,
    ["encrypt", "decrypt"]
  );
}

/** Legacy envelopes stored 32 raw UVK bytes after the outer decrypt. */
export function isLegacyRawVaultKeyMaterial(bytes: Uint8Array): boolean {
  return bytes.byteLength === 32;
}
