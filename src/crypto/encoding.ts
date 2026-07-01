import { VaultPayloadSizeError } from "../errors/vault-errors.js";

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function maxBase64UrlEncodedLength(maxBytes: number): number {
  return Math.ceil(maxBytes / 3) * 4;
}

/**
 * Decodes base64url after bounding encoded length and decoded byte count.
 * @throws {import("../errors/vault-errors.js").VaultPayloadSizeError}
 */
export function decodeBoundedBase64Url(input: string, maxBytes: number): Uint8Array {
  const maxEncodedLength = maxBase64UrlEncodedLength(maxBytes);
  if (input.length > maxEncodedLength) {
    throw new VaultPayloadSizeError(
      `Base64url field exceeds maximum encoded length (${maxEncodedLength})`
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(input);
  } catch {
    throw new VaultPayloadSizeError("Invalid base64url field");
  }

  if (bytes.byteLength > maxBytes) {
    throw new VaultPayloadSizeError(
      `Decoded field exceeds maximum size (${maxBytes} bytes)`
    );
  }

  return bytes;
}

export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function toBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes) as Uint8Array<ArrayBuffer>;
}

export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
