import { describe, expect, it } from "vitest";
import { parseDeviceBindingId } from "../../passkey/device-binding/parse-binding-id.js";
import { resolvePasskeyUnlockAvailableOnDevice } from "../../passkey/device-binding/resolve-availability.js";
import { scopeAuthenticationOptionsToDevice } from "../../passkey/device-binding/scope-auth-options.js";
describe("parseDeviceBindingId", () => {
  it("parses versioned and raw credential ids", () => {
    expect(parseDeviceBindingId("v1.cred-abc")).toEqual({ version: 1, credentialId: "cred-abc" });
    expect(parseDeviceBindingId("cred-abc")).toEqual({ version: 1, credentialId: "cred-abc" });
  });
  it("returns null for empty values", () => {
    expect(parseDeviceBindingId(null)).toBeNull();
    expect(parseDeviceBindingId("v1.")).toBeNull();
  });
});
describe("resolvePasskeyUnlockAvailableOnDevice", () => {
  it("requires an envelope", () => { expect(resolvePasskeyUnlockAvailableOnDevice({})).toBe(false); });
  it("defaults to available when omitted", () => { expect(resolvePasskeyUnlockAvailableOnDevice({ hasPasskeyPrfEnvelope: true })).toBe(true); });
  it("returns false when explicitly false", () => {
    expect(resolvePasskeyUnlockAvailableOnDevice({ hasPasskeyPrfEnvelope: true, passkeyUnlockAvailableOnThisDevice: false })).toBe(false);
  });
});
describe("scopeAuthenticationOptionsToDevice", () => {
  it("filters multiple allowCredentials", () => {
    const options = { allowCredentials: [{ id: "cred-a", type: "public-key" as const }, { id: "cred-b", type: "public-key" as const }] };
    const scoped = scopeAuthenticationOptionsToDevice(options, { credentialId: "cred-b" });
    expect(scoped.allowCredentials).toHaveLength(1);
    expect(scoped.allowCredentials?.[0]?.id).toBe("cred-b");
  });

  it("returns options unchanged for a single allowCredential", () => {
    const options = { allowCredentials: [{ id: "cred-a", type: "public-key" as const }] };
    expect(scopeAuthenticationOptionsToDevice(options, { credentialId: "cred-a" })).toBe(options);
  });

  it("returns options unchanged when credential id is not listed", () => {
    const options = {
      allowCredentials: [
        { id: "cred-a", type: "public-key" as const },
        { id: "cred-b", type: "public-key" as const },
      ],
    };
    expect(scopeAuthenticationOptionsToDevice(options, { credentialId: "missing" })).toBe(options);
  });
});
