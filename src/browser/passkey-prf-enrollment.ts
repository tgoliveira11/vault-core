import { vaultPasskeyOpaqueIdSchema } from "../passkey/model.js";
import { resolvePasskeyPrfCapability } from "../envelopes/passkey-prf-capability.js";
import { extractPasskeyPrfOutput } from "../envelopes/passkey-prf-output.js";
import type { PasskeyCredentialSelection } from "../passkey/device-binding/scope-auth-options.js";

export type ResolvePasskeyPrfEnrollmentAfterRegistrationInput = {
  /** Credential id returned by the browser registration response. */
  registrationCredentialId: string;
  /** Credential id returned by successful server-side registration verification. */
  verifiedCredentialId: string;
  /** Retained locally; sanitize the registration JSON before sending it to the server. */
  clientExtensionResults?: Record<string, unknown> | null;
};

export type PasskeyPrfEnrollmentAfterRegistrationResult =
  | {
      status: "ready";
      source: "registration";
      credentialId: string;
      /** Browser-only owned snapshot. Zero it after creating the envelope. */
      prfOutput: Uint8Array;
    }
  | {
      status: "authentication_required";
      credentialId: string;
      credentialSelection: Extract<PasskeyCredentialSelection, { mode: "exact" }>;
      reason: "registration_prf_output_unavailable";
    }
  | {
      status: "unavailable";
      credentialId: string;
      reason: "credential_prf_disabled" | "registration_confirmation_missing";
    }
  | {
      status: "rejected";
      reason:
        | "invalid_registration_credential_id"
        | "invalid_verified_credential_id"
        | "credential_id_mismatch";
    };

/**
 * Resolves whether registration already produced the PRF needed for the first envelope.
 * The result is accepted only for the exact credential id confirmed by server verification.
 */
export function resolvePasskeyPrfEnrollmentAfterRegistration(
  input: ResolvePasskeyPrfEnrollmentAfterRegistrationInput
): PasskeyPrfEnrollmentAfterRegistrationResult {
  const registrationCredentialId = vaultPasskeyOpaqueIdSchema.safeParse(
    input.registrationCredentialId
  );
  if (!registrationCredentialId.success) {
    return { status: "rejected", reason: "invalid_registration_credential_id" };
  }

  const verifiedCredentialId = vaultPasskeyOpaqueIdSchema.safeParse(input.verifiedCredentialId);
  if (!verifiedCredentialId.success) {
    return { status: "rejected", reason: "invalid_verified_credential_id" };
  }
  if (registrationCredentialId.data !== verifiedCredentialId.data) {
    return { status: "rejected", reason: "credential_id_mismatch" };
  }

  const results = input.clientExtensionResults ?? {};
  const capability = resolvePasskeyPrfCapability({
    ceremony: "registration",
    clientExtensionResults: results,
  });
  if (capability.state === "unavailable") {
    return {
      status: "unavailable",
      credentialId: verifiedCredentialId.data,
      reason: "credential_prf_disabled",
    };
  }
  if (capability.state !== "confirmed_registration") {
    return {
      status: "unavailable",
      credentialId: verifiedCredentialId.data,
      reason: "registration_confirmation_missing",
    };
  }

  const prf = results.prf as Record<string, unknown>;
  const registrationOnlyResults = { prf: { results: prf.results } };
  const prfOutput = extractPasskeyPrfOutput(registrationOnlyResults);
  if (!prfOutput) {
    return {
      status: "authentication_required",
      credentialId: verifiedCredentialId.data,
      credentialSelection: { mode: "exact", credentialId: verifiedCredentialId.data },
      reason: "registration_prf_output_unavailable",
    };
  }

  return {
    status: "ready",
    source: "registration",
    credentialId: verifiedCredentialId.data,
    prfOutput,
  };
}
