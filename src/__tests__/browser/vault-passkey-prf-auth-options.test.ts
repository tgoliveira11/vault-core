import { describe, expect, it } from "vitest";
import { bytesToBase64Url } from "../../crypto/encoding.js";
import { prepareVaultPasskeyPrfAuthenticationOptions } from "../../browser/vault-passkey-prf-auth-options.js";
import { buildPrfSaltBytes } from "../../browser/prf-salt-bytes.js";

const CREDENTIAL_ID = "cred-a";
const USER_ID = "user-1";
const PRF_PREFIX = "acme-passkey-prf-v1:";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";

describe("prepareVaultPasskeyPrfAuthenticationOptions", () => {
  it("composes PRF salt merge, JSON prep, device scoping, and ceremony prep", async () => {
    const challengeB64 = bytesToBase64Url(new Uint8Array(32).fill(7));
    const credentialIdB64 = bytesToBase64Url(new Uint8Array(16).fill(3));

    const prepared = await prepareVaultPasskeyPrfAuthenticationOptions({
      userId: USER_ID,
      prfSaltPrefix: PRF_PREFIX,
      serverOptions: {
        challenge: challengeB64,
        allowCredentials: [
          { id: credentialIdB64, type: "public-key", transports: ["hybrid", "internal"] },
          { id: "cred-b", type: "public-key" },
        ],
      },
      credentialId: CREDENTIAL_ID,
      userAgent: IPHONE_UA,
      scopeToCredential: true,
      transportPolicy: "apple-mobile-internal-workaround",
      prepareJson: (options) => ({
        ...options,
        challenge: new Uint8Array(32).fill(7),
        allowCredentials: options.allowCredentials?.map((descriptor) => ({
          ...descriptor,
          id: descriptor.id === credentialIdB64 ? CREDENTIAL_ID : descriptor.id,
        })),
      }),
    });

    expect(prepared.challenge).toBeInstanceOf(Uint8Array);
    expect(prepared.allowCredentials).toHaveLength(1);
    expect(prepared.allowCredentials?.[0]?.id).toBe(CREDENTIAL_ID);
    expect(prepared.allowCredentials?.[0]?.transports).toEqual(["internal"]);
    expect(prepared.extensions?.prf?.eval?.first).toBeInstanceOf(ArrayBuffer);
    expect(prepared.extensions?.prf?.evalByCredential).toBeUndefined();

    const expectedSalt = await buildPrfSaltBytes(PRF_PREFIX, USER_ID);
    expect(new Uint8Array(prepared.extensions?.prf?.eval?.first as ArrayBuffer)).toEqual(
      new Uint8Array(expectedSalt)
    );
  });

  it("uses eval when no credential id can be resolved", async () => {
    const prepared = await prepareVaultPasskeyPrfAuthenticationOptions({
      userId: USER_ID,
      prfSaltPrefix: PRF_PREFIX,
      serverOptions: {
        challenge: new Uint8Array(32),
        allowCredentials: [
          { id: CREDENTIAL_ID, type: "public-key" },
          { id: "cred-b", type: "public-key" },
        ],
      },
      filterSingleCredential: false,
      userAgent: IPHONE_UA,
    });

    expect(prepared.extensions?.prf?.eval?.first).toBeInstanceOf(ArrayBuffer);
    expect(prepared.extensions?.prf?.evalByCredential).toBeUndefined();
    expect(prepared.allowCredentials).toHaveLength(2);
  });

  it("replaces conflicting server PRF inputs with one canonical eval and requires UV", async () => {
    const prepared = await prepareVaultPasskeyPrfAuthenticationOptions({
      userId: USER_ID,
      prfSaltPrefix: PRF_PREFIX,
      serverOptions: {
        challenge: new Uint8Array(32),
        userVerification: "preferred",
        allowCredentials: [
          { id: CREDENTIAL_ID, type: "public-key" },
          { id: "cred-b", type: "public-key" },
        ],
        extensions: {
          appid: "https://legacy.example",
          prf: {
            eval: { first: new Uint8Array(32).fill(8), second: new Uint8Array(32).fill(7) },
            evalByCredential: {
              [CREDENTIAL_ID]: { first: new Uint8Array(32).fill(9) },
            },
          },
        },
      },
      credentialSelection: {
        mode: "allow-list",
      },
    });

    const expectedSalt = await buildPrfSaltBytes(PRF_PREFIX, USER_ID);
    expect(prepared.userVerification).toBe("required");
    expect(prepared.extensions?.appid).toBe("https://legacy.example");
    expect(prepared.extensions?.prf?.evalByCredential).toBeUndefined();
    expect(prepared.extensions?.prf?.eval?.second).toBeUndefined();
    expect(new Uint8Array(prepared.extensions?.prf?.eval?.first as ArrayBuffer)).toEqual(
      new Uint8Array(expectedSalt)
    );
  });

  it("preserves stored transports by default", async () => {
    const prepared = await prepareVaultPasskeyPrfAuthenticationOptions({
      userId: USER_ID,
      prfSaltPrefix: PRF_PREFIX,
      serverOptions: {
        challenge: new Uint8Array(32),
        allowCredentials: [{ id: CREDENTIAL_ID, type: "public-key", transports: ["hybrid"] }],
      },
      credentialId: CREDENTIAL_ID,
      userAgent: IPHONE_UA,
    });

    expect(prepared.allowCredentials?.[0]?.transports).toEqual(["hybrid"]);
    expect(prepared.extensions?.prf?.eval?.first).toBeInstanceOf(ArrayBuffer);
  });

  it("preserves server JSON fields while adding a native PRF extension for browser libraries", async () => {
    const serverOptions = {
      challenge: "base64url-challenge",
      allowCredentials: [{ id: CREDENTIAL_ID, type: "public-key" as const }],
    };
    const prepared = await prepareVaultPasskeyPrfAuthenticationOptions({
      userId: USER_ID,
      prfSaltPrefix: PRF_PREFIX,
      serverOptions,
      credentialSelection: { mode: "exact", credentialId: CREDENTIAL_ID },
    });

    expect(prepared.challenge).toBe("base64url-challenge");
    expect(prepared.allowCredentials).toEqual([
      { id: CREDENTIAL_ID, type: "public-key" },
    ]);
    expect(prepared.extensions?.prf?.eval?.first).toBeInstanceOf(ArrayBuffer);
    expect(serverOptions).not.toHaveProperty("extensions");
  });

  it("fails when strict scoping omits the credential id", async () => {
    await expect(prepareVaultPasskeyPrfAuthenticationOptions({
      userId: USER_ID,
      prfSaltPrefix: PRF_PREFIX,
      serverOptions: { challenge: new Uint8Array(32), allowCredentials: [] },
      scopeToCredential: true,
    })).rejects.toMatchObject({ code: "invalid_credential_id" });
  });

  it("supports an explicit discoverable policy", async () => {
    const prepared = await prepareVaultPasskeyPrfAuthenticationOptions({
      userId: USER_ID,
      prfSaltPrefix: PRF_PREFIX,
      serverOptions: {
        challenge: new Uint8Array(32),
        allowCredentials: [{ id: CREDENTIAL_ID, type: "public-key" }],
      },
      credentialId: CREDENTIAL_ID,
      transportPolicy: "discoverable",
    });
    expect(prepared.allowCredentials).toEqual([]);
    expect(prepared.extensions?.prf?.eval?.first).toBeInstanceOf(ArrayBuffer);
  });

  it("supports explicit exact selection and rejects legacy conflicts", async () => {
    const serverOptions = {
      challenge: new Uint8Array(32),
      allowCredentials: [
        { id: CREDENTIAL_ID, type: "public-key" as const },
        { id: "cred-b", type: "public-key" as const },
      ],
    };
    const prepared = await prepareVaultPasskeyPrfAuthenticationOptions({
      userId: USER_ID,
      prfSaltPrefix: PRF_PREFIX,
      serverOptions,
      credentialSelection: { mode: "exact", credentialId: CREDENTIAL_ID },
    });
    expect(prepared.allowCredentials).toEqual([{ id: CREDENTIAL_ID, type: "public-key" }]);

    await expect(prepareVaultPasskeyPrfAuthenticationOptions({
      userId: USER_ID,
      prfSaltPrefix: PRF_PREFIX,
      serverOptions,
      credentialId: CREDENTIAL_ID,
      credentialSelection: { mode: "exact", credentialId: CREDENTIAL_ID },
    })).rejects.toMatchObject({ code: "conflicting_credential_selection" });

    await expect(prepareVaultPasskeyPrfAuthenticationOptions({
      userId: USER_ID,
      prfSaltPrefix: PRF_PREFIX,
      serverOptions,
      credentialSelection: { mode: "exact", credentialId: CREDENTIAL_ID },
      transportPolicy: "discoverable",
    })).rejects.toMatchObject({ code: "conflicting_credential_selection" });
  });
});
