import { bytesToBase64Url, stringToBytes, toBufferSource } from "../crypto/encoding.js";

export type PasskeyPrfAuthenticationExtensionsJson = {
  prf: {
    eval: {
      first: string;
    };
  };
};

export async function buildPrfSaltBytes(prefix: string, userId: string): Promise<ArrayBuffer> {
  const input = toBufferSource(stringToBytes(`${prefix}${userId}`));
  return crypto.subtle.digest("SHA-256", input);
}

/**
 * Builds JSON-safe PRF authentication extensions for a server-composed WebAuthn options response.
 * The salt is public input, not PRF output. Consumers must hydrate it with
 * `prepareVaultUnlockAuthenticationOptions()` before calling `navigator.credentials.get()`.
 */
export async function buildPasskeyPrfAuthenticationExtensionsJson(
  prefix: string,
  userId: string
): Promise<PasskeyPrfAuthenticationExtensionsJson> {
  const salt = await buildPrfSaltBytes(prefix, userId);
  return {
    prf: {
      eval: {
        first: bytesToBase64Url(new Uint8Array(salt)),
      },
    },
  };
}
