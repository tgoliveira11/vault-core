import { stringToBytes, toBufferSource } from "../crypto/encoding.js";

export async function buildPrfSaltBytes(prefix: string, userId: string): Promise<ArrayBuffer> {
  const input = toBufferSource(stringToBytes(`${prefix}${userId}`));
  return crypto.subtle.digest("SHA-256", input);
}
