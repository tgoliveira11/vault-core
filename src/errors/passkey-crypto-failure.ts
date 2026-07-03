import {
  PasskeyUnlockError,
  VaultAuthorizationError,
  VaultKeyNotExtractableError,
} from "./vault-errors.js";
import { INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE } from "../session/inner-key-material-cache.js";

export type PasskeyCryptoFailureKind =
  | "prf_mismatch"
  | "rewrap_requires_unlock"
  | "decrypt_failed"
  | "unknown";

const CRYPTO_ERROR_NAMES = new Set(["OperationError", "DataError"]);

const PRF_MISMATCH_MESSAGE =
  /prf.*mismatch|wrong passkey|credential.*mismatch|passkey.*does not match/i;

const REWRAP_MESSAGE =
  /non-extractable|innervaultkeyblob|cannot wrap a non-extractable|cached inner vault key material|inner vault key blob does not match/i;

const DECRYPT_MESSAGE =
  /could not decrypt|decrypt failed|decryption failed|authentication tag/i;

const DEFAULT_MESSAGES_EN: Record<PasskeyCryptoFailureKind, string> = {
  prf_mismatch:
    "This passkey could not derive the expected encryption key. Try another passkey or unlock with your vault password.",
  rewrap_requires_unlock:
    "Unlock your vault with your password or recovery phrase, then retry the passkey operation.",
  decrypt_failed:
    "Could not decrypt your vault with this passkey. Try your vault password or recovery phrase.",
  unknown:
    "Passkey unlock failed. Try again or use your vault password or recovery phrase.",
};

function errorName(error: unknown): string {
  if (error instanceof DOMException) return error.name;
  if (error instanceof Error) return error.name;
  return "";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

/** Classifies passkey unwrap and re-wrap crypto failures for consumer-facing copy. */
export function classifyPasskeyCryptoError(error: unknown): PasskeyCryptoFailureKind {
  if (error instanceof VaultKeyNotExtractableError) {
    return "rewrap_requires_unlock";
  }

  const name = errorName(error);
  const message = errorMessage(error);

  if (message === INNER_VAULT_KEY_CACHE_MISMATCH_MESSAGE) {
    return "rewrap_requires_unlock";
  }

  if (PRF_MISMATCH_MESSAGE.test(message)) {
    return "prf_mismatch";
  }

  if (error instanceof PasskeyUnlockError) {
    return "decrypt_failed";
  }

  if (CRYPTO_ERROR_NAMES.has(name)) {
    return "decrypt_failed";
  }

  if (DECRYPT_MESSAGE.test(message)) {
    return "decrypt_failed";
  }

  if (error instanceof VaultAuthorizationError && REWRAP_MESSAGE.test(message)) {
    return "rewrap_requires_unlock";
  }

  if (REWRAP_MESSAGE.test(message)) {
    return "rewrap_requires_unlock";
  }

  return "unknown";
}

/** Neutral English defaults for passkey crypto failures (i18n-ready). */
export function getDefaultPasskeyCryptoErrorMessage(
  kind: PasskeyCryptoFailureKind,
  locale?: string
): string {
  void locale;
  return DEFAULT_MESSAGES_EN[kind];
}
