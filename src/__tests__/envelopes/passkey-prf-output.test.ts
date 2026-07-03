import { describe, expect, it } from "vitest";
import {
  bytesToBase64Url,
  extractPasskeyPrfOutput,
  prfBytesForAes256Import,
} from "../../index.js";

const CREDENTIAL_A = "cred-a-base64url";
const CREDENTIAL_B = "cred-b-base64url";

function makePrfBytes(seed: number): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_, index) => seed + index);
}

function bufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("extractPasskeyPrfOutput", () => {
  it("returns null for missing or short PRF material", () => {
    expect(extractPasskeyPrfOutput({})).toBeNull();
    expect(
      extractPasskeyPrfOutput({ prf: { results: { first: new ArrayBuffer(16) } } })
    ).toBeNull();
  });

  it("reads results.first from ArrayBuffer", () => {
    const bytes = makePrfBytes(0x10);
    const output = extractPasskeyPrfOutput({
      prf: { results: { first: bufferFromBytes(bytes) } },
    });
    expect(output).toEqual(bytes);
  });

  it("prefers evalByCredential for the matching credentialId on Safari-style payloads", () => {
    const wrong = makePrfBytes(0x01);
    const correct = makePrfBytes(0x40);

    const output = extractPasskeyPrfOutput(
      {
        prf: {
          results: { first: bufferFromBytes(wrong) },
          evalByCredential: {
            [CREDENTIAL_A]: { first: bufferFromBytes(correct) },
            [CREDENTIAL_B]: { first: bufferFromBytes(wrong) },
          },
        },
      },
      { credentialId: CREDENTIAL_A }
    );

    expect(output).toEqual(correct);
  });

  it("falls back to results.first when credential map entry is missing", () => {
    const fromResults = makePrfBytes(0x22);
    const output = extractPasskeyPrfOutput(
      {
        prf: {
          results: { first: bufferFromBytes(fromResults) },
          evalByCredential: {
            [CREDENTIAL_B]: { first: bufferFromBytes(makePrfBytes(0x33)) },
          },
        },
      },
      { credentialId: CREDENTIAL_A }
    );
    expect(output).toEqual(fromResults);
  });

  it("uses the first evalByCredential entry when results.first is absent", () => {
    const firstMapEntry = makePrfBytes(0x55);
    const output = extractPasskeyPrfOutput({
      prf: {
        evalByCredential: {
          [CREDENTIAL_A]: { first: bufferFromBytes(firstMapEntry) },
        },
      },
    });
    expect(output).toEqual(firstMapEntry);
  });

  it("coerces base64url strings and number arrays", () => {
    const bytes = makePrfBytes(0x70);
    const base64url = bytesToBase64Url(bytes);
    expect(
      extractPasskeyPrfOutput({ prf: { results: { first: base64url } } })
    ).toEqual(bytes);
    expect(
      extractPasskeyPrfOutput({ prf: { results: { first: Array.from(bytes) } } })
    ).toEqual(bytes);
  });

  it("coerces ArrayBufferView values", () => {
    const bytes = makePrfBytes(0x90);
    const view = new Uint8Array(bytes);
    expect(
      extractPasskeyPrfOutput({ prf: { results: { first: view } } })
    ).toEqual(bytes);
  });

  it("normalizes outputs longer than 32 bytes via prfBytesForAes256Import", () => {
    const long = new Uint8Array(48).fill(0xab);
    const output = extractPasskeyPrfOutput({
      prf: { results: { first: bufferFromBytes(long) } },
    });
    expect(output).toEqual(prfBytesForAes256Import(long));
    expect(output).toHaveLength(32);
  });
});
