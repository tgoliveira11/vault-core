import { describe, expect, it } from "vitest";
import { base64UrlToBytes } from "../../crypto/encoding.js";
import {
  buildPasskeyPrfAuthenticationExtensionsJson,
  buildPrfSaltBytes,
} from "../../browser/prf-salt-bytes.js";

describe("passkey PRF salt serialization", () => {
  it("serializes the canonical user-scoped salt for server-composed authentication options", async () => {
    const prefix = "test-passkey-prf-v1:";
    const userId = "user-123";
    const expected = new Uint8Array(await buildPrfSaltBytes(prefix, userId));

    const extensions = await buildPasskeyPrfAuthenticationExtensionsJson(prefix, userId);

    expect(Object.keys(extensions)).toEqual(["prf"]);
    expect(Object.keys(extensions.prf)).toEqual(["eval"]);
    expect(base64UrlToBytes(extensions.prf.eval.first)).toEqual(expected);
    expect(JSON.parse(JSON.stringify(extensions))).toEqual(extensions);
  });
});
