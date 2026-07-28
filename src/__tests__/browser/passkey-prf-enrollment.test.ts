import { describe, expect, it } from "vitest";
import { resolvePasskeyPrfEnrollmentAfterRegistration } from "../../browser/passkey-prf-enrollment.js";

const CREDENTIAL_ID = "credential-1";
const PRF_OUTPUT = new Uint8Array(32).fill(0x5a);

function resolve(clientExtensionResults: Record<string, unknown>) {
  return resolvePasskeyPrfEnrollmentAfterRegistration({
    registrationCredentialId: CREDENTIAL_ID,
    verifiedCredentialId: CREDENTIAL_ID,
    clientExtensionResults,
  });
}

describe("resolvePasskeyPrfEnrollmentAfterRegistration", () => {
  it("returns an owned PRF snapshot only after credential verification matches", () => {
    const source = PRF_OUTPUT.buffer.slice(0);
    const result = resolve({ prf: { enabled: true, results: { first: source } } });
    expect(result).toMatchObject({
      status: "ready",
      source: "registration",
      credentialId: CREDENTIAL_ID,
    });
    if (result.status !== "ready") throw new Error("Expected ready enrollment");
    expect(result.prfOutput).toEqual(PRF_OUTPUT);
    result.prfOutput.fill(0);
    expect(new Uint8Array(source)).toEqual(PRF_OUTPUT);
  });

  it("fails closed without confirmation and requires authentication only when output is missing", () => {
    expect(resolve({})).toEqual({
      status: "unavailable",
      credentialId: CREDENTIAL_ID,
      reason: "registration_confirmation_missing",
    });
    expect(resolvePasskeyPrfEnrollmentAfterRegistration({
      registrationCredentialId: CREDENTIAL_ID,
      verifiedCredentialId: CREDENTIAL_ID,
      clientExtensionResults: null,
    })).toMatchObject({
      status: "unavailable",
      reason: "registration_confirmation_missing",
    });
    expect(resolve({ prf: { enabled: true } })).toEqual({
      status: "authentication_required",
      credentialId: CREDENTIAL_ID,
      credentialSelection: { mode: "exact", credentialId: CREDENTIAL_ID },
      reason: "registration_prf_output_unavailable",
    });
    expect(resolve({
      prf: { enabled: true, results: { first: new Uint8Array(16) } },
    })).toMatchObject({
      status: "authentication_required",
      reason: "registration_prf_output_unavailable",
    });
    expect(resolve({
      prf: {
        enabled: true,
        results: { first: PRF_OUTPUT },
        evalByCredential: {
          [CREDENTIAL_ID]: { first: new Uint8Array(32).fill(0x11) },
        },
      },
    })).toMatchObject({ status: "ready", prfOutput: PRF_OUTPUT });
    expect(resolve({
      prf: {
        enabled: true,
        evalByCredential: { [CREDENTIAL_ID]: { first: PRF_OUTPUT } },
      },
    })).toMatchObject({
      status: "authentication_required",
      reason: "registration_prf_output_unavailable",
    });
  });

  it("reports a credential that explicitly disabled PRF as unavailable", () => {
    expect(resolve({ prf: { enabled: false, results: { first: PRF_OUTPUT } } })).toEqual({
      status: "unavailable",
      credentialId: CREDENTIAL_ID,
      reason: "credential_prf_disabled",
    });
    expect(resolve({ prf: { results: { first: PRF_OUTPUT } } })).toMatchObject({
      status: "unavailable",
      reason: "registration_confirmation_missing",
    });
  });

  it("rejects invalid or mismatched browser and verified credential ids", () => {
    expect(resolvePasskeyPrfEnrollmentAfterRegistration({
      registrationCredentialId: " bad",
      verifiedCredentialId: CREDENTIAL_ID,
    })).toEqual({ status: "rejected", reason: "invalid_registration_credential_id" });
    expect(resolvePasskeyPrfEnrollmentAfterRegistration({
      registrationCredentialId: CREDENTIAL_ID,
      verifiedCredentialId: " ",
    })).toEqual({ status: "rejected", reason: "invalid_verified_credential_id" });
    expect(resolvePasskeyPrfEnrollmentAfterRegistration({
      registrationCredentialId: CREDENTIAL_ID,
      verifiedCredentialId: "credential-2",
      clientExtensionResults: { prf: { enabled: true, results: { first: PRF_OUTPUT } } },
    })).toEqual({ status: "rejected", reason: "credential_id_mismatch" });
  });
});
