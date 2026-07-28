import { describe, expect, it } from "vitest";
import { buildPrfSaltBytes } from "../../browser/prf-salt-bytes.js";
import { prepareVaultPasskeyPrfRegistrationOptions } from "../../browser/vault-passkey-prf-registration-options.js";

const USER_ID = "user-1";
const PRF_PREFIX = "acme-passkey-prf-v1:";

describe("prepareVaultPasskeyPrfRegistrationOptions", () => {
  it("adds the canonical eval salt after JSON preparation without mutating server options", async () => {
    const serverOptions = {
      challenge: "base64url-challenge",
      extensions: {
        credProps: true,
        prf: {
          eval: { second: new Uint8Array(32).fill(4) },
          evalByCredential: { legacy: { first: new Uint8Array(32).fill(9) } },
        },
      },
    };

    const prepared = await prepareVaultPasskeyPrfRegistrationOptions({
      userId: USER_ID,
      prfSaltPrefix: PRF_PREFIX,
      serverOptions,
      prepareJson: (options) => ({ ...options, challenge: new Uint8Array(32).fill(7) }),
    });

    expect(prepared.challenge).toBeInstanceOf(Uint8Array);
    expect(prepared.extensions?.credProps).toBe(true);
    expect(prepared.extensions?.prf?.evalByCredential).toBeUndefined();
    expect(prepared.extensions?.prf?.eval?.second).toBeInstanceOf(ArrayBuffer);
    const expected = await buildPrfSaltBytes(PRF_PREFIX, USER_ID);
    expect(new Uint8Array(prepared.extensions?.prf?.eval?.first as ArrayBuffer)).toEqual(
      new Uint8Array(expected)
    );
    expect(serverOptions.extensions.prf.evalByCredential).toBeDefined();
    expect(serverOptions.challenge).toBe("base64url-challenge");
  });

  it("supports registration options without existing extensions", async () => {
    const prepared = await prepareVaultPasskeyPrfRegistrationOptions({
      userId: USER_ID,
      prfSaltPrefix: PRF_PREFIX,
      serverOptions: { challenge: new Uint8Array(32) },
    });
    expect(prepared.extensions?.prf?.eval?.first).toBeInstanceOf(ArrayBuffer);
  });

  it("preserves server JSON fields while adding a native PRF extension for browser libraries", async () => {
    const serverOptions = { challenge: "base64url-challenge" };
    const prepared = await prepareVaultPasskeyPrfRegistrationOptions({
      userId: USER_ID,
      prfSaltPrefix: PRF_PREFIX,
      serverOptions,
    });

    expect(prepared.challenge).toBe("base64url-challenge");
    expect(prepared.extensions?.prf?.eval?.first).toBeInstanceOf(ArrayBuffer);
    expect(serverOptions).not.toHaveProperty("extensions");
  });
});
