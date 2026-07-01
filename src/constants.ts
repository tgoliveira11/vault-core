export const ENCRYPTION_VERSION = "enc-v1" as const;
export const ENCRYPTION_ALG = "AES-GCM" as const;
export const VAULT_CRYPTO_VERSION = "vault-v1" as const;
export const DEFAULT_VAULT_AUTO_LOCK_MINUTES = 15;
export const MAX_VAULT_AUTO_LOCK_MINUTES = 24 * 60;

/** AES-GCM IV length (bytes). */
export const MAX_VAULT_IV_BYTES = 12;
/** Upper bound for decrypted field plaintext plus GCM authentication tag. */
export const MAX_VAULT_CIPHERTEXT_BYTES = 64 * 1024 + 16;

function maxBase64UrlEncodedLength(maxBytes: number): number {
  return Math.ceil(maxBytes / 3) * 4;
}

export const MAX_VAULT_IV_BASE64URL_LENGTH = maxBase64UrlEncodedLength(MAX_VAULT_IV_BYTES);
export const MAX_VAULT_CIPHERTEXT_BASE64URL_LENGTH = maxBase64UrlEncodedLength(
  MAX_VAULT_CIPHERTEXT_BYTES
);
/** Longest allowed base64url field among vault encrypted payload parts. */
export const MAX_VAULT_BASE64URL_FIELD_LENGTH = Math.max(
  MAX_VAULT_IV_BASE64URL_LENGTH,
  MAX_VAULT_CIPHERTEXT_BASE64URL_LENGTH
);
