import {
  PasskeyPrfRequiredError,
  PasskeyUnlockError,
  VaultRateLimitError,
} from "./vault-errors.js";

export type PasskeyUnlockFailureKind =
  | "user_cancelled"
  | "recoverable"
  | "redirect_to_full_unlock";

const USER_CANCELLED_ERROR_NAMES = new Set(["NotAllowedError", "AbortError"]);

const USER_CANCELLED_MESSAGE =
  /cancelled|canceled|aborted|passkey unlock was cancelled/i;

const REDIRECT_MESSAGE =
  /prf.*unavailable|passkey prf is not supported|prf output|requires browser prf|invalid envelope|credential not linked|no passkey credential|decrypt failed|could not decrypt|challenge expired|server verify|verification failed/i;

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

/** Classifies passkey unlock failures for dock redirect and callback policy. */
export function classifyPasskeyUnlockFailure(error: unknown): PasskeyUnlockFailureKind {
  const name = errorName(error);
  const message = errorMessage(error);

  if (USER_CANCELLED_ERROR_NAMES.has(name)) return "user_cancelled";
  if (USER_CANCELLED_MESSAGE.test(message)) return "user_cancelled";

  if (error instanceof VaultRateLimitError) return "recoverable";
  if (error instanceof PasskeyPrfRequiredError) return "redirect_to_full_unlock";
  if (error instanceof PasskeyUnlockError) return "redirect_to_full_unlock";

  if (REDIRECT_MESSAGE.test(message)) return "redirect_to_full_unlock";

  return "recoverable";
}

/** Returns whether a passkey failure kind should redirect to full unlock by default. */
export function shouldRedirectPasskeyUnlockFailureByDefault(
  kind: PasskeyUnlockFailureKind
): boolean {
  return kind === "redirect_to_full_unlock";
}
