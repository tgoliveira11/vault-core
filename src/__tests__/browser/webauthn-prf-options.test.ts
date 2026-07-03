import { describe, expect, it } from "vitest";
import { bytesToBase64Url } from "../../crypto/encoding.js";
import {
  alignPrfExtensionsForCredential,
  prepareWebAuthnPrfExtensions,
} from "../../browser/webauthn-prf-options.js";

const CREDENTIAL_ID = "cred-abc";
const SALT_BYTES = Uint8Array.from({ length: 32 }, (_, index) => index);

describe("prepareWebAuthnPrfExtensions", () => {
  it("converts base64url and number-array salts to ArrayBuffer", () => {
    const prepared = prepareWebAuthnPrfExtensions({
      prf: {
        eval: { first: bytesToBase64Url(SALT_BYTES) },
        evalByCredential: {
          [CREDENTIAL_ID]: { first: Array.from(SALT_BYTES) },
        },
      },
    });

    expect(prepared.prf?.eval?.first).toBeInstanceOf(ArrayBuffer);
    expect(prepared.prf?.evalByCredential?.[CREDENTIAL_ID]?.first).toBeInstanceOf(ArrayBuffer);
  });

  it("passes through existing ArrayBuffer and ArrayBufferView salts", () => {
    const buffer = SALT_BYTES.buffer.slice(0, 32);
    const prepared = prepareWebAuthnPrfExtensions({
      prf: {
        eval: { first: buffer, second: new Uint8Array(SALT_BYTES) },
      },
    });
    expect(prepared.prf?.eval?.first).toBeInstanceOf(ArrayBuffer);
    expect(prepared.prf?.eval?.second).toBeInstanceOf(ArrayBuffer);
  });

  it("returns options unchanged when prf is absent", () => {
    const extensions = { appid: "https://example.test" };
    expect(prepareWebAuthnPrfExtensions(extensions)).toEqual(extensions);
  });

  it("omits eval when salts cannot be coerced to ArrayBuffer", () => {
    const prepared = prepareWebAuthnPrfExtensions({
      prf: { eval: { first: "not!!!valid" } },
    });
    expect(prepared.prf?.eval).toBeUndefined();
  });

  it("skips eval entries without coercible salts", () => {
    const prepared = prepareWebAuthnPrfExtensions({
      prf: { eval: { second: true } },
    });
    expect(prepared.prf?.eval).toBeUndefined();
  });

  it("filters evalByCredential entries that cannot be coerced", () => {
    const prepared = prepareWebAuthnPrfExtensions({
      prf: {
        evalByCredential: {
          [CREDENTIAL_ID]: { second: true },
        },
      },
    });
    expect(prepared.prf?.evalByCredential).toBeUndefined();
  });
});

describe("alignPrfExtensionsForCredential", () => {
  it("moves evalByCredential to eval for a single allowCredential (iOS parity)", () => {
    const options = {
      allowCredentials: [{ id: CREDENTIAL_ID, type: "public-key" as const }],
      extensions: {
        prf: {
          evalByCredential: {
            [CREDENTIAL_ID]: { first: bytesToBase64Url(SALT_BYTES) },
          },
        },
      },
    };

    const aligned = alignPrfExtensionsForCredential(options, CREDENTIAL_ID);
    expect(aligned.extensions?.prf?.eval?.first).toBeInstanceOf(ArrayBuffer);
    expect(aligned.extensions?.prf?.evalByCredential).toBeUndefined();
  });

  it("leaves options unchanged when evalByCredential is absent", () => {
    const options = {
      extensions: { prf: { eval: { first: SALT_BYTES.buffer } } },
    };
    expect(alignPrfExtensionsForCredential(options)).toEqual(options);
  });

  it("infers credential id from a single allowCredentials entry", () => {
    const options = {
      allowCredentials: [{ id: CREDENTIAL_ID, type: "public-key" as const }],
      extensions: {
        prf: {
          evalByCredential: {
            [CREDENTIAL_ID]: { first: bytesToBase64Url(SALT_BYTES) },
          },
        },
      },
    };
    const aligned = alignPrfExtensionsForCredential(options);
    expect(aligned.extensions?.prf?.eval?.first).toBeInstanceOf(ArrayBuffer);
  });

  it("does not align when evalByCredential entry lacks first", () => {
    const options = {
      allowCredentials: [{ id: CREDENTIAL_ID, type: "public-key" as const }],
      extensions: {
        prf: {
          evalByCredential: {
            [CREDENTIAL_ID]: { second: true },
          },
        },
      },
    };
    expect(alignPrfExtensionsForCredential(options)).toEqual(options);
  });

  it("does not align when multiple credentials and no credentialId", () => {
    const options = {
      allowCredentials: [
        { id: "a", type: "public-key" as const },
        { id: "b", type: "public-key" as const },
      ],
      extensions: {
        prf: {
          evalByCredential: {
            a: { first: bytesToBase64Url(SALT_BYTES) },
          },
        },
      },
    };
    expect(alignPrfExtensionsForCredential(options).extensions?.prf?.evalByCredential).toBeDefined();
  });
});
