import { describe, expect, it } from "vitest";
import { PasskeyCredentialScopeError } from "../../errors/vault-errors.js";
import {
  parseDeviceBindingId,
  parsePasskeyBindingId,
} from "../../passkey/device-binding/parse-binding-id.js";
import {
  resolvePasskeyUnlockAvailable,
  resolvePasskeyUnlockAvailableOnDevice,
} from "../../passkey/device-binding/resolve-availability.js";
import {
  selectAuthenticationCredentials,
  scopeAuthenticationOptionsToCredential,
  scopeAuthenticationOptionsToDevice,
} from "../../passkey/device-binding/scope-auth-options.js";
describe("parseDeviceBindingId", () => {
  it("parses versioned and raw credential ids", () => {
    expect(parseDeviceBindingId("v1.cred-abc")).toEqual({ version: 1, credentialId: "cred-abc" });
    expect(parseDeviceBindingId("cred-abc")).toEqual({ version: 1, credentialId: "cred-abc" });
  });
  it("returns null for empty values", () => {
    expect(parseDeviceBindingId(null)).toBeNull();
    expect(parseDeviceBindingId("   ")).toBeNull();
    expect(parseDeviceBindingId("v1.")).toBeNull();
  });

  it("parses opaque binding ids without treating them as credentials", () => {
    expect(parsePasskeyBindingId("v1.binding-abc")).toEqual({
      version: 1,
      bindingId: "binding-abc",
    });
    expect(parsePasskeyBindingId(" binding-raw ")).toEqual({
      version: 1,
      bindingId: "binding-raw",
    });
    expect(parsePasskeyBindingId(undefined)).toBeNull();
    expect(parsePasskeyBindingId("   ")).toBeNull();
    expect(parsePasskeyBindingId("v1.")).toBeNull();
  });
});
describe("resolvePasskeyUnlockAvailableOnDevice", () => {
  it("requires an envelope", () => { expect(resolvePasskeyUnlockAvailableOnDevice({})).toBe(false); });
  it("fails closed when binding state is omitted", () => {
    expect(resolvePasskeyUnlockAvailableOnDevice({ hasPasskeyPrfEnvelope: true })).toBe(false);
  });
  it("returns false when explicitly false", () => {
    expect(resolvePasskeyUnlockAvailableOnDevice({ hasPasskeyPrfEnvelope: true, passkeyUnlockAvailableOnThisDevice: false })).toBe(false);
  });
  it("prefers the browser binding field and accepts the deprecated field", () => {
    expect(resolvePasskeyUnlockAvailable({
      hasPasskeyPrfEnvelope: true,
      passkeyUnlockAvailableOnThisBrowser: true,
      passkeyUnlockAvailableOnThisDevice: false,
    })).toBe(true);
    expect(resolvePasskeyUnlockAvailable({
      hasPasskeyPrfEnvelope: true,
      passkeyUnlockAvailableOnThisDevice: true,
    })).toBe(true);
  });
});
describe("scopeAuthenticationOptionsToDevice", () => {
  it("filters multiple allowCredentials", () => {
    const options = { allowCredentials: [{ id: "cred-a", type: "public-key" as const }, { id: "cred-b", type: "public-key" as const }] };
    const scoped = scopeAuthenticationOptionsToDevice(options, { credentialId: "cred-b" });
    expect(scoped.allowCredentials).toHaveLength(1);
    expect(scoped.allowCredentials?.[0]?.id).toBe("cred-b");
  });

  it("returns exactly one matching descriptor for a single allowCredential", () => {
    const options = { allowCredentials: [{ id: "cred-a", type: "public-key" as const }] };
    expect(scopeAuthenticationOptionsToDevice(options, { credentialId: "cred-a" })).toEqual(options);
  });

  it("throws a typed failure when credential id is not listed", () => {
    const options = {
      allowCredentials: [
        { id: "cred-a", type: "public-key" as const },
        { id: "cred-b", type: "public-key" as const },
      ],
    };
    expect(() => scopeAuthenticationOptionsToDevice(options, { credentialId: "missing" }))
      .toThrowError(PasskeyCredentialScopeError);
    try {
      scopeAuthenticationOptionsToCredential(options, { credentialId: "missing" });
    } catch (error) {
      expect(error).toMatchObject({ code: "credential_not_found", descriptorIndex: null });
    }
  });

  it("keeps exact and discoverable credential selection separate", () => {
    const empty = { allowCredentials: [] as const, challenge: "challenge" };
    expect(() => scopeAuthenticationOptionsToCredential(empty, { credentialId: "cred-a" }))
      .toThrowError(/cannot use a discoverable/i);
    expect(selectAuthenticationCredentials(empty, { mode: "discoverable" }).allowCredentials)
      .toEqual([]);

    const absent = { challenge: "challenge" };
    expect(() => scopeAuthenticationOptionsToCredential(absent, { credentialId: "cred-a" }))
      .toThrowError(/cannot use a discoverable/i);
  });

  it("rejects duplicate and malformed descriptors deterministically", () => {
    const duplicate = {
      allowCredentials: [
        { id: "cred-a", type: "public-key" as const },
        { id: "cred-a", type: "public-key" as const },
      ],
    };
    expect(() => scopeAuthenticationOptionsToCredential(duplicate, { credentialId: "cred-a" }))
      .toThrowError(expect.objectContaining({ code: "duplicate_credential_descriptor" }));

    const malformedCases = [
      { allowCredentials: "not-an-array" },
      { allowCredentials: [null] },
      { allowCredentials: [{ id: "", type: "public-key" }] },
      { allowCredentials: [{ id: " cred-a", type: "public-key" }] },
      { allowCredentials: [{ id: "cred-a", type: "password" }] },
      { allowCredentials: [{ id: "cred-a", type: "public-key", transports: "usb" }] },
      { allowCredentials: [{ id: "cred-a", type: "public-key", transports: ["invalid"] }] },
      { allowCredentials: [{ id: "cred-a", type: "public-key", transports: ["usb", "usb"] }] },
    ];
    for (const options of malformedCases) {
      expect(() => scopeAuthenticationOptionsToCredential(options, { credentialId: "cred-a" }))
        .toThrowError(expect.objectContaining({ code: "invalid_credential_descriptor" }));
    }
  });

  it("rejects invalid target credential ids", () => {
    const options = { allowCredentials: [{ id: "cred-a", type: "public-key" as const }] };
    expect(() => scopeAuthenticationOptionsToCredential(options, { credentialId: "" }))
      .toThrowError(expect.objectContaining({ code: "invalid_credential_id" }));
    expect(() => scopeAuthenticationOptionsToCredential(options, { credentialId: " cred-a" }))
      .toThrowError(expect.objectContaining({ code: "invalid_credential_id" }));
  });

  it("supports explicit exact, allow-list, and discoverable selection", () => {
    const options = {
      allowCredentials: [
        { id: "cred-a", type: "public-key" as const },
        { id: "cred-b", type: "public-key" as const },
      ],
    };
    expect(selectAuthenticationCredentials(options, {
      mode: "exact",
      credentialId: "cred-b",
    }).allowCredentials).toEqual([{ id: "cred-b", type: "public-key" }]);
    expect(selectAuthenticationCredentials(options, { mode: "allow-list" }).allowCredentials)
      .toEqual(options.allowCredentials);
    expect(selectAuthenticationCredentials(options, { mode: "discoverable" }).allowCredentials)
      .toEqual([]);
    expect(() => selectAuthenticationCredentials({ allowCredentials: [] }, { mode: "allow-list" }))
      .toThrowError(/non-empty/i);
  });
});
