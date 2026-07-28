import { extractPasskeyPrfOutput } from "./passkey-prf-output.js";
import {
  isPrfExtensionHeuristicallyAvailable,
  type PrfExtensionSupportOptions,
} from "./passkey-prf-support.js";
import { MAX_PASSKEY_OPAQUE_ID_LENGTH } from "../passkey/model.js";

export type PasskeyPrfCapability =
  | {
      state: "unavailable";
      source: "heuristic" | "registration";
      reason: "heuristic_unavailable" | "credential_prf_disabled";
    }
  | { state: "heuristic"; source: "heuristic" }
  | { state: "confirmed_registration"; source: "registration" }
  | { state: "confirmed_authentication"; source: "authentication" }
  | {
      state: "incompatible";
      source: "registration" | "authentication";
      reason:
        | "missing_registration_confirmation"
        | "missing_verified_credential_id"
        | "missing_authentication_result"
        | "invalid_authentication_result";
    };

export type ResolvePasskeyPrfCapabilityInput = PrfExtensionSupportOptions & ({
  ceremony?: undefined;
  clientExtensionResults?: Record<string, unknown> | null;
  credentialId?: string;
} | {
  ceremony: "registration";
  clientExtensionResults?: Record<string, unknown> | null;
  credentialId?: string;
} | {
  ceremony: "authentication";
  clientExtensionResults?: Record<string, unknown> | null;
  /** Credential id returned by the application's successful server-side WebAuthn verification. */
  verifiedCredentialId: string;
});

function hasAuthenticationResultValue(results: Record<string, unknown>): boolean {
  const prf = results.prf;
  if (!prf || typeof prf !== "object") return false;
  const record = prf as Record<string, unknown>;
  const standard = record.results;
  if (standard && typeof standard === "object" && "first" in standard) return true;
  const byCredential = record.evalByCredential;
  return Boolean(
    byCredential &&
      typeof byCredential === "object" &&
      Object.values(byCredential as Record<string, unknown>).some(
        (entry) => Boolean(entry && typeof entry === "object" && "first" in entry)
      )
  );
}

function scopeAuthenticationResultsToCredential(
  results: Record<string, unknown>,
  credentialId?: string
): Record<string, unknown> {
  if (!credentialId || !results.prf || typeof results.prf !== "object") {
    return results;
  }
  const prf = results.prf as Record<string, unknown>;
  if (!prf.evalByCredential || typeof prf.evalByCredential !== "object") {
    return results;
  }
  const byCredential = prf.evalByCredential as Record<string, unknown>;
  return {
    ...results,
    prf: {
      ...prf,
      evalByCredential: Object.hasOwn(byCredential, credentialId)
        ? { [credentialId]: byCredential[credentialId] }
        : {},
    },
  };
}

/** Resolves preliminary vs ceremony-confirmed PRF capability without returning PRF material. */
export function resolvePasskeyPrfCapability(
  input: ResolvePasskeyPrfCapabilityInput = {}
): PasskeyPrfCapability {
  const results = input.clientExtensionResults ?? {};

  if (input.ceremony === "registration") {
    const prf = results.prf;
    const enabled = prf && typeof prf === "object"
      ? (prf as Record<string, unknown>).enabled
      : undefined;
    if (enabled === true) {
      return { state: "confirmed_registration", source: "registration" };
    }
    if (enabled === false) {
      return {
        state: "unavailable",
        source: "registration",
        reason: "credential_prf_disabled",
      };
    }
    return {
      state: "incompatible",
      source: "registration",
      reason: "missing_registration_confirmation",
    };
  }

  if (input.ceremony === "authentication") {
    if (
      typeof input.verifiedCredentialId !== "string" ||
      input.verifiedCredentialId.length === 0 ||
      input.verifiedCredentialId.length > MAX_PASSKEY_OPAQUE_ID_LENGTH ||
      input.verifiedCredentialId.trim() !== input.verifiedCredentialId
    ) {
      return {
        state: "incompatible",
        source: "authentication",
        reason: "missing_verified_credential_id",
      };
    }
    const credentialScopedResults = scopeAuthenticationResultsToCredential(
      results,
      input.verifiedCredentialId
    );
    const extracted = extractPasskeyPrfOutput(credentialScopedResults, {
      credentialId: input.verifiedCredentialId,
    });
    if (extracted) {
      extracted.fill(0);
      return { state: "confirmed_authentication", source: "authentication" };
    }
    return {
      state: "incompatible",
      source: "authentication",
      reason: hasAuthenticationResultValue(results)
        ? "invalid_authentication_result"
        : "missing_authentication_result",
    };
  }

  return isPrfExtensionHeuristicallyAvailable(input)
    ? { state: "heuristic", source: "heuristic" }
    : {
        state: "unavailable",
        source: "heuristic",
        reason: "heuristic_unavailable",
      };
}
