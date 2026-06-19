import type { EncryptedVaultPayload } from "../validation/schemas.js";
import { stringToBytes } from "./encoding.js";

export function canonicalAadString(aad: EncryptedVaultPayload["aad"]): string {
  return JSON.stringify({
    context: aad.context,
    field: aad.field,
    resourceId: aad.resourceId,
    userId: aad.userId,
  });
}

export function aadByteCandidates(aad: EncryptedVaultPayload["aad"]): Uint8Array[] {
  const variants = new Set<string>([
    canonicalAadString(aad),
    JSON.stringify({
      userId: aad.userId,
      resourceId: aad.resourceId,
      field: aad.field,
      context: aad.context,
    }),
    JSON.stringify(aad),
  ]);

  return Array.from(variants).map((value) => stringToBytes(value));
}
