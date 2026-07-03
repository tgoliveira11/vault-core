import { describe, expect, it } from "vitest";
import { bytesToBase64Url } from "../../crypto/encoding.js";
import { prepareVaultUnlockAuthenticationOptions } from "../../browser/vault-unlock-auth-options.js";

const CREDENTIAL_A = "cred-a";
const CREDENTIAL_B = "cred-b";
const SALT = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";

describe("prepareVaultUnlockAuthenticationOptions", () => {
  it("composes PRF alignment, salt coercion, filtering, and transport pinning", () => {
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
      }
    );

    expect(prepared.allowCredentials).toHaveLength(1);
    expect(prepared.allowCredentials?.[0]?.id).toBe(CREDENTIAL_A);
    expect(prepared.allowCredentials?.[0]?.transports).toEqual(["internal"]);
    expect(prepared.extensions?.prf?.eval?.first).toBeInstanceOf(ArrayBuffer);
    expect(prepared.extensions?.prf?.evalByCredential).toBeUndefined();
  });

  it("skips filtering when credentialId is not in allowCredentials", () => {
    const prepared = prepareVaultUnlockAuthenticationOptions(
      {
        challenge: new Uint8Array(32),
        allowCredentials: [
          { id: CREDENTIAL_A, type: "public-key" },
          { id: CREDENTIAL_B, type: "public-key" },
        ],
      },
      { credentialId: "missing", filterSingleCredential: true, userAgent: IPHONE_UA }
    );
    expect(prepared.allowCredentials).toHaveLength(2);
  });

  it("returns options unchanged when extensions are absent", () => {
    const options = {
      challenge: new Uint8Array(32),
      allowCredentials: [{ id: CREDENTIAL_A, type: "public-key" as const }],
    };
    const prepared = prepareVaultUnlockAuthenticationOptions(options, { userAgent: IPHONE_UA });
    expect(prepared.extensions).toBeUndefined();
    expect(prepared.allowCredentials?.[0]?.transports).toEqual(["internal"]);
  });
});
