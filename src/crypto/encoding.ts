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

export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function toBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes) as Uint8Array<ArrayBuffer>;
}

export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
