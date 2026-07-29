import { describe, expect, it } from "vitest";
import { bytesToBase64Url } from "../../crypto/encoding.js";
import { prepareVaultUnlockAuthenticationOptions } from "../../browser/vault-unlock-auth-options.js";

const CREDENTIAL_A = "cred-a";
const CREDENTIAL_B = "cred-b";
const SALT = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";

describe("prepareVaultUnlockAuthenticationOptions", () => {
  it("composes PRF alignment, salt coercion, strict filtering, and explicit transport policy", () => {
    const prepared = prepareVaultUnlockAuthenticationOptions(
      {
        challenge: new Uint8Array(32),
        allowCredentials: [
          { id: CREDENTIAL_A, type: "public-key", transports: ["hybrid", "internal"] },
          { id: CREDENTIAL_B, type: "public-key", transports: ["hybrid"] },
        ],
        extensions: {
          prf: {
            evalByCredential: {
              [CREDENTIAL_A]: { first: bytesToBase64Url(SALT) },
            },
          },
        },
      },
      {
        credentialId: CREDENTIAL_A,
        userAgent: IPHONE_UA,
        filterSingleCredential: true,
        transportPolicy: "apple-mobile-internal-workaround",
      }
    );

    expect(prepared.allowCredentials).toHaveLength(1);
    expect(prepared.allowCredentials?.[0]?.id).toBe(CREDENTIAL_A);
    expect(prepared.allowCredentials?.[0]?.transports).toEqual(["internal"]);
    expect(prepared.userVerification).toBe("required");
    expect(prepared.extensions?.prf?.eval?.first).toBeInstanceOf(ArrayBuffer);
    expect(prepared.extensions?.prf?.evalByCredential).toBeUndefined();
  });

  it("canonicalizes a hydrated server eval across an allow-list", () => {
    const prepared = prepareVaultUnlockAuthenticationOptions(
      {
        challenge: new Uint8Array(32),
        userVerification: "preferred",
        allowCredentials: [
          { id: CREDENTIAL_A, type: "public-key" },
          { id: CREDENTIAL_B, type: "public-key" },
        ],
        extensions: {
          credProps: true,
          prf: {
            eval: { first: bytesToBase64Url(SALT), second: new Uint8Array(32).fill(7) },
            evalByCredential: {
              [CREDENTIAL_A]: { first: new Uint8Array(32).fill(8) },
            },
          },
        },
      },
      { credentialSelection: { mode: "allow-list" } }
    );

    expect(prepared.userVerification).toBe("required");
    expect(prepared.extensions?.credProps).toBe(true);
    expect(prepared.extensions?.prf?.eval?.first).toBeInstanceOf(ArrayBuffer);
    expect(prepared.extensions?.prf?.eval?.second).toBeUndefined();
    expect(prepared.extensions?.prf?.evalByCredential).toBeUndefined();
    expect(new Uint8Array(prepared.extensions?.prf?.eval?.first as ArrayBuffer)).toEqual(SALT);
  });

  it("fails closed when credentialId is not in allowCredentials", () => {
    expect(() => prepareVaultUnlockAuthenticationOptions(
      {
        challenge: new Uint8Array(32),
        allowCredentials: [
          { id: CREDENTIAL_A, type: "public-key" },
          { id: CREDENTIAL_B, type: "public-key" },
        ],
      },
      { credentialId: "missing", filterSingleCredential: true, userAgent: IPHONE_UA }
    )).toThrowError(expect.objectContaining({ code: "credential_not_found" }));
    expect(() => prepareVaultUnlockAuthenticationOptions(
      { challenge: new Uint8Array(32), allowCredentials: [] },
      { filterSingleCredential: true }
    )).toThrowError(expect.objectContaining({ code: "invalid_credential_id" }));
  });

  it("returns options unchanged when extensions are absent", () => {
    const options = {
      challenge: new Uint8Array(32),
      allowCredentials: [{ id: CREDENTIAL_A, type: "public-key" as const }],
    };
    const prepared = prepareVaultUnlockAuthenticationOptions(options, { userAgent: IPHONE_UA });
    expect(prepared.extensions).toBeUndefined();
    expect(prepared.allowCredentials?.[0]?.transports).toBeUndefined();
  });

  it("supports explicit discoverable credential flow", () => {
    const prepared = prepareVaultUnlockAuthenticationOptions(
      {
        challenge: new Uint8Array(32),
        allowCredentials: [{ id: CREDENTIAL_A, type: "public-key" }],
      },
      {
        credentialId: CREDENTIAL_A,
        filterSingleCredential: true,
        transportPolicy: "discoverable",
      }
    );
    expect(prepared.allowCredentials).toEqual([]);
  });

  it("supports explicit credential selection and rejects legacy flag conflicts", () => {
    const options = {
      challenge: new Uint8Array(32),
      allowCredentials: [
        { id: CREDENTIAL_A, type: "public-key" as const },
        { id: CREDENTIAL_B, type: "public-key" as const },
      ],
    };
    expect(prepareVaultUnlockAuthenticationOptions(options, {
      credentialSelection: { mode: "exact", credentialId: CREDENTIAL_B },
    }).allowCredentials).toEqual([{ id: CREDENTIAL_B, type: "public-key" }]);
    expect(() => prepareVaultUnlockAuthenticationOptions(options, {
      credentialSelection: { mode: "allow-list" },
      filterSingleCredential: true,
    })).toThrowError(expect.objectContaining({ code: "conflicting_credential_selection" }));
    expect(() => prepareVaultUnlockAuthenticationOptions(options, {
      credentialSelection: { mode: "exact", credentialId: CREDENTIAL_A },
      transportPolicy: "discoverable",
    })).toThrowError(expect.objectContaining({ code: "conflicting_credential_selection" }));
    expect(() => prepareVaultUnlockAuthenticationOptions(options, {
      credentialSelection: { mode: "discoverable" },
      transportPolicy: "platform-only",
    })).toThrowError(expect.objectContaining({ code: "conflicting_credential_selection" }));
  });
});
